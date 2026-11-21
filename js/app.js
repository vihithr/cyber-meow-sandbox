/**
 * CyberMeow - 游乐场核心编排控制器 (App Orchestrator)
 * 包含：超宽大平层豪宅世界 (3000px)、相机平移与缩放、自动投喂生态、抓猫放猫物理学
 */
(function(window) {
  'use strict';

  const {
    MathUtils,
    physicsWorld,
    soundEngine,
    environment,
    uiManager,
    Cat,
    YarnBall,
    FishTreat,
    CardboardBox,
    featherWand,
    Roomba,
    CatTree,
    Scratcher,
    Sunbeam,
    WallPerch,
    WindowSill,
    SmartFeeder,
    CatSuspensionBridge,
    AerialHammock,
    WallClimbLadder,
    CeilingDanglingToy,
    WaterMug,
    WaterPuddle,
    MountSystem,
    BREEDS,
    PERSONALITIES
  } = window.CyberMeow;

  // 实体数量上限：防止长时间游玩后玩具/家具无限累积拖慢主循环
  const MAX_TOYS = 80;
  const MAX_FURNITURE = 60;
  const MAX_CATS = 40;
  const MAX_PARTICLES = 240;
  const ROOMS = [
    { id: 'patio', title: '阳光露台', center: 500 },
    { id: 'living', title: '起居室', center: 1500 },
    { id: 'playground', title: '攀爬乐园', center: 2500 }
  ];

  const PLACEMENT_FOOTPRINTS = {
    box: { w: 58, h: 38, grounded: true },
    cattree: { w: 130, h: 18, grounded: true },
    roomba: { w: 68, h: 36, grounded: true },
    scratcher: { w: 75, h: 24, grounded: true },
    bridge: { w: 280, h: 18 },
    hammock: { w: 115, h: 34 }
  };

  // 视口裁剪安全余量（世界像素）：覆盖最大道具半宽、悬吊摆动、拖拽与拖尾动画，
  // 宁可多画一点也不误裁边缘对象；缩小视口范围才省填充率。
  const CULL_MARGIN = 180;

  class CyberMeowApp {
    constructor() {
      this.canvas = document.getElementById('playground');
      this.canvasContainer = document.getElementById('canvas-container');
      this.ctx = this.canvas.getContext('2d');
      this.viewportWidth = window.innerWidth;
      this.viewportHeight = window.innerHeight;
      this.worldWidth = Math.max(3000, window.innerWidth * 1.8);
      this.width = this.worldWidth;
      this.height = this.viewportHeight;

      // 相机与视口系统 (Camera System)
      this.cameraX = 0;
      this.targetCameraX = 0;
      this.zoom = 1.0;
      this.targetZoom = 1.0;
      this.fitZoom = 1.0;
      this.wideAngle = false;
      this.isPanningCamera = false;
      this.panStartX = 0;
      this.panStartCamX = 0;
      // 喵视角：非 null 时镜头持续跟随该猫（按 C 切换）
      this.catCam = null;

      // 场景对象
      this.cats = [];
      this.toys = [];
      this.furniture = [];
      this.particles = [];
      this.sunbeam = null;

      // 背景离屏层：视口切片缓存（只覆盖可见世界范围 + 余量），随主题/尺寸/DPR/相机越界失效。
      this._bgLayer = null;
      this._bgLayerKey = '';
      // 静态家具层：保留旧接口供兼容与测试调用；主循环改为逐帧直接绘制，不再占用常驻显存。
      this._staticFurnitureLayer = null;
      this._staticFurnitureLayerKey = '';
      this._visibleRange = { left: -CULL_MARGIN, right: 0 };

      // 控制状态
      this.currentTool = 'pet';
      this.laser = { x: -100, y: -100, active: false };
      this.mouse = { x: 0, y: 0, overScene: false, isDown: false, draggedCat: null };
      this.dragOffset = { x: 0, y: 0 };

      // 猫咪渲染模式：'chibi' (Q萌团子，默认常态极速) | 'procedural' (次世代高精拟真)
      this.catRenderStyle = 'chibi';
      // 底层绘制引擎配置与遥测中枢
      this.renderEngineConfig = (window.CyberMeow && window.CyberMeow.renderEngineManager)
        ? window.CyberMeow.renderEngineManager.config
        : {
            pipeline: 'chibi',
            clusterMode: 'smart',
            clusterLabels: true,
            spriteCache: true,
            eyeTracking: true,
            particleBudget: 100,
            showTelemetry: false
          };

      // 建造与放置模式系统 (Placement Engine)
      this.placement = {
        active: false,
        itemType: null,
        ghostX: 0,
        ghostY: 0
      };

      // 拖拽抚摸与双击检测
      this.petDistanceTracker = 0;
      this.lastMousePos = { x: 0, y: 0 };
      this.lastClickedCat = null;
      this.lastClickTime = 0;

      // 自适应画质：根据帧间隔 EMA 自动降/升渲染成本，保留新特性但让弱机也能跑
      this.renderQuality = 'high';
      this._dprCap = 2;
      this._frameEma = 16.7;
      this._slowFrames = 0;
      this._fastFrames = 0;
      // 按过 Q 后锁定手动档位：帧率回升时自适应不再把 low 悄悄切回 high，
      // 保证性能对照测试（切 low 看是否流畅）得到稳定的档位。
      this._qualityLocked = false;
      window.CyberMeow.renderQuality = 'high';
    }

    init() {
      this.resize();
      window.addEventListener('resize', () => this.resize());

      // 初始化阳光 (照射在露台区域)
      this.sunbeam = new Sunbeam(420, 0, 260);

      // 加载存档或初始化 3000px 豪宅三区场景
      if (!this.loadState()) {
        this.initDefaultScene();
      }

      this.roomFurniture = new Set(this.furniture);
      uiManager.init();
      this.bindInputs();
      this.bindUIButtons();
      this.bindManorNavigation();
      this.bindMiniMap();
      this.updateHud();

      // 启动主渲染循环
      this.loop = this.loop.bind(this);
      requestAnimationFrame(this.loop);

      uiManager.showToast('点击抚摸，按住拖动，双击抱入怀中。', 4800);
    }

    resize() {
      // 按设备像素比设置画布后备缓冲；上限由自适应画质动态控制（2 / 1.25 / 1）
      const dpr = Math.min(window.devicePixelRatio || 1, this._dprCap);
      this.dpr = dpr;
      const width = this.canvasContainer?.clientWidth;
      const height = this.canvasContainer?.clientHeight;
      this.viewportWidth = width || window.innerWidth;
      this.viewportHeight = height || window.innerHeight;
      if (!this._sceneHeight) {
        this._sceneHeight = Math.max(480, this.viewportHeight);
        this.worldWidth = Math.max(3000, this.viewportWidth * 1.8);
      }
      this.height = this._sceneHeight;
      this.width = this.worldWidth;
      this.fitZoom = this.viewportHeight / this.height;
      this.targetZoom = this.fitZoom * (this.wideAngle ? 0.76 : 1);
      this.zoom = this.targetZoom;
      const maxCamX = Math.max(0, this.worldWidth - this.viewportWidth / this.zoom);
      this.targetCameraX = MathUtils.clamp(this.targetCameraX, 0, maxCamX);
      this.cameraX = MathUtils.clamp(this.cameraX, 0, maxCamX);
      this.canvas.width = Math.round(this.viewportWidth * dpr);
      this.canvas.height = Math.round(this.viewportHeight * dpr);
      this.canvas.style.width = this.viewportWidth + 'px';
      this.canvas.style.height = this.viewportHeight + 'px';
    }

    // 初始化超宽大平层三区豪宅：阳光露台 (0-1000) | 豪华客厅 (1000-2000) | 游乐高塔 (2000-3000)
    // 构建立体三维猫道走廊：每区均设专属猫爬架，空中有悬索桥、高空吊床、阶梯爬道与风铃玩具，彻底告别空旷！
    initDefaultScene() {
      const floorY = physicsWorld.getFloorY(this.height);

      // --- 1. 左翼：阳光全景温室露台 (Sunlit Solarium, 0-1000) ---
      this.furniture.push(new WindowSill(172, floorY * 0.36, 224, 150));
      this.furniture.push(new WallClimbLadder(360, floorY - 50, 3, 1, 65, 12, 70, -60));
      this.furniture.push(new CatTree(640, floorY)); // 露台温室景观猫爬架！
      this.furniture.push(new WallPerch(820, floorY - 240, 130, 16));
      this.furniture.push(new CeilingDanglingToy(740, floorY - 280, '#ff7675'));
      this.furniture.push(new CardboardBox(531, floorY - 25));

      // --- 2. 中央：豪华猫咪大客厅 (Grand Living Room, 1000-2000) ---
      this.furniture.push(new SmartFeeder(1180, floorY)); // 智能自动出粮投喂机
      this.furniture.push(new WallClimbLadder(1020, floorY - 50, 3, 1, 65, 12, 70, -60));
      this.furniture.push(new CatTree(1380, floorY)); // 大客厅中央豪华巨型猫爬架！
      this.furniture.push(new Roomba(1520, floorY - 20));
      this.furniture.push(new WallPerch(1240, floorY - 240, 120, 16));
      this.furniture.push(new CatSuspensionBridge(1640, floorY - 240, 280, 18)); // 空中悬索天桥跨越客厅！
      this.furniture.push(new WallPerch(1860, floorY - 240, 130, 16));
      this.toys.push(new WaterMug(1870, floorY - 255)); // 跳台边缘水杯，等待被推落打翻！
      this.furniture.push(new AerialHammock(1540, floorY - 320, 115, 34)); // 天花板高空全景吊床！
      this.furniture.push(new CeilingDanglingToy(1760, floorY - 290, '#55efc4'));
      this.toys.push(new YarnBall(1620, floorY - 60));

      // --- 3. 右翼：极限运动游乐高塔 (Adventure Playground, 2000-3000) ---
      this.furniture.push(new Scratcher(2140, floorY));
      this.furniture.push(new WallClimbLadder(2240, floorY - 50, 3, 1, 65, 12, 70, -60));
      this.furniture.push(new CatTree(2520, floorY)); // 游乐高塔攀爬树！
      this.furniture.push(new WallPerch(2720, floorY - 260, 140, 16));
      this.furniture.push(new CatSuspensionBridge(2860, floorY - 240, 220, 18));
      this.furniture.push(new WallPerch(2980, floorY - 170, 110, 16));
      this.furniture.push(new CeilingDanglingToy(2630, floorY - 300, '#fd79a8'));
      this.toys.push(new CardboardBox(2760, floorY - 25));

      // 露台靠近镜头的两只猫，其余猫咪分布在另外两个房间。
      this.cats.push(new Cat(155, floorY - 30, { breed: BREEDS[2], name: '年糕', hat: 'none' }));
      this.cats.push(new Cat(450, floorY - 35, { breed: BREEDS[0], name: '大橘', hat: 'none' }));
      this.cats.push(new Cat(1350, floorY - 35, { breed: BREEDS[1], name: '奥利奥', hat: 'bell' }));
      this.cats.push(new Cat(2350, floorY - 35, { breed: BREEDS[3], name: '雪球', hat: 'none' }));

      // 初始镜头停留在露台与客厅交界
      this.cameraX = 0;
      this.targetCameraX = 0;
    }

    spawnParticle(x, y, text) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      this.particles.push({
        x, y, text,
        vx: (Math.random() - 0.5) * 1.6,
        vy: -1.6 - Math.random() * 2,
        alpha: 1.0,
        scale: 1.0
      });
    }

    setTool(tool) {
      if (this.placement.active) this.cancelPlacement();
      this.currentTool = tool;
      document.querySelectorAll('#dock-container .dock-item').forEach(btn => {
        if (btn.dataset.tool) {
          const active = btn.dataset.tool === tool;
          btn.classList.toggle('active', active);
          btn.setAttribute?.('aria-pressed', String(active));
        }
      });

      this.closeToolDrawer();
      this.canvas.style.cursor = (tool === 'laser' || tool === 'feather') ? 'crosshair' : 'default';
      this.laser.active = (tool === 'laser');
      featherWand.active = (tool === 'feather');

      const hints = {
        pet: '点击抚摸，按住拖动，双击抱入怀中。',
        cat: '点击房间，领养一只随机猫咪。',
        laser: '移动光标，引导猫咪追逐红点。',
        feather: '挥动逗猫棒，吸引猫咪扑跳。',
        fish: '点击房间，投喂小鱼干。',
        yarn: '点击房间，投出毛线球。',
        box: '点击房间，在地面放置纸箱。',
        cattree: '点击房间，在地面放置猫爬架。',
        bridge: '点击房间，放置空中天桥。',
        hammock: '点击房间，放置吊床。',
        roomba: '点击房间，放置扫地机。',
        scratcher: '点击房间，在地面放置抓板。',
        catnip: '点击房间，在附近撒猫薄荷。',
        recycle: '点击道具，将它收回。'
      };
      uiManager.showToast(hints[tool] || '');
    }

    toggleCatLOD() {
      this.setRenderPipeline(this.catRenderStyle === 'chibi' ? 'procedural' : 'chibi');
      uiManager.syncTunerUI();
    }

    applyRenderPreset(preset) {
      const manager = window.CyberMeow.renderEngineManager;
      if (manager) {
        manager.applyPreset(preset);
        this.renderEngineConfig = manager.config;
      }
      this.syncModelButton();
      const labels = { saver: '流畅', balanced: '均衡', ultra: '高精度' };
      uiManager.showToast(`画质 · ${labels[preset] || labels.balanced}`);
    }

    syncModelButton() {
      this.catRenderStyle = this.renderEngineConfig.pipeline === 'procedural' ? 'procedural' : 'chibi';
      const button = document.getElementById('btn-cat-lod');
      if (button) button.innerText = this.catRenderStyle === 'chibi' ? '画风 · 团子' : '画风 · 骨骼';
    }

    setRenderPipeline(pipe) {
      this.renderEngineConfig.pipeline = pipe;
      this.syncModelButton();
      uiManager.showToast(document.getElementById('btn-cat-lod')?.innerText || '');
    }

    setClusterMode(mode) {
      this.renderEngineConfig.clusterMode = mode;
    }

    startPlacement(itemType) {
      this.setTool('pet');
      this.placement.active = true;
      this.canvas.style.cursor = 'crosshair';
      this.placement.itemType = itemType;
      this.placement.ghostX = null;
      this.placement.ghostY = null;

      const itemNames = {
        cat: '🐱 随机萌猫',
        fish: '🐟 小鱼干',
        catnip: '🌿 猫薄荷喷雾',
        yarn: '🧶 弹力毛线球',
        box: '📦 经典纸箱',
        cattree: '🌳 豪华猫爬架',
        roomba: '🤖 智能扫地机',
        scratcher: '🪵 瓦楞抓板',
        bridge: '🌉 悬索天桥',
        hammock: '☁️ 全景吊床'
      };

      const hud = document.getElementById('placement-hud');
      const hint = document.getElementById('placement-hint');
      if (hud) hud.style.display = 'flex';
      if (hint) hint.innerText = `放置 · ${itemNames[itemType] || itemType}`;
      uiManager.showToast('点击房间放置。');
    }

    cancelPlacement() {
      if (!this.placement.active) return;
      this.placement.active = false;
      this.placement.itemType = null;
      const hud = document.getElementById('placement-hud');
      if (hud) hud.style.display = 'none';
      this.canvas.style.cursor = 'default';
      uiManager.showToast('');
    }

    placementLocation(type, x, y) {
      const footprint = PLACEMENT_FOOTPRINTS[type];
      const floorY = physicsWorld.getFloorY(this.height);
      const margin = footprint ? footprint.w / 2 + 10 : 24;
      const atX = MathUtils.clamp(x, margin, this.worldWidth - margin);
      const atY = footprint?.grounded ? floorY :
        MathUtils.clamp(y, footprint ? 60 : 28, floorY - (footprint ? 45 : 18));
      return { x: atX, y: atY, footprint, floorY };
    }

    executePlacement(x, y) {
      const type = this.placement.itemType;
      const { x: worldX, y: worldY, floorY } = this.placementLocation(type, x, y);

      if (type === 'cat') {
        if (this.cats.length >= MAX_CATS) {
          this.cancelPlacement();
          uiManager.showToast(`猫咪已达上限 ${MAX_CATS} 只。`);
          return;
        }
        const newCat = new Cat(worldX, worldY);
        this.cats.push(newCat);
        soundEngine.playMeow(newCat.pitchMod, 'chirp');
        this.spawnParticle(worldX, worldY - 20, '✨🐱');
        this.saveState();
      } else if (type === 'fish') {
        this.toys.push(new FishTreat(worldX, worldY));
        soundEngine.playPop();
      } else if (type === 'yarn') {
        this.toys.push(new YarnBall(worldX, worldY));
        soundEngine.playPop();
      } else if (type === 'box') {
        this.furniture.push(new CardboardBox(worldX, floorY - 25));
        soundEngine.playPop();
      } else if (type === 'cattree') {
        this.furniture.push(new CatTree(worldX, floorY));
        soundEngine.playPop();
      } else if (type === 'roomba') {
        this.furniture.push(new Roomba(worldX, floorY - 20));
        soundEngine.playPop();
      } else if (type === 'scratcher') {
        this.furniture.push(new Scratcher(worldX, floorY));
        soundEngine.playPop();
      } else if (type === 'bridge') {
        this.furniture.push(new CatSuspensionBridge(worldX, worldY, 280));
        soundEngine.playPop();
      } else if (type === 'hammock') {
        this.furniture.push(new AerialHammock(worldX, worldY, 115));
        soundEngine.playPop();
      } else if (type === 'catnip') {
        soundEngine.playPop();
        for (let i = 0; i < 20; i++) {
          this.spawnParticle(worldX + (Math.random() - 0.5) * 80, worldY + (Math.random() - 0.5) * 80, '🌿');
        }
        for (let c of this.cats) {
          if (Math.hypot(c.x - worldX, c.y - worldY) < 320) {
            c.catnipEnergy = 300;
            c.vy = -7;
            soundEngine.playMeow(c.pitchMod * 1.25, 'chatter');
          }
        }
      }

      this.spawnParticle(worldX, worldY - 10, '✨🔨');
      this.updateHud();
      this.cancelPlacement();
    }

    drawGhostPreview(ctx) {
      const { active, ghostX, ghostY, itemType } = this.placement;
      if (!active || ghostX === null || !this.mouse.overScene) return;
      const { x, y, footprint } = this.placementLocation(itemType, ghostX, ghostY);

      ctx.save();
      ctx.beginPath();
      if (footprint) {
        const top = footprint.grounded ? y - footprint.h : y;
        ctx.roundRect(x - footprint.w / 2, top, footprint.w, footprint.h, 5);
      } else {
        ctx.arc(x, y, itemType === 'catnip' ? 34 : 20, 0, Math.PI * 2);
      }
      ctx.fillStyle = 'rgba(235, 247, 224, .50)';
      ctx.fill();
      ctx.strokeStyle = '#355d47';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.restore();
    }

    // 屏幕像素坐标转世界坐标
    getWorldPos(e) {
      const rect = this.canvas.getBoundingClientRect();
      const touch = e.touches && e.touches[0];
      // 0 是合法坐标（画布顶边/左边），不能用 || 回退，否则会取到 undefined 并污染世界坐标
      const clientX = e.clientX ?? (touch ? touch.clientX : 0);
      const clientY = e.clientY ?? (touch ? touch.clientY : 0);
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;

      const worldX = screenX / this.zoom + this.cameraX;
      const worldY = (screenY - this.sceneOffsetY) / this.zoom;
      return { x: worldX, y: worldY, screenX, screenY };
    }

    get sceneOffsetY() {
      return this.wideAngle || this._zoomTransition
        ? Math.max(0, (this.viewportHeight - this.height * this.zoom) * 0.5)
        : 0;
    }

    catAt(x, y) {
      for (let i = this.cats.length - 1; i >= 0; i--) {
        const cat = this.cats[i];
        if (cat.containsVisualPoint(x, y, this.catRenderStyle)) return cat;
      }
      return null;
    }

    bindInputs() {
      // 禁用 Canvas 默认右键菜单，留给全景平移
      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

      const onPointerDown = (e) => {
        if (e.isPrimary === false && e.pointerType) return;
        soundEngine.init();

        if (this.placement.active && e.button === 2) {
          this.cancelPlacement();
          return;
        }

        // 1. 右键或中键：进入视口相机拖拽平移
        if (e.button === 2 || e.button === 1) {
          // 手动接管镜头时自动退出喵视角
          this.catCam = null;
          this.isPanningCamera = true;
          this.panStartX = e.clientX;
          this.panStartCamX = this.targetCameraX;
          return;
        }

        // 指针捕获以防移出窗口
        if (e.pointerId && this.canvas.setPointerCapture) {
          try { this.canvas.setPointerCapture(e.pointerId); } catch(err){}
        }

        const pos = this.getWorldPos(e);
        this.mouse.x = pos.x;
        this.mouse.y = pos.y;
        this.mouse.isDown = true;
        this.mouse.overScene = true;
        this.petDistanceTracker = 0;
        this.lastMousePos = { x: pos.x, y: pos.y };

        // 0. 放置模式拦截：左键确认放置，右键取消
        if (this.placement.active) {
          if (e.button === 0) {
            this.executePlacement(pos.x, pos.y);
          } else {
            this.cancelPlacement();
          }
          return;
        }

        // 0.5. 回收工具：点击任意散落玩具或家具温和收纳
        if (this.currentTool === 'recycle') {
          for (let i = this.toys.length - 1; i >= 0; i--) {
            const t = this.toys[i];
            if (t && Math.hypot(t.x - pos.x, t.y - pos.y) < (t.radius || 20) + 14) {
              this.toys.splice(i, 1);
              soundEngine.playPop();
              this.spawnParticle(pos.x, pos.y, '💨 已收纳');
              this.updateHud();
              return;
            }
          }
          for (let i = this.furniture.length - 1; i >= 0; i--) {
            const f = this.furniture[i];
            const fw = f.w || f.width || 50;
            if (f && Math.abs(f.x - pos.x) < fw / 2 + 15 && Math.abs(f.y - pos.y) < 70) {
              for (const c of this.cats) {
                if (c.inBox === f || c.ridingObj === f || c._mountHost === f) MountSystem.dismount(c);
              }
              this.furniture.splice(i, 1);
              soundEngine.playPop();
              this.spawnParticle(pos.x, pos.y, '💨 已回收');
              this.updateHud();
              return;
            }
          }
        }

        // Cats are painted above furniture, including cats standing on a platform.
        const clickedCat = this.catAt(pos.x, pos.y);
        if (clickedCat) {
          const now = Date.now();
          if (this.lastClickedCat === clickedCat && now - this.lastClickTime < 320) {
            uiManager.openCloseUpStudio(clickedCat);
            this.lastClickedCat = null;
            return;
          }
          this.lastClickedCat = clickedCat;
          this.lastClickTime = now;
          this.mouse.draggedCat = clickedCat;
          this.dragOffset.x = clickedCat.x - pos.x;
          this.dragOffset.y = clickedCat.y - pos.y;
          clickedCat.vx = 0;
          clickedCat.vy = 0;
          clickedCat.isGrabbed = true;
          MountSystem.dismount(clickedCat);
          clickedCat.pet(this);
          return;
        }

        // 2. 检测是否按中了家具进行特色交互 (投喂机/猫爬架玩球登高/吊床摇摆/风铃羽毛球/空中天桥)
        for (let f of this.furniture) {
          if (f.type === 'feeder') {
            if (Math.abs(f.x - pos.x) < f.w && Math.abs(f.y - pos.y) < f.h) {
              f.dispense(this);
              uiManager.showToast('🥣 触发智能投喂机一键开饭！香脆小鱼干喷出！');
              return;
            }
          } else if (f.type === 'cattree') {
            // 点击吊球拨动玩耍
            if (f.dangleBall && Math.hypot(f.dangleBall.x - pos.x, f.dangleBall.y - pos.y) < 26) {
              f.batDangleBall(Math.random() < 0.5 ? 1 : -1);
              this.spawnParticle(f.dangleBall.x, f.dangleBall.y, '🐾🎈');
              return;
            }
            // 点击爬架本体：唤起就近猫咪开启征服猫爬架大计！
            if (Math.abs(f.x - pos.x) < f.width / 2 + 10 && pos.y >= f.y - 240 && pos.y <= f.y) {
              const nearestCat = this.cats.filter(c => !c.isGrabbed).sort((a,b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y))[0];
              if (nearestCat) {
                nearestCat.currentAgenda = 'TREE_CLIMB';
                nearestCat.agendaTarget = f;
                nearestCat.agendaPhase = 0;
                nearestCat.agendaTimer = 480;
                nearestCat.intentIcon = '🌳';
                nearestCat.intentLabel = '征服猫爬架';
                nearestCat.speak('收到铲屎官召唤！这就去征服猫爬架！🌳✨');
                uiManager.showToast('🌳 唤起猫咪征服豪华猫爬架！');
                return;
              }
            }
          } else if (f.type === 'hammock') {
            if (Math.abs(f.x - pos.x) < f.w / 2 && Math.abs(f.y - pos.y) < 30) {
              f.nudge(0.08);
              this.spawnParticle(f.x, f.y, '☁️✨');
              uiManager.showToast('☁️ 轻轻推动空中全景吊床~');
              return;
            }
          } else if (f.type === 'ceiling_toy') {
            if (Math.abs(f.x + f.offsetX - pos.x) < 28 && Math.abs(f.y - pos.y) < 28) {
              f.batToy((Math.random() - 0.5) * 8, -6);
              this.spawnParticle(f.x + f.offsetX, f.y, '🔔✨');
              uiManager.showToast('🔔 拨动天花板风铃羽毛球！叮当脆响~');
              return;
            }
          } else if (f.type === 'bridge') {
            if (Math.abs(f.x - pos.x) < f.w / 2 && Math.abs(f.y - pos.y) < 25) {
              const nearestCat = this.cats.filter(c => !c.isGrabbed).sort((a,b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y))[0];
              if (nearestCat) {
                nearestCat.currentAgenda = 'AERIAL_PATROL';
                nearestCat.agendaTarget = f;
                nearestCat.agendaPhase = 0;
                nearestCat.agendaTimer = 520;
                nearestCat.intentIcon = '🌉';
                nearestCat.intentLabel = '飞天巡视';
                nearestCat.speak('收到指令！巡视空中悬索天桥！🌉🐾');
                uiManager.showToast('🌉 唤起猫咪穿梭空中天桥！');
                return;
              }
            }
          }
        }

        // 4. 工具使用逻辑 (在空白处点击)
        const floorY = physicsWorld.getFloorY(this.height);
        if (this.currentTool === 'cat') {
          if (this.cats.length >= MAX_CATS) {
            uiManager.showToast(`🐾 猫咪已达上限 ${MAX_CATS} 只，先撸撸现有的小可爱吧！`);
            return;
          }
          const newCat = new Cat(pos.x, pos.y);
          this.cats.push(newCat);
          soundEngine.playMeow(newCat.pitchMod, 'chirp');
          this.spawnParticle(pos.x, pos.y - 20, '✨');
          this.saveState();
        } else if (this.currentTool === 'fish') {
          this.toys.push(new FishTreat(pos.x, pos.y));
          soundEngine.playPop();
        } else if (this.currentTool === 'yarn') {
          this.toys.push(new YarnBall(pos.x, pos.y));
          soundEngine.playPop();
        } else if (this.currentTool === 'box') {
          this.furniture.push(new CardboardBox(pos.x, pos.y));
          soundEngine.playPop();
        } else if (this.currentTool === 'cattree') {
          this.furniture.push(new CatTree(pos.x, floorY));
          soundEngine.playPop();
        } else if (this.currentTool === 'roomba') {
          this.furniture.push(new Roomba(pos.x, floorY - 20));
          soundEngine.playPop();
        } else if (this.currentTool === 'scratcher') {
          this.furniture.push(new Scratcher(pos.x, floorY));
          soundEngine.playPop();
        } else if (this.currentTool === 'bridge') {
          this.furniture.push(new CatSuspensionBridge(pos.x, pos.y, 280));
          soundEngine.playPop();
        } else if (this.currentTool === 'hammock') {
          this.furniture.push(new AerialHammock(pos.x, pos.y, 115));
          soundEngine.playPop();
        } else if (this.currentTool === 'catnip') {
          soundEngine.playPop();
          for (let i = 0; i < 20; i++) {
            this.spawnParticle(pos.x + (Math.random() - 0.5) * 80, pos.y + (Math.random() - 0.5) * 80, '🌿');
          }
          for (let c of this.cats) {
            if (Math.hypot(c.x - pos.x, c.y - pos.y) < 320) {
              c.catnipEnergy = 300;
              c.vy = -7;
              soundEngine.playMeow(c.pitchMod * 1.25, 'chatter');
            }
          }
        }
        this.updateHud();
      };

      const onPointerMove = (e) => {
        if (e.isPrimary === false && e.pointerType) return;
        this.mouse.overScene = e.target === this.canvas;
        // 相机平移处理
        if (this.isPanningCamera) {
          const dx = e.clientX - this.panStartX;
          const maxCamX = Math.max(0, this.worldWidth - this.viewportWidth / this.zoom);
          this.targetCameraX = MathUtils.clamp(this.panStartCamX - dx / this.zoom, 0, maxCamX);
          return;
        }

        if (!this.mouse.overScene && !this.mouse.isDown) return;
        const pos = this.getWorldPos(e);
        this.mouse.x = pos.x;
        this.mouse.y = pos.y;
        this.laser.x = pos.x;
        this.laser.y = pos.y;

        if (this.placement.active) {
          this.placement.ghostX = pos.x;
          this.placement.ghostY = pos.y;
        }

        featherWand.update(pos.x, pos.y, Math.min((this.dt || 1 / 60) * 60, 3));

        // 拖拽抓起的猫咪
        if (this.mouse.draggedCat) {
          this.mouse.draggedCat.x = pos.x + this.dragOffset.x;
          this.mouse.draggedCat.y = pos.y + this.dragOffset.y;
          this.mouse.draggedCat.vx = (pos.x - this.lastMousePos.x) * 0.85;
          this.mouse.draggedCat.vy = (pos.y - this.lastMousePos.y) * 0.85;
        }

        const petTarget = this.catAt(pos.x, pos.y);
        if (!this.placement.active && !this.laser.active && !featherWand.active) {
          this.canvas.style.cursor = this.mouse.draggedCat ? 'grabbing' : (petTarget ? 'grab' : 'default');
        }

        if (this.currentTool === 'pet' && this.mouse.isDown && !this.mouse.draggedCat && petTarget) {
          this.petDistanceTracker += Math.hypot(pos.x - this.lastMousePos.x, pos.y - this.lastMousePos.y);
          if (this.petDistanceTracker > 32) {
            this.petDistanceTracker = 0;
            petTarget.pet(this);
          }
        }

        this.lastMousePos = { x: pos.x, y: pos.y };
      };

      const onPointerUp = (e) => {
        if (e?.isPrimary === false && e.pointerType) return;
        if (e && e.pointerId && this.canvas.releasePointerCapture) {
          try { this.canvas.releasePointerCapture(e.pointerId); } catch(err){}
        }
        this.isPanningCamera = false;

        // 放下抓起的猫咪 (赋予自然抛物线初速度，保证必定顺畅落地！)
        if (this.mouse.draggedCat) {
          const c = this.mouse.draggedCat;
          c.isGrabbed = false;
          c.state = 'idle';
          const limit = e?.type === 'pointercancel' ? 0 : 9;
          c.vx = MathUtils.clamp(c.vx, -limit, limit);
          c.vy = MathUtils.clamp(c.vy, -limit, limit);
          this.mouse.draggedCat = null;
        }

        this.mouse.isDown = false;
        soundEngine.stopPurr();
      };

      // 滚轮横向平移全景世界
      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.catCam = null;
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        const maxCamX = Math.max(0, this.worldWidth - this.viewportWidth / this.zoom);
        this.targetCameraX = MathUtils.clamp(this.targetCameraX + delta * 1.2, 0, maxCamX);
      }, { passive: false });

      this.canvas.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);

      // 键盘快捷键与 A/D 平移相机
      window.addEventListener('keydown', (e) => {
        if (e.code === 'Escape') {
          if (uiManager.activeModal) uiManager.dismissModal();
          else if (!this.closeSettings() && !this.closeToolDrawer()) this.cancelPlacement();
          return;
        }
        if (e.altKey || e.ctrlKey || e.metaKey ||
            /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
        const key = e.key.toLowerCase();
        if (uiManager.activeModal) {
          const activeID = uiManager.activeModal.id;
          if ((key === 'b' && activeID === 'build-catalog-modal') ||
              (key === 'e' && activeID === 'render-tuner-modal')) uiManager.dismissModal();
          return;
        }
        if (e.code === 'Space' && /^(BUTTON|SUMMARY|A)$/.test(e.target.tagName)) return;
        const maxCamX = Math.max(0, this.worldWidth - this.viewportWidth / this.zoom);

        if (key === 'a' || e.code === 'ArrowLeft') {
          this.catCam = null;
          this.targetCameraX = Math.max(0, this.targetCameraX - 120);
        } else if (key === 'd' || e.code === 'ArrowRight') {
          this.catCam = null;
          this.targetCameraX = Math.min(maxCamX, this.targetCameraX + 120);
        } else if (key === 'b') {
          const catalog = document.getElementById('build-catalog-modal');
          if (catalog && catalog.classList.contains('open')) {
            uiManager.closeBuildCatalog();
          } else {
            uiManager.openBuildCatalog();
          }
        } else if (key === 't') {
          this.toggleCatLOD();
        } else if (key === 'e') {
          const tuner = document.getElementById('render-tuner-modal');
          if (tuner && tuner.classList.contains('open')) {
            uiManager.closeRenderTuner();
          } else {
            uiManager.openRenderTuner();
          }
        } else if (key === '1') this.setTool('pet');
        else if (key === '2') this.setTool('cat');
        else if (key === '3') this.setTool('laser');
        else if (key === '4') this.setTool('feather');
        else if (key === '5') this.setTool('fish');
        else if (key === '6') this.setTool('yarn');
        else if (key === '7') this.setTool('box');
        else if (key === '8') this.setTool('cattree');
        else if (key === '9') this.setTool('roomba');
        else if (key === '0') this.setTool('catnip');
        else if (e.code === 'Space') {
          e.preventDefault();
          const antiBtn = document.getElementById('btn-antigravity');
          if (antiBtn) antiBtn.click();
        } else if (key === 'm') {
          // 全体猫咪大合唱！
          soundEngine.init();
          this.cats.forEach(c => {
            soundEngine.playMeow(c.pitchMod, 'pleading');
            c.speak(['喵呜！', '喵~', '喵喵！', '铲屎的！'][Math.floor(Math.random() * 4)]);
          });
          uiManager.showToast('🐱 触发全体猫咪大合唱！');
        } else if (key === 'p') {
          uiManager.takeSnapshot(this.canvas);
        } else if (key === 'c') {
          this.toggleCatCam();
        } else if (key === 'q') {
          // 手动画质：高 → 均衡 → 流畅 → 高；按过即锁定，自适应不再接管
          this._qualityLocked = true;
          const order = ['high', 'medium', 'low'];
          const next = order[(order.indexOf(this.renderQuality) + 1) % order.length];
          this._frameEma = next === 'high' ? 14 : (next === 'medium' ? 20 : 35);
          this._slowFrames = 0;
          this._fastFrames = 0;
          this.renderQuality = next;
          window.CyberMeow.renderQuality = next;
          const cap = next === 'high' ? 2 : (next === 'medium' ? 1.25 : 1);
          if (cap !== this._dprCap) { this._dprCap = cap; this.resize(); }
          const label = next === 'high' ? '高' : (next === 'medium' ? '均衡' : '流畅');
          uiManager.showToast(`⚙️ 画质已锁定为「${label}」（Q 键可继续切换，自适应已停用）`);
        }
      });
    }

    // 喵视角：镜头跟随一只猫，假装自己就是它
    toggleCatCam() {
      if (this.catCam) {
        this.catCam = null;
        uiManager.showToast('🐾 已退出喵视角，恢复自由镜头~');
        return;
      }
      if (!this.cats.length) {
        uiManager.showToast('🐾 还没有猫咪可以跟随呢！');
        return;
      }
      // 优先跟随离鼠标最近的猫；没有鼠标信息时取第一只
      let cat = this.cats[0];
      let best = Infinity;
      for (const c of this.cats) {
        const d = Math.hypot(c.x - this.mouse.x, c.y - this.mouse.y);
        if (d < best) { best = d; cat = c; }
      }
      this.catCam = cat;
      uiManager.showToast(`🐱 喵视角启动：镜头正在跟随「${cat.name}」！按 C 退出~`);
    }

    bindManorNavigation() {
      this.zoneButtons = document.querySelectorAll('.nav-zone-btn');
      this.zoneButtons.forEach((button) => {
        button.onclick = () => {
          const room = ROOMS.find(({ id }) => id === button.dataset.zone);
          if (!room) return;
          this.catCam = null;
          const viewWidth = this.viewportWidth / this.targetZoom;
          this.targetCameraX = MathUtils.clamp(room.center - viewWidth / 2, 0, Math.max(0, this.worldWidth - viewWidth));
        };
      });

      const zoomBtn = document.getElementById('btn-zoom-toggle');
      if (zoomBtn) zoomBtn.onclick = () => {
        const center = this.cameraX + this.viewportWidth / (2 * this.zoom);
        this.wideAngle = !this.wideAngle;
        this._zoomTransition = true;
        this.targetZoom = this.fitZoom * (this.wideAngle ? 0.76 : 1);
        const viewWidth = this.viewportWidth / this.targetZoom;
        this.targetCameraX = MathUtils.clamp(center - viewWidth / 2, 0, Math.max(0, this.worldWidth - viewWidth));
        zoomBtn.innerText = this.wideAngle ? '还原' : '广角';
        zoomBtn.setAttribute?.('aria-pressed', String(this.wideAngle));
      };
      this.updateRoomNav();
    }

    updateRoomNav() {
      const center = this.cameraX + this.viewportWidth / (2 * this.zoom);
      const room = ROOMS[MathUtils.clamp(Math.floor(center / 1000), 0, ROOMS.length - 1)];
      if (this.activeRoom === room) return;
      this.activeRoom = room;
      const name = document.getElementById('current-room');
      if (name) name.innerText = room.title;
      this.zoneButtons?.forEach((button) => {
        const active = button.dataset.zone === room.id;
        button.classList.toggle('active', active);
        button.setAttribute?.('aria-pressed', String(active));
      });
    }

    closeSettings() {
      const settings = document.getElementById('settings-menu');
      if (!settings?.open) return false;
      settings.open = false;
      return true;
    }

    closeToolDrawer() {
      const drawer = document.getElementById('dock-wrapper');
      if (!drawer || drawer.classList.contains('collapsed')) return false;
      drawer.classList.add('collapsed');
      document.getElementById('dock-toggle-btn')?.setAttribute?.('aria-expanded', 'false');
      return true;
    }

    bindUIButtons() {
      const settings = document.getElementById('settings-menu');
      const drawer = document.getElementById('dock-wrapper');
      if (drawer) drawer.classList.add('collapsed');
      window.addEventListener('pointerdown', (event) => {
        if (settings?.open && !settings.contains(event.target)) this.closeSettings();
        if (drawer?.contains && !drawer.contains(event.target)) this.closeToolDrawer();
      });

      // 声音切换
      const soundBtn = document.getElementById('btn-sound');
      if (soundBtn) {
        soundBtn.onclick = () => {
          soundEngine.setMuted(!soundEngine.isMuted);
          soundBtn.innerText = soundEngine.isMuted ? '音效 · 关' : '音效 · 开';
          soundBtn.setAttribute?.('aria-pressed', String(!soundEngine.isMuted));
        };
      }

      // Lofi 音乐切换
      const bgmBtn = document.getElementById('btn-bgm');
      if (bgmBtn) {
        bgmBtn.onclick = () => {
          // @escape H4: 直写 soundEngine.bgmEnabled。audio.js 已提供 toggleBGM() 公开方法，
          // 此处是组合根直控 UI 状态的既有实现。标记使「故意例外」与「意外耦合」可区分（D3/H4）。
          soundEngine.bgmEnabled = !soundEngine.bgmEnabled;
          bgmBtn.setAttribute?.('aria-pressed', String(soundEngine.bgmEnabled));
          if (soundEngine.bgmEnabled) {
            soundEngine.startLofiBGM();
            bgmBtn.innerText = '音乐 · 开';
            bgmBtn.classList.add('active');
            uiManager.showToast('📻 已开启程序化生成 Lofi 治愈背景音乐~');
          } else {
            soundEngine.stopLofiBGM();
            bgmBtn.innerText = '音乐 · 关';
            bgmBtn.classList.remove('active');
          }
        };
      }

      // 天气切换
      const weatherBtn = document.getElementById('btn-weather');
      if (weatherBtn) {
        weatherBtn.onclick = () => {
          const w = environment.toggleWeather();
          const names = { clear: '晴空', rain: '细雨', fireflies: '萤火' };
          weatherBtn.innerText = `天气 · ${names[w]}`;
        };
      }

      // 主题切换
      const themeBtn = document.getElementById('btn-theme');
      if (themeBtn) {
        const names = { sunny_day: '日间', cozy_night: '夜间', cyber_neon: '霓虹' };
        themeBtn.innerText = `时段 · ${names[environment.theme]}`;
        themeBtn.onclick = () => {
          const themes = Object.keys(names);
          const next = themes[(themes.indexOf(environment.theme) + 1) % themes.length];
          environment.setTheme(next);
          themeBtn.innerText = `时段 · ${names[next]}`;
        };
      }

      // 反重力模式
      const antiBtn = document.getElementById('btn-antigravity');
      if (antiBtn) {
        antiBtn.onclick = () => {
          const isZero = physicsWorld.isZeroG();
          // @escape H4: 直写 physicsWorld.gravityMode。physics.js:125-127 仅暴露 isZeroG() 读接口，
          // 无公开写接口；组合根按 UI 按钮切换全局重力模式，属有意保留的逃逸点，登记以便审计。
          physicsWorld.gravityMode = isZero ? 'earth' : 'antigravity';
          antiBtn.classList.toggle('special-on', !isZero);
          antiBtn.setAttribute?.('aria-pressed', String(!isZero));

          if (!isZero) {
            soundEngine.playPop();
            for (let c of this.cats) {
              c.vy = -5 - Math.random() * 3;
              this.spawnParticle(c.x, c.y - 20, '✨🛸');
            }
          }
        };
      }

      // 拍立得快照
      const photoBtn = document.getElementById('btn-photo');
      if (photoBtn) {
        photoBtn.onclick = () => {
          uiManager.takeSnapshot(this.canvas);
        };
      }

      // 红点挑战模式
      const challengeBtn = document.getElementById('btn-challenge');
      if (challengeBtn) {
        challengeBtn.onclick = () => {
          uiManager.toggleLaserChallenge(this);
        };
      }

      // 清理道具
      const clearBtn = document.getElementById('btn-clear');
      if (clearBtn) {
        clearBtn.onclick = () => {
          this.toys.length = 0;
          this.furniture = this.furniture.filter(f => this.roomFurniture.has(f));
          for (const c of this.cats) {
            if ((c.inBox && !this.roomFurniture.has(c.inBox)) ||
                (c.ridingObj && !this.roomFurniture.has(c.ridingObj))) MountSystem.dismount(c);
          }
          soundEngine.playPop();
          this.updateHud();
          uiManager.showToast('已收起散落玩具和新增家具。');
        };
      }

      // 底部工具栏点击绑定
      document.querySelectorAll('#dock-container .dock-item').forEach(btn => {
        btn.onclick = () => {
          const tool = btn.dataset.tool;
          if (tool) this.setTool(tool);
        };
      });

      // 底部工具抽屉折叠
      const dockToggleBtn = document.getElementById('dock-toggle-btn');
      const dockWrapper = document.getElementById('dock-wrapper');
      if (dockToggleBtn && dockWrapper) {
        dockToggleBtn.onclick = () => {
          const collapsed = dockWrapper.classList.toggle('collapsed');
          dockToggleBtn.setAttribute?.('aria-expanded', String(!collapsed));
        };
      }

      // 模态关闭
      const closePassport = document.getElementById('btn-close-passport');
      if (closePassport) closePassport.onclick = () => uiManager.closeCatPassport();
    }

    updateHud() {
      const catsEl = document.getElementById('stat-cats');
      const toysEl = document.getElementById('stat-toys');

      if (catsEl) catsEl.innerText = this.cats.length;
      if (toysEl) toysEl.innerText = this.toys.length + this.furniture.length;
    }

    // 本地持久化储存
    saveState() {
      try {
        const catData = this.cats.map(c => ({
          name: c.name,
          breedId: c.breed.id,
          personalityId: c.personality.id,
          hat: c.hat,
          hunger: c.hunger,
          affection: c.affection
        }));
        localStorage.setItem('cybermeow_cats_save', JSON.stringify(catData));
      } catch (e) {}
    }

    loadState() {
      try {
        const raw = localStorage.getItem('cybermeow_cats_save');
        if (!raw) return false;
        const list = JSON.parse(raw);
        if (!Array.isArray(list) || list.length === 0) return false;

        const floorY = physicsWorld.getFloorY(this.height);
        this.cats = list.map((item, idx) => {
          const breed = BREEDS.find(b => b.id === item.breedId) || BREEDS[0];
          const personality = PERSONALITIES.find(p => p.id === item.personalityId) || PERSONALITIES[0];
          const cat = new Cat(350 + idx * 450, floorY - 35, {
            name: item.name,
            breed,
            personality,
            hat: item.hat
          });
          // 0 是合法的存档值（饥饿度/亲密度可能降到 0），不能用真值判断
          if (Number.isFinite(item.hunger)) cat.hunger = MathUtils.clamp(item.hunger, 0, 100);
          if (Number.isFinite(item.affection)) cat.affection = MathUtils.clamp(item.affection, 0, 100);
          return cat;
        });

        // 补齐 3000px 豪宅配套家具、猫爬架网络与空中天桥吊床
        this.furniture.push(new WindowSill(172, floorY * 0.36, 224, 150));
        this.furniture.push(new WallClimbLadder(360, floorY - 50, 3, 1, 65, 12, 70, -60));
        this.furniture.push(new CatTree(640, floorY));
        this.furniture.push(new WallPerch(820, floorY - 240, 130, 16));
        this.furniture.push(new CeilingDanglingToy(740, floorY - 280, '#ff7675'));
        this.furniture.push(new SmartFeeder(1180, floorY));
        this.furniture.push(new WallClimbLadder(1020, floorY - 50, 3, 1, 65, 12, 70, -60));
        this.furniture.push(new CatTree(1380, floorY));
        this.furniture.push(new Roomba(1520, floorY - 20));
        this.furniture.push(new WallPerch(1240, floorY - 240, 120, 16));
        this.furniture.push(new CatSuspensionBridge(1640, floorY - 240, 280, 18));
        this.furniture.push(new WallPerch(1860, floorY - 240, 130, 16));
        this.furniture.push(new AerialHammock(1540, floorY - 320, 115, 34));
        this.furniture.push(new CeilingDanglingToy(1760, floorY - 290, '#55efc4'));
        this.furniture.push(new Scratcher(2140, floorY));
        this.furniture.push(new WallClimbLadder(2240, floorY - 50, 3, 1, 65, 12, 70, -60));
        this.furniture.push(new CatTree(2520, floorY));
        this.furniture.push(new WallPerch(2720, floorY - 260, 140, 16));
        this.furniture.push(new CatSuspensionBridge(2860, floorY - 240, 220, 18));
        this.furniture.push(new WallPerch(2980, floorY - 170, 110, 16));
        this.furniture.push(new CeilingDanglingToy(2630, floorY - 300, '#fd79a8'));
        this.toys.push(new WaterMug(1870, floorY - 255));
        this.toys.push(new YarnBall(1620, floorY - 60));

        return true;
      } catch (e) {
        return false;
      }
    }

    // --- 渲染性能优化：视口裁剪与离屏缓存 ---
    // 可见世界 x 范围 = [cameraX, cameraX + viewportWidth/zoom]，两侧再加安全余量。
    _refreshVisibleRange() {
      const viewW = this.viewportWidth / this.zoom;
      this._visibleRange.left = this.cameraX - CULL_MARGIN;
      this._visibleRange.right = this.cameraX + viewW + CULL_MARGIN;
    }

    // 对象中心 x 加减自身半宽是否落入可见范围。
    _isVisibleX(x, halfWidth = 0) {
      const r = this._visibleRange;
      return x + halfWidth >= r.left && x - halfWidth <= r.right;
    }

    // 不同对象用 w / width / radius 表示尺寸，统一换算为世界半宽；缺省 24 足够保守。
    _halfWidth(o) {
      if (Number.isFinite(o.w)) return o.w / 2;
      if (Number.isFinite(o.width)) return o.width / 2;
      if (Number.isFinite(o.radius)) return o.radius;
      return 24;
    }

    // 仅无动画视觉的家具可烘焙：跳台/爬梯/抓板的 update 只同步 y 或清理失效 occupant。
    // Roomba、投喂机、猫爬架吊球、悬索桥、吊床、风铃、窗台小鸟都在 update 中改变画面，
    // 烘焙会冻结动画，因此它们始终走动态绘制。
    _isBakedFurniture(f) {
      return !!f && (f.type === 'perch' || f.type === 'ladder' || f.type === 'scratcher');
    }

    // 视口切片后备：尺寸 = 当前可见世界宽度 + 两侧余量，远小于整座 3000px 世界。
    // 世界 1x~1.25x 烘焙（上限 1.25 兼顾高 DPR 清晰度与显存），相机平移/缩放只在可见
    // 区间超出已缓存切片时重绘；缩放本身由主 ctx 的 zoom 变换完成，不会拉伸缓存。
    _ensureLayerSlot(field, cssWidth, cssHeight, layerScale) {
      const scale = Math.max(1, Math.min(layerScale || 1, 1.25));
      const pw = Math.max(1, Math.round(cssWidth * scale));
      const ph = Math.max(1, Math.round(cssHeight * scale));
      let layer = this[field];
      if (!layer || layer.width !== pw || layer.height !== ph) {
        layer = document.createElement('canvas');
        layer.width = pw;
        layer.height = ph;
        this[field] = layer;
      }
      layer._cacheDpr = scale;
      const lctx = layer.getContext('2d');
      lctx.setTransform(scale, 0, 0, scale, 0, 0);
      lctx.clearRect(0, 0, cssWidth, cssHeight);
      return { layer, lctx };
    }

    // 背景签名：主题/世界尺寸/DPR 任一变化才重建；可见区间超出已缓存切片也重建。
    // 天气粒子是动态层，不进签名；相机微动未越界时直接命中缓存。
    _ensureBgLayer() {
      const key = `${environment.theme}|${Math.round(this.worldWidth)}|${Math.round(this.height)}|${this.dpr}`;
      const r = this._visibleRange;
      // 余量覆盖 CULL_MARGIN 与相机插值微动，避免平移时每帧重建
      const pad = CULL_MARGIN + 240;
      const wantLeft = Math.max(0, Math.floor(r.left - pad));
      const wantRight = Math.min(this.worldWidth, Math.ceil(r.right + pad));
      const cachedLeft = this._bgLayer ? (this._bgLayer._sliceLeft || 0) : 0;
      const cachedW = this._bgLayer ? (this._bgLayer._sliceWorldWidth || 0) : 0;
      if (this._bgLayer && key === this._bgLayerKey && wantRight > wantLeft &&
          wantLeft >= cachedLeft && wantRight <= cachedLeft + cachedW) {
        return;
      }
      const sliceWidth = Math.max(1, wantRight - wantLeft);
      const layerScale = Math.min(this.dpr || 1, 1.25);
      const { layer, lctx } = this._ensureLayerSlot('_bgLayer', sliceWidth, this.height, layerScale);
      // 渐变对象按当前变换重建：切片原点变化后不能沿用旧渐变（否则渐变位置错位）。
      if (environment.invalidateGradientCache) environment.invalidateGradientCache();
      lctx.save();
      lctx.translate(-wantLeft, 0); // 仍用世界坐标绘制，只取所需切片
      environment.drawStaticBackground(lctx, this.worldWidth, this.height);
      lctx.restore();
      layer._sliceLeft = wantLeft;
      layer._sliceWorldWidth = sliceWidth;
      this._bgLayerKey = key;
    }

    // 静态家具签名：类型/位置/尺寸以及世界尺寸与 DPR。新增、移除、resize 都会失效重建。
    _staticFurnitureKey() {
      const parts = [`${Math.round(this.worldWidth)}|${Math.round(this.height)}|${this.dpr}`];
      for (const f of this.furniture) {
        if (!this._isBakedFurniture(f)) continue;
        // 爬梯用 startX/startY 而非 x/y，取两者兼容，避免签名出现 NaN
        const fx = Number.isFinite(f.x) ? f.x : (f.startX || 0);
        const fy = Number.isFinite(f.y) ? f.y : (f.startY || 0);
        parts.push(`${f.type}:${Math.round(fx * 4)}:${Math.round(fy * 4)}:${Math.round(this._halfWidth(f) * 4)}`);
      }
      return parts.join('|');
    }

    _ensureStaticFurnitureLayer() {
      const key = this._staticFurnitureKey();
      if (this._staticFurnitureLayer && key === this._staticFurnitureLayerKey) return;
      const { layer, lctx } = this._ensureLayerSlot('_staticFurnitureLayer', this.worldWidth, this.height, 1);
      layer._sliceLeft = 0;
      layer._sliceWorldWidth = this.worldWidth;
      for (const f of this.furniture) {
        if (!this._isBakedFurniture(f)) continue;
        // 烘焙前同步一次 update（如 Scratcher 的 y 依赖 floorY）；主循环还会再 update，
        // 但这三种类型的 update 是幂等的，只同步 y / 清理失效 occupant，无跨对象副作用。
        f.update(this.worldWidth, this.height, this);
        f.draw(lctx);
      }
      this._staticFurnitureLayerKey = key;
    }

    // 只把当前可见的世界切片 blit 到主画布，减少填充率。
    // 源矩形按缓存比例换算到后备像素（并扣掉切片原点），目标用世界 CSS 单位；
    // 主 ctx 已带 dpr + zoom + 相机变换，因此平移只改目标位置、缩放由 ctx 完成，不错位。
    _drawCachedLayer(ctx, layer, verticalPad = 0) {
      if (!layer) return;
      const r = this._visibleRange;
      const x0 = Math.max(0, Math.floor(r.left));
      const x1 = Math.min(this.worldWidth, Math.ceil(r.right));
      if (x1 <= x0) return;
      const sliceLeft = layer._sliceLeft || 0;
      const sliceW = layer._sliceWorldWidth || this.worldWidth;
      const sx0 = Math.max(x0, sliceLeft);
      const sx1 = Math.min(x1, sliceLeft + sliceW);
      if (sx1 <= sx0) return;
      const scale = layer._cacheDpr || 1;
      const sourceX = (sx0 - sliceLeft) * scale;
      const targetWidth = sx1 - sx0;
      const sourceWidth = targetWidth * scale;
      ctx.drawImage(layer, sourceX, 0, sourceWidth, layer.height, sx0, 0, targetWidth, this.height);
      if (verticalPad > 0) {
        ctx.drawImage(layer, sourceX, 0, sourceWidth, 1, sx0, -verticalPad, targetWidth, verticalPad);
        ctx.drawImage(layer, sourceX, layer.height - 1, sourceWidth, 1,
          sx0, this.height, targetWidth, verticalPad);
      }
    }

    // 自适应画质：连续慢帧才降级，持续流畅才升级，避免在阈值附近来回抖动。
    // 降级只降低 DPR 与跳过部分昂贵绘制细节，不改玩法与实体数量。
    _updateRenderQuality() {
      if (this._qualityLocked) return;
      const ema = this._frameEma;
      let next = this.renderQuality;
      if (ema > 22) { this._slowFrames++; this._fastFrames = 0; }
      else if (ema < 13) { this._fastFrames++; this._slowFrames = 0; }
      else { this._slowFrames = 0; this._fastFrames = 0; }

      if (this._slowFrames >= 20) next = ema > 30 ? 'low' : 'medium';
      else if (this._fastFrames >= 180) next = 'high';
      if (next === this.renderQuality) return;

      this.renderQuality = next;
      window.CyberMeow.renderQuality = next;
      const cap = next === 'high' ? 2 : (next === 'medium' ? 1.25 : 1);
      if (cap !== this._dprCap) {
        this._dprCap = cap;
        this.resize(); // 重设主画布后备缓冲与离屏层
      }
      this._slowFrames = 0;
      this._fastFrames = 0;
    }

    // --- 主帧渲染循环 ---
    loop() {
      const { ctx, viewportWidth, viewportHeight, worldWidth, height } = this;

      // 帧时间步（秒）：传给猫的状态机做帧率解耦。首帧或时钟异常时回退到名义帧，
      // 上限 0.05s 防止切回标签页后一帧推进过多导致行为跳变。
      const nowMs = (typeof performance !== 'undefined' && performance.now)
        ? performance.now() : Date.now();
      const dt = this._lastFrameTime
        ? MathUtils.clamp((nowMs - this._lastFrameTime) / 1000, 1 / 1000, 0.05)
        : 1 / 60;
      this._lastFrameTime = nowMs;
      this.dt = dt;
      // 帧间隔 EMA 与画质自适应（用真实帧间隔，不用被 clamp 后的 dt）
      const rawFrameMs = nowMs - (this._prevFrameMs === undefined ? nowMs - 16.7 : this._prevFrameMs);
      this._prevFrameMs = nowMs;
      this._frameEma = this._frameEma * 0.88 + Math.min(rawFrameMs, 200) * 0.12;
      this._updateRenderQuality();

      // 喵视角：在插值之前更新目标镜头，让跟随平滑且不被手动平移抢走
      if (this.catCam) {
        if (this.cats.indexOf(this.catCam) === -1) {
          this.catCam = null;
        } else {
          const maxCamX = Math.max(0, this.worldWidth - this.viewportWidth / this.zoom);
          this.targetCameraX = MathUtils.clamp(
            this.catCam.x - this.viewportWidth / (2 * this.zoom), 0, maxCamX);
        }
      }

      // 1. 相机与缩放平滑插值 (Lerp Smoothing)
      this.zoom = MathUtils.lerp(this.zoom, this.targetZoom, 0.08);
      if (Math.abs(this.zoom - this.targetZoom) < 0.001) {
        this.zoom = this.targetZoom;
        this._zoomTransition = false;
      }
      const maxCamX = Math.max(0, this.worldWidth - this.viewportWidth / this.zoom);
      this.cameraX = MathUtils.clamp(MathUtils.lerp(this.cameraX, this.targetCameraX, 0.12), 0, maxCamX);
      this.updateRoomNav();

      // 每帧重置变换到设备像素坐标系：clearRect 必须以 CSS 像素尺寸覆盖整个后备缓冲
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, viewportWidth, viewportHeight);

      // --- 进入世界相机空间变换 ---
      ctx.save();
      ctx.translate(0, this.sceneOffsetY);
      ctx.scale(this.zoom, this.zoom);
      ctx.translate(-this.cameraX, 0);

      // 当前可见世界 x 范围（含安全余量），只用于绘制裁剪，不参与任何物理/交互计算
      this._refreshVisibleRange();

      // 2. 背景与天气系统 (覆盖整座 3000px 豪宅世界)
      // 取舍：静态背景烘焙到「视口切片」离屏层，命中缓存时只 drawImage 一次；
      //      天气粒子与飞鸟是动态层，逐帧单独绘制，不会被缓存冻结。
      environment.update(worldWidth, height);
      this._ensureBgLayer();
      this._drawCachedLayer(ctx, this._bgLayer, this.sceneOffsetY / this.zoom);
      environment.drawWeatherParticles(ctx, worldWidth, height);

      // 3. 阳光光束 (动态，始终绘制)
      if (this.sunbeam && environment.theme !== 'cyber_neon') {
        this.sunbeam.update(worldWidth, height);
        this.sunbeam.draw(ctx);
      }

      // 4. 家具更新与绘制 (支持扫地机推物碰撞与智能自动出粮)
      // 取舍：所有家具的 update 必须逐帧执行——投喂机出粮、Roomba 推物等有跨对象副作用；
      //      家具不再烘焙到整世界离屏层，而是按可见裁剪直接绘制：省掉第二张常驻离屏层与
      //      每帧第二次 blit，且按主画布完整 DPR 绘制，平移/缩放不会错位或降低清晰度。
      for (let f of this.furniture) {
        f.update(worldWidth, height, this);
        if (this._isVisibleX(f.x, this._halfWidth(f))) f.draw(ctx);
      }

      // 5. 玩具更新与绘制；过期水洼及时回收，避免数组只增不减
      // 取舍：回收 splice 与 update 全部保留，仅裁剪 draw。
      for (let i = this.toys.length - 1; i >= 0; i--) {
        const t = this.toys[i];
        if (t && t.isExpired && t.isExpired()) {
          this.toys.splice(i, 1);
          continue;
        }
        if (!t) { this.toys.splice(i, 1); continue; }
        t.update(worldWidth, height, this);
        if (this._isVisibleX(t.x, this._halfWidth(t))) t.draw(ctx);
      }
      if (this.toys.length > MAX_TOYS) this.toys.splice(0, this.toys.length - MAX_TOYS);
      if (this.furniture.length > MAX_FURNITURE) this.furniture.splice(0, this.furniture.length - MAX_FURNITURE);

      // 6. 猫咪更新与绘制 (支持离屏 Sprite 缓存烘焙与双模 LOD)
      const renderMgr = window.CyberMeow && window.CyberMeow.renderEngineManager;
      const cfg = this.renderEngineConfig || (renderMgr ? renderMgr.config : null) || {};
      const pipe = cfg.pipeline || this.catRenderStyle || 'chibi';
      const actualStyle = (pipe === 'procedural') ? 'procedural' : 'chibi';
      this.catRenderStyle = actualStyle;

      const useSpriteCache = (cfg.spriteCache !== false) && (pipe === 'chibi_cached' || pipe === 'chibi');
      const eyeTracking = (cfg.eyeTracking !== false);
      const clusterLabels = (cfg.clusterLabels !== false);

      let visibleCatsCount = 0;
      for (let c of this.cats) {
        c.update(worldWidth, height, this);
        if (c === this.mouse.draggedCat || this._isVisibleX(c.x, (c.radius || 22) + 40)) {
          visibleCatsCount++;
          c.draw(ctx, worldWidth, height, {
            style: this.catRenderStyle,
            suppressIndividualLabels: clusterLabels,
            useSpriteCache: useSpriteCache,
            eyeTracking: eyeTracking
          });
        }
      }

      // 6.5. 空间聚类与标签分级折叠渲染 (LabelClusterEngine)
      // 在猫咪身躯之后统一绘制聚类胶囊与抗遮挡名牌，解决文字重叠光污染
      if (clusterLabels && window.CyberMeow && window.CyberMeow.LabelClusterEngine) {
        const viewport = {
          cameraX: this.cameraX,
          zoom: this.zoom,
          width: this.viewportWidth,
          height: this.viewportHeight
        };
        const mouseWorld = this.mouse.overScene ? this.mouse : null;
        window.CyberMeow.LabelClusterEngine.renderLabels(ctx, this.cats, viewport, {
          clusterMode: cfg.clusterMode || 'smart',
          catCam: this.catCam
        }, mouseWorld);
      }

      // 7. 放置模式建造虚影预览
      if (this.placement.active) {
        this.drawGhostPreview(ctx);
      }

      // 7. 逗猫棒
      featherWand.draw(ctx);

      // 8. 激光红点
      if (this.laser.active) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.laser.x, this.laser.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#ff3838';
        ctx.shadowColor = '#ff3838';
        ctx.shadowBlur = 20;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(this.laser.x, this.laser.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();
      }

      // 9. 漂浮粒子与爱心：物理推进与回收对所有粒子执行，仅裁剪绘制
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.02;
        p.scale += 0.012;

        if (this._isVisibleX(p.x, 60)) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.font = `${Math.floor(18 * p.scale)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(p.text, p.x, p.y);
          ctx.restore();
        }

        if (p.alpha <= 0) this.particles.splice(i, 1);
      }

      // 10. 红点挑战模式目标点绘制 (在世界坐标系内)
      uiManager.updateChallenge(this.cats, this);
      uiManager.drawChallengeTarget(ctx);

      // --- 退出世界相机空间变换 ---
      ctx.restore();

      // 11. 豪宅全景导航小地图雷达绘制 (屏幕坐标系，不随相机缩放)
      this.renderMiniMap();

      // 12. 引擎遥测数据统计与 UI 刷新
      this.updateTelemetryStats(visibleCatsCount);

      requestAnimationFrame(this.loop);
    }

    updateTelemetryStats(visibleCatsCount) {
      this._telemetryTick = (this._telemetryTick || 0) + 1;
      if (this._telemetryTick % 12 !== 0) return;

      const clusterEngine = window.CyberMeow && window.CyberMeow.LabelClusterEngine;
      const clusterCount = clusterEngine ? (clusterEngine.clusters?.length || 0) : 0;
      const culled = Math.max(0, this.cats.length - visibleCatsCount);

      const fps = Math.round(1000 / Math.max(1, this._frameEma || 16.7));
      const ms = (this._frameEma || 16.7).toFixed(1);

      // 同步模态框内数据
      const elFps = document.getElementById('tuner-fps');
      if (elFps) elFps.innerText = `${fps} FPS`;
      const elMs = document.getElementById('tuner-ms');
      if (elMs) elMs.innerText = `${ms} ms`;
      const elClusters = document.getElementById('tuner-clusters');
      if (elClusters) elClusters.innerText = `${clusterCount} 个`;
      const elVis = document.getElementById('tuner-visible-cats');
      if (elVis) elVis.innerText = `${visibleCatsCount} 只`;
      const elCulled = document.getElementById('tuner-culled');
      if (elCulled) elCulled.innerText = `${culled}`;

      // 同步常驻悬浮 HUD
      const hud = document.getElementById('telemetry-hud');
      if (hud && hud.style.display !== 'none') {
        const hudFps = document.getElementById('telem-hud-fps');
        if (hudFps) hudFps.innerText = `${fps} FPS`;
        const hudMs = document.getElementById('telem-hud-ms');
        if (hudMs) hudMs.innerText = `${ms}ms`;
        const hudCats = document.getElementById('telem-hud-cats');
        if (hudCats) hudCats.innerText = `🐾 ${visibleCatsCount}/${this.cats.length}`;
        const hudCl = document.getElementById('telem-hud-cluster');
        if (hudCl) hudCl.innerText = `📦 ${clusterCount}簇`;
      }
    }

    bindMiniMap() {
      const container = document.getElementById('minimap-container');
      const canvas = document.getElementById('minimap-canvas');
      if (!canvas || !container) return;
      this.miniMapCanvas = canvas;
      this.miniMapCtx = canvas.getContext('2d');

      const handleMinimapPan = (e) => {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return;
        this.catCam = null;
        const clickRatio = MathUtils.clamp((e.clientX - rect.left) / rect.width, 0, 1);
        const worldTargetX = clickRatio * this.worldWidth;
        const maxCamX = Math.max(0, this.worldWidth - this.viewportWidth / this.zoom);
        this.targetCameraX = MathUtils.clamp(worldTargetX - (this.viewportWidth / (2 * this.zoom)), 0, maxCamX);
      };

      let isDown = false;
      container.addEventListener('pointerdown', (e) => {
        if ((e.isPrimary === false && e.pointerType) || e.button !== 0) return;
        isDown = true;
        container.setPointerCapture?.(e.pointerId);
        handleMinimapPan(e);
      });
      window.addEventListener('pointermove', (e) => {
        if (isDown) handleMinimapPan(e);
      });
      window.addEventListener('pointerup', () => { isDown = false; });
      window.addEventListener('pointercancel', () => { isDown = false; });
    }

    renderMiniMap() {
      if (!this.miniMapCanvas || !this.miniMapCtx) return;
      const ctx = this.miniMapCtx;
      const w = this.miniMapCanvas.width;
      const h = this.miniMapCanvas.height;
      const scaleX = w / this.worldWidth;

      ctx.clearRect(0, 0, w, h);

      // 背景与豪宅三区分割线
      ctx.fillStyle = '#e7e5d4';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#c6c8b8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(1000 * scaleX, 0); ctx.lineTo(1000 * scaleX, h);
      ctx.moveTo(2000 * scaleX, 0); ctx.lineTo(2000 * scaleX, h);
      ctx.stroke();

      // 地平线
      ctx.fillStyle = '#d5c8a9';
      ctx.fillRect(0, h - 6, w, 6);

      // 绘制猫咪实时光点
      for (const c of this.cats) {
        const mx = c.x * scaleX;
        const my = (c.y / this.height) * (h - 10) + 2;
        ctx.fillStyle = c.breed ? c.breed.bodyColor : '#48705a';
        ctx.beginPath();
        ctx.arc(mx, MathUtils.clamp(my, 4, h - 6), 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // 视口取景框
      const viewW = (this.viewportWidth / this.zoom) * scaleX;
      const viewX = this.cameraX * scaleX;
      ctx.strokeStyle = '#48705a';
      ctx.lineWidth = 1.5;
      ctx.fillStyle = 'rgba(69, 108, 84, 0.14)';
      ctx.fillRect(viewX, 1, viewW, h - 2);
      ctx.strokeRect(viewX, 1, viewW, h - 2);
    }
  }

  // 挂载并启动应用
  window.addEventListener('DOMContentLoaded', () => {
    window.CyberMeow.app = new CyberMeowApp();
    window.CyberMeow.app.init();
    window.CyberMeow.setTool = (t) => window.CyberMeow.app.setTool(t);
    window.CyberMeow.saveState = () => window.CyberMeow.app.saveState();
  });

})(window);
