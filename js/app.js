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
    BREEDS,
    PERSONALITIES
  } = window.CyberMeow;

  // 实体数量上限：防止长时间游玩后玩具/家具无限累积拖慢主循环
  const MAX_TOYS = 80;
  const MAX_FURNITURE = 60;
  const MAX_CATS = 40;
  const MAX_PARTICLES = 240;

  // 视口裁剪安全余量（世界像素）：覆盖最大道具半宽、悬吊摆动、拖拽与拖尾动画，
  // 宁可多画一点也不误裁边缘对象；缩小视口范围才省填充率。
  const CULL_MARGIN = 180;

  class CyberMeowApp {
    constructor() {
      this.canvas = document.getElementById('playground');
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

      // 离屏缓存层：按世界坐标烘焙（后备按 dpr 放大），相机平移/缩放时无需重建。
      this._bgLayer = null;
      this._bgLayerKey = '';
      this._staticFurnitureLayer = null;
      this._staticFurnitureLayerKey = '';
      this._visibleRange = { left: -CULL_MARGIN, right: 0 };

      // 控制状态
      this.currentTool = 'pet';
      this.laser = { x: -100, y: -100, active: false };
      this.mouse = { x: this.width / 2, y: this.height / 2, isDown: false, draggedCat: null };

      // 拖拽抚摸与双击检测
      this.petDistanceTracker = 0;
      this.lastMousePos = { x: 0, y: 0 };
      this.lastClickedCat = null;
      this.lastClickTime = 0;
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

      uiManager.init();
      this.bindInputs();
      this.bindUIButtons();
      this.bindManorNavigation();
      this.updateHud();

      // 启动主渲染循环
      this.loop = this.loop.bind(this);
      requestAnimationFrame(this.loop);

      uiManager.showToast('🏰 欢迎来到 3000px 超宽猫猫豪宅！右键拖动平移全景，按 C 开启喵视角~');
    }

    resize() {
      // 按设备像素比设置画布后备缓冲，避免高 DPI 屏幕上画面模糊；上限 2 以控制显存与填充率
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.dpr = dpr;
      this.viewportWidth = window.innerWidth;
      this.viewportHeight = window.innerHeight;
      this.canvas.width = Math.round(this.viewportWidth * dpr);
      this.canvas.height = Math.round(this.viewportHeight * dpr);
      this.canvas.style.width = this.viewportWidth + 'px';
      this.canvas.style.height = this.viewportHeight + 'px';
      this.worldWidth = Math.max(3000, window.innerWidth * 1.8);
      this.width = this.worldWidth;
      this.height = this.viewportHeight;
    }

    // 初始化超宽大平层三区豪宅：阳光露台 (0-1000) | 豪华客厅 (1000-2000) | 游乐高塔 (2000-3000)
    // 构建立体三维猫道走廊：每区均设专属猫爬架，空中有悬索桥、高空吊床、阶梯爬道与风铃玩具，彻底告别空旷！
    initDefaultScene() {
      const floorY = physicsWorld.getFloorY(this.height);

      // --- 1. 左翼：阳光全景温室露台 (Sunlit Solarium, 0-1000) ---
      this.furniture.push(new WindowSill(240, this.height * 0.28, 200, 150));
      this.furniture.push(new WallClimbLadder(360, floorY - 50, 3, 1, 65, 12, 70, -60));
      this.furniture.push(new CatTree(640, floorY)); // 露台温室景观猫爬架！
      this.furniture.push(new WallPerch(820, floorY - 240, 130, 16));
      this.furniture.push(new CeilingDanglingToy(740, floorY - 280, '#ff7675'));
      this.furniture.push(new CardboardBox(450, floorY - 25));

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

      // 默认生成 3 只可爱猫咪，分布在不同区域
      this.cats.push(new Cat(450, floorY - 35, { breed: BREEDS[0], name: '大橘' }));
      this.cats.push(new Cat(1350, floorY - 35, { breed: BREEDS[1], name: '奥利奥' }));
      this.cats.push(new Cat(2350, floorY - 35, { breed: BREEDS[3], name: '雪球' }));

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
      this.currentTool = tool;
      document.querySelectorAll('#dock-container .dock-item').forEach(btn => {
        if (btn.dataset.tool) {
          btn.classList.toggle('active', btn.dataset.tool === tool);
        }
      });

      this.laser.active = (tool === 'laser');
      featherWand.active = (tool === 'feather');

      const hints = {
        'pet': '👆 抚摸抓起：在猫身上滑动抚摸，按住拖动可自由抓起或抛掷；双击可抱入特写侍奉！',
        'cat': '🐱 召唤猫咪：点击画布召唤一只全新的随机品种猫咪！',
        'laser': '🔴 激光红点：在屏幕上移动，猫咪们会集体兴奋飞扑！',
        'feather': '🪶 逗猫棒：挥动羽毛吸引小猫咪捕猎跳跃！',
        'fish': '🐟 投喂鱼干：美味小零食，猫咪会闻香飞奔吃掉！',
        'yarn': '🧶 扔毛线球：带有真实弹力的毛线球，扑咬会散开！',
        'box': '📦 放置纸箱：经典纸箱，胖猫还会卡屁股！',
        'cattree': '🌳 放置猫爬架：猫咪可以跳上多层平台登高望远！',
        'roomba': '🤖 智能扫地机：地面巡逻并推撞开障碍物，猫咪可骑乘！',
        'scratcher': '🪵 放置猫抓板：让猫咪磨爪子，保护家具！',
        'catnip': '🌿 猫薄荷喷雾：让猫咪陷入极乐打滚与兔子蹬！'
      };
      uiManager.showToast(hints[tool] || '');
    }

    // 屏幕像素坐标转世界坐标
    getWorldPos(e) {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;

      const worldX = screenX / this.zoom + this.cameraX;
      const worldY = screenY / this.zoom;
      return { x: worldX, y: worldY, screenX, screenY };
    }

    bindInputs() {
      // 禁用 Canvas 默认右键菜单，留给全景平移
      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

      const onPointerDown = (e) => {
        soundEngine.init();

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
        this.lastMousePos = { x: pos.x, y: pos.y };

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

        // 3. 检查是否点击了猫咪 (在任何工具模式下，只要按中猫咪，都优先允许抓起或双击侍奉！)
        let clickedCat = null;
        for (let i = this.cats.length - 1; i >= 0; i--) {
          const c = this.cats[i];
          if (Math.hypot(c.x - pos.x, c.y - pos.y) < c.radius + 15) {
            clickedCat = c;
            break;
          }
        }

        if (clickedCat) {
          // 双击检测：若 320ms 内连续点击同一只猫，打开桌面特写侍奉台！
          const now = Date.now();
          if (this.lastClickedCat === clickedCat && (now - this.lastClickTime < 320)) {
            uiManager.openCloseUpStudio(clickedCat);
            this.lastClickedCat = null;
            return;
          }
          this.lastClickedCat = clickedCat;
          this.lastClickTime = now;

          // 抓起猫咪：彻底清除它身上的依附引用，保证随时能放回！
          this.mouse.draggedCat = clickedCat;
          clickedCat.isGrabbed = true;
          if (clickedCat.ridingObj) {
            if (clickedCat.ridingObj.rider === clickedCat) clickedCat.ridingObj.rider = null;
            clickedCat.ridingObj = null;
          }
          if (clickedCat.inBox) {
            if (clickedCat.inBox.occupant === clickedCat) clickedCat.inBox.occupant = null;
            clickedCat.inBox = null;
          }
          clickedCat.perchedTier = null;
          clickedCat.pet(this);
          return;
        }

        // 4. 工具使用逻辑 (在空白处点击)
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
          this.furniture.push(new CatTree(pos.x, this.height));
          soundEngine.playPop();
        } else if (this.currentTool === 'roomba') {
          this.furniture.push(new Roomba(pos.x, this.height - 20));
          soundEngine.playPop();
        } else if (this.currentTool === 'scratcher') {
          this.furniture.push(new Scratcher(pos.x, this.height));
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
        // 相机平移处理
        if (this.isPanningCamera) {
          const dx = e.clientX - this.panStartX;
          const maxCamX = Math.max(0, this.worldWidth - this.viewportWidth / this.zoom);
          this.targetCameraX = MathUtils.clamp(this.panStartCamX - dx / this.zoom, 0, maxCamX);
          return;
        }

        const pos = this.getWorldPos(e);
        this.mouse.x = pos.x;
        this.mouse.y = pos.y;
        this.laser.x = pos.x;
        this.laser.y = pos.y;

        featherWand.update(pos.x, pos.y);

        // 拖拽抓起的猫咪
        if (this.mouse.draggedCat) {
          this.mouse.draggedCat.x = pos.x;
          this.mouse.draggedCat.y = pos.y;
          this.mouse.draggedCat.vx = (pos.x - this.lastMousePos.x) * 0.85;
          this.mouse.draggedCat.vy = (pos.y - this.lastMousePos.y) * 0.85;
        }

        // 光标悬浮提示
        let isHoveringCat = false;
        for (let c of this.cats) {
          if (Math.hypot(c.x - pos.x, c.y - pos.y) < c.radius + 16) {
            isHoveringCat = true;
            break;
          }
        }
        if (!this.laser.active && !featherWand.active) {
          this.canvas.style.cursor = this.mouse.draggedCat ? 'grabbing' : (isHoveringCat ? 'grab' : 'default');
        }

        // 抚摸手势累计
        if (this.currentTool === 'pet' && this.mouse.isDown && !this.mouse.draggedCat) {
          const delta = Math.hypot(pos.x - this.lastMousePos.x, pos.y - this.lastMousePos.y);
          this.petDistanceTracker += delta;
          if (this.petDistanceTracker > 32) {
            this.petDistanceTracker = 0;
            for (let c of this.cats) {
              if (Math.hypot(c.x - pos.x, c.y - pos.y) < c.radius + 20) {
                c.pet(this);
                break;
              }
            }
          }
        }

        this.lastMousePos = { x: pos.x, y: pos.y };
      };

      const onPointerUp = (e) => {
        if (e && e.pointerId && this.canvas.releasePointerCapture) {
          try { this.canvas.releasePointerCapture(e.pointerId); } catch(err){}
        }
        this.isPanningCamera = false;

        // 放下抓起的猫咪 (赋予自然抛物线初速度，保证必定顺畅落地！)
        if (this.mouse.draggedCat) {
          const c = this.mouse.draggedCat;
          c.isGrabbed = false;
          c.state = 'idle';
          c.vx = MathUtils.clamp(c.vx, -9, 9);
          c.vy = MathUtils.clamp(c.vy, -9, 9);
          this.mouse.draggedCat = null;
        }

        this.mouse.isDown = false;
        soundEngine.stopPurr();
      };

      // 滚轮横向平移全景世界
      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
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
        if (e.target.tagName === 'INPUT') return;

        const key = e.key.toLowerCase();
        const maxCamX = Math.max(0, this.worldWidth - this.viewportWidth / this.zoom);

        if (key === 'a' || e.code === 'ArrowLeft') {
          this.targetCameraX = Math.max(0, this.targetCameraX - 120);
        } else if (key === 'd' || e.code === 'ArrowRight') {
          this.targetCameraX = Math.min(maxCamX, this.targetCameraX + 120);
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

    // 绑定豪宅三区分区导航与全景缩放切换
    bindManorNavigation() {
      const zoneBtns = document.querySelectorAll('.nav-zone-btn');
      zoneBtns.forEach(btn => {
        btn.onclick = () => {
          zoneBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          // 分区导航是明确的手动镜头控制，退出喵视角
          this.catCam = null;

          const zone = btn.dataset.zone;
          const maxCamX = Math.max(0, this.worldWidth - this.viewportWidth / this.zoom);
          if (zone === 'patio') {
            this.targetCameraX = 0;
            uiManager.showToast('☀️ 已平移至「阳光露台」：全景大窗与温暖日光！');
          } else if (zone === 'living') {
            this.targetCameraX = Math.min(maxCamX, 980);
            uiManager.showToast('🛋️ 已平移至「豪华客厅」：大波斯地毯与智能自动投喂机！');
          } else if (zone === 'playground') {
            this.targetCameraX = maxCamX;
            uiManager.showToast('🎪 已平移至「游乐高塔」：多层天桥跳台与豪华猫爬架！');
          }
        };
      });

      // 全景 / 常规视角切换 (Zoom Toggle)
      const zoomBtn = document.getElementById('btn-zoom-toggle');
      if (zoomBtn) {
        zoomBtn.onclick = () => {
          if (this.targetZoom >= 0.95) {
            // 切到全景俯瞰视角 (0.62x)
            this.targetZoom = 0.62;
            zoomBtn.innerText = '🔍 返回常规';
            zoomBtn.style.color = '#2ed573';
            uiManager.showToast('🔭 已开启 0.62x 全景俯瞰模式，一览整座 3000px 豪宅！');
          } else {
            // 切回常规视角 (1.0x)
            this.targetZoom = 1.0;
            zoomBtn.innerText = '🔍 切换全景';
            zoomBtn.style.color = '#feca57';
            uiManager.showToast('🔍 已恢复 1.0x 细腻吸猫视角！');
          }
        };
      }
    }

    bindUIButtons() {
      // 声音切换
      const soundBtn = document.getElementById('btn-sound');
      if (soundBtn) {
        soundBtn.onclick = () => {
          soundEngine.setMuted(!soundEngine.isMuted);
          soundBtn.innerText = soundEngine.isMuted ? '🔇 声音: 关' : '🔊 声音: 开';
        };
      }

      // Lofi 音乐切换
      const bgmBtn = document.getElementById('btn-bgm');
      if (bgmBtn) {
        bgmBtn.onclick = () => {
          soundEngine.bgmEnabled = !soundEngine.bgmEnabled;
          if (soundEngine.bgmEnabled) {
            soundEngine.startLofiBGM();
            bgmBtn.innerText = '🎵 音乐: 开';
            bgmBtn.classList.add('active');
            uiManager.showToast('📻 已开启程序化生成 Lofi 治愈背景音乐~');
          } else {
            soundEngine.stopLofiBGM();
            bgmBtn.innerText = '🎵 音乐: 关';
            bgmBtn.classList.remove('active');
          }
        };
      }

      // 天气切换
      const weatherBtn = document.getElementById('btn-weather');
      if (weatherBtn) {
        weatherBtn.onclick = () => {
          const w = environment.toggleWeather();
          const icons = { clear: '☀️ 晴空', rain: '🌧️ 细雨', fireflies: '✨ 萤火' };
          weatherBtn.innerText = icons[w] || w;
          uiManager.showToast(`🌤️ 天气已切换为: ${icons[w]}`);
        };
      }

      // 主题切换
      const themeBtn = document.getElementById('btn-theme');
      if (themeBtn) {
        themeBtn.onclick = () => {
          const themes = ['cozy_night', 'sunny_day', 'cyber_neon'];
          const next = themes[(themes.indexOf(environment.theme) + 1) % themes.length];
          environment.setTheme(next);
          const names = { cozy_night: '🌙 温馨夜', sunny_day: '☀️ 暖阳日', cyber_neon: '🌌 赛博夜' };
          themeBtn.innerText = names[next];
        };
      }

      // 反重力模式
      const antiBtn = document.getElementById('btn-antigravity');
      if (antiBtn) {
        antiBtn.onclick = () => {
          const isZero = physicsWorld.isZeroG();
          physicsWorld.gravityMode = isZero ? 'earth' : 'antigravity';
          antiBtn.classList.toggle('special-on', !isZero);
          antiBtn.innerText = !isZero ? '🛸 反重力已激活！' : '🛸 反重力模式';

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
          this.furniture = this.furniture.filter(f => f.type === 'cattree' || f.type === 'feeder');
          for (let c of this.cats) {
            c.inBox = null;
            c.ridingObj = null;
          }
          soundEngine.playPop();
          this.updateHud();
          uiManager.showToast('🧹 已清理散落玩具（保留投喂机与爬架）！');
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
          dockWrapper.classList.toggle('collapsed');
          const isCollapsed = dockWrapper.classList.contains('collapsed');
          dockToggleBtn.innerHTML = isCollapsed ? '▲ 展开侍奉坞' : '▼ 收起抽屉 (纯净吸猫)';
        };
      }

      // 模态关闭
      const closePassport = document.getElementById('btn-close-passport');
      if (closePassport) closePassport.onclick = () => uiManager.closeCatPassport();
    }

    updateHud() {
      const catsEl = document.getElementById('stat-cats');
      const toysEl = document.getElementById('stat-toys');
      const moodEl = document.getElementById('stat-mood');

      if (catsEl) catsEl.innerText = this.cats.length;
      if (toysEl) toysEl.innerText = this.toys.length + this.furniture.length;
      if (moodEl) moodEl.innerText = (100 + this.cats.length * 8) + '%';
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
        this.furniture.push(new WindowSill(240, this.height * 0.28, 200, 150));
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

    _ensureLayerSlot(field) {
      // 世界级离屏层固定按 1x 渲染：DPR=2 时两层约占 100MB 显存，1x 后约 26MB。
      // 背景是渐变/木纹，家具是简单图形，放大后视觉损失很小；猫咪等动态主体仍在主画布按完整 DPR 绘制。
      const layerDpr = 1;
      const pw = Math.max(1, Math.round(this.worldWidth * layerDpr));
      const ph = Math.max(1, Math.round(this.height * layerDpr));
      let layer = this[field];
      if (!layer || layer.width !== pw || layer.height !== ph) {
        layer = document.createElement('canvas');
        layer.width = pw;
        layer.height = ph;
        this[field] = layer;
      }
      layer._cacheDpr = layerDpr;
      const lctx = layer.getContext('2d');
      lctx.setTransform(layerDpr, 0, 0, layerDpr, 0, 0);
      lctx.clearRect(0, 0, this.worldWidth, this.height);
      return { layer, lctx };
    }

    // 背景签名：主题/世界尺寸/DPR 任一变化才重建；天气粒子是动态层，不进签名。
    _ensureBgLayer() {
      const key = `${environment.theme}|${Math.round(this.worldWidth)}|${Math.round(this.height)}|${this.dpr}`;
      if (this._bgLayer && key === this._bgLayerKey) return;
      const { lctx } = this._ensureLayerSlot('_bgLayer');
      environment.drawStaticBackground(lctx, this.worldWidth, this.height);
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
      const { lctx } = this._ensureLayerSlot('_staticFurnitureLayer');
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
    // 源矩形按 dpr 换算到后备像素，目标用世界 CSS 像素；主 ctx 已有 dpr + zoom + 相机变换，
    // zoom=1 时源像素与目标像素 1:1，不会模糊；相机平移只改变目标位置，不会错位。
    _drawCachedLayer(ctx, layer) {
      if (!layer) return;
      const r = this._visibleRange;
      const x0 = Math.max(0, Math.floor(r.left));
      const x1 = Math.min(this.worldWidth, Math.ceil(r.right));
      if (x1 <= x0) return;
      const sourceDpr = layer._cacheDpr || 1;
      ctx.drawImage(layer, x0 * sourceDpr, 0, (x1 - x0) * sourceDpr, layer.height,
        x0, 0, x1 - x0, this.height);
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
      this.cameraX = MathUtils.lerp(this.cameraX, this.targetCameraX, 0.1);
      this.zoom = MathUtils.lerp(this.zoom, this.targetZoom, 0.08);

      // 每帧重置变换到设备像素坐标系：clearRect 必须以 CSS 像素尺寸覆盖整个后备缓冲
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, viewportWidth, viewportHeight);

      // --- 进入世界相机空间变换 ---
      ctx.save();
      ctx.scale(this.zoom, this.zoom);
      ctx.translate(-this.cameraX, 0);

      // 当前可见世界 x 范围（含安全余量），只用于绘制裁剪，不参与任何物理/交互计算
      this._refreshVisibleRange();

      // 2. 背景与天气系统 (覆盖整座 3000px 豪宅世界)
      // 取舍：静态背景烘焙到离屏层，命中缓存时只 drawImage；天气粒子逐帧动态绘制。
      environment.update(worldWidth, height);
      this._ensureBgLayer();
      this._drawCachedLayer(ctx, this._bgLayer);
      environment.drawWeatherParticles(ctx, worldWidth, height);

      // 3. 阳光光束 (动态，始终绘制)
      if (this.sunbeam && environment.theme !== 'cyber_neon') {
        this.sunbeam.update(worldWidth, height);
        this.sunbeam.draw(ctx);
      }

      // 4. 静态家具层：只烘焙无动画的跳台/爬梯/抓板，命中缓存后 drawImage
      this._ensureStaticFurnitureLayer();
      this._drawCachedLayer(ctx, this._staticFurnitureLayer);

      // 5. 家具更新与绘制 (支持扫地机推物碰撞与智能自动出粮)
      // 取舍：所有家具的 update 必须逐帧执行——投喂机出粮、Roomba 推物等有跨对象副作用；
      //      仅对可见的、未烘焙的家具调用 draw，烘焙类型已在上面整层绘制，不重复画。
      for (let f of this.furniture) {
        f.update(worldWidth, height, this);
        if (this._isBakedFurniture(f)) continue;
        if (this._isVisibleX(f.x, this._halfWidth(f))) f.draw(ctx);
      }

      // 6. 玩具更新与绘制；过期水洼及时回收，避免数组只增不减
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

      // 7. 猫咪更新与绘制 (分层渲染确保交互自然)
      // 取舍：猫的 update 负责吃鱼 splice / 骑行 / 附着状态，全部执行；被拖拽的猫强制绘制。
      for (let c of this.cats) {
        c.update(worldWidth, height, this);
        if (c === this.mouse.draggedCat || this._isVisibleX(c.x, (c.radius || 22) + 40)) c.draw(ctx);
      }

      // 8. 逗猫棒
      featherWand.draw(ctx);

      // 9. 激光红点
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

      // 10. 漂浮粒子与爱心：物理推进与回收对所有粒子执行，仅裁剪绘制
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

      // 11. 红点挑战模式目标点绘制 (在世界坐标系内)
      uiManager.updateChallenge(this.cats, this);
      uiManager.drawChallengeTarget(ctx);

      // --- 退出世界相机空间变换 ---
      ctx.restore();

      requestAnimationFrame(this.loop);
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
