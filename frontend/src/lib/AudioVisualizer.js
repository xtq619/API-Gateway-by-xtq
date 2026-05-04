/**
 * AudioVisualizer — 3D 粒子云
 *
 * 球形分布 → 3D 旋转 → 透视投影 → 噪声形变 → 音频驱动
 * 离屏 canvas 拖尾 + 主 canvas 透明
 */

class SimplexNoise {
  constructor() {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    this.perm = new Uint8Array(512);
    this.pm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) { this.perm[i] = p[i & 255]; this.pm[i] = this.perm[i] % 12; }
    this.g3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
  }
  noise3D(x, y, z) {
    const { perm, pm, g3 } = this;
    const F3 = 1/3, G3 = 1/6;
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
    const t = (i + j + k) * G3;
    const X0 = x - (i - t), Y0 = y - (j - t), Z0 = z - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (X0 >= Y0) { if (Y0 >= Z0) { i1=1;j1=0;k1=0;i2=1;j2=1;k2=0; } else if (X0 >= Z0) { i1=1;j1=0;k1=0;i2=1;j2=0;k2=1; } else { i1=0;j1=0;k1=1;i2=1;j2=0;k2=1; } }
    else { if (Y0 < Z0) { i1=0;j1=0;k1=1;i2=0;j2=1;k2=1; } else if (X0 < Z0) { i1=0;j1=1;k1=0;i2=0;j2=1;k2=1; } else { i1=0;j1=1;k1=0;i2=1;j2=1;k2=0; } }
    const x1=X0-i1+G3, y1=Y0-j1+G3, z1=Z0-k1+G3;
    const x2=X0-i2+2*G3, y2=Y0-j2+2*G3, z2=Z0-k2+2*G3;
    const x3=X0-1+3*G3, y3=Y0-1+3*G3, z3=Z0-1+3*G3;
    const ii=i&255, jj=j&255, kk=k&255;
    const dot = (g, a, b, c) => g[0]*a + g[1]*b + g[2]*c;
    let n0=0,n1=0,n2=0,n3=0;
    let t0=0.6-X0*X0-Y0*Y0-Z0*Z0; if(t0>0){t0*=t0;n0=t0*t0*dot(g3[pm[ii+perm[jj+perm[kk]]]],X0,Y0,Z0)}
    let t1=0.6-x1*x1-y1*y1-z1*z1; if(t1>0){t1*=t1;n1=t1*t1*dot(g3[pm[ii+i1+perm[jj+j1+perm[kk+k1]]]],x1,y1,z1)}
    let t2=0.6-x2*x2-y2*y2-z2*z2; if(t2>0){t2*=t2;n2=t2*t2*dot(g3[pm[ii+i2+perm[jj+j2+perm[kk+k2]]]],x2,y2,z2)}
    let t3=0.6-x3*x3-y3*y3-z3*z3; if(t3>0){t3*=t3;n3=t3*t3*dot(g3[pm[ii+1+perm[jj+1+perm[kk+1]]]],x3,y3,z3)}
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
    this.radius = options.baseRadius || 130;
    this.particleCount = options.particleCount || 2000;

    this.canvas = null;
    this.ctx = null;
    this._trail = null;
    this._tctx = null;

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
    this._burst = [];

    // 3D 旋转角
    this._rotX = 0;
    this._rotY = 0;
    this._rotZ = 0;

    this._initCanvas();
    this._initParticles();
    this._initAudio();
  }

  _initCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.canvas.style.background = 'transparent';
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    this._trail = document.createElement('canvas');
    this._trail.width = this.width;
    this._trail.height = this.height;
    this._tctx = this._trail.getContext('2d');
  }

  _initParticles() {
    this._particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      // 球形分布（Fibonacci sphere）
      const phi = Math.acos(1 - 2 * (i + 0.5) / this.particleCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = this.radius * (0.3 + Math.random() * 0.7); // 球壳厚度

      this._particles.push({
        bx: Math.sin(phi) * Math.cos(theta) * r,
        by: Math.sin(phi) * Math.sin(theta) * r,
        bz: Math.cos(phi) * r,
        x: 0, y: 0, z: 0,
        size: 0.6 + Math.random() * 1.2,
        baseAlpha: 0.15 + Math.random() * 0.35,
      });
    }
  }

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

  loadFile(file) {
    if (this.source) { this.source.disconnect(); this.source = null; }
    const url = file instanceof File ? URL.createObjectURL(file) : file;
    this.audio.src = url;
    this.audio.addEventListener('canplay', () => {
      if (!this.source) { this.source = this.audioCtx.createMediaElementSource(this.audio); this.source.connect(this.analyser); }
    }, { once: true });
  }

  play() { if (this.audioCtx.state === 'suspended') this.audioCtx.resume(); this.audio.play(); }
  pause() { this.audio.pause(); }
  start() { if (!this.rafId) this._draw(); }
  stop() { if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; } }

  startRecord() {
    if (this.recording) return;
    this.recordedChunks = [];
    const stream = this.canvas.captureStream(30);
    try { const d = this.audioCtx.createMediaStreamDestination(); this.analyser.connect(d); d.stream.getAudioTracks().forEach(t => stream.addTrack(t)); this._audioDest = d; } catch {}
    this.recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm' });
    this.recorder.ondataavailable = e => { if (e.data.size) this.recordedChunks.push(e.data); };
    this.recorder.start(100); this.recording = true;
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

  // ─── 3D 旋转 ──────────────────────────────────────────

  _rotate3D(x, y, z, ax, ay, az) {
    // X 轴旋转
    let y1 = y * Math.cos(ax) - z * Math.sin(ax);
    let z1 = y * Math.sin(ax) + z * Math.cos(ax);
    // Y 轴旋转
    let x2 = x * Math.cos(ay) + z1 * Math.sin(ay);
    let z2 = -x * Math.sin(ay) + z1 * Math.cos(ay);
    // Z 轴旋转
    let x3 = x2 * Math.cos(az) - y1 * Math.sin(az);
    let y3 = x2 * Math.sin(az) + y1 * Math.cos(az);
    return { x: x3, y: y3, z: z2 };
  }

  // ─── 主循环 ───────────────────────────────────────────

  _draw() {
    this.rafId = requestAnimationFrame(() => this._draw());

    const { ctx, _tctx: tctx, _trail: trail, analyser, smoothedData, noise } = this;
    const W = this.width, H = this.height;
    const cx = W / 2, cy = H / 2;
    const bufLen = analyser.frequencyBinCount;
    const raw = new Uint8Array(bufLen);
    analyser.getByteFrequencyData(raw);

    const f = this.smoothingFactor;
    for (let i = 0; i < bufLen; i++) smoothedData[i] = smoothedData[i] * f + raw[i] * (1 - f);

    const bands = new Float32Array(64);
    for (let b = 0; b < 64; b++) {
      const lo = Math.floor(Math.pow(b / 64, 2) * bufLen);
      const hi = Math.floor(Math.pow((b + 1) / 64, 2) * bufLen);
      let s = 0, c = 0;
      for (let j = lo; j < Math.min(hi, bufLen); j++) { s += smoothedData[j]; c++; }
      bands[b] = c > 0 ? s / c / 255 : 0;
    }

    let bass = 0; for (let i = 0; i < 5; i++) bass += bands[i]; bass /= 5;
    let mid = 0; for (let i = 10; i < 35; i++) mid += bands[i]; mid /= 25;
    let high = 0; for (let i = 40; i < 64; i++) high += bands[i]; high /= 24;

    const playing = !this.audio.paused;
    this.time += 0.006;

    // 3D 旋转速度
    this._rotY += 0.004 + bass * 0.003;
    this._rotX += 0.002 + mid * 0.001;
    this._rotZ += 0.001;

    // 拖尾
    tctx.fillStyle = playing ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.1)';
    tctx.fillRect(0, 0, W, H);

    const noiseScale = 0.006 + mid * 0.004;
    const amp = 15 + bass * 50 + mid * 20;
    const fov = 400; // 透视距离

    // 3D 变换 + 透视投影
    const projected = [];
    for (const p of this._particles) {
      // 噪声形变
      const n = noise.noise3D(p.bx * noiseScale, p.by * noiseScale, p.bz * noiseScale + this.time);
      const n2 = noise.noise3D(p.bx * noiseScale * 2 + 10, p.by * noiseScale * 2, this.time * 1.5);

      const ox = p.bx + n * amp + n2 * amp * 0.3;
      const oy = p.by + n * amp * 0.7 + n2 * amp * 0.4;
      const oz = p.bz + n * amp * 0.5;

      // 3D 旋转
      const r = this._rotate3D(ox, oy, oz, this._rotX, this._rotY, this._rotZ);

      // 透视投影
      const scale = fov / (fov + r.z);
      const sx = cx + r.x * scale;
      const sy = cy + r.y * scale;

      projected.push({ sx, sy, z: r.z, scale, size: p.size, alpha: p.baseAlpha });
    }

    // 按 z 排序（远的先画）
    projected.sort((a, b) => b.z - a.z);

    // 绘制
    for (const p of projected) {
      // 深度映射：远处暗小，近处亮大
      const depthT = (p.z + this.radius) / (this.radius * 2); // 0=最近 1=最远
      const clamped = Math.max(0, Math.min(1, depthT));

      const sz = p.size * p.scale * (1.8 - clamped * 0.8) * (0.8 + bass * 0.4);
      if (sz < 0.2) continue;

      // 颜色：根据位置和深度
      const hue = clamped * 0.6 + this.time * 0.05;
      const cr = Math.floor(60 + (1 - clamped) * 160 + Math.sin(hue * 6) * 30);
      const cg = Math.floor(100 + (1 - clamped) * 60 - bass * 40);
      const cb = Math.floor(200 + (1 - clamped) * 55);

      const a = p.alpha * (1.2 - clamped * 0.7) * (0.7 + bass * 0.3);
      if (a < 0.02) continue;

      tctx.beginPath();
      tctx.arc(p.sx, p.sy, sz, 0, Math.PI * 2);
      tctx.fillStyle = `rgba(${cr},${cg},${cb},${a})`;

      // 近处粒子发光
      if (clamped < 0.4) {
        tctx.shadowBlur = 3 + (1 - clamped) * 6;
        tctx.shadowColor = `rgba(${cr},${cg},${cb},${a * 0.4})`;
      } else {
        tctx.shadowBlur = 0;
      }
      tctx.fill();
    }

    // bass 爆发
    if (playing && bass > 0.5 && this._prevBass <= 0.5) {
      for (let n = 0; n < 8 + Math.floor(bass * 12); n++) {
        if (this._burst.length >= 150) break;
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.random() * Math.PI;
        const r = this.radius * (0.8 + Math.random() * 0.4);
        const spd = 0.8 + Math.random() * 2;
        const dx = Math.sin(theta) * Math.cos(phi);
        const dy = Math.sin(theta) * Math.sin(phi);
        const dz = Math.cos(theta);
        this._burst.push({
          x: dx * r, y: dy * r, z: dz * r,
          vx: dx * spd, vy: dy * spd, vz: dz * spd,
          size: 1.5 + Math.random() * 2,
          alpha: 0.7, decay: 0.012,
          color: `${Math.floor(120 + Math.random() * 135)},${Math.floor(80 + Math.random() * 80)},255`,
        });
      }
    }
    this._prevBass = bass;

    for (let i = this._burst.length - 1; i >= 0; i--) {
      const p = this._burst[i];
      p.x += p.vx; p.y += p.vy; p.z += p.vz;
      p.vx *= 0.97; p.vy *= 0.97; p.vz *= 0.97;
      p.alpha -= p.decay; p.size *= 0.995;
      if (p.alpha <= 0) { this._burst.splice(i, 1); continue; }

      const r = this._rotate3D(p.x, p.y, p.z, this._rotX, this._rotY, this._rotZ);
      const scale = fov / (fov + r.z);
      const sx = cx + r.x * scale;
      const sy = cy + r.y * scale;

      tctx.beginPath();
      tctx.arc(sx, sy, p.size * scale, 0, Math.PI * 2);
      tctx.fillStyle = `rgba(${p.color},${p.alpha})`;
      tctx.shadowBlur = 8;
      tctx.shadowColor = `rgba(${p.color},${p.alpha * 0.5})`;
      tctx.fill();
    }

    tctx.shadowBlur = 0;

    // 主 canvas：透明
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(trail, 0, 0);
  }

  destroy() {
    this.stop();
    this.audio.pause();
    this.audio.src = '';
    if (this.source) { try { this.source.disconnect(); } catch {} }
    if (this.audioCtx.state !== 'closed') { try { this.audioCtx.close(); } catch {} }
    if (this.canvas?.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  }
}
