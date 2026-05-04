/**
 * AudioVisualizer — "Sound Planet" 音频可视化模块
 *
 * 分层渲染：背景 → 星球 → 光晕 → 频谱 → 冲击波
 * 所有动画由音频数据驱动
 *
 * 用法：
 *   const vis = new AudioVisualizer({ container, width, height })
 *   vis.loadFile(file);  vis.play();  vis.start();
 *   vis.startRecord();   vis.stopRecord().then(blob => ...)
 *   vis.destroy();
 */
export default class AudioVisualizer {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container
   * @param {number}      [options.width=600]
   * @param {number}      [options.height=600]
   * @param {number}      [options.fftSize=512]
   * @param {number}      [options.smoothingFactor=0.8]
   * @param {number}      [options.baseRadius=70]
   */
  constructor(options) {
    this.container = options.container;
    this.width = options.width || 600;
    this.height = options.height || 600;
    this.fftSize = options.fftSize || 512;
    this.smoothingFactor = options.smoothingFactor ?? 0.8;
    this.baseRadius = options.baseRadius || 70;

    // internals
    this.canvas = null;
    this.ctx = null;
    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.audio = null;
    this.rafId = null;
    this.smoothedData = null;
    this.recorder = null;
    this.recordedChunks = [];
    this.recording = false;

    // planet state
    this.rotation = 0;
    this._prevBass = 0;
    this._shockwaves = [];
    this._spectrumDrift = 0;

    // offscreen noise canvas for planet texture
    this._noiseCanvas = null;
    this._initNoise();

    this._initCanvas();
    this._initAudio();
  }

