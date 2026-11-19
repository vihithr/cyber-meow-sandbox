/**
 * CyberMeow - 纯原生 Web Audio 声音合成引擎
 * 零外部音频文件依赖，所有猫叫、呼噜、环境音均由振荡器与噪声发生器实时合成
 */
(function(window) {
  'use strict';

  // Web Audio 不可用时的空实现：保持完整 API 形状，让所有播放方法安全降级为静音，
  // 避免 new undefined() 或后续链式调用抛错中断 UI 与主循环
  const SILENT_SAMPLES = new Float32Array(0);
  function createSilentContext() {
    const noop = () => {};
    const param = () => ({
      value: 0,
      setValueAtTime: noop,
      linearRampToValueAtTime: noop,
      exponentialRampToValueAtTime: noop,
      cancelScheduledValues: noop
    });
    const node = () => ({ connect: noop, disconnect: noop, start: noop, stop: noop });
    return {
      state: 'running',
      currentTime: 0,
      sampleRate: 44100,
      destination: node(),
      resume: () => Promise.resolve(),
      suspend: () => Promise.resolve(),
      close: () => Promise.resolve(),
      createGain: () => Object.assign(node(), { gain: param() }),
      createOscillator: () => Object.assign(node(), { frequency: param(), type: 'sine' }),
      createBiquadFilter: () => Object.assign(node(), { frequency: param(), Q: param(), type: 'lowpass' }),
      createBufferSource: () => Object.assign(node(), { buffer: null, loop: false }),
      createBuffer: () => ({ getChannelData: () => SILENT_SAMPLES })
    };
  }

  class SoundEngine {
    // 一次性音源结束后断开整条音频链，避免节点在 AudioContext 图中累积
    _releaseOnEnded(source, ...nodes) {
      source.onended = () => {
        try {
          source.disconnect();
          for (const node of nodes) {
            if (node) node.disconnect();
          }
        } catch (e) {}
      };
    }

    // 停止并断开持续声源节点（供 dispose 使用；GainNode 无 stop，由 try 吞掉）
    _stopAndRelease(node) {
      if (!node) return;
      try { node.stop(); } catch (e) {}
      try { node.disconnect(); } catch (e) {}
    }

    constructor() {
      this.ctx = null;
      this.unavailable = false;
      this.masterGain = null;
      this.sfxGain = null;
      this.bgmGain = null;
      this.isMuted = false;
      this.bgmEnabled = false;

      // 呼噜声节点
      this.purrSource = null;
      this.purrGain = null;
      this.purrFilter = null;
      this.purrLfo = null;
      this.purrLfoGain = null;
      this.purrActiveCount = 0;
      this.purrStopTimer = null;

      // 扫地机嗡嗡声节点
      this.roombaOsc = null;
      this.roombaGain = null;
      this.roombaFilter = null;
      this.roombaStopTimer = null;

      // Lofi 音乐定时器
      this.lofiTimer = null;
      this.lofiStep = 0;

      // 页面可见性 / 生命周期状态
      this._visibilityBound = false;
      this._visibilityHandler = null;
      this._pausedByVisibility = false;
      this._purrActiveBeforeHide = false;
      this._roombaActiveBeforeHide = false;
      this._disposed = false;

      this._bindVisibility();
    }

    // --- 页面可见性与资源生命周期 ---
    // 监听注册带防御：无 document / 无 addEventListener 的测试环境直接跳过
    _bindVisibility() {
      if (this._visibilityBound) return;
      if (typeof document === 'undefined' || !document.addEventListener) return;
      try {
        this._visibilityHandler = () => {
          if (typeof document === 'undefined') return;
          const hidden = document.hidden || document.visibilityState === 'hidden';
          if (hidden) this._onHidden();
          else this._onVisible();
        };
        document.addEventListener('visibilitychange', this._visibilityHandler);
        this._visibilityBound = true;
      } catch (e) {}
    }

    _onHidden() {
      if (this._disposed || this._pausedByVisibility) return;
      this._pausedByVisibility = true;
      // 先记录持续声源是否活跃（stopPurr/stopRoomba 会清引用），回到页面时据此恢复
      this._purrActiveBeforeHide = !!(this.purrSource && this.purrActiveCount > 0);
      this._roombaActiveBeforeHide = !!this.roombaOsc;
      // 挂起音频上下文
      if (this.ctx && this.ctx.state === 'running') {
        try {
          const p = this.ctx.suspend();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch (e) {}
      }
      // 停掉 Lofi 定时器，避免 suspended 期间继续 schedule 节点；保留 bgmEnabled 用户意图
      if (this.lofiTimer) {
        clearInterval(this.lofiTimer);
        this.lofiTimer = null;
      }
      // 停止持续声源
      if (this.purrSource) this.stopPurr();
      if (this.roombaOsc) this.stopRoomba();
    }

    _onVisible() {
      if (this._disposed || !this._pausedByVisibility) return;
      this._pausedByVisibility = false;
      // 恢复音频上下文
      if (this.ctx && this.ctx.state === 'suspended') {
        try {
          const p = this.ctx.resume();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch (e) {}
      }
      // 恢复用户此前开启的 Lofi
      if (this.bgmEnabled && !this.lofiTimer) this.startLofiBGM();
      // 恢复隐藏前活跃的持续声源
      if (this._purrActiveBeforeHide) {
        this._purrActiveBeforeHide = false;
        this.startPurr();
      }
      if (this._roombaActiveBeforeHide) {
        this._roombaActiveBeforeHide = false;
        this.startRoomba();
      }
    }

    // 释放全部资源：移除监听、清理定时器、停止并断开节点、关闭音频上下文
    dispose() {
      if (this._disposed) return;
      this._disposed = true;

      if (this._visibilityBound && typeof document !== 'undefined' && document.removeEventListener && this._visibilityHandler) {
        try { document.removeEventListener('visibilitychange', this._visibilityHandler); } catch (e) {}
      }
      this._visibilityHandler = null;
      this._visibilityBound = false;

      if (this.lofiTimer) { clearInterval(this.lofiTimer); this.lofiTimer = null; }
      if (this.purrStopTimer) { clearTimeout(this.purrStopTimer); this.purrStopTimer = null; }
      if (this.roombaStopTimer) { clearTimeout(this.roombaStopTimer); this.roombaStopTimer = null; }

      this._stopAndRelease(this.purrSource);
      this._stopAndRelease(this.purrLfo);
      this._stopAndRelease(this.purrLfoGain);
      this._stopAndRelease(this.purrFilter);
      this._stopAndRelease(this.purrGain);
      this._stopAndRelease(this.roombaOsc);
      this._stopAndRelease(this.roombaFilter);
      this._stopAndRelease(this.roombaGain);
      this.purrSource = null;
      this.purrLfo = null;
      this.purrLfoGain = null;
      this.purrFilter = null;
      this.purrGain = null;
      this.roombaOsc = null;
      this.roombaFilter = null;
      this.roombaGain = null;
      this.purrActiveCount = 0;
      this.bgmEnabled = false;
      this._pausedByVisibility = false;
      this._purrActiveBeforeHide = false;
      this._roombaActiveBeforeHide = false;

      if (this.ctx && !this.unavailable) {
        try {
          const p = this.ctx.close();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch (e) {}
      }
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (typeof AudioCtx === 'function') {
          try {
            this.ctx = new AudioCtx();
          } catch (e) {
            this.ctx = createSilentContext();
            this.unavailable = true;
          }
        } else {
          this.ctx = createSilentContext();
          this.unavailable = true;
        }

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.8;
        this.masterGain.connect(this.ctx.destination);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.9;
        this.sfxGain.connect(this.masterGain);

        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = 0.25;
        this.bgmGain.connect(this.masterGain);
      }
      if (this.ctx.state === 'suspended') {
        try {
          const resumePromise = this.ctx.resume();
          if (resumePromise && typeof resumePromise.catch === 'function') resumePromise.catch(() => {});
        } catch (e) {}
      }
    }

    setMuted(muted) {
      this.isMuted = muted;
      if (this.masterGain) {
        this.masterGain.gain.setValueAtTime(muted ? 0 : 0.8, this.ctx.currentTime);
      }
    }

    // --- 猫咪叫声合成器 (多种情绪模式) ---
    playMeow(pitchMod = 1.0, mood = 'regular') {
      if (this.isMuted || this._disposed) return;
      this.init();
      const now = this.ctx.currentTime;

      if (mood === 'chatter') {
        // 发现红点时的“咔咔”急促颤音
        for (let i = 0; i < 4; i++) {
          const t = now + i * 0.055;
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime((850 + Math.random() * 120) * pitchMod, t);
          g.gain.setValueAtTime(0.001, t);
          g.gain.linearRampToValueAtTime(0.12, t + 0.015);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
          osc.connect(g);
          g.connect(this.sfxGain);
          osc.start(t);
          osc.stop(t + 0.05);
          this._releaseOnEnded(osc, g);
        }
        return;
      }

      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = mood === 'chirp' ? 'sine' : 'sawtooth';
      filter.type = 'bandpass';
      filter.Q.value = mood === 'chirp' ? 2.5 : 4.0;

      let baseFreq = (480 + (Math.random() - 0.5) * 60) * pitchMod;
      if (mood === 'kitten') baseFreq *= 1.45;
      if (mood === 'pleading') baseFreq *= 1.15;

      const duration = mood === 'chirp' ? 0.18 : (mood === 'pleading' ? 0.55 : 0.38);

      if (mood === 'chirp') {
        // 欢快短促的啁啾声
        osc.frequency.setValueAtTime(baseFreq * 0.9, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.6, now + duration * 0.4);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.1, now + duration);

        filter.frequency.setValueAtTime(1000 * pitchMod, now);
        filter.frequency.exponentialRampToValueAtTime(1800 * pitchMod, now + duration * 0.4);
      } else if (mood === 'pleading') {
        // 撒娇拉长叫
        osc.frequency.setValueAtTime(baseFreq * 0.8, now);
        osc.frequency.linearRampToValueAtTime(baseFreq * 1.5, now + 0.18);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.85, now + duration);

        filter.frequency.setValueAtTime(700 * pitchMod, now);
        filter.frequency.exponentialRampToValueAtTime(1600 * pitchMod, now + 0.18);
        filter.frequency.exponentialRampToValueAtTime(650 * pitchMod, now + duration);
      } else {
        // 标准 Meow 弯音
        osc.frequency.setValueAtTime(baseFreq * 0.88, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.38, now + 0.12);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.72, now + duration);

        filter.frequency.setValueAtTime(800 * pitchMod, now);
        filter.frequency.exponentialRampToValueAtTime(1450 * pitchMod, now + 0.12);
        filter.frequency.exponentialRampToValueAtTime(500 * pitchMod, now + duration);
      }

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + duration + 0.02);
      this._releaseOnEnded(osc, filter, gain);
    }

    // --- 真实呼噜声引擎 (25Hz 低频震颤 + 粉红噪声) ---
    startPurr() {
      if (this.isMuted || this._disposed) return;
      this.init();
      if (this.purrSource) {
        // 梳毛/挠下巴会高频调用：声源已存在时只取消待执行的停止并恢复音量
        clearTimeout(this.purrStopTimer);
        if (this.purrGain && this.ctx) {
          const gain = this.purrGain.gain;
          gain.cancelScheduledValues(this.ctx.currentTime);
          gain.setValueAtTime(Math.max(0.01, gain.value), this.ctx.currentTime);
          gain.linearRampToValueAtTime(0.28, this.ctx.currentTime + 0.2);
        }
        return;
      }
      this.purrActiveCount = 1;

      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // 生成粉红噪声模拟喉音气流
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
        b6 = white * 0.115926;
      }

      this.purrSource = this.ctx.createBufferSource();
      this.purrSource.buffer = buffer;
      this.purrSource.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 160;

      // 25Hz 低频调制器模拟猫咪声带振颤
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 24; // 经典猫呼噜频率 20-30Hz
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 0.8;
      this.purrLfoGain = lfoGain;

      this.purrGain = this.ctx.createGain();
      this.purrGain.gain.setValueAtTime(0.01, this.ctx.currentTime);
      this.purrGain.gain.linearRampToValueAtTime(0.28, this.ctx.currentTime + 0.5);

      lfo.connect(lfoGain);
      lfoGain.connect(this.purrGain.gain);

      this.purrFilter = filter;
      this.purrSource.connect(filter);
      filter.connect(this.purrGain);
      this.purrGain.connect(this.sfxGain);

      this.purrSource.start();
      lfo.start();
      this.purrLfo = lfo;
    }

    stopPurr() {
      this.purrActiveCount = 0;
      if (!this.purrSource || !this.purrGain || !this.ctx) return;
      clearTimeout(this.purrStopTimer);
      const gain = this.purrGain.gain;
      gain.cancelScheduledValues(this.ctx.currentTime);
      gain.setValueAtTime(Math.max(0.001, gain.value), this.ctx.currentTime);
      gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

      // 捕获本次声源引用：延迟回调只处理它，避免与 320ms 内重启的新声源竞态
      const source = this.purrSource;
      const lfo = this.purrLfo;
      const lfoGain = this.purrLfoGain;
      const filter = this.purrFilter;
      const purrGain = this.purrGain;
      this.purrStopTimer = setTimeout(() => {
        try {
          source.stop();
          if (lfo) lfo.stop();
          source.disconnect();
          if (lfo) lfo.disconnect();
          if (lfoGain) lfoGain.disconnect();
          if (filter) filter.disconnect();
          purrGain.disconnect();
        } catch (e) {}
        if (this.purrSource === source) {
          this.purrSource = null;
          this.purrLfo = null;
          this.purrLfoGain = null;
          this.purrFilter = null;
          this.purrGain = null;
        }
      }, 320);
    }

    // --- 吃鱼干咀嚼声 ---
    playCrunch() {
      if (this.isMuted || this._disposed) return;
      this.init();
      const now = this.ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        const t = now + i * 0.05;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(380 + Math.random() * 220, t);
        osc.frequency.exponentialRampToValueAtTime(140, t + 0.04);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.045);
        this._releaseOnEnded(osc, gain);
      }
    }

    // --- 抓板磨爪声 ---
    playScratch() {
      if (this.isMuted || this._disposed) return;
      this.init();
      const now = this.ctx.currentTime;
      const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.08), this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1800 + Math.random() * 600;
      filter.Q.value = 2.0;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      noise.start(now);
      this._releaseOnEnded(noise, filter, gain);
    }

    // --- 猫咪哈气警告 (Hissing) ---
    playHiss() {
      if (this.isMuted || this._disposed) return;
      this.init();
      const now = this.ctx.currentTime;
      const dur = 0.35;
      const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length * 0.6);
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(3200, now);
      filter.frequency.exponentialRampToValueAtTime(1800, now + dur);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      noise.start(now);
      this._releaseOnEnded(noise, filter, gain);
    }

    // --- 喵喵拳互拍 (Cat Slap) ---
    playSlap() {
      if (this.isMuted || this._disposed) return;
      this.init();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);

      gain.gain.setValueAtTime(0.26, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.1);
      this._releaseOnEnded(osc, gain);
    }

    // --- 观鸟捕食快速齿颤声 (Chattering) ---
    playChatter(pitchMod = 1.0) {
      if (this.isMuted || this._disposed) return;
      this.init();
      const now = this.ctx.currentTime;
      const clicks = 5 + Math.floor(Math.random() * 4);
      for (let i = 0; i < clicks; i++) {
        const t = now + i * 0.045;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime((900 + Math.random() * 200) * pitchMod, t);
        osc.frequency.exponentialRampToValueAtTime(350 * pitchMod, t + 0.03);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.15, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.038);
        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.04);
        this._releaseOnEnded(osc, g);
      }
    }

    // --- 窗外小鸟啁啾声 (Bird Tweet) ---
    playBirdTweet() {
      if (this.isMuted || this._disposed) return;
      this.init();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2400, now);
      osc.frequency.exponentialRampToValueAtTime(3800, now + 0.07);
      osc.frequency.exponentialRampToValueAtTime(2600, now + 0.16);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.2);
      this._releaseOnEnded(osc, gain);
    }

    // --- 猫咪领地争夺低吼 (Low Territorial Growl) ---
    playLowGrowl(pitchMod = 1.0) {
      if (this.isMuted || this._disposed) return;
      this.init();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140 * pitchMod, now);
      osc.frequency.linearRampToValueAtTime(110 * pitchMod, now + 0.4);
      osc.frequency.linearRampToValueAtTime(125 * pitchMod, now + 0.8);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, now);
      filter.Q.value = 3.5;

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.9);
      this._releaseOnEnded(osc, filter, gain);
    }

    // --- 水花飞溅 / 湿爪甩动 (Water Splash) ---
    playWaterSplash() {
      if (this.isMuted || this._disposed) return;
      this.init();
      const now = this.ctx.currentTime;
      const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.12), this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.3));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1600, now);
      filter.frequency.exponentialRampToValueAtTime(900, now + 0.1);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      noise.start(now);
      this._releaseOnEnded(noise, filter, gain);
    }

    // --- 扫地机器人马达嗡嗡声 ---
    startRoomba() {
      if (this.isMuted || this._disposed || this.roombaOsc) return;
      this.init();
      // 若上一次停止的淡出尚未结束，取消其清理定时器，让新声源正常起振
      clearTimeout(this.roombaStopTimer);
      const now = this.ctx.currentTime;
      this.roombaOsc = this.ctx.createOscillator();
      this.roombaGain = this.ctx.createGain();

      this.roombaOsc.type = 'sawtooth';
      this.roombaOsc.frequency.setValueAtTime(85, now);

      const filter = this.ctx.createBiquadFilter();
      this.roombaFilter = filter;
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, now);

      this.roombaGain.gain.setValueAtTime(0.001, now);
      this.roombaGain.gain.linearRampToValueAtTime(0.06, now + 0.4);

      this.roombaOsc.connect(filter);
      filter.connect(this.roombaGain);
      this.roombaGain.connect(this.sfxGain);

      this.roombaOsc.start();
    }

    stopRoomba() {
      if (!this.roombaOsc || !this.roombaGain || !this.ctx) return;
      clearTimeout(this.roombaStopTimer);
      const osc = this.roombaOsc;
      const gain = this.roombaGain;
      const filter = this.roombaFilter;
      gain.gain.cancelScheduledValues(this.ctx.currentTime);
      gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.3);
      // 立即释放引用，使 320ms 淡出期间再次 startRoomba 不会被早退忽略
      this.roombaOsc = null;
      this.roombaGain = null;
      this.roombaFilter = null;
      this.roombaStopTimer = setTimeout(() => {
        try {
          osc.stop();
          osc.disconnect();
          if (filter) filter.disconnect();
          gain.disconnect();
        } catch (e) {}
      }, 320);
    }

    // --- 相机快门拍照声 ---
    playShutter() {
      if (this.isMuted || this._disposed) return;
      this.init();
      const now = this.ctx.currentTime;
      // 机械咔哒
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.03);
      g.gain.setValueAtTime(0.3, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.04);
      this._releaseOnEnded(osc, g);

      // 快门收起
      setTimeout(() => {
        if (!this.ctx || this._disposed) return;
        const t2 = this.ctx.currentTime;
        const o2 = this.ctx.createOscillator();
        const g2 = this.ctx.createGain();
        o2.frequency.setValueAtTime(800, t2);
        o2.frequency.exponentialRampToValueAtTime(220, t2 + 0.05);
        g2.gain.setValueAtTime(0.2, t2);
        g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.05);
        o2.connect(g2);
        g2.connect(this.sfxGain);
        o2.start(t2);
        o2.stop(t2 + 0.06);
        this._releaseOnEnded(o2, g2);
      }, 70);
    }

    // --- 弹性物体反弹声 ---
    playBounce() {
      if (this.isMuted || this._disposed) return;
      this.init();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.09);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.1);
      this._releaseOnEnded(osc, gain);
    }

    // --- 泡泡 / 放置物品声 ---
    playPop() {
      if (this.isMuted || this._disposed) return;
      this.init();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(650 + Math.random() * 100, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.07);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.08);
      this._releaseOnEnded(osc, gain);
    }

    // --- 清脆铜铃铛 / 风铃羽毛玩具声 ---
    playBell() {
      if (this.isMuted || this._disposed) return;
      this.init();
      const now = this.ctx.currentTime;
      // 双谐波闪烁金属音 (High sine chime pair)
      [1800, 2750].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq + (Math.random() - 0.5) * 40, now);
        gain.gain.setValueAtTime(0.12 / (idx + 1), now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.48);
        this._releaseOnEnded(osc, gain);
      });
    }

    // --- 实木跳台踏板 / 悬索桥木板轻踏声 ---
    playWoodThud() {
      if (this.isMuted || this._disposed) return;
      this.init();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140 + Math.random() * 30, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.08);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.09);
      this._releaseOnEnded(osc, gain);
    }

    // --- 陶瓷 / 玻璃高空推落碎裂声 (高频脆响 + 碎片崩裂) ---
    playGlassShatter() {
      if (this.isMuted || this._disposed) return;
      this.init();
      const now = this.ctx.currentTime;
      // 1. 高频金属/陶瓷撞击噪波
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.12);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.setValueAtTime(3200, now);
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.24, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.sfxGain);
      noise.start(now);
      noise.stop(now + 0.13);
      this._releaseOnEnded(noise, noiseFilter, noiseGain);

      // 2. 陶瓷碎片微鸣叮当 (Dual ringing harmonics)
      [2400, 3950].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq + (Math.random() - 0.5) * 60, now + idx * 0.02);
        gain.gain.setValueAtTime(0.14 / (idx + 1), now + idx * 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35 + idx * 0.05);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now + idx * 0.02);
        osc.stop(now + 0.42);
        this._releaseOnEnded(osc, gain);
      });
    }

    // --- 观鸟捕猎齿颤 Ek-ek-ek 声 (高频短促多脉冲咔咔声) ---
    playChatter() {
      if (this.isMuted || this._disposed) return;
      this.init();
      const now = this.ctx.currentTime;
      for (let i = 0; i < 4; i++) {
        const t = now + i * 0.055;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1750 + Math.random() * 250, t);
        osc.frequency.exponentialRampToValueAtTime(1100, t + 0.035);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.04);
        this._releaseOnEnded(osc, gain);
      }
    }

    // --- 猫猫拳肉垫互扇声 (脆响轻拍) ---
    playSlap() {
      if (this.isMuted || this._disposed) return;
      this.init();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(450 + Math.random() * 100, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.045);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.055);
      this._releaseOnEnded(osc, gain);
    }

    // --- 极速狂飙暴走音效 (低音马达加速 + 破空风声) ---
    playZoomies() {
      if (this.isMuted || this._disposed) return;
      this.init();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.35);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.42);
      this._releaseOnEnded(osc, gain);
    }

    // --- 程序化极简 Lofi 氛围生成乐 (温和五声音阶循环) ---
    toggleBGM() {
      if (this._disposed) return this.bgmEnabled;
      this.bgmEnabled = !this.bgmEnabled;
      if (this.bgmEnabled) {
        this.init();
        this.startLofiBGM();
      } else {
        this.stopLofiBGM();
      }
      return this.bgmEnabled;
    }

    startLofiBGM() {
      if (this.lofiTimer) return;
      // 舒缓和弦走向 (Cmaj9, Am9, Fmaj7, G7sus4)
      const chords = [
        [261.63, 329.63, 392.00, 493.88, 587.33], // Cmaj9
        [220.00, 261.63, 329.63, 392.00, 493.88], // Am9
        [174.61, 261.63, 329.63, 392.00, 440.00], // Fmaj7
        [196.00, 261.63, 293.66, 392.00, 440.00]  // G7sus4
      ];

      const playChord = () => {
        if (this._disposed || !this.bgmEnabled || this.isMuted) return;
        this.init();
        const chord = chords[this.lofiStep % chords.length];
        this.lofiStep++;

        const now = this.ctx.currentTime;
        chord.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();

          osc.type = 'sine';
          // 轻微随机失真营造黑胶磁带感
          osc.frequency.setValueAtTime(freq + (Math.random() - 0.5) * 0.8, now);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(600, now);

          const delay = idx * 0.08;
          const noteStart = now + delay;
          gain.gain.setValueAtTime(0.0001, noteStart);
          gain.gain.linearRampToValueAtTime(0.045, noteStart + 0.4);
          gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 3.2);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.bgmGain);

          osc.start(noteStart);
          osc.stop(noteStart + 3.3);
          this._releaseOnEnded(osc, filter, gain);
        });
      };

      playChord();
      this.lofiTimer = setInterval(playChord, 3600);
    }

    stopLofiBGM() {
      if (this.lofiTimer) {
        clearInterval(this.lofiTimer);
        this.lofiTimer = null;
      }
    }
  }

  window.CyberMeow = window.CyberMeow || {};
  window.CyberMeow.soundEngine = new SoundEngine();
})(window);
