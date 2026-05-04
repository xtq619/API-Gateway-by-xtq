/**
 * AudioVisualizer — 粒子能量环
 *
 * 无中心星球，透明背景，能量环 + 双粒子系统
 */
export default class AudioVisualizer {
  constructor(options) {
    this.container = options.container;
    this.width = options.width || 600;
    this.height = options.height || 600;
    this.fftSize = options.fftSize || 512;
    this.smoothingFactor = options.smoothingFactor ?? 0.82;
    this.baseRadius = options.baseRadius || 110;

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

    this.rotation = 0;
    this._prevBass = 0;
    this._ringParticles = [];
    this._burstParticles = [];

    this._initCanvas();
    this._initAudio();
  }

  // ─── Canvas ───────────────────────────────────────────
  _initCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.canvas.style.background = 'transparent';
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
    this.smoothedData = new Float32Array(this.analyser.frequencyBinCount);
  }

  // ─── API ──────────────────────────────────────────────

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
      const dest = this.audioCtx.createMediaStreamDestination();
      this.analyser.connect(dest);
      dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      this._audioDest = dest;
    } catch {}
    this.recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9' : 'video/webm',
    });
    this.recorder.ondataavailable = e => { if (e.data.size) this.recordedChunks.push(e.data); };
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

  // ─── 主循环 ───────────────────────────────────────────

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

    // 分频段（对数分区）
    const BANDS = 64;
    const bands = new Float32Array(BANDS);
    for (let b = 0; b < BANDS; b++) {
      const lo = Math.floor(Math.pow(b / BANDS, 2) * bufLen);
      const hi = Math.floor(Math.pow((b + 1) / BANDS, 2) * bufLen);
      let sum = 0, cnt = 0;
      for (let j = lo; j < Math.min(hi, bufLen); j++) { sum += smoothedData[j]; cnt++; }
      bands[b] = cnt > 0 ? sum / cnt / 255 : 0;
    }

    // 邻域平滑
    const SPREAD = 2;
    const smooth = new Float32Array(BANDS);
    for (let i = 0; i < BANDS; i++) {
      let s = 0;
      for (let j = -SPREAD; j <= SPREAD; j++) s += bands[(i + j + BANDS) % BANDS];
      smooth[i] = s / (SPREAD * 2 + 1);
    }

    // 音频指标
    let bass = 0; for (let i = 0; i < 5; i++) bass += smooth[i]; bass /= 5;
    let mid = 0; for (let i = 10; i < 35; i++) mid += smooth[i]; mid /= 25;
    let volume = 0; for (let i = 0; i < BANDS; i++) volume += smooth[i]; volume /= BANDS;

    // 旋转
    this.rotation += 0.0008;

    const cx = W / 2;
    const cy = H / 2;
    const playing = !this.audio.paused;

    // 清空（完全透明）
    ctx.clearRect(0, 0, W, H);

    // 中心能量空腔
    this._drawCore(ctx, cx, cy, volume, mid);

    // 能量环
    this._drawRing(ctx, cx, cy, smooth, BANDS, playing);

    // 更新 & 绘制粒子
    if (playing) {
      this._spawnRingParticles(smooth, BANDS, cx, cy);
      if (bass > 0.5 && this._prevBass <= 0.5) {
        this._spawnBurst(cx, cy, bass);
      }
    }
    this._prevBass = bass;
    this._updateAndDrawParticles(ctx, cx, cy);
  }

  // ─── 中心空腔 ─────────────────────────────────────────

  _drawCore(ctx, cx, cy, volume, mid) {
    const r = this.baseRadius * 0.85;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    const v = Math.min(volume, 1);
    glow.addColorStop(0, `rgba(60,80,200,${0.02 + v * 0.03})`);
    glow.addColorStop(0.4, `rgba(80,60,180,${0.03 + mid * 0.04})`);
    glow.addColorStop(0.7, `rgba(60,40,160,${0.02 + v * 0.02})`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ─── 能量环 ───────────────────────────────────────────

  _drawRing(ctx, cx, cy, bands, BANDS, playing) {
    if (!playing) return;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);

    const step = Math.PI * 2 / BANDS;
    const R = this.baseRadius;

    // 绘制弧段连接成环
    for (let i = 0; i < BANDS; i++) {
      const val = Math.pow(bands[i], 0.65);
      if (val < 0.01) continue;

      const t = i / BANDS;
      const angle = step * i - Math.PI / 2;
      const nextAngle = step * (i + 1) - Math.PI / 2;

      // 环半径随频谱波动
      const r1 = R + val * R * 0.6;
      const nextVal = Math.pow(bands[(i + 1) % BANDS], 0.65);
      const r2 = R + nextVal * R * 0.6;

      // 颜色：蓝 → 紫 → 粉
      const cr = Math.floor(50 + t * 180 + val * 30);
      const cg = Math.floor(130 - t * 70);
      const cb = Math.floor(255 - t * 110);
      const alpha = 0.35 + val * 0.65;

      const x1 = Math.cos(angle) * r1;
      const y1 = Math.sin(angle) * r1;
      const x2 = Math.cos(nextAngle) * r2;
      const y2 = Math.sin(nextAngle) * r2;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha})`;
      ctx.lineWidth = 2.5 + val * 3.5;
      ctx.lineCap = 'round';
      ctx.shadowBlur = 6 + val * 14;
      ctx.shadowColor = `rgba(${cr},${cg},${cb},${alpha * 0.7})`;
      ctx.stroke();
    }

    // 内侧微弱基准环
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(80,100,220,0.06)';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 4;
    ctx.shadowColor = 'rgba(80,100,220,0.1)';
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ─── 环形粒子（持续）──────────────────────────────────

  _spawnRingParticles(bands, BANDS, cx, cy) {
    const step = Math.PI * 2 / BANDS;

    for (let i = 0; i < BANDS; i += 2) {
      const val = bands[i];
      if (val < 0.1 || this._ringParticles.length >= 350) continue;
      if (Math.random() > val * 0.6) continue;

      const angle = step * i + (Math.random() - 0.5) * step;
      const r = this.baseRadius + Math.pow(val, 0.65) * this.baseRadius * 0.6;
      const t = i / BANDS;

      this._ringParticles.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: Math.cos(angle) * (0.2 + Math.random() * 0.3),
        vy: Math.sin(angle) * (0.2 + Math.random() * 0.3),
        // 切线方向漂移
        tx: -Math.sin(angle) * (0.15 + Math.random() * 0.2),
        ty: Math.cos(angle) * (0.15 + Math.random() * 0.2),
        size: 0.8 + val * 1.8,
        alpha: 0.4 + val * 0.5,
        decay: 0.005 + Math.random() * 0.004,
        color: this._getColor(t, val),
      });
    }
  }

  // ─── 外扩粒子（bass 触发）────────────────────────────

  _spawnBurst(cx, cy, bass) {
    const count = 12 + Math.floor(bass * 18);
    for (let n = 0; n < count; n++) {
      if (this._burstParticles.length >= 250) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3 + bass * 2;
      const t = Math.random();
      this._burstParticles.push({
        x: cx + Math.cos(angle) * this.baseRadius,
        y: cy + Math.sin(angle) * this.baseRadius,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 2.5,
        alpha: 0.7 + Math.random() * 0.3,
        decay: 0.012 + Math.random() * 0.008,
        color: this._getColor(t, bass),
      });
    }
  }

  // ─── 粒子更新 & 绘制 ──────────────────────────────────

  _updateAndDrawParticles(ctx, cx, cy) {
    // 环形粒子
    for (let i = this._ringParticles.length - 1; i >= 0; i--) {
      const p = this._ringParticles[i];
      p.x += p.vx + p.tx + (Math.random() - 0.5) * 0.2;
      p.y += p.vy + p.ty + (Math.random() - 0.5) * 0.2;
      p.alpha -= p.decay;
      p.size *= 0.998;
      if (p.alpha <= 0 || p.size < 0.2) { this._ringParticles.splice(i, 1); continue; }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${p.alpha})`;
      ctx.shadowBlur = 5;
      ctx.shadowColor = `rgba(${p.color},${p.alpha * 0.6})`;
      ctx.fill();
    }

    // 外扩粒子
    for (let i = this._burstParticles.length - 1; i >= 0; i--) {
      const p = this._burstParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.alpha -= p.decay;
      p.size *= 0.995;
      if (p.alpha <= 0 || p.size < 0.2) { this._burstParticles.splice(i, 1); continue; }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${p.alpha})`;
      ctx.shadowBlur = 8;
      ctx.shadowColor = `rgba(${p.color},${p.alpha * 0.7})`;
      ctx.fill();
    }

    ctx.shadowBlur = 0;
  }

  // ─── 颜色工具 ─────────────────────────────────────────

  _getColor(t, val) {
    const r = Math.floor(50 + t * 180 + val * 30);
    const g = Math.floor(130 - t * 70);
    const b = Math.floor(255 - t * 110);
    return `${r},${g},${b}`;
  }

  // ─── 销毁 ─────────────────────────────────────────────

  destroy() {
    this.stop();
    this.audio.pause();
    this.audio.src = '';
    if (this.source) { try { this.source.disconnect(); } catch {} }
    if (this.audioCtx.state !== 'closed') { try { this.audioCtx.close(); } catch {} }
    if (this.canvas?.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  }
}
