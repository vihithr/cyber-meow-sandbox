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
    WaterMug,
    WaterPuddle,
    BREEDS,
    PERSONALITIES
  } = window.CyberMeow;

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

      // 场景对象
      this.cats = [];
      this.toys = [];
      this.furniture = [];
      this.particles = [];
      this.sunbeam = null;

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

      uiManager.showToast('🏰 欢迎来到 3000px 超宽猫猫豪宅！按住鼠标右键可拖动平移全景~');
    }

    resize() {
      this.viewportWidth = this.canvas.width = window.innerWidth;
      this.viewportHeight = this.canvas.height = window.innerHeight;
      this.worldWidth = Math.max(3000, window.innerWidth * 1.8);
      this.width = this.worldWidth;
      this.height = this.viewportHeight;
    }

    // 初始化超宽大平层三区豪宅：阳光露台 (0-1000) | 豪华客厅 (1000-2000) | 游乐高塔 (2000-3000)
    initDefaultScene() {
      const floorY = physicsWorld.getFloorY(this.height);

      // --- 1. 左翼：阳光全景温室露台 (Sunlit Solarium) ---
      this.furniture.push(new WindowSill(260, this.height * 0.28, 200, 150));
      this.furniture.push(new WallPerch(540, floorY - 240, 130, 16));
      this.furniture.push(new CardboardBox(380, floorY - 25));

      // --- 2. 中央：豪华猫咪大客厅 (Grand Living Room) ---
      // 智能自动出粮投喂机 (全自动宠溺供粮)
      this.furniture.push(new SmartFeeder(1220, floorY));
      this.furniture.push(new Roomba(1480, floorY - 20));
      this.furniture.push(new WallPerch(1720, floorY - 220, 130, 16));
      this.toys.push(new WaterMug(1730, floorY - 235)); // 跳台边缘水杯，等待被推落打翻！
      this.toys.push(new YarnBall(1620, floorY - 60));

      // --- 3. 右翼：极限运动游乐高塔 (Adventure Playground) ---
      this.furniture.push(new Scratcher(2180, floorY));
      this.furniture.push(new CatTree(2460, floorY));
      this.furniture.push(new WallPerch(2680, floorY - 260, 140, 16));
      this.furniture.push(new WallPerch(2860, floorY - 170, 120, 16));
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

        // 2. 检测是否按中了智能自动投喂机 (点击一键手动加餐喷粮)
        for (let f of this.furniture) {
          if (f.type === 'feeder') {
            if (Math.abs(f.x - pos.x) < f.w && Math.abs(f.y - pos.y) < f.h) {
              f.dispense(this);
              uiManager.showToast('🥣 触发智能投喂机一键开饭！香脆小鱼干喷出！');
              return;
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
        }
      });
    }

    // 绑定豪宅三区分区导航与全景缩放切换
    bindManorNavigation() {
      const zoneBtns = document.querySelectorAll('.nav-zone-btn');
      zoneBtns.forEach(btn => {
        btn.onclick = () => {
          zoneBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

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
          if (item.hunger) cat.hunger = item.hunger;
          if (item.affection) cat.affection = item.affection;
          return cat;
        });

        // 补齐 3000px 豪宅配套家具与自动投喂机
        this.furniture.push(new WindowSill(260, this.height * 0.28, 200, 150));
        this.furniture.push(new WallPerch(540, floorY - 240, 130, 16));
        this.furniture.push(new SmartFeeder(1220, floorY));
        this.furniture.push(new Roomba(1480, floorY - 20));
        this.furniture.push(new WallPerch(1720, floorY - 220, 130, 16));
        this.furniture.push(new Scratcher(2180, floorY));
        this.furniture.push(new CatTree(2460, floorY));
        this.furniture.push(new WallPerch(2680, floorY - 260, 140, 16));
        this.furniture.push(new WallPerch(2860, floorY - 170, 120, 16));
        this.toys.push(new YarnBall(1620, floorY - 60));

        return true;
      } catch (e) {
        return false;
      }
    }

    // --- 主帧渲染循环 ---
    loop() {
      const { ctx, viewportWidth, viewportHeight, worldWidth, height } = this;

      // 1. 相机与缩放平滑插值 (Lerp Smoothing)
      this.cameraX = MathUtils.lerp(this.cameraX, this.targetCameraX, 0.1);
      this.zoom = MathUtils.lerp(this.zoom, this.targetZoom, 0.08);

      // 清屏
      ctx.clearRect(0, 0, viewportWidth, viewportHeight);

      // --- 进入世界相机空间变换 ---
      ctx.save();
      ctx.scale(this.zoom, this.zoom);
      ctx.translate(-this.cameraX, 0);

      // 2. 背景与天气系统 (覆盖整座 3000px 豪宅世界)
      environment.update(worldWidth, height);
      environment.drawBackground(ctx, worldWidth, height);

      // 3. 阳光光束
      if (this.sunbeam && environment.theme !== 'cyber_neon') {
        this.sunbeam.update(worldWidth, height);
        this.sunbeam.draw(ctx, height);
      }

      // 4. 家具更新与绘制 (支持扫地机推物碰撞与智能自动出粮)
      for (let f of this.furniture) {
        f.update(worldWidth, height, this);
        f.draw(ctx);
      }

      // 5. 玩具更新与绘制
      for (let i = this.toys.length - 1; i >= 0; i--) {
        const t = this.toys[i];
        t.update(worldWidth, height, this);
        t.draw(ctx);
      }

      // 6. 猫咪更新与绘制 (分层渲染确保交互自然)
      for (let c of this.cats) {
        c.update(worldWidth, height, this);
        c.draw(ctx);
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

      // 9. 漂浮粒子与爱心
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.02;
        p.scale += 0.012;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.font = `${Math.floor(18 * p.scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y);
        ctx.restore();

        if (p.alpha <= 0) this.particles.splice(i, 1);
      }

      // 10. 红点挑战模式目标点绘制 (在世界坐标系内)
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