  // ─── 噪波纹理 ─────────────────────────────────────────
  _initNoise() {
    const size = 128;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const cx = c.getContext('2d');
    const img = cx.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 30; // very subtle
    }
    cx.putImageData(img, 0, 0);
    this._noiseCanvas = c;
  }

  // ─── Canvas ───────────────────────────────────────────
  _initCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);
  }

  // ─── Audio ────────────────────────────────────────────
  _initAudio() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = 0.8;
    this.analyser.connect(this.audioCtx.destination);

    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';

    const bufLen = this.analyser.frequencyBinCount;
    this.smoothedData = new Float32Array(bufLen);
  }

  // ─── 公开 API ─────────────────────────────────────────

  loadFile(file) {
    if (this.source) { this.source.disconnect(); this.source = null; }
    const url = file instanceof File ? URL.createObjectURL(file) : file;
    this.audio.src = url;
    this.audio.addEventListener('canplay', () => {
      if (!this.source) {
        this.source = this.audioCtx.createMediaElementSource(this.audio);
        this.source.connect(this.analyser);
      }
    }, { once: true });
  }

  play() {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    this.audio.play();
  }

  pause() { this.audio.pause(); }

  start() {
    if (this.rafId) return;
    this._draw();
  }

  stop() {
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
  }

  // ─── 录制 ─────────────────────────────────────────────

  startRecord() {
    if (this.recording) return;
    this.recordedChunks = [];
    const stream = this.canvas.captureStream(30);
    try {
      const audioDest = this.audioCtx.createMediaStreamDestination();
      this.analyser.connect(audioDest);
      audioDest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      this._audioDest = audioDest;
    } catch {}
    this.recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9' : 'video/webm',
    });
    this.recorder.ondataavailable = e => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };
    this.recorder.start(100);
    this.recording = true;
  }

  stopRecord() {
    return new Promise(resolve => {
      if (!this.recording) { resolve(null); return; }
      this.recording = false;
      this.recorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        if (this._audioDest) { try { this.analyser.disconnect(this._audioDest); } catch {} this._audioDest = null; }
        resolve(blob);
      };
      this.recorder.stop();
    });
  }

  getDownloadURL(blob) { return URL.createObjectURL(blob); }

  // ─── 主渲染循环 ───────────────────────────────────────

  _draw() {
    this.rafId = requestAnimationFrame(() => this._draw());

    const { ctx, analyser, smoothedData, width: W, height: H } = this;
    const bufLen = analyser.frequencyBinCount;
    const raw = new Uint8Array(bufLen);
    analyser.getByteFrequencyData(raw);

    // 平滑
    const f = this.smoothingFactor;
    for (let i = 0; i < bufLen; i++) {
      smoothedData[i] = smoothedData[i] * f + raw[i] * (1 - f);
    }

    // 分频段 — 使用对数分区，低频分辨率高
    const BANDS = 64;
    const bands = new Float32Array(BANDS);
    for (let b = 0; b < BANDS; b++) {
      // 对数映射：低频占更多 bin
      const lo = Math.floor(Math.pow(b / BANDS, 2) * bufLen);
      const hi = Math.floor(Math.pow((b + 1) / BANDS, 2) * bufLen);
      let sum = 0; let count = 0;
      for (let j = lo; j < Math.min(hi, bufLen); j++) { sum += smoothedData[j]; count++; }
      bands[b] = count > 0 ? sum / count / 255 : 0;
    }

    // bass / mid / treble / volume
    let bass = 0; for (let i = 0; i < 5; i++) bass += bands[i]; bass /= 5;
    let mid = 0; for (let i = 10; i < 35; i++) mid += bands[i]; mid /= 25;
    let treble = 0; for (let i = 40; i < BANDS; i++) treble += bands[i]; treble /= (BANDS - 40);
    let volume = 0; for (let i = 0; i < BANDS; i++) volume += bands[i]; volume /= BANDS;

    // 冲击波触发
    if (bass > 0.55 && this._prevBass <= 0.55) {
      this._shockwaves.push({ radius: this.baseRadius * 1.2, alpha: 0.7, speed: 3 + bass * 4 });
    }
    this._prevBass = bass;

    // 更新冲击波
    for (let i = this._shockwaves.length - 1; i >= 0; i--) {
      const sw = this._shockwaves[i];
      sw.radius += sw.speed;
      sw.alpha -= 0.012;
      if (sw.alpha <= 0) this._shockwaves.splice(i, 1);
    }

    // 缓慢旋转
    this.rotation += 0.0008;

    const cx = W / 2;
    const cy = H / 2;
    const planetR = this.baseRadius * (1 + bass * 0.35);

    // 清空
    ctx.clearRect(0, 0, W, H);

    // ── Layer 1: 背景 ──
    this._drawBackground(ctx, W, H, volume);

    // ── Layer 2: 星球 ──
    this._drawPlanet(ctx, cx, cy, planetR, bass);

    // ── Layer 3: 光晕 ──
    this._drawHalo(ctx, cx, cy, planetR, mid);

    // ── Layer 4: 频谱 ──
    this._drawSpectrum(ctx, cx, cy, planetR, bands, BANDS);

    // ── Layer 5: 冲击波 ──
    this._drawShockwaves(ctx, cx, cy);
  }

  // ─── Layer 1: 背景（透明，不遮挡页面）────────────────

  _drawBackground(ctx, W, H, volume) {
    // 完全透明 — 只画一个极淡的中心光晕，增强"浮在页面上"的感觉
    const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.4);
    const v = Math.min(volume, 1);
    glow.addColorStop(0, `rgba(60,80,180,${0.04 + v * 0.04})`);
    glow.addColorStop(0.5, `rgba(40,30,100,${0.02 + v * 0.02})`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }

  // ─── Layer 2: 星球（能量核心）────────────────────────

  _drawPlanet(ctx, cx, cy, r, bass) {
    ctx.save();

    // 最外层：柔和扩散光（替代黑色背景感）
    const outerGlow = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2.5);
    outerGlow.addColorStop(0, `rgba(80,100,255,${0.12 + bass * 0.1})`);
    outerGlow.addColorStop(0.4, `rgba(60,50,160,${0.06 + bass * 0.05})`);
    outerGlow.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = outerGlow;
    ctx.fill();

    // 球体渐变
    const grad = ctx.createRadialGradient(
      cx - r * 0.25, cy - r * 0.25, r * 0.05,
      cx, cy, r
    );
    grad.addColorStop(0, `rgba(160,190,255,${0.7 + bass * 0.25})`);
    grad.addColorStop(0.3, `rgba(100,100,240,${0.6 + bass * 0.2})`);
    grad.addColorStop(0.65, `rgba(60,40,150,${0.5 + bass * 0.15})`);
    grad.addColorStop(1, `rgba(30,20,80,${0.3 + bass * 0.1})`);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // 噪波纹理叠加
    if (this._noiseCanvas) {
      ctx.save();
      ctx.globalAlpha = 0.06 + bass * 0.04;
      ctx.globalCompositeOperation = 'screen';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(this._noiseCanvas, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
    }

    // 高光点
    const hlR = r * 0.4;
    const hl = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx - r * 0.3, cy - r * 0.3, hlR);
    hl.addColorStop(0, `rgba(220,235,255,${0.3 + bass * 0.15})`);
    hl.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.3, hlR, 0, Math.PI * 2);
    ctx.fillStyle = hl;
    ctx.fill();

    ctx.restore();
  }

  // ─── Layer 3: 光晕（能量过渡层）──────────────────────

  _drawHalo(ctx, cx, cy, planetR, mid) {
    const haloR = planetR * (1.5 + mid * 0.5);
    const grad = ctx.createRadialGradient(cx, cy, planetR * 0.8, cx, cy, haloR);
    grad.addColorStop(0, `rgba(100,120,255,${0.15 + mid * 0.1})`);
    grad.addColorStop(0.4, `rgba(130,70,220,${0.08 + mid * 0.06})`);
    grad.addColorStop(0.7, `rgba(80,40,160,${0.04})`);
    grad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // ─── Layer 4: 频谱 ────────────────────────────────────

  _drawSpectrum(ctx, cx, cy, planetR, bands, BANDS) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);

    // ① 动态漂移：每帧递增，低频/高频在圆周上缓慢流动
    this._spectrumDrift += 0.002;
    const driftOffset = this._spectrumDrift * BANDS;

    // ② 邻域平滑（spread=2，5 个邻居均值）
    const SPREAD = 2;
    const smoothed = new Float32Array(BANDS);
    for (let i = 0; i < BANDS; i++) {
      let sum = 0;
      for (let j = -SPREAD; j <= SPREAD; j++) {
        const idx = (i + j + BANDS) % BANDS;
        sum += bands[idx];
      }
      smoothed[i] = sum / (SPREAD * 2 + 1);
    }

    const step = Math.PI * 2 / BANDS;

    for (let i = 0; i < BANDS; i++) {
      // 应用动态偏移
      const si = Math.floor((i + driftOffset) % BANDS);
      const raw = smoothed[si];

      // ③ 强度压缩：pow(0.7) 避免某一块过高
      const val = Math.pow(raw, 0.7);
      if (val < 0.015) continue;

      const t = i / BANDS;
      const thickness = 4.5 - t * 3;
      const maxH = this.baseRadius * (0.7 + t * 1.6);
      const barH = val * maxH;

      const angle = step * i - Math.PI / 2;

      // 颜色沿角度渐变：蓝 → 紫 → 粉
      const r = Math.floor(60 + t * 170 + val * 30);
      const g = Math.floor(130 - t * 80);
      const b = Math.floor(255 - t * 120 + val * 20);
      const alpha = 0.4 + val * 0.6;

      const x1 = Math.cos(angle) * planetR;
      const y1 = Math.sin(angle) * planetR;
      const x2 = Math.cos(angle) * (planetR + barH);
      const y2 = Math.sin(angle) * (planetR + barH);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.lineWidth = thickness;
      ctx.lineCap = 'round';
      ctx.shadowBlur = 5 + val * 12;
      ctx.shadowColor = `rgb(${r},${g},${b})`;
      ctx.stroke();
    }

    ctx.restore();
  }

  // ─── Layer 5: 冲击波 ──────────────────────────────────

  _drawShockwaves(ctx, cx, cy) {
    for (const sw of this._shockwaves) {
      ctx.beginPath();
      ctx.arc(cx, cy, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(100,140,255,${sw.alpha})`;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 15;
      ctx.shadowColor = `rgba(80,120,255,${sw.alpha})`;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  // ─── 工具 ─────────────────────────────────────────────

  destroy() {
    this.stop();
    this.audio.pause();
    this.audio.src = '';
    if (this.source) { try { this.source.disconnect(); } catch {} }
    if (this.audioCtx.state !== 'closed') { try { this.audioCtx.close(); } catch {} }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}
