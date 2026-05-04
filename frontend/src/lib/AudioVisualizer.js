/**
 * AudioVisualizer — 粒子流体云
 *
 * 噪声驱动 + 音频响应 + 拖尾轨迹
 * 看起来像"声音形成的流动物质"
 */

// ─── 紧凑 Simplex Noise（3D）────────────────────────────
class SimplexNoise {
  constructor() {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    this.perm = new Uint8Array(512);
    this.permMod = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod[i] = this.perm[i] % 12;
    }
    this.grad3 = [
      [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
      [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
      [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1],
    ];
  }

  noise3D(x, y, z) {
    const { perm, permMod, grad3 } = this;
    const F3 = 1 / 3, G3 = 1 / 6;
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
    const t = (i + j + k) * G3;
    const X0 = x - (i - t), Y0 = y - (j - t), Z0 = z - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (X0 >= Y0) {
      if (Y0 >= Z0) { i1=1;j1=0;k1=0;i2=1;j2=1;k2=0; }
      else if (X0 >= Z0) { i1=1;j1=0;k1=0;i2=1;j2=0;k2=1; }
      else { i1=0;j1=0;k1=1;i2=1;j2=0;k2=1; }
    } else {
      if (Y0 < Z0) { i1=0;j1=0;k1=1;i2=0;j2=1;k2=1; }
      else if (X0 < Z0) { i1=0;j1=1;k1=0;i2=0;j2=1;k2=1; }
      else { i1=0;j1=1;k1=0;i2=1;j2=1;k2=0; }
    }
    const x1=X0-i1+G3, y1=Y0-j1+G3, z1=Z0-k1+G3;
    const x2=X0-i2+2*G3, y2=Y0-j2+2*G3, z2=Z0-k2+2*G3;
    const x3=X0-1+3*G3, y3=Y0-1+3*G3, z3=Z0-1+3*G3;
    const ii=i&255, jj=j&255, kk=k&255;
    const dot = (g, x, y, z) => g[0]*x + g[1]*y + g[2]*z;
    let n0=0, n1=0, n2=0, n3=0;
    let t0 = 0.6 - X0*X0 - Y0*Y0 - Z0*Z0;
    if (t0 > 0) { t0*=t0; n0 = t0*t0 * dot(grad3[permMod[ii+perm[jj+perm[kk]]]], X0, Y0, Z0); }
    let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
    if (t1 > 0) { t1*=t1; n1 = t1*t1 * dot(grad3[permMod[ii+i1+perm[jj+j1+perm[kk+k1]]]], x1, y1, z1); }
    let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
    if (t2 > 0) { t2*=t2; n2 = t2*t2 * dot(grad3[permMod[ii+i2+perm[jj+j2+perm[kk+k2]]]], x2, y2, z2); }
    let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
    if (t3 > 0) { t3*=t3; n3 = t3*t3 * dot(grad3[permMod[ii+1+perm[jj+1+perm[kk+1]]]], x3, y3, z3); }
    return 32 * (n0 + n1 + n2 + n3);
  }
}

export default class AudioVisualizer {
  constructor(options) {
    this.container = options.container;
    this.width = options.width || 600;
    this.height = options.height || 600;
    this.fftSize = options.fftSize || 512;
    this.smoothingFactor = options.smoothingFactor ?? 0.82;
    this.baseRadius = options.baseRadius || 120;
    this.particleCount = options.particleCount || 1500;

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

    this.noise = new SimplexNoise();
    this.time = 0;
    this._prevBass = 0;
    this._particles = [];
    this._burstParticles = [];

    this._initCanvas();
    this._initParticles();
    this._initAudio();
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

    // 初始填充深色底（只画一次，之后用拖尾覆盖）
    this.ctx.fillStyle = 'rgba(8,8,16,1)';
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  // ─── 粒子初始化：从圆形分布 ────────────────────────────
  _initParticles() {
    const cx = this.width / 2;
    const cy = this.height / 2;
    this._particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = this.baseRadius + (Math.random() - 0.5) * this.baseRadius * 0.6;
      this._particles.push({
        baseX: cx + Math.cos(angle) * r,
        baseY: cy + Math.sin(angle) * r,
        x: 0, y: 0,
        size: 0.6 + Math.random() * 1.4,
        alpha: 0.15 + Math.random() * 0.35,
        hueShift: Math.random(), // 颜色微调
      });
    }
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

  play() { if (this.audioCtx.state === 'suspended') this.audioCtx.resume(); this.audio.play(); }
  pause() { this.audio.pause(); }
  start() { if (!this.rafId) this._draw(); }
  stop() { if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; } }

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

    const { ctx, analyser, smoothedData, width: W, height: H, noise } = this;
    const bufLen = analyser.frequencyBinCount;
    const raw = new Uint8Array(bufLen);
    analyser.getByteFrequencyData(raw);

