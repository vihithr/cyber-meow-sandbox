/**
 * CyberMeow - 用户界面交互与管理系统 (UI Manager)
 * 包含：猫咪身份证模态、拍立得快照生成、红点追逐挑战模式、提示通知
 */
(function(window) {
  'use strict';

  const { soundEngine, HATS } = window.CyberMeow;

  class UIManager {
    constructor() {
      this.selectedCat = null;
      this.challengeActive = false;
      this.challengeTime = 45;
      this.challengeScore = 0;
      this.challengeTimer = null;
      this.targetStar = null;
    }

    init() {
      this.bindPassportEvents();
      this.bindSnapshotEvents();
    }

    showToast(msg, duration = 3000) {
      const hint = document.getElementById('hint-text');
      if (hint) {
        hint.innerText = msg;
        hint.style.opacity = '1';
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => {
          hint.style.opacity = '0.7';
        }, duration);
      }
    }

    // --- 猫咪身份证 (Passport) ---
    openCatPassport(cat) {
      this.selectedCat = cat;
      const modal = document.getElementById('passport-modal');
      const nameInput = document.getElementById('cat-name-input');
      const breedEl = document.getElementById('cat-breed-tag');
      const personalityTitle = document.getElementById('cat-personality-title');
      const personalityDesc = document.getElementById('cat-personality-desc');

      if (!modal || !nameInput) return;

      nameInput.value = cat.name;
      breedEl.innerText = cat.breed.name;
      personalityTitle.innerText = cat.personality.name;
      personalityDesc.innerText = cat.personality.desc;

      this.updatePassportMetrics();
      this.renderHatOptions();
      this.drawPassportAvatar();

      modal.classList.add('open');
      soundEngine.playMeow(cat.pitchMod, 'chirp');
    }

    closeCatPassport() {
      const modal = document.getElementById('passport-modal');
      if (modal) modal.classList.remove('open');
      this.selectedCat = null;
    }

    updatePassportMetrics() {
      if (!this.selectedCat) return;
      const hungerFill = document.getElementById('bar-hunger');
      const affectionFill = document.getElementById('bar-affection');
      const energyFill = document.getElementById('bar-energy');

      if (hungerFill) hungerFill.style.width = this.selectedCat.hunger + '%';
      if (affectionFill) affectionFill.style.width = this.selectedCat.affection + '%';
      if (energyFill) energyFill.style.width = this.selectedCat.energy + '%';
    }

    drawPassportAvatar() {
      const avatarCanvas = document.getElementById('passport-avatar-canvas');
      if (!avatarCanvas || !this.selectedCat) return;
      const ctx = avatarCanvas.getContext('2d');
      ctx.clearRect(0, 0, avatarCanvas.width, avatarCanvas.height);

      ctx.save();
      ctx.translate(avatarCanvas.width / 2, avatarCanvas.height / 2 + 10);
      const cat = this.selectedCat;
      const headR = 26;

      // 耳朵
      ctx.fillStyle = cat.breed.bodyColor;
      ctx.beginPath();
      ctx.moveTo(-headR * 0.8, -headR * 0.4);
      ctx.lineTo(-headR * 0.7, -headR * 1.35);
      ctx.lineTo(-headR * 0.1, -headR * 0.8);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(headR * 0.1, -headR * 0.8);
      ctx.lineTo(headR * 0.7, -headR * 1.35);
      ctx.lineTo(headR * 0.8, -headR * 0.4);
      ctx.fill();

      // 耳蜗
      ctx.fillStyle = cat.breed.earColor;
      ctx.beginPath();
      ctx.moveTo(-headR * 0.6, -headR * 0.4);
      ctx.lineTo(-headR * 0.55, -headR * 1.15);
      ctx.lineTo(-headR * 0.2, -headR * 0.7);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(headR * 0.2, -headR * 0.7);
      ctx.lineTo(headR * 0.55, -headR * 1.15);
      ctx.lineTo(headR * 0.6, -headR * 0.4);
      ctx.fill();

      // 脸
      ctx.beginPath();
      ctx.arc(0, 0, headR, 0, Math.PI * 2);
      ctx.fillStyle = cat.breed.bodyColor;
      ctx.fill();

      // 眼睛
      ctx.fillStyle = cat.breed.eyeColor;
      ctx.beginPath();
      ctx.ellipse(-headR * 0.4, -2, 5, 6, 0, 0, Math.PI * 2);
      ctx.ellipse(headR * 0.4, -2, 5, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // 瞳孔
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(-headR * 0.4, -2, 2.8, 0, Math.PI * 2);
      ctx.arc(headR * 0.4, -2, 2.8, 0, Math.PI * 2);
      ctx.fill();

      // 鼻子
      ctx.fillStyle = '#ff7675';
      ctx.beginPath();
      ctx.arc(0, 6, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // 帽子
      cat.drawHat(ctx, 0, headR);

      ctx.restore();
    }

    renderHatOptions() {
      const container = document.getElementById('hat-picker-opts');
      if (!container || !this.selectedCat) return;
      container.innerHTML = '';

      const hatLabels = {
        none: '无配饰',
        bell: '🔔 铃铛',
        bow: '🎀 蝴蝶结',
        wizard: '🧙 巫师帽',
        party: '🎉 派对帽'
      };

      HATS.forEach(hat => {
        const btn = document.createElement('button');
        btn.className = 'hat-opt-btn' + (this.selectedCat.hat === hat ? ' selected' : '');
        btn.innerText = hatLabels[hat] || hat;
        btn.onclick = () => {
          this.selectedCat.hat = hat;
          this.renderHatOptions();
          this.drawPassportAvatar();
          soundEngine.playPop();
          if (window.CyberMeow.saveState) window.CyberMeow.saveState();
        };
        container.appendChild(btn);
      });
    }

    bindPassportEvents() {
      const nameInput = document.getElementById('cat-name-input');
      if (nameInput) {
        nameInput.onchange = () => {
          if (this.selectedCat && nameInput.value.trim()) {
            this.selectedCat.name = nameInput.value.trim();
            if (window.CyberMeow.saveState) window.CyberMeow.saveState();
          }
        };
      }
    }

    // --- 拍立得照片快照模式 (Photo Mode) ---
    takeSnapshot(mainCanvas) {
      soundEngine.playShutter();

      // 创建合成拍立得画布
      const snapCanvas = document.createElement('canvas');
      const pad = 24;
      const bottomExtra = 70;
      snapCanvas.width = mainCanvas.width * 0.65;
      snapCanvas.height = (mainCanvas.height * 0.65) + bottomExtra;
      const sctx = snapCanvas.getContext('2d');

      // 拍立得相纸白底
      sctx.fillStyle = '#f8f9fa';
      sctx.fillRect(0, 0, snapCanvas.width, snapCanvas.height);

      // 画面图像
      sctx.drawImage(
        mainCanvas,
        0, 0, mainCanvas.width, mainCanvas.height,
        pad, pad, snapCanvas.width - pad * 2, snapCanvas.height - bottomExtra - pad
      );

      // 拍立得手写签名文字
      sctx.fillStyle = '#2d3436';
      sctx.font = 'bold 18px "Comic Sans MS", "PingFang SC", sans-serif';
      sctx.fillText('🐾 CyberMeow Memories 🌸', pad + 10, snapCanvas.height - 30);

      sctx.fillStyle = '#636e72';
      sctx.font = '13px sans-serif';
      const dateStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      sctx.fillText(dateStr, snapCanvas.width - pad - 160, snapCanvas.height - 30);

      const dataUrl = snapCanvas.toDataURL('image/png');
      const modal = document.getElementById('snapshot-modal');
      const img = document.getElementById('snapshot-img');
      const downloadBtn = document.getElementById('btn-download-snap');

      if (img && modal && downloadBtn) {
        img.src = dataUrl;
        downloadBtn.onclick = () => {
          const a = document.createElement('a');
          a.download = `CyberMeow_${Date.now()}.png`;
          a.href = dataUrl;
          a.click();
          this.showToast('📸 拍立得相片已下载保存！');
        };
        modal.classList.add('open');
      }
    }

    bindSnapshotEvents() {
      const closeBtn = document.getElementById('btn-close-snapshot');
      if (closeBtn) {
        closeBtn.onclick = () => {
          document.getElementById('snapshot-modal').classList.remove('open');
        };
      }
    }

    // --- 红点追逐大作战 (Laser Rush Challenge) ---
    toggleLaserChallenge(sceneContext) {
      if (this.challengeActive) {
        this.stopLaserChallenge();
      } else {
        this.startLaserChallenge(sceneContext);
      }
    }

    startLaserChallenge(sceneContext) {
      this.challengeActive = true;
      this.challengeTime = 40;
      this.challengeScore = 0;
      const hud = document.getElementById('challenge-hud');
      if (hud) hud.style.display = 'flex';

      // 切换到激光笔
      if (window.CyberMeow.setTool) window.CyberMeow.setTool('laser');
      this.spawnNextTarget(sceneContext);

      soundEngine.playMeow(1.2, 'chirp');
      this.showToast('🎯 红点大作战开启！移动激光笔引导猫咪扑中金色星星！');

      clearInterval(this.challengeTimer);
      this.challengeTimer = setInterval(() => {
        this.challengeTime--;
        const timeEl = document.getElementById('challenge-time');
        const scoreEl = document.getElementById('challenge-score');
        if (timeEl) timeEl.innerText = this.challengeTime + 's';
        if (scoreEl) scoreEl.innerText = this.challengeScore;

        if (this.challengeTime <= 0) {
          this.endLaserChallenge();
        }
      }, 1000);
    }

    spawnNextTarget(sceneContext) {
      const margin = 100;
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.targetStar = {
        x: margin + Math.random() * (w - margin * 2),
        y: margin + Math.random() * (h - margin * 2),
        radius: 22,
        pulse: 0
      };
    }

    updateChallenge(cats, sceneContext) {
      if (!this.challengeActive || !this.targetStar) return;
      this.targetStar.pulse += 0.08;

      // 检测是否有猫咪进入星星范围
      for (let c of cats) {
        const d = Math.hypot(c.x - this.targetStar.x, c.y - this.targetStar.y);
        if (d < this.targetStar.radius + c.radius) {
          // 得分！
          this.challengeScore += 100;
          soundEngine.playPop();
          soundEngine.playMeow(c.pitchMod * 1.3, 'chatter');
          for (let i = 0; i < 8; i++) {
            sceneContext.spawnParticle(this.targetStar.x, this.targetStar.y, '⭐');
          }
          this.spawnNextTarget(sceneContext);
          break;
        }
      }
    }

    drawChallengeTarget(ctx) {
      if (!this.challengeActive || !this.targetStar) return;
      ctx.save();
      ctx.translate(this.targetStar.x, this.targetStar.y);
      const scale = 1 + Math.sin(this.targetStar.pulse) * 0.15;
      ctx.scale(scale, scale);

      // 光晕圈
      ctx.beginPath();
      ctx.arc(0, 0, this.targetStar.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(254, 202, 87, 0.3)';
      ctx.fill();
      ctx.strokeStyle = '#feca57';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 星星
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⭐', 0, 0);

      ctx.restore();
    }

    endLaserChallenge() {
      this.stopLaserChallenge();
      this.showToast(`🎉 挑战结束！最终得分: ${this.challengeScore} 分！猫咪们玩得太爽啦！`, 5000);
      soundEngine.playMeow(1.0, 'pleading');
    }

    stopLaserChallenge() {
      this.challengeActive = false;
      clearInterval(this.challengeTimer);
      this.targetStar = null;
      const hud = document.getElementById('challenge-hud');
      if (hud) hud.style.display = 'none';
    }
  }

  window.CyberMeow = window.CyberMeow || {};
  window.CyberMeow.uiManager = new UIManager();
})(window);
