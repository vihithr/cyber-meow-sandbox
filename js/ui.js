/**
 * CyberMeow - 用户界面交互与管理系统 (UI Manager)
 * 包含：猫咪身份证模态、拍立得快照生成、红点追逐挑战模式、提示通知
 */
(function(window) {
  'use strict';

  const { soundEngine, HATS } = window.CyberMeow;
  const CHALLENGE_DURATION = 45;

  const BUILD_CATALOG = {
    cats: [
      { id: 'cat', icon: '🐱', name: '召唤新猫咪', desc: '领养一只随机品种与性格的萌猫入住豪宅', action: '召唤' },
      { id: 'fish', icon: '🐟', name: '香脆小鱼干', desc: '美味小鱼干零食，猫咪闻香飞奔吃掉补充饱腹度', action: '投喂' },
      { id: 'catnip', icon: '🌿', name: '猫薄荷喷雾', desc: '快乐神草！让附近的猫咪陷入极乐打滚与兔子蹬', action: '喷洒' }
    ],
    toys: [
      { id: 'yarn', icon: '🧶', name: '弹力毛线球', desc: '带物理弹力的毛线球，猫咪扑咬蹬踹散落线段', action: '放置' },
      { id: 'feather', icon: '🪶', name: '飘逸逗猫棒', desc: '挥动羽毛吸引小猫咪捕猎跳跃与扑击', action: '选用' },
      { id: 'laser', icon: '🔴', name: '激光红点', desc: '在屏幕上移动，猫咪们会集体兴奋飞扑追逐', action: '选用' }
    ],
    furniture: [
      { id: 'box', icon: '📦', name: '经典纸箱', desc: '猫咪最爱的安乐窝，胖猫还会卡屁股变装甲车', action: '放置' },
      { id: 'roomba', icon: '🤖', name: '智能扫地机', desc: '地面巡逻推撞障碍物，猫咪还能跳上去霸气骑乘', action: '放置' },
      { id: 'scratcher', icon: '🪵', name: '瓦楞猫抓板', desc: '剑麻耐磨抓板，让猫咪磨爪解压保护家具', action: '放置' },
      { id: 'recycle', icon: '🧹', name: '单体回收工具', desc: '点击任意散落玩具或家具将其一键温和回收', action: '选用' }
    ],
    structures: [
      { id: 'cattree', icon: '🌳', name: '豪华猫爬架', desc: '三层跳台带红色吊球，猫咪可阶梯飞跃登顶俯瞰', action: '搭建' },
      { id: 'bridge', icon: '🌉', name: '空中悬索天桥', desc: '跨越客厅上空的空中走廊，带木板受力下沉形变', action: '搭建' },
      { id: 'hammock', icon: '☁️', name: '高空全景吊床', desc: '天花板悬吊双链软榻，单摆阻尼摆动与惬意午睡', action: '悬挂' }
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
    }

    init() {
      this.bindPassportEvents();
      this.bindSnapshotEvents();
      this.bindStudioEvents();
      this.bindCatalogEvents();
      this.bindRenderTunerEvents();
    }

    // --- 建造与摆放仓库系统 (Build Catalog) ---
    openBuildCatalog() {
      const modal = document.getElementById('build-catalog-modal');
      if (!modal) return;
      this.currentCatalogTab = this.currentCatalogTab || 'cats';
      this.renderCatalogGrid(this.currentCatalogTab);
      modal.classList.add('open');
      soundEngine.playPop();
    }

    closeBuildCatalog() {
      const modal = document.getElementById('build-catalog-modal');
      if (modal) modal.classList.remove('open');
    }

    renderCatalogGrid(categoryKey) {
      this.currentCatalogTab = categoryKey;
      const container = document.getElementById('catalog-grid-items');
      if (!container) return;
      container.innerHTML = '';

      document.querySelectorAll('.catalog-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === categoryKey);
      });

      const items = BUILD_CATALOG[categoryKey] || [];
      items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'catalog-item-card';
        card.innerHTML = `
          <div class="catalog-item-icon">${item.icon}</div>
          <div class="catalog-item-info">
            <div class="catalog-item-title">${item.name}</div>
            <div class="catalog-item-desc">${item.desc}</div>
          </div>
          <div class="catalog-item-action">
            <button class="pill-btn active" style="padding: 6px 12px; font-size: 0.8rem;">${item.action}</button>
          </div>
        `;
        const actionBtn = card.querySelector('button');
        if (actionBtn) {
          actionBtn.onclick = () => {
            this.closeBuildCatalog();
            const app = window.CyberMeow.app;
            if (app) {
              if (item.id === 'laser' || item.id === 'feather') {
                app.setTool(item.id);
              } else {
                app.startPlacement(item.id);
              }
            }
          };
        }
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
      modal.classList.add('open');
      if (soundEngine?.playPop) soundEngine.playPop();
    }

    closeRenderTuner() {
      const modal = document.getElementById('render-tuner-modal');
      if (modal) modal.classList.remove('open');
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
            if (m.y < minY) minY = m.y;
          });
          clusters.push({
            id: `cluster_${root}`,
            cats: members,
            cx: sumX / members.length,
            cy: minY - 36,
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

        const isHovered = mouseWorld && Math.hypot(mouseWorld.x - cat.x, mouseWorld.y - (cat.y - 30)) < 36;
        const isFocus = (cat.isGrabbed || isHovered || cat === config.catCam);

        this._drawSingleCatLabel(ctx, cat, mode, isFocus, yOffset);
      }

      ctx.restore();
    }

    _drawClusterCapsule(ctx, cluster, isHovered, mode) {
      const { cx, cy, cats, count } = cluster;
      const names = cats.map(c => c.name).join('·');
      const label = `🐾 ${count}猫贴贴: ${names}`;

      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const textW = ctx.measureText(label).width;
      const padX = 12;
      const bw = textW + padX * 2;
      const bh = 22;

      ctx.save();
      ctx.translate(cx, cy);

      // 半透明磨砂胶囊底盘
      ctx.fillStyle = isHovered ? 'rgba(255, 107, 129, 0.88)' : 'rgba(20, 24, 35, 0.72)';
      ctx.strokeStyle = isHovered ? '#ff6b81' : 'rgba(255, 255, 255, 0.35)';
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
      const topY = cat.y - R * 1.8 + yOffset;

      ctx.save();
      ctx.translate(cat.x, topY);

      if (mode === 'minimal' && !isFocus) {
        // 极简微标模式：常态仅显示微光点
        ctx.fillStyle = (cat.purrLevel > 0) ? '#2ed573' : 'rgba(255, 255, 255, 0.45)';
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
        ctx.fillStyle = 'rgba(16, 20, 30, 0.85)';
        ctx.strokeStyle = '#feca57';
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
        ctx.fillText(`✨ ${cat.name}`, 0, -7);
      } else {
        // 常态紧凑微标
        const pillW = nameW + 12;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
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
        cat.drawSpeechBubble(ctx, -20);
      } else if (cat.intentIcon && isFocus) {
        cat.drawIntentBadge(ctx, -20);
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
