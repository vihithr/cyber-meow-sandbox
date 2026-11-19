/**
 * CyberMeow - 用户界面交互与管理系统 (UI Manager)
 * 包含：猫咪身份证模态、拍立得快照生成、红点追逐挑战模式、提示通知
 */
(function(window) {
  'use strict';

  const { soundEngine, HATS } = window.CyberMeow;
  const CHALLENGE_DURATION = 45;

  class UIManager {
    constructor() {
      this.selectedCat = null;
      this.challengeActive = false;
      this.challengeTime = CHALLENGE_DURATION;
      this.challengeScore = 0;
      this.challengeTimer = null;
      this.targetStar = null;
      this.prevTool = null;
      this.biteRecoverTimer = null;
      this.studioCat = null;
      this.studioAnimId = null;
      this.toastTimer = null;
    }

    init() {
      this.bindPassportEvents();
      this.bindSnapshotEvents();
      this.bindStudioEvents();
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

      if (!modal || !nameInput || !breedEl || !personalityTitle || !personalityDesc) return;

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

      const holdBtn = document.getElementById('btn-passport-hold');
      if (holdBtn) {
        holdBtn.onclick = () => {
          const cat = this.selectedCat;
          this.closeCatPassport();
          if (cat) this.openCloseUpStudio(cat);
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

      let dataUrl;
      try {
        dataUrl = snapCanvas.toDataURL('image/png');
      } catch (e) {
        this.showToast('📸 快照生成失败，请稍后重试');
        return;
      }
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
          const modal = document.getElementById('snapshot-modal');
          if (modal) modal.classList.remove('open');
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
      this.challengeTime = CHALLENGE_DURATION;
      this.challengeScore = 0;
      // 记录进入挑战前的工具，结束时恢复，避免玩家被困在激光笔模式
      this.prevTool = sceneContext ? sceneContext.currentTool : null;
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
      // 星星绘制在「世界坐标系」内，必须按当前相机与缩放换算可见范围，
      // 否则镜头平移到客厅/高塔后星星会出现在屏幕外
      const margin = 100;
      const zoom = (sceneContext && sceneContext.zoom > 0) ? sceneContext.zoom : 1;
      const viewW = (sceneContext && sceneContext.viewportWidth) || window.innerWidth;
      const viewH = (sceneContext && sceneContext.viewportHeight) || window.innerHeight;
      const camX = sceneContext ? sceneContext.cameraX : 0;
      const worldW = (sceneContext && sceneContext.worldWidth) || viewW;
      const x0 = Math.max(margin, camX + margin / zoom);
      const x1 = Math.min(worldW - margin, camX + (viewW - margin) / zoom);
      const y0 = margin / zoom;
      const y1 = (viewH - margin) / zoom;
      this.targetStar = {
        x: x0 + Math.random() * Math.max(1, x1 - x0),
        y: y0 + Math.random() * Math.max(1, y1 - y0),
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
          if (sceneContext && sceneContext.spawnParticle) {
            for (let i = 0; i < 8; i++) {
              sceneContext.spawnParticle(this.targetStar.x, this.targetStar.y, '⭐');
            }
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
      this.challengeTimer = null;
      this.targetStar = null;
      // prevTool 缺失时也要退出激光笔，避免玩家被困在该工具模式
      const restoreTool = this.prevTool || 'pet';
      if (window.CyberMeow.setTool) {
        window.CyberMeow.setTool(restoreTool);
      }
      this.prevTool = null;
      const hud = document.getElementById('challenge-hud');
      if (hud) hud.style.display = 'none';
    }

    // --- 抱入怀中·桌面特写侍奉台 (Close-up Care Studio) ---
    openCloseUpStudio(cat) {
      // 清理上一次会话遗留的抱咬恢复定时器，避免改写新会话的耐心值
      clearTimeout(this.biteRecoverTimer);
      this.biteRecoverTimer = null;
      this.studioCat = cat;
      this.studioTool = 'brush';
      this.studioParticles = [];
      this.studioPurrTimer = 0;
      this.studioTongueOut = 0;
      this.studioPatience = 100;
      this.studioCollectedFur = 0;
      this.studioBiteCooldown = 0;
      this.studioScreenShake = 0;

      const modal = document.getElementById('studio-modal');
      const title = document.getElementById('studio-cat-name');
      const furBanner = document.getElementById('studio-fur-banner');
      if (!modal) return;

      if (title) title.innerText = `与「${cat.name}」的亲密时光 🐾`;
      if (furBanner) furBanner.style.display = 'none';

      this.updateStudioPatienceUI();
      modal.classList.add('open');

      soundEngine.playMeow(cat.pitchMod, 'pleading');
      this.startStudioAnimation();
      this.updateStudioToolUI();
    }

    closeCloseUpStudio() {
      const modal = document.getElementById('studio-modal');
      if (modal) modal.classList.remove('open');
      this.studioCat = null;
      clearTimeout(this.biteRecoverTimer);
      this.biteRecoverTimer = null;
      cancelAnimationFrame(this.studioAnimId);
      soundEngine.stopPurr();
      // 侍奉台里改变的亲密度/饱腹度在关闭时统一落盘，避免每次交互都写 localStorage
      if (window.CyberMeow.saveState) window.CyberMeow.saveState();
    }

    updateStudioPatienceUI() {
      const bar = document.getElementById('studio-patience-bar');
      const tag = document.getElementById('studio-mood-tag');
      if (!bar || !tag) return;

      const pct = Math.max(0, Math.min(100, this.studioPatience));
      bar.style.width = pct + '%';

      if (pct > 65) {
        bar.style.background = '#2ed573';
        tag.innerText = '🥰 极度舒适';
        tag.style.color = '#2ed573';
      } else if (pct > 25) {
        bar.style.background = '#ffa502';
        tag.innerText = '⚠️ 尾巴微甩，注意别一直摸肚皮';
        tag.style.color = '#ffa502';
      } else {
        bar.style.background = '#ff4757';
        tag.innerText = '😾 飞机耳！随时亮爪抱咬！';
        tag.style.color = '#ff4757';
      }
    }

    setStudioTool(tool) {
      this.studioTool = tool;
      this.updateStudioToolUI();
      soundEngine.playPop();
    }

    updateStudioToolUI() {
      document.querySelectorAll('.studio-tool-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === this.studioTool);
      });
    }

    bindStudioEvents() {
      const closeBtn = document.getElementById('btn-close-studio');
      if (closeBtn) closeBtn.onclick = () => this.closeCloseUpStudio();

      document.querySelectorAll('.studio-tool-btn').forEach(btn => {
        btn.onclick = () => {
          if (btn.dataset.tool) this.setStudioTool(btn.dataset.tool);
        };
      });

      // 绑定浮毛搓成毛球扔回场景事件
      const tossFurBtn = document.getElementById('btn-toss-fur-ball');
      if (tossFurBtn) {
        tossFurBtn.onclick = () => {
          if (!this.studioCat) return;
          const cat = this.studioCat;
          const app = window.CyberMeow.app;
          if (app && app.toys) {
            const YarnBallClass = window.CyberMeow.YarnBall;
            const newBall = new YarnBallClass(cat.x + 15, cat.y - 30, 13, cat.breed.bodyColor);
            app.toys.push(newBall);
            soundEngine.playBounce();
            this.showToast(`🧶 用「${cat.name}」梳下的浮毛搓成了专属毛球！已投掷进房间！`, 4000);
            cat.speak('咦！我的毛球！');
          }
          this.closeCloseUpStudio();
        };
      }

      const canvas = document.getElementById('studio-canvas');
      if (!canvas) return;

      let isDown = false;
      let lastX = 0, lastY = 0;

      const onPointerDown = (e) => {
        isDown = true;
        soundEngine.init();
        const rect = canvas.getBoundingClientRect();
        lastX = e.clientX - rect.left;
        lastY = e.clientY - rect.top;
        this.interactStudio(lastX, lastY);
      };

      const onPointerMove = (e) => {
        if (!isDown) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (Math.hypot(x - lastX, y - lastY) > 16) {
          this.interactStudio(x, y);
          lastX = x;
          lastY = y;
        }
      };

      const onPointerUp = () => {
        isDown = false;
        soundEngine.stopPurr();
      };

      canvas.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    }

    interactStudio(x, y) {
      if (!this.studioCat) return;
      if (this.studioBiteCooldown > 0) return; // 被咬后的傲娇冷却期

      const cat = this.studioCat;
      const isBellyZone = y > 140; // 肚皮禁区判定！

      if (isBellyZone && this.studioTool !== 'churu') {
        // 摸肚皮：高风险高过载！
        this.studioPatience -= 24;
        this.updateStudioPatienceUI();

        if (this.studioPatience <= 0) {
          // 触发过载反击！
          this.triggerStudioLoveBite();
          return;
        } else {
          soundEngine.playHiss();
          this.studioParticles.push({
            x, y,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -1.5,
            text: '⚡',
            alpha: 1.0
          });
          return;
        }
      }

      // 处于安全舒适区 (头顶、耳后、下巴)
      if (this.studioTool === 'brush') {
        // 舒爽梳毛
        soundEngine.playScratch();
        soundEngine.startPurr();
        cat.affection = Math.min(100, cat.affection + 2);
        this.studioPurrTimer = 45;
        this.studioPatience = Math.min(100, this.studioPatience + 3);
        this.updateStudioPatienceUI();

        // 浮毛收集积累
        this.studioCollectedFur++;
        if (this.studioCollectedFur >= 12) {
          const banner = document.getElementById('studio-fur-banner');
          if (banner) banner.style.display = 'flex';
        }

        // 浮毛飘舞粒子
        for (let i = 0; i < 3; i++) {
          this.studioParticles.push({
            x: x + (Math.random() - 0.5) * 30,
            y: y + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -1.2 - Math.random() * 1.5,
            text: '☁️',
            alpha: 1.0,
            scale: 0.8
          });
        }
      } else if (this.studioTool === 'chin') {
        // 挠挠下巴
        soundEngine.startPurr();
        cat.affection = Math.min(100, cat.affection + 3);
        this.studioPurrTimer = 55;
        this.studioPatience = Math.min(100, this.studioPatience + 6);
        this.updateStudioPatienceUI();

        this.studioParticles.push({
          x: x + (Math.random() - 0.5) * 20,
          y: y - 10,
          vx: (Math.random() - 0.5) * 1.2,
          vy: -2,
          text: '❤️',
          alpha: 1.0,
          scale: 1.0
        });
      } else if (this.studioTool === 'churu') {
        // 挤猫条舔舐
        soundEngine.playCrunch();
        cat.hunger = Math.min(100, cat.hunger + 8);
        this.studioTongueOut = 30;
        this.studioPatience = Math.min(100, this.studioPatience + 4);
        this.updateStudioPatienceUI();

        this.studioParticles.push({
          x, y,
          vx: (Math.random() - 0.5) * 1.0,
          vy: -1.8,
          text: '🐟',
          alpha: 1.0,
          scale: 1.0
        });
      }
    }

    triggerStudioLoveBite() {
      this.studioBiteCooldown = 120; // 冷却
      this.studioScreenShake = 16;
      soundEngine.stopPurr();
      soundEngine.playSlap();
      soundEngine.playHiss();

      // 抱咬受惊粒子
      for (let i = 0; i < 8; i++) {
        this.studioParticles.push({
          x: 190 + (Math.random() - 0.5) * 60,
          y: 130 + (Math.random() - 0.5) * 40,
          vx: (Math.random() - 0.5) * 3,
          vy: -2 - Math.random() * 2,
          text: '💥',
          alpha: 1.0
        });
      }

      this.showToast('⚠️ 猫咪过载抱咬！「嗷呜一口轻咬了你的手指！」傲娇走神中…', 4000);
      clearTimeout(this.biteRecoverTimer);
      this.biteRecoverTimer = setTimeout(() => {
        if (!this.studioCat) return;
        this.studioPatience = 70;
        this.updateStudioPatienceUI();
      }, 2500);
    }

    startStudioAnimation() {
      const canvas = document.getElementById('studio-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      // 画布尺寸只在初始化时设置；写 width/height 会清空缓冲并重置上下文，不能每帧执行
      if (canvas.width !== 380) canvas.width = 380;
      if (canvas.height !== 240) canvas.height = 240;
      // 快速反复打开侍奉台时，先取消上一轮循环，避免两个 rAF 同时写同一画布
      cancelAnimationFrame(this.studioAnimId);

      const render = () => {
        if (!this.studioCat) return;
        const cat = this.studioCat;
        const w = 380;
        const h = 240;

        ctx.clearRect(0, 0, w, h);

        // 1. 柔软舒适的毛绒大坐垫
        ctx.save();
        ctx.translate(w / 2, h - 35);
        ctx.beginPath();
        ctx.ellipse(0, 0, 150, 26, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#ff7675';
        ctx.fill();
        ctx.strokeStyle = '#d63031';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 坐垫绒毛花边
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // 2. 猫咪大特写绘制 (居中坐姿，大头呆萌)
        ctx.save();
        let shakeX = 0, shakeY = 0;
        if (this.studioScreenShake > 0) {
          shakeX = (Math.random() - 0.5) * this.studioScreenShake;
          shakeY = (Math.random() - 0.5) * this.studioScreenShake;
          this.studioScreenShake *= 0.88;
          if (this.studioScreenShake < 0.5) this.studioScreenShake = 0;
        }
        if (this.studioBiteCooldown > 0) this.studioBiteCooldown--;

        ctx.translate(w / 2 + shakeX, h - 90 + shakeY);
        const breath = Math.sin(Date.now() * 0.004) * 2;
        const isHappy = this.studioPurrTimer > 0;
        const isAngry = this.studioBiteCooldown > 60 || this.studioPatience < 25;
        if (this.studioPurrTimer > 0) this.studioPurrTimer--;
        if (this.studioTongueOut > 0) this.studioTongueOut--;

        // 身体
        ctx.beginPath();
        ctx.ellipse(0, 20 + breath, 52, 44, 0, 0, Math.PI * 2);
        ctx.fillStyle = cat.breed.bodyColor;
        ctx.fill();

        // 肚皮
        ctx.beginPath();
        ctx.ellipse(0, 24 + breath, 32, 28, 0, 0, Math.PI * 2);
        ctx.fillStyle = cat.breed.bellyColor;
        ctx.fill();

        // 头部
        const headR = 46;
        const headY = -18 + breath * 0.5;

        // 耳朵 (舒服时微撇，过载生气时成愤怒飞机耳)
        ctx.fillStyle = cat.breed.bodyColor;
        const earSplay = isAngry ? 0.65 : (isHappy ? 0.2 : 0);
        ctx.save();
        ctx.rotate(-earSplay);
        ctx.beginPath();
        ctx.moveTo(-headR * 0.8, headY - 8);
        ctx.lineTo(-headR * 0.75, headY - headR * 1.4);
        ctx.lineTo(-headR * 0.15, headY - headR * 0.8);
        ctx.fill();
        ctx.fillStyle = cat.breed.earColor;
        ctx.beginPath();
        ctx.moveTo(-headR * 0.65, headY - 8);
        ctx.lineTo(-headR * 0.6, headY - headR * 1.2);
        ctx.lineTo(-headR * 0.2, headY - headR * 0.7);
        ctx.fill();
        ctx.restore();

        // 右耳
        ctx.save();
        ctx.rotate(earSplay);
        ctx.fillStyle = cat.breed.bodyColor;
        ctx.beginPath();
        ctx.moveTo(headR * 0.15, headY - headR * 0.8);
        ctx.lineTo(headR * 0.75, headY - headR * 1.4);
        ctx.lineTo(headR * 0.8, headY - 8);
        ctx.fill();
        ctx.fillStyle = cat.breed.earColor;
        ctx.beginPath();
        ctx.moveTo(headR * 0.2, headY - headR * 0.7);
        ctx.lineTo(headR * 0.6, headY - headR * 1.2);
        ctx.lineTo(headR * 0.65, headY - 8);
        ctx.fill();
        ctx.restore();

        // 大圆脸
        ctx.beginPath();
        ctx.arc(0, headY, headR, 0, Math.PI * 2);
        ctx.fillStyle = cat.breed.bodyColor;
        ctx.fill();

        // 眼睛 (舒服眯眼 / 愤怒竖瞳 / 正常大圆眼)
        if (isAngry) {
          // 生气过载：细长竖瞳
          ctx.fillStyle = cat.breed.eyeColor;
          ctx.beginPath();
          ctx.ellipse(-headR * 0.4, headY - 3, 7, 10, -0.15, 0, Math.PI * 2);
          ctx.ellipse(headR * 0.4, headY - 3, 7, 10, 0.15, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#111';
          ctx.beginPath();
          ctx.ellipse(-headR * 0.4, headY - 3, 2, 8.5, 0, 0, Math.PI * 2);
          ctx.ellipse(headR * 0.4, headY - 3, 2, 8.5, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (isHappy) {
          ctx.strokeStyle = '#2d3436';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(-headR * 0.4, headY - 3, 8, Math.PI, 0);
          ctx.arc(headR * 0.4, headY - 3, 8, Math.PI, 0);
          ctx.stroke();
        } else {
          // 宝石大圆眼
          ctx.fillStyle = cat.breed.eyeColor;
          ctx.beginPath();
          ctx.ellipse(-headR * 0.4, headY - 3, 9, 11, 0, 0, Math.PI * 2);
          ctx.ellipse(headR * 0.4, headY - 3, 9, 11, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#111';
          ctx.beginPath();
          ctx.arc(-headR * 0.4, headY - 3, 5, 0, Math.PI * 2);
          ctx.arc(headR * 0.4, headY - 3, 5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(-headR * 0.4 - 2, headY - 6, 3, 0, Math.PI * 2);
          ctx.arc(headR * 0.4 - 2, headY - 6, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        // 鼻子
        ctx.fillStyle = '#ff7675';
        ctx.beginPath();
        ctx.arc(0, headY + 8, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // 吃猫条舌头动画
        if (this.studioTongueOut > 0) {
          ctx.fillStyle = '#ff9ff3';
          ctx.beginPath();
          ctx.arc(0, headY + 16, 7, 0, Math.PI);
          ctx.fill();
        }

        // 胡须
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-15, headY + 9); ctx.lineTo(-45, headY + 5);
        ctx.moveTo(-15, headY + 13); ctx.lineTo(-45, headY + 16);
        ctx.moveTo(15, headY + 9); ctx.lineTo(45, headY + 5);
        ctx.moveTo(15, headY + 13); ctx.lineTo(45, headY + 16);
        ctx.stroke();

        // 佩戴帽子
        cat.drawHat(ctx, headY, headR);

        ctx.restore();

        // 3. 互动飘飞粒子渲染
        for (let i = this.studioParticles.length - 1; i >= 0; i--) {
          const p = this.studioParticles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 0.025;

          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.font = '22px sans-serif';
          ctx.fillText(p.text, p.x, p.y);
          ctx.restore();

          if (p.alpha <= 0) this.studioParticles.splice(i, 1);
        }

        this.studioAnimId = requestAnimationFrame(render);
      };

      render();
    }
  }

  window.CyberMeow = window.CyberMeow || {};
  window.CyberMeow.uiManager = new UIManager();
})(window);