    // 平滑
    const f = this.smoothingFactor;
    for (let i = 0; i < bufLen; i++) {
      smoothedData[i] = smoothedData[i] * f + raw[i] * (1 - f);
    }

    // 分频段
    const bands = new Float32Array(64);
    for (let b = 0; b < 64; b++) {
      const lo = Math.floor(Math.pow(b / 64, 2) * bufLen);
      const hi = Math.floor(Math.pow((b + 1) / 64, 2) * bufLen);
      let s = 0, c = 0;
      for (let j = lo; j < Math.min(hi, bufLen); j++) { s += smoothedData[j]; c++; }
      bands[b] = c > 0 ? s / c / 255 : 0;
    }

    // 音频指标
    let bass = 0; for (let i = 0; i < 5; i++) bass += bands[i]; bass /= 5;
    let mid = 0; for (let i = 10; i < 35; i++) mid += bands[i]; mid /= 25;
    let high = 0; for (let i = 40; i < 64; i++) high += bands[i]; high /= 24;

    const playing = !this.audio.paused;
    this.time += 0.008;

    // ── 拖尾（关键：不是 clearRect，而是半透明覆盖）──
    ctx.fillStyle = playing
      ? 'rgba(8,8,16,0.06)'
      : 'rgba(8,8,16,0.15)';
    ctx.fillRect(0, 0, W, H);

    const cx = W / 2;
    const cy = H / 2;

    // ── 噪声驱动参数 ──
    const noiseScale = 0.004 + mid * 0.003;
    const amplitude = 20 + bass * 80 + mid * 30;
    const jitter = high * 4;

    // ── 粒子更新 & 绘制 ──
    for (const p of this._particles) {
      // 3D 噪声：x, y, time → 连续流动
      const n = noise.noise3D(p.baseX * noiseScale, p.baseY * noiseScale, this.time);

      // 极角方向的噪声（让粒子沿切线流动）
      const angle = Math.atan2(p.baseY - cy, p.baseX - cx);
      const flowN = noise.noise3D(
        Math.cos(angle) * 0.5 + this.time * 0.3,
        Math.sin(angle) * 0.5,
        this.time * 0.5
      );

      // 位移 = 噪声 * 振幅 + 音频抖动
      const dx = n * amplitude + flowN * amplitude * 0.4;
      const dy = n * amplitude * 0.8 + flowN * amplitude * 0.5;

      // 高频抖动
      const jx = (Math.random() - 0.5) * jitter;
      const jy = (Math.random() - 0.5) * jitter;

      p.x = p.baseX + dx + jx;
      p.y = p.baseY + dy + jy;

      // 颜色：蓝 → 紫 → 粉，根据到中心的距离
      const dist = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
      const t = Math.min(dist / (this.baseRadius * 2), 1);
      const cr = Math.floor(60 + t * 170 + p.hueShift * 20);
      const cg = Math.floor(140 - t * 90 - bass * 30);
      const cb = Math.floor(255 - t * 100);

      // alpha 随音量增强
      const a = p.alpha * (0.6 + bass * 0.4 + mid * 0.2);

      // 绘制
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.8 + bass * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${a})`;
      ctx.shadowBlur = 2 + bass * 4;
      ctx.shadowColor = `rgba(${cr},${cg},${cb},${a * 0.5})`;
      ctx.fill();
    }

    // ── bass 触发爆发粒子 ──
    if (playing && bass > 0.5 && this._prevBass <= 0.5) {
      const count = 8 + Math.floor(bass * 15);
      for (let n = 0; n < count; n++) {
        if (this._burstParticles.length >= 200) break;
        const angle = Math.random() * Math.PI * 2;
        const r = this.baseRadius + (Math.random() - 0.5) * 40;
        const speed = 1 + Math.random() * 2.5;
        this._burstParticles.push({
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 1.2 + Math.random() * 2,
          alpha: 0.6 + Math.random() * 0.3,
          decay: 0.01 + Math.random() * 0.008,
          color: `${Math.floor(100 + Math.random() * 155)},${Math.floor(80 + Math.random() * 60)},255`,
        });
      }
    }
    this._prevBass = bass;

    // 更新爆发粒子
    for (let i = this._burstParticles.length - 1; i >= 0; i--) {
      const p = this._burstParticles[i];
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.98; p.vy *= 0.98;
      p.alpha -= p.decay; p.size *= 0.996;
      if (p.alpha <= 0) { this._burstParticles.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${p.alpha})`;
      ctx.shadowBlur = 6;
      ctx.shadowColor = `rgba(${p.color},${p.alpha * 0.6})`;
      ctx.fill();
    }

    ctx.shadowBlur = 0;
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
