/**
 * CyberMeow - 用户界面交互与管理系统 (UI Manager)
 * 包含：猫咪身份证模态、拍立得快照生成、红点追逐挑战模式、提示通知
 */
(function(window) {
  'use strict';

  const { soundEngine, HATS, Cat } = window.CyberMeow;

  // Cell coordinates and mouth anchors in the 380 × 260 portrait artwork.
  const STUDIO_PORTRAITS = {
    blue:    { col: 0, row: 0, mouth: [317, 99] },
    orange:  { col: 1, row: 0, mouth: [327, 106] },
    tuxedo:  { col: 0, row: 1, mouth: [332, 95] },
    white:   { col: 1, row: 1, mouth: [331, 98] },
    calico:  { col: 0, row: 2, mouth: [326, 103] },
    siamese: { col: 1, row: 2, mouth: [342, 96] }
  };

  let paintedStudioLayers;
  function studioLayers() {
    if (!paintedStudioLayers) {
      paintedStudioLayers = ['studio-cats', 'studio-eyelids'].map(name => {
        const image = new Image();
        image.src = 'assets/' + name + '.webp';
        return image;
      });
    }
    return paintedStudioLayers;
  }

  function drawPaintedStudioCat(ctx, pose, expression, layers) {
    const portrait = STUDIO_PORTRAITS[pose.breed.id];
    const [coat, eyelids] = layers;
    if (!portrait || !coat.complete || !coat.naturalWidth) return false;

    const drawLayer = image => ctx.drawImage(image, portrait.col * 640, portrait.row * 440,
      640, 440, 0, -255, 380, 260);
    ctx.save();
    // Keep all four paws on the cushion as the shoulders breathe and lean toward the hand.
    ctx.translate(39, 205);
    const scale = pose.hat === 'wizard' || pose.hat === 'party' ? .66 : .75;
    const breath = Math.sin(pose.loafBreathe) * .006;
    ctx.transform(scale, 0, -expression.gazeX * .016, scale * (1 + breath - expression.gazeY * .012), 0, 0);
    drawLayer(coat);
    if (eyelids.complete && eyelids.naturalWidth) {
      ctx.globalAlpha = Math.max(expression.blink, expression.happy ? .97 : 0, expression.angry ? .34 : 0);
      if (ctx.globalAlpha > .01) drawLayer(eyelids);
      ctx.globalAlpha = 1;
    }
    const [mouthX, mouthY] = portrait.mouth;
    if (expression.lick) {
      ctx.fillStyle = '#d99191';
      ctx.beginPath();
      ctx.ellipse(mouthX + 1, mouthY - 253, 3.4, 5, -.20, 0, Math.PI * 2);
      ctx.fill();
    }
    if (pose.hat && pose.hat !== 'none') {
      ctx.translate(mouthX - 15, mouthY - 281);
      pose._drawProfileHat(ctx, 53, expression);
    }
    ctx.restore();
    return true;
  }

  const CHALLENGE_DURATION = 45;

  const BUILD_CATALOG = {
    cats: [
      { id: 'cat', icon: '🐱', name: '领养猫咪', desc: '随机品种和性格', action: '召唤' },
      { id: 'fish', icon: '🐟', name: '小鱼干', desc: '补充猫咪的饱腹度', action: '投喂' },
      { id: 'catnip', icon: '🌿', name: '猫薄荷', desc: '让附近的猫咪打滚', action: '喷洒' }
    ],
    toys: [
      { id: 'yarn', icon: '🧶', name: '毛线球', desc: '能弹跳和滚动，可被猫咪推走', action: '放置' },
      { id: 'feather', icon: '🪶', name: '逗猫棒', desc: '跟随光标移动，吸引猫咪扑跳', action: '选用' },
      { id: 'laser', icon: '🔴', name: '激光笔', desc: '让猫咪追逐光标处的红点', action: '选用' }
    ],
    furniture: [
      { id: 'box', icon: '📦', name: '纸箱', desc: '可以钻进去的纸箱窝', action: '放置' },
      { id: 'roomba', icon: '🤖', name: '扫地机', desc: '在地面巡逻，猫咪可以搭乘', action: '放置' },
      { id: 'scratcher', icon: '🪵', name: '猫抓板', desc: '给猫咪磨爪的地方', action: '放置' },
      { id: 'recycle', icon: '🧹', name: '回收工具', desc: '点击单件玩具或家具收回', action: '选用' }
    ],
    structures: [
      { id: 'cattree', icon: '🌳', name: '猫爬架', desc: '带跳台和悬挂玩具的高架', action: '搭建' },
      { id: 'bridge', icon: '🌉', name: '悬索天桥', desc: '猫咪经过时会轻轻下沉', action: '搭建' },
      { id: 'hammock', icon: '☁️', name: '吊床', desc: '悬挂在半空，可以推动摇摆', action: '悬挂' }
    ]
  };

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
      this.activeModal = null;
    }

    init() {
      this.bindPassportEvents();
      this.bindSnapshotEvents();
      this.bindStudioEvents();
      this.bindCatalogEvents();
      this.bindRenderTunerEvents();
    }

    showModal(modal, dismiss) {
      if (this.activeModal === modal) return;
      this.dismissModal();
      this.activeModal = modal;
      this.dismissModalAction = dismiss;
      this.modalTrigger = document.activeElement;
      const shell = document.getElementById('game-shell');
      if (shell) shell.inert = true;
      modal.classList.add('open');
      modal.onclick = (event) => {
        if (event.target === modal) this.dismissModal();
      };
      modal.onkeydown = (event) => {
        if (event.key !== 'Tab') return;
        const controls = [...modal.querySelectorAll('button, input, a[href]')]
          .filter(control => !control.disabled && control.getClientRects().length);
        const first = controls[0];
        const last = controls.at(-1);
        const edge = event.shiftKey ? first : last;
        if (edge && document.activeElement === edge) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      };
      modal.querySelector?.('.btn-close, #btn-close-snapshot')?.focus();
    }

    hideModal(modal) {
      if (!modal) return;
      modal.classList.remove('open');
      if (this.activeModal !== modal) return;
      this.activeModal = null;
      this.dismissModalAction = null;
      const shell = document.getElementById('game-shell');
      if (shell) shell.inert = false;
      this.modalTrigger?.focus?.();
      this.modalTrigger = null;
    }

    dismissModal() {
      this.dismissModalAction?.();
    }

    // --- 建造与摆放仓库系统 (Build Catalog) ---
    openBuildCatalog() {
      const modal = document.getElementById('build-catalog-modal');
      if (!modal) return;
      this.currentCatalogTab = this.currentCatalogTab || 'cats';
      this.renderCatalogGrid(this.currentCatalogTab);
      this.showModal(modal, () => this.closeBuildCatalog());
      soundEngine.playPop();
    }

    closeBuildCatalog() {
      const modal = document.getElementById('build-catalog-modal');
      this.hideModal(modal);
    }

    renderCatalogGrid(categoryKey) {
      this.currentCatalogTab = categoryKey;
      const container = document.getElementById('catalog-grid-items');
      if (!container) return;
      container.innerHTML = '';

      document.querySelectorAll('.catalog-tab-btn').forEach(btn => {
        const active = btn.dataset.tab === categoryKey;
        btn.classList.toggle('active', active);
        btn.setAttribute?.('aria-pressed', String(active));
      });

      const items = BUILD_CATALOG[categoryKey] || [];
      items.forEach(item => {
        const card = document.createElement('button');
        card.className = 'catalog-item-card';
        card.innerHTML = `
          <span class="catalog-item-icon" aria-hidden="true">${item.icon}</span>
          <span>
            <span class="catalog-item-title">${item.name}</span>
            <span class="catalog-item-desc">${item.desc}</span>
          </span>
          <span class="catalog-item-action" aria-hidden="true">${item.action} →</span>
        `;
        card.onclick = () => {
          this.closeBuildCatalog();
          const app = window.CyberMeow.app;
          if (!app) return;
          if (['laser', 'feather', 'recycle'].includes(item.id)) app.setTool(item.id);
          else app.startPlacement(item.id);
        };
        container.appendChild(card);
      });
    }

    bindCatalogEvents() {
      const openBtn = document.getElementById('btn-build-catalog');
      if (openBtn) openBtn.onclick = () => this.openBuildCatalog();

      const closeBtn = document.getElementById('btn-close-catalog');
      if (closeBtn) closeBtn.onclick = () => this.closeBuildCatalog();

      document.querySelectorAll('.catalog-tab-btn').forEach(btn => {
        btn.onclick = () => {
          const tab = btn.dataset.tab;
          if (tab) this.renderCatalogGrid(tab);
        };
      });

      const cancelPlacementBtn = document.getElementById('btn-cancel-placement');
      if (cancelPlacementBtn) {
        cancelPlacementBtn.onclick = () => {
          const app = window.CyberMeow.app;
          if (app && app.cancelPlacement) app.cancelPlacement();
        };
      }

      const lodBtn = document.getElementById('btn-cat-lod');
      if (lodBtn) {
        lodBtn.onclick = () => {
          const app = window.CyberMeow.app;
          if (app && app.toggleCatLOD) app.toggleCatLOD();
        };
      }
    }

    // --- 底层绘制引擎与标签折叠调控中心 (Render Engine Tuner) ---
    openRenderTuner() {
      const modal = document.getElementById('render-tuner-modal');
      if (!modal) return;
      this.syncTunerUI();
      this.showModal(modal, () => this.closeRenderTuner());
      if (soundEngine?.playPop) soundEngine.playPop();
    }

    closeRenderTuner() {
      const modal = document.getElementById('render-tuner-modal');
      this.hideModal(modal);
    }

    syncTunerUI() {
      const app = window.CyberMeow.app;
      if (!app || !app.renderEngineConfig) return;
      const cfg = app.renderEngineConfig;

      // 管线按钮状态
      document.querySelectorAll('#tuner-pipeline-group .tuner-opt-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.val === cfg.pipeline);
      });

      // 聚类折叠策略按钮状态
      document.querySelectorAll('#tuner-cluster-group .tuner-opt-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.val === cfg.clusterMode);
      });

      // 复选框
      const chkSprite = document.getElementById('chk-sprite-cache');
      if (chkSprite) chkSprite.checked = !!cfg.spriteCache;

      const chkEye = document.getElementById('chk-eye-tracking');
      if (chkEye) chkEye.checked = !!cfg.eyeTracking;

      const chkTelem = document.getElementById('chk-show-telemetry');
      if (chkTelem) chkTelem.checked = !!cfg.showTelemetry;
    }

    bindRenderTunerEvents() {
      const openBtn = document.getElementById('btn-render-tuner');
      if (openBtn) openBtn.onclick = () => this.openRenderTuner();

      const closeBtn = document.getElementById('btn-close-tuner');
      if (closeBtn) closeBtn.onclick = () => this.closeRenderTuner();

      // 预设点击
      document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.onclick = () => {
          const preset = btn.dataset.preset;
          const app = window.CyberMeow.app;
          if (app && app.applyRenderPreset) {
            app.applyRenderPreset(preset);
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.syncTunerUI();
          }
        };
      });

      // 管线模式切换
      document.querySelectorAll('#tuner-pipeline-group .tuner-opt-btn').forEach(btn => {
        btn.onclick = () => {
          const val = btn.dataset.val;
          const app = window.CyberMeow.app;
          if (app && app.setRenderPipeline) {
            app.setRenderPipeline(val);
            this.syncTunerUI();
          }
        };
      });

      // 聚类折叠策略切换
      document.querySelectorAll('#tuner-cluster-group .tuner-opt-btn').forEach(btn => {
        btn.onclick = () => {
          const val = btn.dataset.val;
          const app = window.CyberMeow.app;
          if (app && app.setClusterMode) {
            app.setClusterMode(val);
            this.syncTunerUI();
          }
        };
      });

      // 开关勾选
      const chkSprite = document.getElementById('chk-sprite-cache');
      if (chkSprite) {
        chkSprite.onchange = (e) => {
          const app = window.CyberMeow.app;
          if (app && app.renderEngineConfig) {
            app.renderEngineConfig.spriteCache = e.target.checked;
            this.showToast(e.target.checked ? '⚡ 已开启离屏 Sprite 身体缓存 (加速 300%)' : '🎨 已切换至纯原生实时矢量绘制');
          }
        };
      }

      const chkEye = document.getElementById('chk-eye-tracking');
      if (chkEye) {
        chkEye.onchange = (e) => {
          const app = window.CyberMeow.app;
          if (app && app.renderEngineConfig) {
            app.renderEngineConfig.eyeTracking = e.target.checked;
            this.showToast(e.target.checked ? '👀 已开启灵动立体双眼视线追踪' : '👀 灵动双眼视线追踪已关闭');
          }
        };
      }

      const chkTelem = document.getElementById('chk-show-telemetry');
      if (chkTelem) {
        chkTelem.onchange = (e) => {
          const app = window.CyberMeow.app;
          if (app && app.renderEngineConfig) {
            app.renderEngineConfig.showTelemetry = e.target.checked;
            const hud = document.getElementById('telemetry-hud');
            if (hud) hud.style.display = e.target.checked ? 'block' : 'none';
          }
        };
      }
    }

    showToast(msg, duration = 3000) {
      const hint = document.getElementById('hint-text');
      if (hint) {
        hint.innerText = msg;
        hint.style.opacity = msg ? '1' : '0';
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => {
          hint.style.opacity = '0';
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

      this.showModal(modal, () => this.closeCatPassport());
      soundEngine.playMeow(cat.pitchMod, 'chirp');
    }

    closeCatPassport() {
      const modal = document.getElementById('passport-modal');
      this.hideModal(modal);
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

      this.selectedCat.drawPortrait(ctx, avatarCanvas.width);
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
      const photoWidth = Math.round(mainCanvas.width * 0.75);
      const photoHeight = Math.round(mainCanvas.height * 0.75);
      const pad = Math.max(8, Math.round(photoWidth * 0.024));
      snapCanvas.width = photoWidth + pad * 2;
      snapCanvas.height = photoHeight + pad * 2 + 34;
      const sctx = snapCanvas.getContext('2d');

      // 拍立得相纸白底
      sctx.fillStyle = '#f8f9fa';
      sctx.fillRect(0, 0, snapCanvas.width, snapCanvas.height);

      // 画面图像
      sctx.drawImage(
        mainCanvas,
        0, 0, mainCanvas.width, mainCanvas.height,
        pad, pad, photoWidth, photoHeight
      );

      sctx.fillStyle = '#315643';
      sctx.font = 'bold 16px Georgia, serif';
      sctx.fillText('CyberMeow', pad, snapCanvas.height - 14, photoWidth);
      if (photoWidth > 220) {
        sctx.textAlign = 'right';
        sctx.font = '12px sans-serif';
        sctx.fillText(new Date().toLocaleDateString('zh-CN'), snapCanvas.width - pad, snapCanvas.height - 14);
      }

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
        this.showModal(modal, () => this.closeSnapshot());
      }
    }

    closeSnapshot() {
      this.hideModal(document.getElementById('snapshot-modal'));
    }

    bindSnapshotEvents() {
      const closeBtn = document.getElementById('btn-close-snapshot');
      if (closeBtn) closeBtn.onclick = () => this.closeSnapshot();
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
      document.getElementById('btn-challenge')?.setAttribute?.('aria-pressed', 'true');
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
      document.getElementById('btn-challenge')?.setAttribute?.('aria-pressed', 'false');
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
      this.studioGaze = { x: 0, y: 0 };

      const modal = document.getElementById('studio-modal');
      const title = document.getElementById('studio-cat-name');
      const furBanner = document.getElementById('studio-fur-banner');
      if (!modal) return;

      if (title) title.innerText = `照顾 ${cat.name}`;
      if (furBanner) furBanner.style.display = 'none';

      this.updateStudioPatienceUI();
      this.showModal(modal, () => this.closeCloseUpStudio());

      soundEngine.playMeow(cat.pitchMod, 'pleading');
      this.startStudioAnimation();
      this.updateStudioToolUI();
    }

    closeCloseUpStudio() {
      const modal = document.getElementById('studio-modal');
      this.hideModal(modal);
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
        bar.style.background = '#4d7950';
        tag.innerText = '🥰 极度舒适';
        tag.style.color = '#4d7950';
      } else if (pct > 25) {
        bar.style.background = '#9a611c';
        tag.innerText = '⚠️ 尾巴微甩，注意别一直摸肚皮';
        tag.style.color = '#9a611c';
      } else {
        bar.style.background = '#a5433d';
        tag.innerText = '😾 飞机耳！随时亮爪抱咬！';
        tag.style.color = '#a5433d';
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
      const passportBtn = document.getElementById('btn-studio-passport');
      if (passportBtn) passportBtn.onclick = () => {
        const cat = this.studioCat;
        if (!cat) return;
        this.closeCloseUpStudio();
        this.openCatPassport(cat);
      };

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
        lastX = (e.clientX - rect.left) * 380 / rect.width;
        lastY = (e.clientY - rect.top) * 240 / rect.height;
        this.interactStudio(lastX, lastY);
      };

      const onPointerMove = (e) => {
        if (!this.studioCat || (!isDown && e.target !== canvas)) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * 380 / rect.width;
        const y = (e.clientY - rect.top) * 240 / rect.height;
        this.studioGaze.x = Math.max(-1, Math.min(1, (x - 271) / 105));
        this.studioGaze.y = Math.max(-1, Math.min(1, (y - 104) / 80));
        if (isDown && Math.hypot(x - lastX, y - lastY) > 16) {
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
      window.addEventListener('pointercancel', onPointerUp);
    }

    interactStudio(x, y) {
      if (!this.studioCat) return;
      if (this.studioBiteCooldown > 0) return; // 被咬后的傲娇冷却期

      const cat = this.studioCat;
      const head = ((x - 271) / 42) ** 2 + ((y - 94) / 47) ** 2;
      const body = ((x - 172) / 93) ** 2 + ((y - 131) / 39) ** 2;
      if (head > 1 && body > 1) return;
      const isBellyZone = body <= 1 && x < 206 && y > 142; // 肚皮禁区判定！

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
      const logicalWidth = 380;
      const logicalHeight = 240;
      const footY = 205;
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      const pixelWidth = Math.round(logicalWidth * dpr);
      const pixelHeight = Math.round(logicalHeight * dpr);

      // 保持 380x240 逻辑坐标，仅按设备像素比提高画布后备分辨率。
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      // 快速反复打开侍奉台时，先取消上一轮循环，避免两个 rAF 同时写同一画布
      cancelAnimationFrame(this.studioAnimId);

      const backdrop = new Image();
      backdrop.decoding = 'async';
      backdrop.src = 'assets/studio-window.webp';
      const layers = studioLayers();

      const fallback = document.createElement('canvas');
      fallback.width = pixelWidth;
      fallback.height = pixelHeight;
      const fallbackCtx = fallback.getContext('2d');
      fallbackCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fallbackCtx.imageSmoothingEnabled = true;
      fallbackCtx.imageSmoothingQuality = 'high';

      // 图片加载前或加载失败时使用：暖窗光、低对比窗框与厚实织物坐垫。
      const wall = fallbackCtx.createLinearGradient(0, 0, 0, logicalHeight);
      wall.addColorStop(0, '#eee7d5');
      wall.addColorStop(.58, '#e7d8bd');
      wall.addColorStop(1, '#c49c73');
      fallbackCtx.fillStyle = wall;
      fallbackCtx.fillRect(0, 0, logicalWidth, logicalHeight);

      const daylight = fallbackCtx.createRadialGradient(316, 8, 8, 316, 8, 285);
      daylight.addColorStop(0, 'rgba(255, 250, 218, .96)');
      daylight.addColorStop(.38, 'rgba(255, 236, 184, .58)');
      daylight.addColorStop(1, 'rgba(255, 224, 168, 0)');
      fallbackCtx.fillStyle = daylight;
      fallbackCtx.fillRect(0, 0, logicalWidth, logicalHeight);

      const glass = fallbackCtx.createLinearGradient(22, 12, 356, 178);
      glass.addColorStop(0, '#e8edda');
      glass.addColorStop(.48, '#f7edcd');
      glass.addColorStop(1, '#b9c8ae');
      fallbackCtx.beginPath();
      fallbackCtx.roundRect(20, 10, 340, 166, 11);
      fallbackCtx.fillStyle = glass;
      fallbackCtx.fill();

      fallbackCtx.save();
      fallbackCtx.beginPath();
      fallbackCtx.roundRect(20, 10, 340, 166, 11);
      fallbackCtx.clip();
      fallbackCtx.fillStyle = 'rgba(105, 132, 102, .13)';
      fallbackCtx.beginPath();
      fallbackCtx.ellipse(64, 166, 92, 48, -.18, 0, Math.PI * 2);
      fallbackCtx.ellipse(322, 171, 105, 57, .16, 0, Math.PI * 2);
      fallbackCtx.fill();
      fallbackCtx.fillStyle = 'rgba(255, 255, 239, .19)';
      fallbackCtx.beginPath();
      fallbackCtx.moveTo(250, 10);
      fallbackCtx.lineTo(360, 10);
      fallbackCtx.lineTo(214, 176);
      fallbackCtx.lineTo(100, 176);
      fallbackCtx.closePath();
      fallbackCtx.fill();
      fallbackCtx.restore();

      fallbackCtx.strokeStyle = 'rgba(244, 231, 204, .78)';
      fallbackCtx.lineWidth = 5;
      fallbackCtx.beginPath();
      fallbackCtx.roundRect(20, 10, 340, 166, 11);
      fallbackCtx.stroke();
      fallbackCtx.strokeStyle = 'rgba(92, 103, 87, .13)';
      fallbackCtx.lineWidth = 8;
      fallbackCtx.beginPath();
      fallbackCtx.moveTo(88, 15);
      fallbackCtx.lineTo(88, 172);
      fallbackCtx.moveTo(292, 15);
      fallbackCtx.lineTo(292, 172);
      fallbackCtx.moveTo(25, 86);
      fallbackCtx.lineTo(355, 86);
      fallbackCtx.stroke();
      fallbackCtx.strokeStyle = 'rgba(255, 250, 232, .55)';
      fallbackCtx.lineWidth = 2;
      fallbackCtx.beginPath();
      fallbackCtx.moveTo(72, 18);
      fallbackCtx.lineTo(72, 176);
      fallbackCtx.moveTo(276, 18);
      fallbackCtx.lineTo(276, 176);
      fallbackCtx.stroke();

      const sill = fallbackCtx.createLinearGradient(0, 174, 0, 194);
      sill.addColorStop(0, 'rgba(238, 222, 192, .92)');
      sill.addColorStop(1, 'rgba(147, 113, 82, .22)');
      fallbackCtx.fillStyle = sill;
      fallbackCtx.fillRect(12, 175, 356, 17);

      fallbackCtx.save();
      fallbackCtx.translate(183, 217);
      fallbackCtx.fillStyle = 'rgba(61, 45, 34, .18)';
      fallbackCtx.beginPath();
      fallbackCtx.ellipse(0, 10, 158, 24, 0, 0, Math.PI * 2);
      fallbackCtx.fill();

      const cushionSide = fallbackCtx.createLinearGradient(0, 187, 0, 238);
      cushionSide.addColorStop(0, '#8d6b55');
      cushionSide.addColorStop(1, '#63493d');
      fallbackCtx.fillStyle = cushionSide;
      fallbackCtx.beginPath();
      fallbackCtx.ellipse(0, 0, 145, 25, 0, 0, Math.PI * 2);
      fallbackCtx.fill();

      const cushionTop = fallbackCtx.createLinearGradient(-105, 174, 112, 218);
      cushionTop.addColorStop(0, '#ba9270');
      cushionTop.addColorStop(.55, '#a37b5f');
      cushionTop.addColorStop(1, '#816149');
      fallbackCtx.fillStyle = cushionTop;
      fallbackCtx.beginPath();
      fallbackCtx.ellipse(0, -12, 147, 26, 0, 0, Math.PI * 2);
      fallbackCtx.fill();

      fallbackCtx.strokeStyle = 'rgba(235, 211, 176, .44)';
      fallbackCtx.lineWidth = 1.4;
      fallbackCtx.setLineDash([4, 5]);
      fallbackCtx.beginPath();
      fallbackCtx.ellipse(0, -11, 133, 19, 0, 0, Math.PI * 2);
      fallbackCtx.stroke();
      fallbackCtx.setLineDash([]);
      fallbackCtx.strokeStyle = 'rgba(59, 42, 33, .25)';
      fallbackCtx.lineWidth = 1.2;
      fallbackCtx.beginPath();
      fallbackCtx.moveTo(-139, 3);
      fallbackCtx.quadraticCurveTo(0, 28, 139, 3);
      fallbackCtx.stroke();
      fallbackCtx.restore();

      const cat = this.studioCat;
      const pose = new Cat({
        x: 177, y: footY - 63, radius: 63, facing: 1, vx: 0, state: 'idle',
        breed: cat.breed, hat: cat.hat, dna: cat.dna, age: cat.age,
        bcs: cat.bcs, fluff: cat.fluff, personality: cat.personality
      });
      let gazeX = 0;
      let gazeY = 0;
      const startedAt = performance.now();

      const render = () => {
        if (!this.studioCat) return;
        ctx.clearRect(0, 0, logicalWidth, logicalHeight);
        if (backdrop.complete && backdrop.naturalWidth > 0) {
          ctx.drawImage(backdrop, 0, 0, logicalWidth, logicalHeight);
        } else {
          ctx.drawImage(fallback, 0, 0, logicalWidth, logicalHeight);
        }

        // 图片背景的坐垫已包含体积，这里只统一压住脚底接触关系。
        const contactShadow = ctx.createRadialGradient(198, footY - 1, 4, 198, footY - 1, 112);
        contactShadow.addColorStop(0, 'rgba(48, 31, 24, .34)');
        contactShadow.addColorStop(.42, 'rgba(55, 36, 27, .18)');
        contactShadow.addColorStop(1, 'rgba(55, 36, 27, 0)');
        ctx.fillStyle = contactShadow;
        ctx.beginPath();
        ctx.ellipse(198, footY - 1, 112, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        if (this.studioScreenShake > 0) {
          const shake = this.studioScreenShake;
          ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
          this.studioScreenShake = shake < .5 ? 0 : shake * .88;
        }
        if (this.studioBiteCooldown > 0) this.studioBiteCooldown--;
        const isHappy = this.studioPurrTimer > 0;
        const isAngry = this.studioBiteCooldown > 60 || this.studioPatience < 25;
        if (this.studioPurrTimer > 0) this.studioPurrTimer--;
        if (this.studioTongueOut > 0) this.studioTongueOut--;

        gazeX += (this.studioGaze.x - gazeX) * .13;
        gazeY += (this.studioGaze.y - gazeY) * .13;
        pose.loafBreathe = performance.now() * .003;
        const blinkPhase = (performance.now() - startedAt + 1100) % 3600;
        const expression = {
          tilt: -.035 + gazeX * .045,
          gazeX: .12 + gazeX * .55,
          gazeY: gazeY * .60,
          blink: Math.max(0, 1 - Math.abs(blinkPhase - 3420) / 92),
          happy: isHappy,
          angry: isAngry,
          lick: this.studioTongueOut > 0
        };
        if (!drawPaintedStudioCat(ctx, pose, expression, layers)) {
          pose.render(ctx, logicalWidth, logicalHeight, { suppressIndividualLabels: true, profile: expression });
        }
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

  // ============================================================================
  // 空间聚类与标签分级折叠引擎 (Spatial Clustering & Label Folding Engine)
  // 基于双边界原理 (Dual-Boundary)，解决多猫沙盒信息过载与文字碰撞光污染
  // ============================================================================
  class LabelClusterEngine {
    constructor() {
      this.hoveredCluster = null;
      this.clusters = [];
    }

    /**
     * 对视口内的猫咪执行空间连通分量距离聚类
     */
    clusterCats(cats, viewport, threshold = 75) {
      const visibleCats = [];
      const { cameraX, zoom, width } = viewport;
      const minX = cameraX - 80;
      const maxX = cameraX + width / zoom + 80;

      for (let c of cats) {
        if (c.x >= minX && c.x <= maxX) {
          visibleCats.push(c);
        }
      }

      const n = visibleCats.length;
      if (n === 0) {
        this.clusters = [];
        return { clusters: [], singletons: [] };
      }

      // 并查集
      const parent = new Array(n);
      for (let i = 0; i < n; i++) parent[i] = i;
      const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
      const union = (i, j) => {
        const rootI = find(i);
        const rootJ = find(j);
        if (rootI !== rootJ) parent[rootI] = rootJ;
      };

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dx = Math.abs(visibleCats[i].x - visibleCats[j].x);
          const dy = Math.abs(visibleCats[i].y - visibleCats[j].y);
          if (dx < threshold && dy < threshold * 0.65) {
            union(i, j);
          }
        }
      }

      const groups = new Map();
      for (let i = 0; i < n; i++) {
        const root = find(i);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root).push(visibleCats[i]);
      }

      const clusters = [];
      const singletons = [];

      for (let [root, members] of groups) {
        if (members.length > 1) {
          let sumX = 0;
          let minY = Infinity;
          members.forEach(m => {
            sumX += m.x;
            minY = Math.min(minY, (m.visualFootY ?? m.y) - (m.radius || 22) * 2.25);
          });
          clusters.push({
            id: `cluster_${root}`,
            cats: members,
            cx: sumX / members.length,
            cy: minY - 9,
            count: members.length
          });
        } else {
          singletons.push(members[0]);
        }
      }

      this.clusters = clusters;
      return { clusters, singletons };
    }

    /**
     * 统一上层渲染管线：绘制聚类胶囊与折叠后的单猫标签
     */
    renderLabels(ctx, cats, viewport, config = {}, mouseWorld = null) {
      const mode = config.clusterMode || 'smart'; // 'smart' | 'minimal' | 'full'
      const { clusters, singletons } = this.clusterCats(cats, viewport);

      ctx.save();

      // 1. 渲染团簇折叠胶囊 (Cat Clump Capsule)
      if (mode !== 'full') {
        for (let cl of clusters) {
          const isHovered = mouseWorld && Math.hypot(mouseWorld.x - cl.cx, mouseWorld.y - cl.cy) < 45;
          this._drawClusterCapsule(ctx, cl, isHovered, mode);
        }
      }

      // 2. 渲染单猫或全量展开标签 (带相邻 Y 轴防遮挡避让)
      const targetCats = (mode === 'full') ? cats : singletons;
      const sorted = [...targetCats].sort((a, b) => a.x - b.x);

      for (let i = 0; i < sorted.length; i++) {
        const cat = sorted[i];
        let yOffset = 0;
        if (i > 0 && Math.abs(cat.x - sorted[i - 1].x) < 48) {
          yOffset = -14; // 相邻猫咪 Y 轴梯级错开避让
        }

        const isHovered = mouseWorld && Math.hypot(mouseWorld.x - cat.x, mouseWorld.y - ((cat.visualFootY ?? cat.y) - 30)) < 36;
        const isFocus = (cat.isGrabbed || isHovered || cat === config.catCam);

        this._drawSingleCatLabel(ctx, cat, mode, isFocus, yOffset);
      }

      ctx.restore();
    }

    _drawClusterCapsule(ctx, cluster, isHovered, mode) {
      const { cx, cy, cats, count } = cluster;
      const names = cats.map(c => c.name).join('·');
      const label = isHovered ? names : `${count} 只猫`;

      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const textW = ctx.measureText(label).width;
      const padX = 12;
      const bw = textW + padX * 2;
      const bh = 22;

      ctx.save();
      ctx.translate(cx, cy);

      // 半透明磨砂胶囊底盘
      ctx.fillStyle = isHovered ? '#315643' : 'rgba(39, 57, 44, 0.9)';
      ctx.strokeStyle = isHovered ? '#d9dcb9' : 'rgba(255, 253, 246, 0.52)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 11);
      } else {
        ctx.rect(-bw / 2, -bh / 2, bw, bh);
      }
      ctx.fill();
      ctx.stroke();

      // 文字
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 0);

      // 若有猫咪正在说话，在胶囊上方显示最新合并气泡
      const speakingCat = cats.find(c => c.bubbleTimer > 0 && c.bubbleText);
      if (speakingCat) {
        const bubble = `💬 ${speakingCat.name}: "${speakingCat.bubbleText}"`;
        const bW = ctx.measureText(bubble).width + 16;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(-bW / 2, -bh / 2 - 24, bW, 18, 9);
        } else {
          ctx.rect(-bW / 2, -bh / 2 - 24, bW, 18);
        }
        ctx.fill();
        ctx.fillStyle = '#1e272e';
        ctx.fillText(bubble, 0, -bh / 2 - 15);
      }

      ctx.restore();
    }

    _drawSingleCatLabel(ctx, cat, mode, isFocus, yOffset = 0) {
      const R = cat.radius || 22;
      const topY = (cat.visualFootY ?? cat.y) - R * 2.2 + yOffset;

      ctx.save();
      ctx.translate(cat.x, topY);

      if (mode === 'minimal' && !isFocus) {
        // 极简微标模式：常态仅显示微光点
        ctx.fillStyle = (cat.purrLevel > 0) ? '#4d7950' : 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const nameW = ctx.measureText(cat.name).width;

      if (isFocus) {
        // 焦点态/悬停态：展开详细名牌与高亮光晕
        const pillW = nameW + 28;
        ctx.fillStyle = '#315643';
        ctx.strokeStyle = '#f5eee0';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(-pillW / 2, -16, pillW, 18, 9);
        } else {
          ctx.rect(-pillW / 2, -16, pillW, 18);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cat.name, 0, -7);
      } else {
        // 常态紧凑微标
        const pillW = nameW + 12;
        ctx.fillStyle = 'rgba(39, 57, 44, 0.73)';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(-pillW / 2, -14, pillW, 14, 7);
        } else {
          ctx.rect(-pillW / 2, -14, pillW, 14);
        }
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cat.name, 0, -7);
      }

      // 气泡与徽章
      if (cat.bubbleTimer > 0 && cat.bubbleText) {
        cat.drawSpeechBubble(ctx, -20, true);
      } else if (cat.intentIcon && isFocus) {
        cat.drawIntentBadge(ctx, -20, true);
      }

      ctx.restore();
    }
  }

  // ============================================================================
  // 底层绘制引擎调控中枢 (Render Engine Manager)
  // ============================================================================
  class RenderEngineManager {
    constructor() {
      this.config = {
        pipeline: 'chibi',          // 'chibi' (Q萌) | 'chibi_cached' (极速Sprite) | 'procedural' (拟真)
        clusterMode: 'smart',       // 'smart' (智能聚类折叠) | 'minimal' (极简) | 'full' (全开)
        clusterLabels: true,        // 是否使用 LabelClusterEngine 做全局抗重叠渲染
        spriteCache: true,          // 离屏 Sprite 缓存烘焙
        eyeTracking: true,          // 灵动双眼视线追踪
        particleBudget: 100,        // 粒子上限预算
        showTelemetry: false        // 是否显示遥测浮窗
      };
      this.telemetry = {
        fps: 60,
        frameMs: 1.2,
        activeClusters: 0,
        visibleCats: 0,
        cacheHitRate: '100%',
        culledEntities: 0
      };
    }

    applyPreset(presetName) {
      if (presetName === 'saver') {
        this.config.pipeline = 'chibi_cached';
        this.config.clusterMode = 'minimal';
        this.config.spriteCache = true;
        this.config.eyeTracking = false;
        this.config.particleBudget = 30;
      } else if (presetName === 'ultra') {
        this.config.pipeline = 'procedural';
        this.config.clusterMode = 'full';
        this.config.spriteCache = false;
        this.config.eyeTracking = true;
        this.config.particleBudget = 240;
      } else { // balanced
        this.config.pipeline = 'chibi';
        this.config.clusterMode = 'smart';
        this.config.spriteCache = true;
        this.config.eyeTracking = true;
        this.config.particleBudget = 100;
      }
    }
  }

  window.CyberMeow = window.CyberMeow || {};
  window.CyberMeow.LabelClusterEngine = new LabelClusterEngine();
  window.CyberMeow.renderEngineManager = new RenderEngineManager();
  window.CyberMeow.uiManager = new UIManager();
})(window);
