/**
 * AudioVisualizer - 圆形音频频谱可视化模块
 *
 * 用法：
 *   const vis = new AudioVisualizer({ container, width, height, colors, ... })
 *   vis.loadFile(file)
 *   vis.play()
 *   vis.startRecord()
 *   vis.stopRecord().then(blob => ...)
 *   vis.destroy()
 */
export default class AudioVisualizer {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container  - 挂载的 DOM 容器
   * @param {number}      [options.width=600]
   * @param {number}      [options.height=300]
   * @param {string[]}    [options.colors=["#ff00cc","#3333ff","#00ffff"]]
   * @param {number}      [options.fftSize=256]
   * @param {number}      [options.smoothingFactor=0.8]
   * @param {number}      [options.baseRadius=60]
   */
  constructor(options) {
    this.container = options.container;
    this.width = options.width || 600;
    this.height = options.height || 300;
    this.colors = options.colors || ['#ff00cc', '#3333ff', '#00ffff'];
    this.fftSize = options.fftSize || 256;
    this.smoothingFactor = options.smoothingFactor ?? 0.8;
    this.baseRadius = options.baseRadius || 60;

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

    this._initCanvas();
    this._initAudio();
  }

  // ─── Canvas ──────────────────────────────────────────────
  _initCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);
  }

  // ─── Audio ───────────────────────────────────────────────
  _initAudio() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = 0.8;
    this.analyser.connect(this.audioCtx.destination);

    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';

    // reset smoothed buffer
    const bufLen = this.analyser.frequencyBinCount;
    this.smoothedData = new Float32Array(bufLen);
  }

  // ─── 公开 API ────────────────────────────────────────────

  /** 加载音频文件 */
  loadFile(file) {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    const url = file instanceof File ? URL.createObjectURL(file) : file;
    this.audio.src = url;

    // 需要等 canplay 之后再 connect，否则某些浏览器会报错
    this.audio.addEventListener('canplay', () => {
      if (!this.source) {
        this.source = this.audioCtx.createMediaElementSource(this.audio);
        this.source.connect(this.analyser);
      }
    }, { once: true });
  }

  /** 播放 */
  play() {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    this.audio.play();
  }

  /** 暂停 */
  pause() {
    this.audio.pause();
  }

  /** 开始动画循环 */
  start() {
    if (this.rafId) return;
    this._draw();
  }

  /** 停止动画循环 */
  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  // ─── 录制 ────────────────────────────────────────────────

  /** 开始录制 canvas 为视频 */
  startRecord() {
    if (this.recording) return;
    this.recordedChunks = [];

    const stream = this.canvas.captureStream(30); // 30 fps
    // 如果有音频，也加入 stream
    try {
      const audioDest = this.audioCtx.createMediaStreamDestination();
      this.analyser.connect(audioDest);
      audioDest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      this._audioDest = audioDest;
    } catch { /* 某些浏览器不支持，忽略 */ }

    this.recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm',
    });
    this.recorder.ondataavailable = e => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };
    this.recorder.start(100);
    this.recording = true;
  }

  /** 停止录制，返回 Promise<Blob> */
  stopRecord() {
    return new Promise(resolve => {
      if (!this.recording) { resolve(null); return; }
      this.recording = false;
      this.recorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        // 断开 audioDest
        if (this._audioDest) {
          try { this.analyser.disconnect(this._audioDest); } catch {}
          this._audioDest = null;
        }
        resolve(blob);
      };
      this.recorder.stop();
    });
  }

  /** 获取下载用的临时 URL（在 stopRecord 之后调用） */
  getDownloadURL(blob) {
    return URL.createObjectURL(blob);
  }

  // ─── 渲染 ────────────────────────────────────────────────

  _draw() {
    this.rafId = requestAnimationFrame(() => this._draw());

    const { ctx, analyser, smoothedData, width: W, height: H } = this;
    const bufLen = analyser.frequencyBinCount;
    const raw = new Uint8Array(bufLen);
    analyser.getByteFrequencyData(raw);

    // 平滑插值
    const f = this.smoothingFactor;
    for (let i = 0; i < bufLen; i++) {
      smoothedData[i] = smoothedData[i] * f + raw[i] * (1 - f);
    }

    // 将频率数据分成 BAND_COUNT 个区间，每个区间取均值
    const BAND_COUNT = 64;
    const bands = new Float32Array(BAND_COUNT);
    const segSize = Math.floor(bufLen / BAND_COUNT);
    for (let b = 0; b < BAND_COUNT; b++) {
      let sum = 0;
      const start = b * segSize;
      const end = Math.min(start + segSize, bufLen);
      for (let j = start; j < end; j++) sum += smoothedData[j];
      bands[b] = sum / (end - start) / 255; // 归一化到 0~1
    }

    // 低频 bass 均值（前 4 个 band）
    let bass = 0;
    for (let i = 0; i < 4; i++) bass += bands[i];
    bass /= 4;

    // 呼吸半径
    const radius = this.baseRadius * (1 + bass * 0.5);

    // 清画布
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2;
    const cy = H / 2;

    // ── 内圈 glow ──
    ctx.save();
    ctx.shadowBlur = 20 + bass * 30;
    ctx.shadowColor = this.colors[0];
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.01)';
    ctx.fill();
    ctx.restore();

    // ── 频谱圆环 ──
    const step = Math.PI * 2 / BAND_COUNT;
    const maxBarH = this.baseRadius * 1.8;

    for (let i = 0; i < BAND_COUNT; i++) {
      // sqrt 压缩动态范围，让低频不再碾压高频
      const val = Math.sqrt(bands[i]);
      const barH = val * maxBarH;
      const angle = step * i - Math.PI / 2;

      // 颜色插值
      const ci = (i / BAND_COUNT) * (this.colors.length - 1);
      const ciFloor = Math.floor(ci);
      const ciFrac = ci - ciFloor;
      const c1 = this.colors[Math.min(ciFloor, this.colors.length - 1)];
      const c2 = this.colors[Math.min(ciFloor + 1, this.colors.length - 1)];
      const color = this._lerpColor(c1, c2, ciFrac);

      const x1 = cx + Math.cos(angle) * radius;
      const y1 = cy + Math.sin(angle) * radius;
      const x2 = cx + Math.cos(angle) * (radius + barH);
      const y2 = cy + Math.sin(angle) * (radius + barH);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, 4 - BAND_COUNT / 40);
      ctx.lineCap = 'round';
      ctx.shadowBlur = 6 + val * 12;
      ctx.shadowColor = color;
      ctx.stroke();
    }

    // ── 中心圆 ──
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, this._hexAlpha(this.colors[0], 0.15));
    grad.addColorStop(0.6, this._hexAlpha(this.colors[1], 0.08));
    grad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.shadowBlur = 0;
    ctx.fill();

    // ── 外圈微光 ──
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
    ctx.strokeStyle = this._hexAlpha(this.colors[2], 0.15 + bass / 800);
    ctx.lineWidth = 1;
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.colors[2];
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // ─── 工具 ────────────────────────────────────────────────

  /** 16 进制颜色插值 */
  _lerpColor(a, b, t) {
    const ah = this._hexToRgb(a);
    const bh = this._hexToRgb(b);
    const r = Math.round(ah.r + (bh.r - ah.r) * t);
    const g = Math.round(ah.g + (bh.g - ah.g) * t);
    const bl = Math.round(ah.b + (bh.b - ah.b) * t);
    return `rgb(${r},${g},${bl})`;
  }

  _hexToRgb(hex) {
    const h = hex.replace('#', '');
    return {
      r: parseInt(h.substring(0, 2), 16),
      g: parseInt(h.substring(2, 4), 16),
      b: parseInt(h.substring(4, 6), 16),
    };
  }

  _hexAlpha(hex, alpha) {
    const { r, g, b } = this._hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /** 销毁释放资源 */
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
