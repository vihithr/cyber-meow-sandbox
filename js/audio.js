/**
 * CyberMeow - 纯原生 Web Audio 声音合成引擎
 * 零外部音频文件依赖，所有猫叫、呼噜、环境音均由振荡器与噪声发生器实时合成
 */
(function(window) {
  'use strict';

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.sfxGain = null;
      this.bgmGain = null;
      this.isMuted = false;
      this.bgmEnabled = false;

      // 呼噜声节点
      this.purrSource = null;
      this.purrGain = null;
      this.purrActiveCount = 0;

      // 扫地机嗡嗡声节点
      this.roombaOsc = null;
      this.roombaGain = null;

      // Lofi 音乐定时器
      this.lofiTimer = null;
      this.lofiStep = 0;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();

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
        this.ctx.resume();
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
      if (this.isMuted) return;
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
    }

    // --- 真实呼噜声引擎 (25Hz 低频震颤 + 粉红噪声) ---
    startPurr() {
      if (this.isMuted) return;
      this.init();
      this.purrActiveCount++;
      if (this.purrSource) return;

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

      this.purrGain = this.ctx.createGain();
      this.purrGain.gain.setValueAtTime(0.01, this.ctx.currentTime);
      this.purrGain.gain.linearRampToValueAtTime(0.28, this.ctx.currentTime + 0.5);

      lfo.connect(lfoGain);
      lfoGain.connect(this.purrGain.gain);

      this.purrSource.connect(filter);
      filter.connect(this.purrGain);
      this.purrGain.connect(this.sfxGain);

      this.purrSource.start();
      lfo.start();
      this.purrLfo = lfo;
    }

    stopPurr() {
      this.purrActiveCount = Math.max(0, this.purrActiveCount - 1);
      if (this.purrActiveCount === 0 && this.purrGain && this.ctx) {
        this.purrGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
        setTimeout(() => {
          if (this.purrActiveCount === 0 && this.purrSource) {
            try {
              this.purrSource.stop();
              this.purrLfo.stop();
            } catch (e) {}
            this.purrSource = null;
            this.purrLfo = null;
          }
        }, 320);
      }
    }

    // --- 吃鱼干咀嚼声 ---
    playCrunch() {
      if (this.isMuted) return;
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
      }
    }

    // --- 抓板磨爪声 ---
    playScratch() {
      if (this.isMuted) return;
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
    }

    // --- 猫咪哈气警告 (Hissing) ---
    playHiss() {
      if (this.isMuted) return;
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
    }

    // --- 喵喵拳互拍 (Cat Slap) ---
    playSlap() {
      if (this.isMuted) return;
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
    }

    // --- 观鸟捕食快速齿颤声 (Chattering) ---
    playChatter(pitchMod = 1.0) {
      if (this.isMuted) return;
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
      }
    }

    // --- 窗外小鸟啁啾声 (Bird Tweet) ---
    playBirdTweet() {
      if (this.isMuted) return;
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
    }

    // --- 猫咪领地争夺低吼 (Low Territorial Growl) ---
    playLowGrowl(pitchMod = 1.0) {
      if (this.isMuted) return;
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
    }

    // --- 水花飞溅 / 湿爪甩动 (Water Splash) ---
    playWaterSplash() {
      if (this.isMuted) return;
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
    }

    // --- 扫地机器人马达嗡嗡声 ---
    startRoomba() {
      if (this.isMuted || this.roombaOsc) return;
      this.init();
      const now = this.ctx.currentTime;
      this.roombaOsc = this.ctx.createOscillator();
      this.roombaGain = this.ctx.createGain();

      this.roombaOsc.type = 'sawtooth';
      this.roombaOsc.frequency.setValueAtTime(85, now);

      const filter = this.ctx.createBiquadFilter();
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
      if (this.roombaOsc && this.roombaGain) {
        this.roombaGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.3);
        setTimeout(() => {
          if (this.roombaOsc) {
            try { this.roombaOsc.stop(); } catch(e) {}
            this.roombaOsc = null;
            this.roombaGain = null;
          }
        }, 320);
      }
    }

    // --- 相机快门拍照声 ---
    playShutter() {
      if (this.isMuted) return;
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

      // 快门收起
      setTimeout(() => {
        if (!this.ctx) return;
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
      }, 70);
    }

    // --- 弹性物体反弹声 ---
    playBounce() {
      if (this.isMuted) return;
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
    }

    // --- 泡泡 / 放置物品声 ---
    playPop() {
      if (this.isMuted) return;
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
    }

    // --- 程序化极简 Lofi 氛围生成乐 (温和五声音阶循环) ---
    toggleBGM() {
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
        if (!this.bgmEnabled || this.isMuted) return;
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
