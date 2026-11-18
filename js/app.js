/**
 * CyberMeow - 游乐场核心编排控制器 (App Orchestrator)
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
    BREEDS,
    PERSONALITIES
  } = window.CyberMeow;

  class CyberMeowApp {
    constructor() {
      this.canvas = document.getElementById('playground');
      this.ctx = this.canvas.getContext('2d');
      this.width = window.innerWidth;
      this.height = window.innerHeight;

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

      // 拖拽抚摸检测
      this.petDistanceTracker = 0;
      this.lastMousePos = { x: 0, y: 0 };
    }

    init() {
      this.resize();
      window.addEventListener('resize', () => this.resize());

      // 初始化阳光
      this.sunbeam = new Sunbeam(this.width * 0.45, 0, 220);

      // 加载存档或默认场景
      if (!this.loadState()) {
        this.initDefaultScene();
      }

      uiManager.init();
      this.bindInputs();
      this.bindUIButtons();
      this.updateHud();

      // 启动主渲染循环
      this.loop = this.loop.bind(this);
      requestAnimationFrame(this.loop);

      uiManager.showToast('🐾 欢迎来到 CyberMeow 游乐场！点击或抚摸小猫咪互动吧~');
    }

    resize() {
      this.width = this.canvas.width = window.innerWidth;
      this.height = this.canvas.height = window.innerHeight;
      if (this.sunbeam) {
        this.sunbeam.x = this.width * 0.45;
      }
    }

    initDefaultScene() {
      const floorY = physicsWorld.getFloorY(this.height);

      // 默认生成 3 只可爱猫咪，位于抬高安全的室内地毯上，绝不与底栏遮挡
      this.cats.push(new Cat(this.width * 0.35, floorY - 35, { breed: BREEDS[0], name: '大橘' }));
      this.cats.push(new Cat(this.width * 0.5, floorY - 35, { breed: BREEDS[1], name: '奥利奥' }));
      this.cats.push(new Cat(this.width * 0.65, floorY - 35, { breed: BREEDS[3], name: '雪球' }));

      // 纵向猫道跳台与景观大窗系统 (猫咪最爱的立体高空领地)
      this.furniture.push(new WindowSill(this.width * 0.16, this.height * 0.28));
      this.furniture.push(new WallPerch(this.width * 0.38, this.height * 0.42));
      this.furniture.push(new WallPerch(this.width * 0.82, this.height * 0.36));

      // 丰富地面家具
      this.furniture.push(new CatTree(this.width * 0.88, floorY));
      this.furniture.push(new Roomba(this.width * 0.25, floorY - 20));
      this.furniture.push(new Scratcher(this.width * 0.68, floorY));

      this.toys.push(new YarnBall(this.width * 0.45, floorY - 60));
      this.toys.push(new CardboardBox(this.width * 0.55, floorY - 30));
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
        'pet': '👆 抚摸模式：在猫咪身上滑动抚摸增加好感，或按住抓起它！点击可查看身份证。',
        'cat': '🐱 召唤猫咪：点击画布召唤一只全新的随机品种猫咪！',
        'laser': '🔴 激光红点：在屏幕上移动，猫咪们会集体兴奋飞扑！',
        'feather': '🪶 逗猫棒：挥动羽毛吸引小猫咪捕猎跳跃！',
        'fish': '🐟 投喂小鱼干：美味小零食，猫咪会闻香飞奔吃掉！',
        'yarn': '🧶 扔毛线球：带有真实弹力的毛线球，猫咪爱不释手！',
        'box': '📦 放置纸箱：“只要钻得下我就坐”，猫咪们的最爱！',
        'cattree': '🌳 放置猫爬架：猫咪可以跳上多层平台登高望远！',
        'roomba': '🤖 智能扫地机：地面巡逻，猫咪可以跳上去坐着兜风！',
        'scratcher': '🪵 放置猫抓板：让猫咪磨爪子，保护家具！',
        'catnip': '🌿 猫薄荷喷雾：让附近的猫咪陷入无尽狂欢与极速跑酷！'
      };
      uiManager.showToast(hints[tool] || '');
    }

    bindInputs() {
      const getPos = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        return {
          x: (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left,
          y: (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top
        };
      };

      const onPointerDown = (e) => {
        soundEngine.init();
        const pos = getPos(e);
        this.mouse.x = pos.x;
        this.mouse.y = pos.y;
        this.mouse.isDown = true;
        this.lastMousePos = { x: pos.x, y: pos.y };

        // 检查是否点击了猫咪
        let clickedCat = null;
        for (let i = this.cats.length - 1; i >= 0; i--) {
          const c = this.cats[i];
          if (Math.hypot(c.x - pos.x, c.y - pos.y) < c.radius + 12) {
            clickedCat = c;
            break;
          }
        }

        if (this.currentTool === 'pet') {
          if (clickedCat) {
            this.mouse.draggedCat = clickedCat;
            clickedCat.isGrabbed = true;
            clickedCat.pet(this);
            // 延迟判定是单纯点击打开身份证还是拖拽
            this.mouse.clickStartTime = Date.now();
          }
          return;
        }

        // 道具生成
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
        const pos = getPos(e);
        this.mouse.x = pos.x;
        this.mouse.y = pos.y;
        this.laser.x = pos.x;
        this.laser.y = pos.y;

        featherWand.update(pos.x, pos.y);

        // 拖拽猫咪
        if (this.mouse.draggedCat) {
          this.mouse.draggedCat.x = pos.x;
          this.mouse.draggedCat.y = pos.y;
          this.mouse.draggedCat.vx = (pos.x - this.lastMousePos.x) * 0.8;
          this.mouse.draggedCat.vy = (pos.y - this.lastMousePos.y) * 0.8;
        }

        // 智能光标与触碰感知 (猫咪看到手靠近会准备被摸或抓起)
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

        // 抚摸手势检测
        if (this.currentTool === 'pet' && this.mouse.isDown) {
          const delta = Math.hypot(pos.x - this.lastMousePos.x, pos.y - this.lastMousePos.y);
          this.petDistanceTracker += delta;
          if (this.petDistanceTracker > 30) {
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

      const onPointerUp = () => {
        if (this.mouse.draggedCat) {
          const duration = Date.now() - (this.mouse.clickStartTime || 0);
          const c = this.mouse.draggedCat;
          c.isGrabbed = false;
          c.state = 'idle';

          // 如果只是单纯点击未拖动，直接把猫咪抱入怀中特写侍奉！
          if (duration < 280 && Math.hypot(c.vx, c.vy) < 2.5) {
            uiManager.openCloseUpStudio(c);
          }
          this.mouse.draggedCat = null;
        }
        this.mouse.isDown = false;
        soundEngine.stopPurr();
      };

      this.canvas.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);

      // 键盘快捷键支持
      window.addEventListener('keydown', (e) => {
        // 如果正在修改名字，不拦截
        if (e.target.tagName === 'INPUT') return;

        const key = e.key.toLowerCase();
        const toolMap = {
          '1': 'pet',
          '2': 'cat',
          '3': 'laser',
          '4': 'feather',
          '5': 'fish',
          '6': 'yarn',
          '7': 'box',
          '8': 'cattree',
          '9': 'roomba',
          '0': 'catnip'
        };

        if (toolMap[key]) {
          this.setTool(toolMap[key]);
        } else if (e.code === 'Space') {
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
          const on = soundEngine.toggleBGM();
          bgmBtn.classList.toggle('special-on', on);
          bgmBtn.innerText = on ? '🎵 音乐: 舒缓中' : '🎵 音乐: 关';
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
          this.furniture = this.furniture.filter(f => f.type === 'cattree'); // 保留猫爬架
          for (let c of this.cats) {
            c.inBox = null;
            c.ridingObj = null;
          }
          soundEngine.playPop();
          this.updateHud();
          uiManager.showToast('🧹 已清理散落的玩具与箱子！');
        };
      }

      // 底部工具栏点击绑定
      document.querySelectorAll('#dock-container .dock-item').forEach(btn => {
        btn.onclick = () => {
          const tool = btn.dataset.tool;
          if (tool) this.setTool(tool);
        };
      });

      // 底部工具抽屉一键折叠/展开
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
          const cat = new Cat(this.width * 0.25 + idx * 120, floorY - 35, {
            name: item.name,
            breed,
            personality,
            hat: item.hat
          });
          if (item.hunger) cat.hunger = item.hunger;
          if (item.affection) cat.affection = item.affection;
          return cat;
        });

        // 配套家具与立体高空领地
        this.furniture.push(new WindowSill(this.width * 0.16, this.height * 0.28));
        this.furniture.push(new WallPerch(this.width * 0.38, this.height * 0.42));
        this.furniture.push(new WallPerch(this.width * 0.82, this.height * 0.36));
        this.furniture.push(new CatTree(this.width * 0.88, floorY));
        this.furniture.push(new Roomba(this.width * 0.25, floorY - 20));
        this.furniture.push(new Scratcher(this.width * 0.68, floorY));
        this.toys.push(new YarnBall(this.width * 0.45, floorY - 60));

        return true;
      } catch (e) {
        return false;
      }
    }

    // --- 主帧渲染循环 ---
    loop() {
      const { ctx, width, height } = this;

      // 1. 背景与天气系统
      environment.update(width, height);
      environment.drawBackground(ctx, width, height);

      // 2. 阳光光束
      if (this.sunbeam && environment.theme !== 'cyber_neon') {
        this.sunbeam.update(width, height);
        this.sunbeam.draw(ctx, height);
      }

      // 3. 家具更新与绘制
      for (let f of this.furniture) {
        f.update(width, height);
        f.draw(ctx);
      }

      // 4. 玩具更新与绘制
      for (let i = this.toys.length - 1; i >= 0; i--) {
        const t = this.toys[i];
        t.update(width, height);
        t.draw(ctx);
      }

      // 5. 猫咪更新与绘制 (分层渲染确保交互自然)
      for (let c of this.cats) {
        c.update(width, height, this);
        c.draw(ctx);
      }

      // 6. 逗猫棒
      featherWand.draw(ctx);

      // 7. 激光红点
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

      // 8. 漂浮粒子与爱心
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

      // 9. 红点挑战模式更新与绘制
      uiManager.updateChallenge(this.cats, this);
      uiManager.drawChallengeTarget(ctx);

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
