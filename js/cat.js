/**
 * CyberMeow - 真正的猫咪智能体 (Living Cat Agent)
 * 深度实现：
 * 1. 真实生理驱动引擎：饥饿衰减、精力耗散、无聊累积、深夜 Zoomies 跑酷爆发、激光捕食挫败感；
 * 2. 6 大性格真实决策倾向矩阵 (Glutton/Zoomer/Chill/Clingy/Curious)；
 * 3. 猫体形态动力学：母鸡蹲 (Loafing)、液态长条猫拉伸 (Long Cat)、翻肚皮求抚摸、猫薄荷兔子蹬 (Bunny Kicks)；
 * 4. 经典猫生本能：高台贱爪推物 (Knocking things off)、窗台飞鸟嗑牙声 (Chattering)、踩毛线缠爪甩腿；
 * 5. 多猫深度社交网：碰鼻礼 (Nose bump)、互相舔毛反目互扇喵喵拳 (Allogrooming to Cat Slap)、地盘争夺哈气 (Hissing)、叠猫饼。
 */
(function(window) {
  'use strict';

  const { MathUtils, VerletChain, physicsWorld, soundEngine } = window.CyberMeow;

  const CAT_NAMES = [
    '芝麻', '年糕', '大橘', '皮皮', '布丁', '奥利奥', '咪咪', '豆包', '雪球', '琥珀', '抹茶', '炭炭', '奶茶', '花卷'
  ];

  const BREEDS = [
    {
      id: 'orange',
      name: '橘猫',
      bodyColor: '#f39c12',
      earColor: '#e74c3c',
      eyeColor: '#27ae60',
      bellyColor: '#f1c40f',
      hasStripes: true,
      stripeColor: '#d35400',
      chunky: true
    },
    {
      id: 'tuxedo',
      name: '奶牛猫',
      bodyColor: '#2c3e50',
      earColor: '#ff7675',
      eyeColor: '#2ecc71',
      bellyColor: '#ffffff',
      hasMask: true
    },
    {
      id: 'blue',
      name: '英短蓝猫',
      bodyColor: '#7f8c8d',
      earColor: '#95a5a6',
      eyeColor: '#f39c12',
      bellyColor: '#bdc3c7',
      chunky: true
    },
    {
      id: 'white',
      name: '纯白异瞳',
      bodyColor: '#ffffff',
      earColor: '#ffb8b8',
      eyeColor: '#3498db',
      eyeRightColor: '#f1c40f',
      bellyColor: '#ffffff'
    },
    {
      id: 'calico',
      name: '三花猫',
      bodyColor: '#e67e22',
      earColor: '#c0392b',
      eyeColor: '#1abc9c',
      bellyColor: '#ffffff',
      hasPatches: true
    },
    {
      id: 'siamese',
      name: '暹罗猫',
      bodyColor: '#ecf0f1',
      earColor: '#34495e',
      eyeColor: '#2980b9',
      bellyColor: '#bdc3c7',
      isPointColor: true
    }
  ];

  const PERSONALITIES = [
    { id: 'GLUTTON', name: '贪吃鬼 🍗', desc: '满脑子都是小鱼干，闻到香味就会飞奔，吃饱后喜欢舔毛。' },
    { id: 'ZOOMER', name: '跑酷狂人 ⚡', desc: '精力充沛，热衷登高与夜半暴冲，追逐红点速度加倍！' },
    { id: 'CHILL', name: '佛系咸鱼 💤', desc: '随遇而安，最喜欢在阳光下母鸡蹲或在箱子里长睡不醒。' },
    { id: 'CLINGY', name: '超级粘人 🥰', desc: '喜欢寸步不离跟随人手，被摸时发出满分共鸣呼噜。' },
    { id: 'CURIOUS', name: '好奇宝宝 🔍', desc: '热衷高空推物、观鸟嗑牙与研究扫地机，是天生的物理学家！' }
  ];

  const HATS = ['none', 'bell', 'bow', 'wizard', 'party'];

  // 10 大真实猫生战术大计 (Feline Strategic Agendas)
  const AGENDAS = {
    NONE: 'NONE',                       // 自由日常
    THRONEC_QUEST: 'THRONEC_QUEST',     // 登高霸权：夺取豪宅最高王座与蔑视俯瞰
    TREE_CLIMB: 'TREE_CLIMB',           // 阶梯攀爬：猫爬架抱柱磨爪、阶梯飞跃与狂拍吊球
    AERIAL_PATROL: 'AERIAL_PATROL',     // 飞天巡视：穿梭空中天桥、高空俯瞰与吊床荡秋千
    STEALTH_HUNT: 'STEALTH_HUNT',       // 隐秘刺客：一二三木头人战术潜行突袭
    FEEDER_CAMP: 'FEEDER_CAMP',         // 守仓黑客：蹲守自动投喂机与猫爪拍机敲碗
    MISCHIEF_DEMO: 'MISCHIEF_DEMO',     // 搞事拆迁：跳台边缘试探轻推与暴击推物打碎
    BELLY_TRAP: 'BELLY_TRAP',           // 心机碰瓷：光标前翻肚皮假意求摸过载反咬
    SUNBEAM_PILGRIM: 'SUNBEAM_PILGRIM', // 逐日朝圣：巡游大平层追随阳光光斑
    PARKOUR_CIRCUIT: 'PARKOUR_CIRCUIT'  // 战术跑酷：三维跳台高速连跳与侧滑急停
  };

  class Cat {
    constructor(x, y, customConfig = {}) {
      this.id = 'cat_' + Math.random().toString(36).substring(2, 9);
      this.name = customConfig.name || CAT_NAMES[Math.floor(Math.random() * CAT_NAMES.length)];
      this.breed = customConfig.breed || BREEDS[Math.floor(Math.random() * BREEDS.length)];
      this.personality = customConfig.personality || PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
      this.hat = customConfig.hat || HATS[Math.floor(Math.random() * HATS.length)];

      // 基础空间与运动学
      this.x = x;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 2;
      this.vy = 0;
      this.radius = this.breed.chunky ? 26 : 22;
      this.facing = this.vx >= 0 ? 1 : -1;

      // Verlet 物理尾巴 (5节段)
      this.tailChain = new VerletChain(this.x, this.y, 5, 7);

      // --- 生理驱动引擎 (Drive Engine) ---
      this.hunger = 75; // 0-100, 持续衰减
      this.energy = 85; // 0-100, 活动消耗, 睡眠恢复
      this.boredom = 10; // 0-100, 积攒到 80+ 触发 Zoomies 狂奔
      this.affection = 60; // 0-100, 亲密度
      this.purrLevel = 0; // 0-1.0
      this.laserFrustration = 0; // 追激光抓不到的挫败感
      this.overstimulation = 0; // 抚摸过载度

      // --- 猫生战术策略脑 (Tactical Agenda Brain) ---
      this.currentAgenda = AGENDAS.NONE;
      this.agendaTarget = null;
      this.agendaPhase = 0;
      this.agendaTimer = 0;
      this.intentIcon = null;
      this.intentLabel = '';
      this.bellyTrapPatience = 100;
      this.rival = null;

      // --- 姿态与行为状态机 ---
      // 状态: 'idle', 'walking', 'stalking', 'pouncing', 'sleeping', 'loaf', 'scratching',
      //      'in_box', 'riding', 'grabbed', 'zoomies', 'swatting', 'chattering',
      //      'catnip_high', 'tangled', 'social_bump', 'social_groom', 'slapping',
      //      'stealth_stalk', 'stealth_freeze', 'feeder_camp', 'feeder_hack',
      //      'throne_challenge', 'judging_overlook', 'belly_trap', 'wet_shake', 'puddle_jump'
      this.state = 'idle';
      this.stateTimer = 60 + Math.random() * 100;
      this.buttWiggle = 0;
      this.loafBreathe = 0;
      this.bunnyKickPhase = 0;
      this.swatProgress = 0;
      this.chatterPhase = 0;

      // 动画辅助
      this.blinkTimer = 100 + Math.random() * 150;
      this.isBlinking = false;
      this.pupilDilation = 0.5;
      this.earTwitchLeft = 0;
      this.earTwitchRight = 0;
      this.walkCycle = 0;
      this.kneadCycle = 0;
      this.headTilt = 0;
      this.grabStretch = 1.0;

      // 交互与环境引用
      this.target = null;
      this.inBox = null;
      this.ridingObj = null;
      this.perchedTier = null;
      this.isGrabbed = false;
      this.catnipEnergy = 0;
      this.bubbleText = null;
      this.bubbleTimer = 0;
      this.socialPartner = null;
      this.socialCooldown = 0;

      this.pitchMod = 0.85 + Math.random() * 0.35;
    }

    // 核心生命帧循环
    update(width, height, sceneContext) {
      const gravity = physicsWorld.getGravity();

      // 1. 生理驱动自然代谢消耗 (无压力健康食欲模型)
      this.hunger = Math.max(0, this.hunger - 0.0018);
      if (this.state === 'sleeping' || this.state === 'loaf') {
        this.energy = Math.min(100, this.energy + 0.035);
        this.boredom = Math.max(0, this.boredom - 0.02);
      } else if (this.state === 'zoomies') {
        this.energy = Math.max(0, this.energy - 0.08);
      } else {
        this.energy = Math.max(0, this.energy - 0.008);
        this.boredom = Math.min(100, this.boredom + (this.personality.id === 'ZOOMER' ? 0.04 : 0.015));
      }

      if (this.socialCooldown > 0) this.socialCooldown--;
      if (this.yarnCooldown > 0) this.yarnCooldown--;
      if (this.overstimulation > 0) this.overstimulation -= 0.05;
      if (this.bubbleTimer > 0) this.bubbleTimer--;

      // 战术大计计时器衰减与超时恢复
      if (this.agendaTimer > 0) {
        this.agendaTimer--;
        if (this.agendaTimer <= 0 && this.currentAgenda !== AGENDAS.NONE) {
          this.currentAgenda = AGENDAS.NONE;
          this.intentIcon = null;
          this.state = 'idle';
          this.stateTimer = 50;
        }
      }

      // 呼噜声平滑衰减
      if (this.purrLevel > 0) {
        this.purrLevel -= 0.005;
        if (this.purrLevel <= 0) soundEngine.stopPurr();
      }

      // 2. 长条液体猫抓取状态 (Scruff Grab - 解除一切依附并确保随时可松开)
      if (this.isGrabbed) {
        this.state = 'grabbed';
        if (this.ridingObj) {
          if (this.ridingObj.rider === this) this.ridingObj.rider = null;
          this.ridingObj = null;
        }
        if (this.inBox) {
          if (this.inBox.occupant === this) this.inBox.occupant = null;
          this.inBox = null;
        }
        this.perchedTier = null;
        this.grabStretch = MathUtils.lerp(this.grabStretch, 1.55, 0.12);
        this.tailChain.update(this.x, this.y + this.radius * 1.4, 0.35, 0.85);
        return;
      } else {
        this.grabStretch = MathUtils.lerp(this.grabStretch, 1.0, 0.18);
        if (this.state === 'grabbed') {
          this.state = 'idle';
        }
      }

      // 3. 靠近人手时的蹭脸与踩奶
      if (sceneContext && sceneContext.mouse && !this.inBox && !this.ridingObj) {
        const mouseDist = Math.hypot(sceneContext.mouse.x - this.x, sceneContext.mouse.y - this.y);
        const clingThreshold = this.personality.id === 'CLINGY' ? 120 : 65;
        if (mouseDist < clingThreshold) {
          this.headTilt = MathUtils.clamp((sceneContext.mouse.x - this.x) * 0.006, -0.28, 0.28);
          this.kneadCycle += 0.22;
          if (this.personality.id === 'CLINGY' && Math.random() < 0.03 && this.purrLevel < 0.3) {
            this.purrLevel = 0.6;
            soundEngine.startPurr();
          }
        } else {
          this.headTilt *= 0.85;
        }
      }

      // 4. 猫薄荷癫狂状态
      if (this.catnipEnergy > 0) {
        this.catnipEnergy--;
        this.state = 'catnip_high';
        this.bunnyKickPhase += 0.45;
        this.vx += (Math.random() - 0.5) * 4;
        this.vy += (Math.random() - 0.5) * 4;
        if (Math.random() < 0.2) {
          sceneContext.spawnParticle(this.x + (Math.random() - 0.5) * 30, this.y - 20, '✨🌿');
        }
      }

      // 5. 状态机推进与决策
      this.runStateMachine(width, height, sceneContext);

      // 6. 物理学与边界应用
      if (this.state !== 'in_box' && this.state !== 'riding') {
        const floor = physicsWorld.getFloorY(height) - this.radius;

        if (this.state === 'climbing') {
          // 🐾 真实物理爬树：利爪紧抓剑麻立柱，克服重力匀速向上飞爬！
          this.vx = 0;
          this.vy = -3.2; // 敏捷匀速纵向爬升
          this.y += this.vy;
          this.climbCycle = (this.climbCycle || 0) + 0.38;
          if (Math.random() < 0.25 && sceneContext && sceneContext.spawnParticle) {
            sceneContext.spawnParticle(this.x + this.facing * 8, this.y - 10, '🪵✨');
          }
          if (Math.random() < 0.1 && soundEngine && soundEngine.playScratch) {
            soundEngine.playScratch();
          }
        } else {
          this.vy += gravity;
          const drag = physicsWorld.isZeroG() ? 0.985 : (this.state === 'zoomies' ? 0.97 : 0.92);
          this.vx *= drag;
          this.vy *= physicsWorld.isZeroG() ? 0.985 : 0.99;

          const maxSpeed = this.state === 'zoomies' ? 10.5 : (this.state === 'pouncing' || this.state === 'jumping' ? 9.5 : 4.5);
          this.vx = MathUtils.clamp(this.vx, -maxSpeed, maxSpeed);
          // 纵向速度限制：绝不将纵向起跳速度扼杀在地面走速内，赋予猫咪高达 16px/frame 的自然纵跳腾空高度！
          this.vy = MathUtils.clamp(this.vy, -16.0, 16.0);

          this.x += this.vx;
          this.y += this.vy;

          // 检查墙壁跳台、猫爬架各层高台、空中悬索桥、高空吊床与墙壁爬梯 (立体猫道超级网络)
          let landedOnPerch = false;
          if (this.vy >= -0.5 && sceneContext && sceneContext.furniture) {
            for (let f of sceneContext.furniture) {
              // 获取所有可立足跳台平面
              const surfaces = f.getPerchSurfaces ? f.getPerchSurfaces() : (
                f.type === 'perch' ? [{ id: f, x: f.x, y: f.y, w: f.w, type: 'perch' }] :
                (f.type === 'cattree' && f.tiers ? f.tiers.map(t => ({ id: t, x: f.x + t.xOffset, y: f.y + t.yOffset, w: t.w, type: 'cattree', tier: t, tree: f })) : [])
              );

              for (let s of surfaces) {
                const halfW = (s.w || 60) / 2;
                const catFeetY = this.y + this.radius;
                // 水平处于跳台落脚点范围内，且纵向脚爪处于吸附着陆容差窗口内
                if (Math.abs(this.x - s.x) <= halfW + 6) {
                  if (catFeetY >= s.y - 14 && catFeetY <= s.y + Math.max(16, this.vy + 6)) {
                    this.y = s.y - this.radius;
                    this.vy = 0;
                    this.vx *= 0.82;
                    this.perchedTier = s.id;
                    landedOnPerch = true;
                    if (this.state === 'jumping') {
                      this.state = 'idle';
                      if (soundEngine && soundEngine.playWoodThud && Math.random() < 0.4) soundEngine.playWoodThud();
                    }
                    break;
                  }
                }
              }
              if (landedOnPerch) break;
            }
          }

          if (!landedOnPerch) {
            this.perchedTier = null;
          }

          // 落地与边界反弹
          if (this.y > floor) {
            this.y = floor;
            this.vy = -this.vy * 0.35;
            if (Math.abs(this.vy) < 0.2) this.vy = 0;
            if (this.state === 'pouncing' || this.state === 'jumping') this.state = 'idle';
          }
        }

        // 地面水洼避水与湿爪甩水检测 (Puddle Avoidance & Wet Trajectory)
        if (sceneContext && sceneContext.toys && this.y >= floor - 6 && !this.isGrabbed) {
          for (let t of sceneContext.toys) {
            if (t.type === 'puddle' && t.contains) {
              if (t.contains(this.x, this.y + this.radius) && this.state !== 'wet_shake' && this.state !== 'puddle_jump') {
                this.state = 'wet_shake';
                this.stateTimer = 85;
                this.vx = 0;
                this.currentAgenda = AGENDAS.NONE;
                this.intentIcon = '💦';
                this.intentLabel = '嫌弃甩爪';
                if (soundEngine && soundEngine.playWaterSplash) soundEngine.playWaterSplash();
                this.speak('噫！踩到水了！恶心甩爪！💦😾');
                if (sceneContext.spawnParticle) {
                  for (let pi = 0; pi < 3; pi++) {
                    sceneContext.spawnParticle(this.x + (Math.random() - 0.5) * 16, this.y - 10, '💧');
                  }
                }
                break;
              }
              if ((this.state === 'walking' || this.state === 'stealth_stalk') && t.contains(this.x + this.facing * 35, this.y + this.radius)) {
                this.state = 'puddle_jump';
                this.stateTimer = 35;
                this.vy = -5.6;
                this.vx = this.facing * 4.2;
                this.speak('前方有水！起跳跨越！🐾✨');
                break;
              }
            }
          }
        }
        if (this.y < this.radius + 10) {
          this.y = this.radius + 10;
          this.vy = -this.vy * 0.5;
        }
        if (this.x > width - this.radius - 6) {
          this.x = width - this.radius - 6;
          this.vx = -this.vx * (this.state === 'zoomies' ? 1.0 : 0.6);
          this.facing = -1;
        }
        if (this.x < this.radius + 6) {
          this.x = this.radius + 6;
          this.vx = -this.vx * (this.state === 'zoomies' ? 1.0 : 0.6);
          this.facing = 1;
        }
      }

      // 7. Verlet 尾巴动力学 (融入心情反应)
      const tailRootX = this.x - this.facing * (this.radius * 0.7);
      const tailRootY = this.y + (this.state === 'sleeping' || this.state === 'loaf' ? 6 : 4);
      let tailGrav = 0.06;
      if (this.purrLevel > 0.4) tailGrav = -0.07; // 开心竖尾
      if (this.laserFrustration > 40 || this.overstimulation > 40) {
        // 烦躁甩尾巴
        tailGrav = Math.sin(Date.now() * 0.02) * 0.25;
      }
      this.tailChain.update(tailRootX, tailRootY, tailGrav, 0.92);

      // 8. 眨眼与步态周期
      this.blinkTimer--;
      if (this.blinkTimer <= 0) {
        this.isBlinking = true;
        if (this.blinkTimer < -10) {
          this.isBlinking = false;
          this.blinkTimer = 120 + Math.random() * 200;
        }
      }
      if (Math.abs(this.vx) > 0.3) {
        this.walkCycle += this.state === 'zoomies' ? 0.6 : 0.25;
      }
      if (this.state === 'loaf') {
        this.loafBreathe += 0.05;
      }
    }

    // 状态机与智能决策
    runStateMachine(width, height, sceneContext) {
      this.stateTimer--;

      // 优先级1：扫地机骑乘中
      if (this.ridingObj) {
        this.state = 'riding';
        return;
      }

      // 优先级2：纸箱中 (具备突袭伏击路过者的猫性！)
      if (this.inBox) {
        this.state = 'in_box';
        // 纸箱伏击 (Ambush): 伏击路过箱口的其他猫或扫地机
        if (sceneContext.cats) {
          for (let other of sceneContext.cats) {
            if (other !== this && Math.hypot(other.x - this.x, other.y - this.y) < 48) {
              if (Math.random() < 0.12 && other.state !== 'greebles') {
                soundEngine.playSlap();
                other.vy = -6.5; // 被伏击吓飞！
                other.vx = (other.x > this.x ? 1 : -1) * 5;
                this.speak('嗷呜！箱中伏击！📦💥');
                other.speak('喵嗷！吓死朕了！🙀');
                sceneContext.spawnParticle(this.x, this.y - 20, '🐾💥');
                break;
              }
            }
          }
        }
        return;
      }

      // 优先级2.5：抱毛线球疯狂兔子蹬 (Hug & Bunny Kick - 彻底解决在球上蹦跶)
      if (this.state === 'hug_kick') {
        this.bunnyKickPhase += 0.5;
        this.vx = 0;
        if (Math.random() < 0.25) soundEngine.playScratch();
        if (this.stateTimer <= 0) {
          if (this.heldYarn) {
            this.heldYarn.heldBy = null;
            this.heldYarn.vx = this.facing * (6.5 + Math.random() * 3);
            this.heldYarn.vy = -4.5 - Math.random() * 2;
            soundEngine.playBounce();
            this.heldYarn = null;
          }
          this.state = 'idle';
          this.stateTimer = 60;
          this.speak('呼…蹬爽了！舔个毛~ ✨');
        }
        return;
      }

      // 优先级2.6：踩中水洼狂暴甩水 (Wet Shake)
      if (this.state === 'wet_shake') {
        this.vx = 0;
        if (this.stateTimer <= 0) {
          this.state = 'idle';
          this.stateTimer = 45;
          this.intentIcon = null;
          this.speak('呼…爪子终于甩干了！✨');
        }
        return;
      }

      // 优先级2.7：跳过水洼 (Puddle Jump)
      if (this.state === 'puddle_jump') {
        if (this.stateTimer <= 0) {
          this.state = 'idle';
          this.stateTimer = 35;
        }
        return;
      }

      // 优先级2.8：高台王座争霸对决 (Throne Challenge Standoff)
      if (this.state === 'throne_challenge') {
        this.vx = 0;
        if (this.stateTimer <= 0) {
          this.resolveThroneChallenge(sceneContext);
        }
        return;
      }

      // 优先级2.9：高台蔑视俯瞰众生 (Judging Overlook)
      if (this.state === 'judging_overlook') {
        this.vx = 0;
        this.pupilDilation = 0.22;
        if (this.stateTimer <= 0) {
          this.currentAgenda = AGENDAS.NONE;
          this.intentIcon = null;
          this.state = 'loaf';
          this.stateTimer = 180;
          this.speak('俯瞰完毕，高台母鸡蹲~ 🍞');
        }
        return;
      }

      // 优先级2.95：心机碰瓷肚皮陷阱 (Belly Trap)
      if (this.state === 'belly_trap') {
        this.vx = 0;
        this.purrLevel = Math.max(0.4, this.purrLevel);
        if (this.stateTimer <= 0) {
          this.currentAgenda = AGENDAS.NONE;
          this.intentIcon = null;
          this.state = 'idle';
          this.stateTimer = 60;
          this.speak('两脚兽居然不上钩？真不懂享受！😼');
        }
        return;
      }

      // 优先级3：猫薄荷癫狂翻滚
      if (this.catnipEnergy > 0) {
        return;
      }

      // 优先级4：多猫社交互动 (碰鼻礼 / 互相舔毛 / 互拍)
      if (this.socialTimer > 0) {
        this.socialTimer--;
        return;
      }
      if (this.socialCooldown === 0 && sceneContext.cats && sceneContext.cats.length > 1) {
        const metPartner = this.checkSocialInteraction(sceneContext);
        if (metPartner) return;
      }

      // 优先级5：高空推物本能 (Knocking things off edges - 猫咪最贱本能！)
      if (this.perchedTier && this.state !== 'swatting' && (this.personality.id === 'CURIOUS' || Math.random() < 0.15)) {
        const canSwat = this.checkHighPerchSwat(sceneContext);
        if (canSwat) return;
      }

      // 优先级6：景观大窗台观鸟嗑牙 (Chattering)
      if (sceneContext.furniture) {
        const windowElem = sceneContext.furniture.find(f => f.type === 'window');
        if (windowElem && windowElem.getBirdWorldPos) {
          const bird = windowElem.getBirdWorldPos();
          if (bird && bird.active) {
            const distToBird = Math.hypot(bird.x - this.x, bird.y - this.y);
            if (distToBird < 240) {
              this.state = 'chattering';
              this.facing = bird.x >= this.x ? 1 : -1;
              this.pupilDilation = 0.9;
              this.chatterPhase += 0.5;
              if (Math.random() < 0.08) {
                soundEngine.playChatter(this.pitchMod);
                if (Math.random() < 0.3) this.speak('咔咔咔…鸽子！');
              }
              return;
            }
          }
        }
      }

      // 优先级7：猫生战术大计策略引擎 (Tactical Agenda Strategy Engine)
      // 猫咪正在专注推进既定大计（如爬架/巡天/碰瓷/黑客/潜行），全神贯注，绝不被普通漫游目标打断！
      if (this.currentAgenda && this.currentAgenda !== AGENDAS.NONE) {
        // 仅允许直接的玩家强刺激（激光红点、逗猫棒）中途抢断注意力
        if (sceneContext.laser && sceneContext.laser.active && this.laserFrustration < 80) {
          this.handleTargetAction({ type: 'laser', x: sceneContext.laser.x, y: sceneContext.laser.y }, width, height, sceneContext);
          return;
        }
        if (sceneContext.featherWand && sceneContext.featherWand.active) {
          const tip = sceneContext.featherWand.getTip();
          this.handleTargetAction({ type: 'feather', x: tip.x, y: tip.y }, width, height, sceneContext);
          return;
        }
        this.runAgenda(width, height, sceneContext);
        return;
      }

      // 优先级8：无聊与高精力引发的深夜发疯 (Zoomies 跑酷狂奔)
      if (this.boredom > 75 && this.energy > 40 && this.state !== 'zoomies') {
        if (Math.random() < 0.05 || this.personality.id === 'ZOOMER') {
          this.state = 'zoomies';
          this.stateTimer = 180 + Math.random() * 120;
          this.facing = Math.random() < 0.5 ? 1 : -1;
          this.vx = this.facing * 9.5;
          this.vy = -6.5;
          soundEngine.playMeow(this.pitchMod * 1.3, 'chatter');
          this.speak('⚡ 3AM 发疯跑酷启动！');
          sceneContext.spawnParticle(this.x, this.y - 20, '⚡💥');
          return;
        }
      }

      // 优先级9：环境传感器目标寻路 (鱼干 / 纸箱 / 扫地机 / 毛线 / 猫爬架)
      const target = this.evaluateSensors(sceneContext);
      if (target) {
        this.handleTargetAction(target, width, height, sceneContext);
        return;
      }

      // 如果当前无大计，且日常倒计时结束，评估并启动全新的猫生大计！
      this.pupilDilation = 0.45;
      if (this.stateTimer <= 0) {
        const startedAgenda = this.evaluateNewAgenda(sceneContext);
        if (startedAgenda) {
          this.runAgenda(width, height, sceneContext);
          return;
        }

        // 若无适合的复杂大计，执行有性格倾向的惬意日常
        const rand = Math.random();
        if (rand < 0.45) {
          this.state = 'loaf';
          this.vx = 0;
          this.stateTimer = 160 + Math.random() * 150;
          this.speak(Math.random() < 0.5 ? '揣小爪爪，缩成面包~ 🍞' : '舒适母鸡蹲…');
        } else if (rand < 0.78) {
          this.state = 'walking';
          this.facing = Math.random() < 0.5 ? 1 : -1;
          const speedMod = this.personality.id === 'ZOOMER' ? 1.4 : (this.personality.id === 'CHILL' ? 0.7 : 1.0);
          this.vx = this.facing * (0.8 + Math.random() * 0.9) * speedMod;
          this.stateTimer = 50 + Math.random() * 60;
        } else {
          this.state = 'idle';
          soundEngine.playMeow(this.pitchMod, 'chirp');
          const quotes = ['铲屎的，快伺候本喵！', '喵呜~', '本喵是液体~', '粮仓满不满呀？', '晒太阳真棒~'];
          this.speak(quotes[Math.floor(Math.random() * quotes.length)]);
          this.stateTimer = 65;
        }
      }
    }

    // --- 猫生战术策略评估引擎 (Agenda Evaluator) ---
    evaluateNewAgenda(sceneContext) {
      if (!sceneContext) return false;
      const { cats, furniture, toys, sunbeam, mouse } = sceneContext;
      const pId = this.personality.id;

      // 1. 贪吃猫 / 饥饿猫 -> 守仓催粮与拍机黑客 (FEEDER_CAMP)
      if ((pId === 'GLUTTON' || this.hunger < 70) && furniture) {
        const feeder = furniture.find(f => f.type === 'feeder');
        if (feeder && Math.random() < 0.7) {
          this.currentAgenda = AGENDAS.FEEDER_CAMP;
          this.agendaTarget = feeder;
          this.agendaPhase = 0;
          this.agendaTimer = 450;
          this.intentIcon = '🥣';
          this.intentLabel = '敲碗催粮';
          this.speak('肚子咕噜噜…去投喂机蹲点！🥣');
          return true;
        }
      }

      // 2. 跑酷狂人 / 高精力猫 -> 战术立体跑酷巡航 (PARKOUR_CIRCUIT)
      if ((pId === 'ZOOMER' || this.energy > 80) && Math.random() < 0.65) {
        this.currentAgenda = AGENDAS.PARKOUR_CIRCUIT;
        this.agendaPhase = 0;
        this.agendaTimer = 380;
        this.intentIcon = '⚡';
        this.intentLabel = '战术跑酷';
        this.speak('能量过载！启动立体跑酷巡航！⚡💨');
        return true;
      }

      // 3. 好奇猫 -> 蓄意推物搞事拆迁 (MISCHIEF_DEMO)
      if (pId === 'CURIOUS' && toys) {
        const mug = toys.find(t => t.type === 'mug' && !t.isBroken);
        if (mug && Math.random() < 0.75) {
          this.currentAgenda = AGENDAS.MISCHIEF_DEMO;
          this.agendaTarget = mug;
          this.agendaPhase = 0;
          this.agendaTimer = 420;
          this.intentIcon = '😏';
          this.intentLabel = '蓄意推物';
          this.speak('发现边缘有杯子…去推下去！😏');
          return true;
        }
      }

      // 3.5 豪华猫爬架阶梯攀爬与玩球 (TREE_CLIMB) - 跑酷猫、好奇猫极高优先，全猫喜爱
      if (furniture && !this.perchedTier && Math.random() < 0.65) {
        const catTrees = furniture.filter(f => f.type === 'cattree');
        if (catTrees.length > 0) {
          const nearestTree = catTrees.sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y))[0];
          this.currentAgenda = AGENDAS.TREE_CLIMB;
          this.agendaTarget = nearestTree;
          this.agendaPhase = 0;
          this.agendaTimer = 480;
          this.intentIcon = '🌳';
          this.intentLabel = '征服猫爬架';
          this.speak('锁定豪华猫爬架！准备征服！🌳✨');
          return true;
        }
      }

      // 3.8 空中悬索天桥与吊床巡游 (AERIAL_PATROL) - 探索立体空间！
      if (furniture && !this.perchedTier && Math.random() < 0.5) {
        const aerials = furniture.filter(f => f.type === 'bridge' || f.type === 'ladder');
        if (aerials.length > 0) {
          const nearestAerial = aerials.sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y))[0];
          this.currentAgenda = AGENDAS.AERIAL_PATROL;
          this.agendaTarget = nearestAerial;
          this.agendaPhase = 0;
          this.agendaTimer = 520;
          this.intentIcon = '🌉';
          this.intentLabel = '飞天巡视';
          this.speak('出发！巡视空中猫道超级网络！🌉🐾');
          return true;
        }
      }

      // 4. 争夺最高王座 (THRONEC_QUEST) - 登顶俯瞰众生
      if (furniture && !this.perchedTier && Math.random() < (pId === 'ZOOMER' ? 0.6 : 0.35)) {
        const perches = furniture.filter(f => f.type === 'perch');
        if (perches.length > 0) {
          const highestPerch = perches.reduce((min, p) => p.y < min.y ? p : min, perches[0]);
          this.currentAgenda = AGENDAS.THRONEC_QUEST;
          this.agendaTarget = highestPerch;
          this.agendaPhase = 0;
          this.agendaTimer = 420;
          this.intentIcon = '👑';
          this.intentLabel = '争霸王座';
          this.speak('最高处的王座属于朕！出征！👑');
          return true;
        }
      }

      // 5. 粘人猫 -> 心机碰瓷与肚皮陷阱 (BELLY_TRAP)
      if (pId === 'CLINGY' && mouse && Math.random() < 0.65) {
        this.currentAgenda = AGENDAS.BELLY_TRAP;
        this.agendaTarget = mouse;
        this.agendaPhase = 0;
        this.agendaTimer = 350;
        this.intentIcon = '💖';
        this.intentLabel = '心机碰瓷';
        this.speak('两脚兽在动…去前面碰瓷翻肚皮！💖');
        return true;
      }

      // 6. 佛系咸鱼猫 -> 逐日朝圣 (SUNBEAM_PILGRIM)
      if ((pId === 'CHILL' || Math.random() < 0.35) && sunbeam) {
        this.currentAgenda = AGENDAS.SUNBEAM_PILGRIM;
        this.agendaTarget = sunbeam;
        this.agendaPhase = 0;
        this.agendaTimer = 500;
        this.intentIcon = '☀️';
        this.intentLabel = '逐日打盹';
        this.speak('寻觅温暖日光…日光浴启程！☀️');
        return true;
      }

      // 7. 隐秘刺客尾行 (STEALTH_HUNT) - 挑选一只其他猫或扫地机
      if (cats && cats.length > 1 && Math.random() < 0.4) {
        const otherCats = cats.filter(c => c !== this && !c.inBox && c.state !== 'sleeping');
        if (otherCats.length > 0) {
          const victim = otherCats[Math.floor(Math.random() * otherCats.length)];
          this.currentAgenda = AGENDAS.STEALTH_HUNT;
          this.agendaTarget = victim;
          this.agendaPhase = 0;
          this.agendaTimer = 400;
          this.intentIcon = '🎯';
          this.intentLabel = '战术潜行';
          this.speak('锁定目标…一二三木头人，启动！🎯');
          return true;
        }
      }

      return false;
    }

    // --- 战术策略大计具体分步执行 ---
    runAgenda(width, height, sceneContext) {
      if (this.currentAgenda === AGENDAS.FEEDER_CAMP) {
        const feeder = this.agendaTarget;
        if (!feeder) { this.currentAgenda = AGENDAS.NONE; this.intentIcon = null; return; }
        const dx = feeder.x - this.x;
        if (this.agendaPhase === 0) {
          // 走向投喂机
          this.state = 'walking';
          this.facing = dx >= 0 ? 1 : -1;
          this.vx = this.facing * 1.5;
          if (Math.abs(dx) < 30) {
            this.agendaPhase = 1;
            this.vx = 0;
            this.state = 'feeder_camp';
            this.stateTimer = 85;
            this.speak('端坐守候…粮仓里藏着小鱼干！🥣👀');
          }
        } else if (this.agendaPhase === 1) {
          this.state = 'feeder_camp';
          this.vx = 0;
          if (this.stateTimer <= 0) {
            this.agendaPhase = 2;
            this.state = 'feeder_hack';
            this.stateTimer = 65;
            this.speak('敲碗！快吐鱼干！🥣💥');
          }
        } else if (this.agendaPhase === 2) {
          this.state = 'feeder_hack';
          this.vx = 0;
          if (this.stateTimer % 20 === 0 && feeder.receiveTap) {
            const gotFood = feeder.receiveTap(this, sceneContext);
            if (gotFood) {
              this.speak('物理黑客成功！小鱼干出来啦！🐟✨');
              this.currentAgenda = AGENDAS.NONE;
              this.intentIcon = null;
              this.state = 'idle';
              this.stateTimer = 60;
              return;
            }
          }
          if (this.stateTimer <= 0) {
            this.speak('等会儿再来敲你！🥣😼');
            this.currentAgenda = AGENDAS.NONE;
            this.intentIcon = null;
            this.state = 'idle';
            this.stateTimer = 60;
          }
        }
      } else if (this.currentAgenda === AGENDAS.STEALTH_HUNT) {
        const victim = this.agendaTarget;
        if (!victim) { this.currentAgenda = AGENDAS.NONE; this.intentIcon = null; return; }
        const dx = victim.x - this.x;
        const dist = Math.hypot(dx, victim.y - this.y);

        if (this.agendaPhase === 0) {
          this.facing = dx >= 0 ? 1 : -1;
          // 一二三木头人视线检测：如果受害者是猫且正面对着刺客猫，刺客猫必须瞬间定格！
          const victimFacingThis = (victim.facing !== undefined && ((victim.facing === 1 && this.x < victim.x) || (victim.facing === -1 && this.x > victim.x)));
          if (victimFacingThis && dist < 220) {
            this.state = 'stealth_freeze';
            this.vx = 0;
            this.pupilDilation = 0.95;
            if (Math.random() < 0.04) this.speak('定住！它看我了！👀');
          } else {
            this.state = 'stealth_stalk';
            this.vx = this.facing * 0.48;
            this.pupilDilation = 0.85;
          }

          if (dist < 48) {
            this.agendaPhase = 1;
            this.state = 'stalking';
            this.stateTimer = 45;
            this.vx = 0;
            this.speak('锁定猎物！屁股蓄力摇摆…🎯');
          }
        } else if (this.agendaPhase === 1) {
          this.state = 'stalking';
          this.vx = 0;
          this.buttWiggle = Math.sin(Date.now() * 0.038) * 0.6;
          if (this.stateTimer <= 0) {
            // 爆发刺客伏击！
            this.state = 'pouncing';
            this.vy = -6.0;
            this.vx = this.facing * 8.2;
            soundEngine.playMeow(this.pitchMod * 1.3, 'chatter');
            if (victim.type !== 'roomba') {
              soundEngine.playSlap();
              victim.vy = -6.8;
              victim.vx = this.facing * 4.8;
              this.speak('刺客信条！背后突袭！😼💥');
              victim.speak('喵嗷！有刺客背后偷袭！🙀');
              if (sceneContext.spawnParticle) sceneContext.spawnParticle(victim.x, victim.y - 15, '🐾💥');
            } else {
              this.ridingObj = victim;
              victim.rider = this;
              this.state = 'riding';
              this.speak('潜行劫持扫地机战舰！🤖✨');
            }
            this.currentAgenda = AGENDAS.NONE;
            this.intentIcon = null;
          }
        }
      } else if (this.currentAgenda === AGENDAS.TREE_CLIMB) {
        const tree = this.agendaTarget;
        if (!tree) { this.currentAgenda = AGENDAS.NONE; this.intentIcon = null; return; }
        const dx = tree.x - this.x;
        const floor = physicsWorld.getFloorY(height) - this.radius;

        if (this.agendaPhase === 0) {
          // 阶段0：跑向猫爬架立柱下方
          this.state = 'walking';
          this.facing = dx >= 0 ? 1 : -1;
          this.vx = this.facing * 2.2;
          if (Math.abs(dx) < 25) {
            this.agendaPhase = 1;
            this.state = 'scratching';
            this.x = tree.x - this.facing * 12;
            this.vx = 0;
            this.vy = 0;
            this.stateTimer = 35;
            soundEngine.playScratch();
            this.speak('抱住立柱痛快磨个爪，准备爬树！🪵🐾');
            if (sceneContext.spawnParticle) sceneContext.spawnParticle(this.x, this.y - 20, '🪵✨');
          }
        } else if (this.agendaPhase === 1) {
          // 阶段1：磨爪完成，利爪抱紧麻绳立柱，展开真实物理抱柱向上飞爬！
          this.state = 'scratching';
          this.vx = 0;
          this.vy = 0;
          if (this.stateTimer <= 0) {
            this.agendaPhase = 2;
            this.state = 'climbing';
            this.x = tree.x - this.facing * 12;
            this.climbTargetY = tree.y + tree.tiers[0].yOffset;
            this.perchedTier = null;
            this.speak('嗖嗖嗖！本喵爪力十足，开始爬树！🐾🪵');
            soundEngine.playMeow(this.pitchMod * 1.15, 'chirp');
          }
        } else if (this.agendaPhase === 2) {
          // 阶段2：抱树攀爬中！当爪子爬升到达下层第1层跳台 (Tier 0) 边缘时，翻身登上跳台！
          this.state = 'climbing';
          this.x = tree.x - this.facing * 12;
          if (this.y <= this.climbTargetY + 6) {
            this.agendaPhase = 3;
            this.y = this.climbTargetY - this.radius;
            this.x = tree.x + tree.tiers[0].xOffset;
            this.perchedTier = tree.tiers[0];
            this.vy = 0;
            this.vx = 0;
            this.state = 'swatting';
            this.stateTimer = 70;
            this.facing = 1; // 面向红球
            tree.batDangleBall(1);
            this.speak('爬上下层跳台啦！疯狂狂拍红球！🐾💥');
            if (sceneContext.spawnParticle) sceneContext.spawnParticle(tree.dangleBall.x, tree.dangleBall.y, '🐾🎈');
          }
        } else if (this.agendaPhase === 3) {
          // 阶段3：在第1层跳台猛拍摇晃红球
          this.state = 'swatting';
          this.vx = 0;
          if (this.stateTimer % 18 === 0) {
            tree.batDangleBall(Math.random() < 0.5 ? 1 : -1);
          }
          if (this.stateTimer <= 0) {
            // 拍球尽兴！继续抱紧上截立柱，往顶层高台王座飞爬！
            this.agendaPhase = 4;
            this.state = 'climbing';
            this.x = tree.x - this.facing * 12;
            this.climbTargetY = tree.y + tree.tiers[1].yOffset;
            this.perchedTier = null;
            this.speak('继续往上爬！征服顶层王座！👑🪵');
            soundEngine.playMeow(this.pitchMod * 1.2, 'chirp');
          }
        } else if (this.agendaPhase === 4) {
          // 阶段4：抱紧上段立柱向上攀爬直至顶层王座 (Tier 1)
          this.state = 'climbing';
          this.x = tree.x - this.facing * 12;
          if (this.y <= this.climbTargetY + 6) {
            this.agendaPhase = 5;
            this.y = this.climbTargetY - this.radius;
            this.x = tree.x + tree.tiers[1].xOffset;
            this.perchedTier = tree.tiers[1];
            this.vy = 0;
            this.vx = 0;
            this.state = 'judging_overlook';
            this.stateTimer = 240;
            this.speak('成功登顶豪华猫爬架！俯瞰整座江山~ 👑🌳✨');
          }
        } else if (this.agendaPhase === 5) {
          this.state = 'judging_overlook';
          this.vx = 0;
          if (this.stateTimer <= 0) {
            this.currentAgenda = AGENDAS.NONE;
            this.intentIcon = null;
            this.state = 'loaf';
            this.stateTimer = 180;
          }
        }
      } else if (this.currentAgenda === AGENDAS.AERIAL_PATROL) {
        const route = this.agendaTarget;
        if (!route) { this.currentAgenda = AGENDAS.NONE; this.intentIcon = null; return; }
        const floor = physicsWorld.getFloorY(height) - this.radius;

        if (this.agendaPhase === 0) {
          // 阶段0：跑向空中天桥 / 爬梯引桥起点
          const targetX = route.type === 'bridge' ? (route.x - route.w / 2 + 25) : (route.type === 'ladder' ? route.steps[0].x : route.x);
          const dx = targetX - this.x;
          this.state = 'walking';
          this.facing = dx >= 0 ? 1 : -1;
          this.vx = this.facing * 1.8;
          if (Math.abs(dx) < 45) {
            this.agendaPhase = 1;
            // 纵身起跳跃上首段平台
            const targetY = route.type === 'bridge' ? route.y : (route.type === 'ladder' ? route.steps[0].y : route.y);
            const dy = Math.max(45, (this.y - targetY) + 24);
            this.vy = -Math.sqrt(2 * 0.28 * dy);
            const tApex = Math.abs(this.vy) / 0.28;
            const tFall = Math.sqrt(2 * 24 / 0.28);
            const totalFrames = Math.max(14, tApex + tFall);
            this.vx = dx / totalFrames;
            this.state = 'jumping';
            this.facing = this.vx >= 0 ? 1 : -1;
            this.perchedTier = null;
            this.stateTimer = Math.ceil(totalFrames) + 35;
            soundEngine.playMeow(this.pitchMod * 1.1, 'chirp');
            this.speak('发现空中超级天桥！起跳登桥！🌉✨');
          }
        } else if (this.agendaPhase === 1) {
          // 阶段1：着陆在桥端，开始在空中悬索桥上巡游
          if (this.perchedTier) {
            this.agendaPhase = 2;
            this.state = 'walking';
            this.facing = 1;
            this.stateTimer = 160;
          } else if (this.stateTimer <= 0 || (this.y >= floor - 5 && this.vy >= 0 && this.state !== 'jumping')) {
            this.currentAgenda = AGENDAS.NONE;
            this.intentIcon = null;
            this.state = 'idle';
          }
        } else if (this.agendaPhase === 2) {
          // 阶段2：优雅在悬索桥上踱步
          this.state = 'walking';
          this.vx = this.facing * 1.2;
          if (route.type === 'bridge' && Math.abs(this.x - route.x) < 25) {
            // 走到桥中央，驻足俯瞰！
            this.agendaPhase = 3;
            this.state = 'judging_overlook';
            this.vx = 0;
            this.stateTimer = 100;
            this.speak('站在悬索桥正中央，两脚兽都在脚下喵~ 🐾👑');
            if (sceneContext.spawnParticle) sceneContext.spawnParticle(this.x, this.y - 20, '✨👑');
          } else if (this.stateTimer <= 0) {
            this.agendaPhase = 3;
            this.state = 'judging_overlook';
            this.stateTimer = 80;
          }
        } else if (this.agendaPhase === 3) {
          this.state = 'judging_overlook';
          this.vx = 0;
          if (this.stateTimer <= 0) {
            // 检查周边是否有高空吊床 (AerialHammock) 进行午休！
            let nearbyHammock = null;
            if (sceneContext.furniture) {
              nearbyHammock = sceneContext.furniture.find(f => f.type === 'hammock' && Math.abs(f.x - this.x) < 260);
            }
            if (nearbyHammock) {
              this.agendaPhase = 4;
              const dy = Math.max(35, (this.y - nearbyHammock.y) + 20);
              this.vy = -Math.sqrt(2 * 0.28 * dy);
              const tApex = Math.abs(this.vy) / 0.28;
              const tFall = Math.sqrt(2 * 20 / 0.28);
              const totalFrames = Math.max(14, tApex + tFall);
              this.vx = (nearbyHammock.x - this.x) / totalFrames;
              this.state = 'jumping';
              this.facing = this.vx >= 0 ? 1 : -1;
              this.perchedTier = null;
              this.stateTimer = Math.ceil(totalFrames) + 35;
              this.agendaTarget = nearbyHammock;
              soundEngine.playMeow(this.pitchMod * 1.15, 'pleading');
              this.speak('飞入空中吊床！舒舒服服睡大觉~ ☁️💤');
            } else {
              this.currentAgenda = AGENDAS.NONE;
              this.intentIcon = null;
              this.state = 'loaf';
              this.stateTimer = 180;
            }
          }
        } else if (this.agendaPhase === 4) {
          // 阶段4：在吊床中安然入眠
          if (this.perchedTier === this.agendaTarget || this.stateTimer <= 0) {
            this.agendaPhase = 5;
            this.state = 'loaf';
            this.stateTimer = 220;
            this.speak('吊床晃晃悠悠，太惬意了~ ☁️💖');
            if (this.agendaTarget && this.agendaTarget.nudge) this.agendaTarget.nudge(0.06);
          }
        } else if (this.agendaPhase === 5) {
          this.state = 'loaf';
          this.vx = 0;
          if (Math.random() < 0.05 && sceneContext.spawnParticle) {
            sceneContext.spawnParticle(this.x + (Math.random() - 0.5) * 20, this.y - 25, '☁️✨');
          }
          if (this.stateTimer <= 0) {
            this.currentAgenda = AGENDAS.NONE;
            this.intentIcon = null;
            this.state = 'idle';
          }
        }
      } else if (this.currentAgenda === AGENDAS.THRONEC_QUEST) {
        const throne = this.agendaTarget;
        if (!throne) { this.currentAgenda = AGENDAS.NONE; this.intentIcon = null; return; }
        const dx = throne.x - this.x;
        const floor = physicsWorld.getFloorY(height) - this.radius;

        if (this.agendaPhase === 0) {
          // 走近跳台下方
          this.state = 'walking';
          this.facing = dx >= 0 ? 1 : -1;
          this.vx = this.facing * 1.8;
          if (Math.abs(dx) < 65) {
            this.agendaPhase = 1;
            // 纵身起跳精准落在跳台
            const dy = Math.max(45, (this.y - throne.y) + 26);
            this.vy = -Math.sqrt(2 * 0.28 * dy);
            const tApex = Math.abs(this.vy) / 0.28;
            const tFall = Math.sqrt(2 * 26 / 0.28);
            const totalFrames = Math.max(14, tApex + tFall);
            this.vx = dx / totalFrames;
            this.state = 'jumping';
            this.facing = this.vx >= 0 ? 1 : -1;
            this.perchedTier = null;
            this.stateTimer = Math.ceil(totalFrames) + 40;
            soundEngine.playMeow(this.pitchMod * 1.15, 'chirp');
          }
        } else if (this.agendaPhase === 1) {
          // 等待落到跳台
          if (this.perchedTier === throne) {
            // 检查跳台上是否有别的猫占据！
            let rival = null;
            if (sceneContext.cats) {
              rival = sceneContext.cats.find(c => c !== this && c.perchedTier === throne);
            }
            if (rival) {
              // 触发王座对决！
              this.agendaPhase = 2;
              this.state = 'throne_challenge';
              rival.state = 'throne_challenge';
              this.stateTimer = 85;
              rival.stateTimer = 85;
              this.facing = rival.x >= this.x ? 1 : -1;
              rival.facing = -this.facing;
              this.rival = rival;
              if (soundEngine && soundEngine.playLowGrowl) soundEngine.playLowGrowl(this.pitchMod);
              this.speak('此乃朕之王座，凡猫速退！👑⚡');
              rival.speak('大胆叛逆！有本事来抢！😾');
              if (sceneContext.spawnParticle) sceneContext.spawnParticle((this.x + rival.x) / 2, this.y - 20, '⚡⚔️');
            } else {
              // 无人占据，登基！
              this.agendaPhase = 3;
              this.state = 'judging_overlook';
              this.stateTimer = 220;
              this.speak('俯瞰朕的江山！高处不胜寒~ 👑✨');
            }
          } else if (this.stateTimer <= 0 || (this.y >= floor - 5 && this.vy >= 0 && this.state !== 'jumping')) {
            this.currentAgenda = AGENDAS.NONE;
            this.intentIcon = null;
            this.state = 'idle';
          }
        } else if (this.agendaPhase === 2) {
          // 对决倒计时中
          this.state = 'throne_challenge';
          this.vx = 0;
          if (this.stateTimer <= 0) {
            this.resolveThroneChallenge(sceneContext);
            this.agendaPhase = 3;
            this.state = 'judging_overlook';
            this.stateTimer = 220;
          }
        } else if (this.agendaPhase === 3) {
          this.state = 'judging_overlook';
          this.vx = 0;
          if (this.stateTimer <= 0) {
            this.currentAgenda = AGENDAS.NONE;
            this.intentIcon = null;
            this.state = 'loaf';
            this.stateTimer = 160;
          }
        }
      } else if (this.currentAgenda === AGENDAS.MISCHIEF_DEMO) {
        const mug = this.agendaTarget;
        if (!mug || mug.isBroken) { this.currentAgenda = AGENDAS.NONE; this.intentIcon = null; return; }
        const dx = mug.x - this.x;
        const dy = this.y - mug.y;

        if (this.agendaPhase === 0) {
          if (this.y > mug.y + 25) {
            // 需要先跳上高台
            this.state = 'walking';
            this.facing = dx >= 0 ? 1 : -1;
            this.vx = this.facing * 1.4;
            if (Math.abs(dx) < 60) {
              this.vy = -Math.sqrt(2 * 0.28 * Math.max(50, dy + 25));
              this.vx = dx * 0.04;
            }
          } else {
            // 已在同高度，走近水杯
            this.state = 'walking';
            this.facing = dx >= 0 ? 1 : -1;
            this.vx = this.facing * 0.9;
            if (Math.abs(dx) < 45) {
              // 阶段1：试探轻推！
              this.agendaPhase = 1;
              this.state = 'swatting';
              this.vx = 0;
              this.stateTimer = 50;
              if (mug.nudge) mug.nudge(this.facing);
              this.speak('试探轻推一下…看铲屎官反应😏');
            }
          }
        } else if (this.agendaPhase === 1) {
          this.state = 'swatting';
          this.vx = 0;
          if (this.stateTimer <= 0) {
            // 阶段2：全力推落！
            if (mug.smash) mug.smash(this.facing);
            this.speak('啪！落体实验成功！万有引力万岁！😼💥');
            if (sceneContext.spawnParticle) sceneContext.spawnParticle(mug.x, mug.y, '🐾💨');
            this.currentAgenda = AGENDAS.NONE;
            this.intentIcon = null;
            this.state = 'idle';
            this.stateTimer = 60;
          }
        }
      } else if (this.currentAgenda === AGENDAS.BELLY_TRAP) {
        const mouse = sceneContext.mouse;
        if (!mouse) { this.currentAgenda = AGENDAS.NONE; this.intentIcon = null; return; }
        const dx = mouse.x - this.x;

        if (this.agendaPhase === 0) {
          this.state = 'walking';
          this.facing = dx >= 0 ? 1 : -1;
          this.vx = this.facing * 1.5;
          if (Math.hypot(dx, mouse.y - this.y) < 55) {
            this.agendaPhase = 1;
            this.state = 'belly_trap';
            this.vx = 0;
            this.stateTimer = 180;
            this.bellyTrapPatience = 80;
            this.purrLevel = 0.5;
            soundEngine.startPurr();
            this.speak('免费摸肚皮碰瓷中…不来摸一下吗？💖');
          }
        } else if (this.agendaPhase === 1) {
          this.state = 'belly_trap';
          this.vx = 0;
          if (this.stateTimer <= 0) {
            this.speak('居然没上钩？这届两脚兽真冷漠！😼');
            this.currentAgenda = AGENDAS.NONE;
            this.intentIcon = null;
            this.state = 'idle';
            this.stateTimer = 60;
          }
        }
      } else if (this.currentAgenda === AGENDAS.SUNBEAM_PILGRIM) {
        const sun = sceneContext.sunbeam;
        if (!sun) { this.currentAgenda = AGENDAS.NONE; this.intentIcon = null; return; }
        const dx = sun.x - this.x;
        if (this.agendaPhase === 0) {
          this.state = 'walking';
          this.facing = dx >= 0 ? 1 : -1;
          this.vx = this.facing * 1.2;
          if (Math.abs(dx) < sun.width * 0.35) {
            this.agendaPhase = 1;
            this.vx = 0;
            this.state = 'sleeping';
            this.stateTimer = 350;
            this.speak('追着阳光暖洋洋…骨头都酥了~ ☀️💤');
            if (sceneContext.spawnParticle) sceneContext.spawnParticle(this.x, this.y - 20, '☀️✨');
            this.currentAgenda = AGENDAS.NONE;
            this.intentIcon = null;
          }
        }
      } else if (this.currentAgenda === AGENDAS.PARKOUR_CIRCUIT) {
        if (this.agendaPhase === 0) {
          // 战术冲刺起跑
          this.state = 'zoomies';
          this.vx = this.facing * 10.5;
          this.vy = -6.5;
          this.agendaPhase = 1;
          this.stateTimer = 120;
          if (sceneContext.spawnParticle) sceneContext.spawnParticle(this.x, this.y - 20, '⚡💨');
        } else if (this.agendaPhase === 1) {
          this.state = 'zoomies';
          if (this.stateTimer <= 0) {
            // 战术侧滑急停
            this.vx = 0;
            this.state = 'idle';
            this.stateTimer = 70;
            this.speak('战术演习完毕，我很冷静。⚡✨');
            this.currentAgenda = AGENDAS.NONE;
            this.intentIcon = null;
          }
        }
      }
    }

    // 王座争夺决胜裁定
    resolveThroneChallenge(sceneContext) {
      if (!this.rival) return;
      soundEngine.playSlap();
      if (soundEngine.playHiss) soundEngine.playHiss();

      const winner = this;
      const loser = this.rival;

      loser.perchedTier = null;
      loser.vy = -4.5;
      loser.vx = (loser.x > winner.x ? 1 : -1) * 5;
      loser.state = 'idle';
      loser.speak('切！本喵才不稀罕这个破台子！🙀');

      winner.speak('王座易主！朕才是唯一的霸主！👑✨');
      if (sceneContext && sceneContext.spawnParticle) {
        sceneContext.spawnParticle((winner.x + loser.x) / 2, winner.y - 20, '💥👑');
      }
      this.rival = null;
    }

    // 传感器评估 (融入性格敏感度)
    evaluateSensors(sceneContext) {
      const { laser, featherWand, toys, furniture } = sceneContext;

      // 1. 激光红点 (跑酷狂人极度狂热；若挫败感过高则短暂无视)
      if (laser && laser.active && this.laserFrustration < 80) {
        return { type: 'laser', x: laser.x, y: laser.y };
      }

      // 2. 逗猫棒
      if (featherWand && featherWand.active) {
        const tip = featherWand.getTip();
        return { type: 'feather', x: tip.x, y: tip.y };
      }

      // 3. 小鱼干 (贪吃鬼嗅觉范围倍增，饿了也会狂奔)
      const fishDetectRange = (this.personality.id === 'GLUTTON' || this.hunger < 45) ? 750 : 380;
      for (let t of toys) {
        if (t.type === 'fish') {
          const d = Math.hypot(t.x - this.x, t.y - this.y);
          if (d < fishDetectRange) return { type: 'fish', obj: t, x: t.x, y: t.y };
        }
      }

      // 4. 空纸箱 (佛系猫与橘猫超爱)
      for (let f of furniture) {
        if (f.type === 'box' && !f.occupant) {
          const d = Math.hypot(f.x - this.x, f.y - this.y);
          if (d < 320) return { type: 'box', obj: f, x: f.x, y: f.y };
        }
      }

      // 5. 扫地机器人 (好奇猫与跑酷猫优先)
      if (this.personality.id === 'CURIOUS' || this.personality.id === 'ZOOMER') {
        for (let f of furniture) {
          if (f.type === 'roomba' && !f.rider) {
            const d = Math.hypot(f.x - this.x, f.y - this.y);
            if (d < 220) return { type: 'roomba', obj: f, x: f.x, y: f.y };
          }
        }
      }

      // 6. 毛线球 (检测追逐)
      for (let t of toys) {
        if (t.type === 'yarn') {
          const d = Math.hypot(t.x - this.x, t.y - this.y);
          if (d < 260) return { type: 'yarn', obj: t, x: t.x, y: t.y };
        }
      }

      // 7. 猫抓板
      for (let f of furniture) {
        if (f.type === 'scratcher') {
          const d = Math.hypot(f.x - this.x, f.y - this.y);
          if (d < 160 && Math.random() < 0.3) return { type: 'scratcher', obj: f, x: f.x, y: f.y };
        }
      }

      // 8. 豪华猫爬架 (支持自主攀爬与击打吊球)
      if (!this.perchedTier && (!this.currentAgenda || this.currentAgenda === AGENDAS.NONE)) {
        for (let f of furniture) {
          if (f.type === 'cattree') {
            const d = Math.hypot(f.x - this.x, f.y - this.y);
            if (d < 380 && Math.random() < 0.45) return { type: 'cattree', obj: f, x: f.x, y: f.y };
          }
        }
      }

      return null;
    }

    // 目标响应执行
    handleTargetAction(target, width, height, sceneContext) {
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.hypot(dx, dy);

      this.facing = dx >= 0 ? 1 : -1;
      this.pupilDilation = 0.88;

      if (target.type === 'laser') {
        this.laserFrustration += 0.22; // 追逐红点积累挫败
        if (this.laserFrustration >= 80) {
          this.speak('红点抓不住…好气！😾');
          soundEngine.playHiss();
          this.state = 'idle';
          this.stateTimer = 100;
          return;
        }

        if (dist > 130) {
          this.state = 'stalking';
          this.vx += (dx / dist) * 0.45;
        } else if (dist > 35) {
          this.state = 'stalking';
          this.buttWiggle = Math.sin(Date.now() * 0.035) * 0.45;
          if (Math.random() < 0.08) {
            this.state = 'pouncing';
            this.vy = -6.5 - Math.random() * 2.5;
            this.vx = (dx / dist) * 8.0;
            soundEngine.playMeow(this.pitchMod, 'chatter');
          }
        } else {
          // 扑在红点位置
          sceneContext.spawnParticle(this.x, this.y - 15, '🐾');
        }
      } else if (target.type === 'yarn') {
        if (this.yarnCooldown > 0) return; // 冷却中，绝不重复扑球踩球！

        if (dist > 120) {
          this.state = 'stalking';
          this.vx += (dx / dist) * 0.4;
        } else if (dist > 35) {
          this.state = 'stalking';
          this.buttWiggle = Math.sin(Date.now() * 0.03) * 0.4;
          if (Math.random() < 0.07) {
            this.state = 'pouncing';
            this.vy = -5.8;
            this.vx = (dx / dist) * 7.2;
          }
        } else {
          // 扑到了毛线！进入抱球疯狂兔子蹬 (Hug & Bunny Kick)，绝不再在球上弹跳！
          this.laserFrustration = 0;
          this.state = 'hug_kick';
          this.stateTimer = 55;
          this.heldYarn = target.obj;
          target.obj.heldBy = this;
          this.yarnCooldown = 180; // 冷却期 3 秒
          soundEngine.playScratch();
          soundEngine.playMeow(this.pitchMod * 1.2, 'chirp');
          this.speak('抱住狂蹬！看我兔子腿！🐾');
        }
      } else if (target.type === 'feather') {
        if (dist > 35) {
          this.state = 'stalking';
          this.vx += (dx / dist) * 0.45;
          if (dist < 100 && Math.random() < 0.06 && this.y >= height - this.radius - 20) {
            this.state = 'pouncing';
            this.vy = -7.5;
            this.vx = (dx / dist) * 6.5;
            soundEngine.playMeow(this.pitchMod, 'chatter');
          }
        } else {
          // 咬住逗猫棒羽毛！
          soundEngine.playPop();
          sceneContext.spawnParticle(this.x, this.y - 20, '🪶❤️');
          this.speak('咬住啦！不撒嘴！');
          this.laserFrustration = 0;
          this.state = 'idle';
          this.stateTimer = 40;
        }
      } else if (target.type === 'fish') {
        if (dist > 25) {
          this.state = 'walking';
          this.vx += (dx / dist) * 0.5;
        } else {
          // 吃鱼
          const idx = sceneContext.toys.indexOf(target.obj);
          if (idx !== -1) {
            sceneContext.toys.splice(idx, 1);
            soundEngine.playCrunch();
            this.hunger = Math.min(100, this.hunger + 35);
            this.laserFrustration = 0;
            sceneContext.spawnParticle(this.x, this.y - 25, '🐟❤️');
            this.speak(Math.random() < 0.5 ? '美味小鱼干！喵赞~' : '本喵非常满意！');
            this.state = 'idle';
            this.stateTimer = 50;
          }
        }
      } else if (target.type === 'box') {
        if (dist > 20) {
          this.state = 'walking';
          this.vx += (dx / dist) * 0.35;
        } else {
          // 钻箱子 (胖猫如橘猫、英短有几率卡屁股)
          this.inBox = target.obj;
          target.obj.occupant = this;
          this.state = 'in_box';
          soundEngine.playMeow(this.pitchMod, 'chirp');
          if (this.breed.chunky) {
            this.speak('屁股卡住啦…摇摆挤进去！📦');
            target.obj.triggerArmoredTank(this.facing);
          } else {
            this.speak('If it fits, I sits 📦');
          }
        }
      } else if (target.type === 'roomba') {
        if (dist < 35 && Math.abs(this.vy) < 2) {
          this.ridingObj = target.obj;
          target.obj.rider = this;
          this.state = 'riding';
          soundEngine.playMeow(this.pitchMod, 'pleading');
          this.speak('扫地机战舰，出征！🤖');
        } else {
          this.vx += (dx / dist) * 0.3;
        }
      } else if (target.type === 'scratcher') {
        if (dist < 30) {
          this.state = 'scratching';
          if (Math.random() < 0.28) soundEngine.playScratch();
          if (Math.random() < 0.08) sceneContext.spawnParticle(this.x, this.y - 20, '✨');
        } else {
          this.vx += (dx / dist) * 0.35;
        }
      } else if (target.type === 'cattree') {
        if (!this.currentAgenda || this.currentAgenda === AGENDAS.NONE) {
          this.currentAgenda = AGENDAS.TREE_CLIMB;
          this.agendaTarget = target.obj;
          this.agendaPhase = 0;
          this.agendaTimer = 500;
          this.intentIcon = '🌳';
          this.intentLabel = '攀爬猫爬架';
          this.speak('锁定猫爬架立柱！这就爬上去！🪵🐾');
        }
      }
    }

    // 多猫社交交互：碰鼻礼、互相舔毛与打架
    checkSocialInteraction(sceneContext) {
      for (let other of sceneContext.cats) {
        if (other === this || other.state === 'sleeping' || other.isGrabbed || other.inBox) continue;

        const d = Math.hypot(other.x - this.x, other.y - this.y);
        if (d < 45) {
          // 两猫相遇触发社交！
          this.socialCooldown = 320;
          other.socialCooldown = 320;

          const rand = Math.random();
          if (rand < 0.45) {
            // 1. 碰鼻礼 (Nose Bump)
            this.state = 'idle';
            other.state = 'idle';
            this.socialTimer = 40;
            other.socialTimer = 40;
            this.vx = 0; other.vx = 0;
            this.facing = other.x > this.x ? 1 : -1;
            other.facing = -this.facing;

            soundEngine.playMeow(this.pitchMod * 1.15, 'chirp');
            sceneContext.spawnParticle((this.x + other.x) / 2, this.y - 15, '🌸🐾');
            this.speak('碰碰鼻子~ 你好呀！');
            other.speak('喵呜~ 闻闻！');
            this.affection = Math.min(100, this.affection + 5);
            other.affection = Math.min(100, other.affection + 5);
            return true;
          } else if (rand < 0.75) {
            // 2. 互相舔毛 -> 突发互拍互扇 (Allogroom to Slap)
            this.state = 'idle';
            other.state = 'idle';
            this.socialTimer = 65;
            other.socialTimer = 65;
            this.speak('帮你舔舔头顶毛~');
            sceneContext.spawnParticle(other.x, other.y - 20, '👅✨');

            setTimeout(() => {
              // 舔烦了爆发互扇！
              if (soundEngine) {
                soundEngine.playSlap();
                soundEngine.playHiss();
              }
              this.vx = -this.facing * 4.5;
              other.vx = this.facing * 4.5;
              this.vy = -3; other.vy = -3;
              this.speak('嗷！你打我干嘛！');
              other.speak('舔毛超标啦，吃我一拳！💥');
              sceneContext.spawnParticle((this.x + other.x) / 2, this.y - 20, '💥🐾');
            }, 800);
            return true;
          }
        }
      }
      return false;
    }

    // 高台贱爪推物检查 (Knocking things off - 包含毛线、小鱼干与马克水杯！)
    checkHighPerchSwat(sceneContext) {
      if (!sceneContext.toys) return false;
      for (let t of sceneContext.toys) {
        if (t.type === 'yarn' || t.type === 'fish' || t.type === 'mug') {
          const dx = t.x - this.x;
          const dy = t.y - this.y;
          // 物体在跳台台面上且距离很近
          if (Math.abs(dy) < 25 && Math.abs(dx) < 65) {
            this.state = 'swatting';
            this.facing = dx >= 0 ? 1 : -1;
            this.vx = 0;
            this.stateTimer = 50;
            this.speak('这东西在边缘…好想推下去！😏');

            setTimeout(() => {
              // 一爪拍飞！
              t.vx = this.facing * (4.5 + Math.random() * 2);
              t.vy = -2.5;
              soundEngine.playBounce();
              this.speak('啪！落体实验成功！😼');
              sceneContext.spawnParticle(t.x, t.y, '🐾💨');
              this.state = 'idle';
            }, 600);
            return true;
          }
        }
      }
      return false;
    }

    // 接收玩家抚摸
    pet(sceneContext) {
      // 心机碰瓷肚皮陷阱响应：前几次抚摸爽，摸超时直接施展爱情咬咬暴击！
      if (this.state === 'belly_trap') {
        this.bellyTrapPatience -= 25;
        this.purrLevel = Math.min(1.0, this.purrLevel + 0.25);
        soundEngine.startPurr();
        if (sceneContext && sceneContext.spawnParticle) {
          sceneContext.spawnParticle(this.x + (Math.random() - 0.5) * 15, this.y - 15, '💖');
        }
        if (this.bellyTrapPatience <= 0) {
          soundEngine.playHiss();
          soundEngine.playSlap();
          this.vy = -6.5;
          this.vx = -this.facing * 6.5;
          this.speak('嗷呜！摸肚皮超时！心机咬咬暴击！😈💥');
          if (sceneContext && sceneContext.spawnParticle) {
            sceneContext.spawnParticle(this.x, this.y - 20, '🐾💢');
          }
          this.state = 'idle';
          this.currentAgenda = AGENDAS.NONE;
          this.intentIcon = null;
          return;
        }
      }

      this.overstimulation += 6;
      if (this.overstimulation > 65) {
        // 抚摸过载！飞机耳轻咬警告
        soundEngine.playHiss();
        this.speak('摸太多啦！轻咬警告！😾');
        sceneContext.spawnParticle(this.x, this.y - 25, '💢');
        this.vx = -this.facing * 3;
        this.overstimulation = 0;
        return;
      }

      this.purrLevel = Math.min(1.0, this.purrLevel + 0.18);
      this.affection = Math.min(100, this.affection + 2);
      soundEngine.startPurr();

      if (Math.random() < 0.28) {
        sceneContext.spawnParticle(this.x + (Math.random() - 0.5) * 20, this.y - 25, '❤️');
        soundEngine.playMeow(this.pitchMod * 1.2, 'pleading');
        const petQuotes = ['呼噜噜……好舒服~', '继续摸，不要停！', '下巴再挠挠~', '呼噜噜噜……❤️'];
        this.speak(petQuotes[Math.floor(Math.random() * petQuotes.length)]);
      }
    }

    // 绘制猫咪主体
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);

      // 纸箱露出萌头
      if (this.inBox) {
        ctx.translate(0, -4);
      }

      // 地面阴影 (抓起拉长时阴影随之缩小)
      if (!physicsWorld.isZeroG() && !this.inBox && !this.ridingObj) {
        ctx.beginPath();
        const shadowScale = this.isGrabbed ? 0.55 : 1.0;
        ctx.ellipse(0, this.radius + 6, this.radius * 0.9 * shadowScale, 5 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fill();
      }

      // 绘制物理多节尾巴
      if (!this.inBox) {
        this.tailChain.draw(ctx, this.breed.bodyColor, 6, 2.5);
      }

      // 潜伏摇屁股
      if (this.state === 'stalking') {
        ctx.rotate(this.buttWiggle * 0.15);
      }

      // 躯干绘制 (母鸡蹲 / 长条液体猫 / 正常跑走)
      if (!this.inBox) {
        ctx.save();
        if (this.state === 'loaf') {
          // 母鸡蹲形态 (Loafing) - 爪爪收起，面包块起伏呼吸
          const breatheY = Math.sin(this.loafBreathe) * 1.2;
          ctx.beginPath();
          ctx.roundRect(-this.radius * 1.05, -this.radius * 0.2 + breatheY, this.radius * 2.1, this.radius * 1.2, [14]);
          ctx.fillStyle = this.breed.bodyColor;
          ctx.fill();

          // 肚皮毛
          ctx.beginPath();
          ctx.roundRect(-this.radius * 0.6, this.radius * 0.2 + breatheY, this.radius * 1.2, this.radius * 0.6, [8]);
          ctx.fillStyle = this.breed.bellyColor;
          ctx.fill();
        } else if (this.isGrabbed) {
          // 长条液态猫形态 (Long Cat Squash & Stretch)
          ctx.scale(0.72, this.grabStretch);

          // 纵向拉伸身躯
          ctx.beginPath();
          ctx.ellipse(0, 8, this.radius * 0.85, this.radius * 1.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = this.breed.bodyColor;
          ctx.fill();

          // 肚皮
          ctx.beginPath();
          ctx.ellipse(0, 10, this.radius * 0.55, this.radius * 1.2, 0, 0, Math.PI * 2);
          ctx.fillStyle = this.breed.bellyColor;
          ctx.fill();

          // 自然耷拉晃动的四爪
          ctx.fillStyle = this.breed.bodyColor;
          // 前爪
          ctx.beginPath();
          ctx.ellipse(-10, 2, 4, 10, 0.1, 0, Math.PI * 2);
          ctx.ellipse(10, 2, 4, 10, -0.1, 0, Math.PI * 2);
          ctx.fill();
          // 后爪
          ctx.beginPath();
          ctx.ellipse(-8, this.radius * 1.6, 4, 11, 0.2, 0, Math.PI * 2);
          ctx.ellipse(8, this.radius * 1.6, 4, 11, -0.2, 0, Math.PI * 2);
          ctx.fill();
        } else if (this.state === 'sleeping') {
          // 睡眠蜷缩成团
          ctx.beginPath();
          ctx.ellipse(0, 8, this.radius * 1.1, this.radius * 0.75, 0, 0, Math.PI * 2);
          ctx.fillStyle = this.breed.bodyColor;
          ctx.fill();
        } else if (this.state === 'stealth_stalk' || this.state === 'stealth_freeze') {
          // 战术匍匐潜行形态 (Stealth Crawl / Freeze) - 身体扁平，底盘紧贴地面
          ctx.scale(1.22, 0.65);
          ctx.beginPath();
          ctx.ellipse(0, 10, this.radius * 1.15, this.radius * 0.7, 0, 0, Math.PI * 2);
          ctx.fillStyle = this.breed.bodyColor;
          ctx.fill();

          // 肚皮
          ctx.beginPath();
          ctx.ellipse(this.facing * 4, 12, this.radius * 0.65, this.radius * 0.45, 0, 0, Math.PI * 2);
          ctx.fillStyle = this.breed.bellyColor;
          ctx.fill();

          // 匍匐小碎步爪子
          const crawlStep = this.state === 'stealth_freeze' ? 0 : Math.sin(Date.now() * 0.02) * 3;
          ctx.fillStyle = this.breed.bodyColor;
          ctx.beginPath();
          ctx.ellipse(this.facing * 14 + crawlStep, 16, 5, 3, 0, 0, Math.PI * 2);
          ctx.ellipse(-this.facing * 14 - crawlStep, 16, 5, 3, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (this.state === 'belly_trap') {
          // 侧躺翻肚皮心机形态 (Belly Trap)
          ctx.rotate(0.38 * this.facing);
          ctx.beginPath();
          ctx.ellipse(0, 6, this.radius * 1.12, this.radius * 0.9, 0, 0, Math.PI * 2);
          ctx.fillStyle = this.breed.bodyColor;
          ctx.fill();

          // 大面积柔软肚皮毛
          ctx.beginPath();
          ctx.ellipse(0, 2, this.radius * 0.78, this.radius * 0.68, 0, 0, Math.PI * 2);
          ctx.fillStyle = this.breed.bellyColor;
          ctx.fill();

          // 四只粉红肉垫小爪蜷缩悬空
          ctx.fillStyle = this.breed.bodyColor;
          for (let pi = -1; pi <= 1; pi += 0.66) {
            ctx.beginPath();
            ctx.arc(pi * 12, -8 + Math.sin(Date.now() * 0.006 + pi) * 1.5, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (this.state === 'wet_shake') {
          // 湿爪嫌弃高频甩水形态
          ctx.translate(0, 3);
          ctx.beginPath();
          ctx.ellipse(0, 4, this.radius, this.radius * 0.85, 0, 0, Math.PI * 2);
          ctx.fillStyle = this.breed.bodyColor;
          ctx.fill();

          ctx.beginPath();
          ctx.ellipse(this.facing * 4, 7, this.radius * 0.55, this.radius * 0.52, 0, 0, Math.PI * 2);
          ctx.fillStyle = this.breed.bellyColor;
          ctx.fill();

          // 悬空快速甩动的前爪
          const shakeOffset = Math.sin(Date.now() * 0.06) * 5;
          ctx.fillStyle = this.breed.bodyColor;
          ctx.beginPath();
          ctx.ellipse(this.facing * 14, this.radius - 2 + shakeOffset, 5, 4, 0.3, 0, Math.PI * 2);
          ctx.fill();
        } else if (this.state === 'feeder_hack') {
          // 敲碗站立前拍形态
          ctx.scale(0.92, 1.12);
          ctx.beginPath();
          ctx.ellipse(0, 4, this.radius, this.radius * 0.85, 0, 0, Math.PI * 2);
          ctx.fillStyle = this.breed.bodyColor;
          ctx.fill();

          // 伸出前爪拍击
          const tapOffset = Math.sin(Date.now() * 0.04) * 6;
          ctx.fillStyle = this.breed.bodyColor;
          ctx.beginPath();
          ctx.ellipse(this.facing * (15 + tapOffset), this.radius - 4, 6, 4, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (this.state === 'throne_challenge') {
          // 炸毛弓背对决形态
          ctx.scale(1.15, 1.12);
          ctx.beginPath();
          ctx.ellipse(0, 2, this.radius, this.radius * 0.9, 0, 0, Math.PI * 2);
          ctx.fillStyle = this.breed.bodyColor;
          ctx.fill();
        } else if (this.state === 'judging_overlook') {
          // 俯瞰审视高台形态
          ctx.beginPath();
          ctx.roundRect(-this.radius * 1.05, 0, this.radius * 2.1, this.radius * 1.1, [12]);
          ctx.fillStyle = this.breed.bodyColor;
          ctx.fill();
        } else if (this.state === 'climbing') {
          // 🪵 真实抱柱攀爬形态 (Trunk Climbing Pose) - 身体纵向贴柱垂直向上，四爪交替抓攀
          ctx.rotate(this.facing * -Math.PI / 2);
          ctx.scale(1.15, 0.85);

          // 纵向身躯
          ctx.beginPath();
          ctx.ellipse(0, 3, this.radius * 1.05, this.radius * 0.8, 0, 0, Math.PI * 2);
          ctx.fillStyle = this.breed.bodyColor;
          ctx.fill();

          // 肚皮
          ctx.beginPath();
          ctx.ellipse(2, 5, this.radius * 0.65, this.radius * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = this.breed.bellyColor;
          ctx.fill();

          // 四爪交替抓柱爬升动作
          const climbP1 = Math.sin(this.climbCycle || 0) * 7;
          const climbP2 = -climbP1;
          ctx.fillStyle = this.breed.bodyColor;

          // 前爪交替向上攀抓
          ctx.beginPath();
          ctx.ellipse(this.radius * 0.8 + climbP1, 4, 7, 4, 0.3, 0, Math.PI * 2);
          ctx.ellipse(this.radius * 0.8 + climbP2, -4, 7, 4, -0.3, 0, Math.PI * 2);
          ctx.fill();

          // 后爪交替蹬踏立柱
          ctx.beginPath();
          ctx.ellipse(-this.radius * 0.8 + climbP2, 5, 8, 4, -0.2, 0, Math.PI * 2);
          ctx.ellipse(-this.radius * 0.8 + climbP1, -5, 8, 4, 0.2, 0, Math.PI * 2);
          ctx.fill();

          // 粉红小肉垫
          ctx.fillStyle = '#ffb8b8';
          ctx.beginPath();
          ctx.arc(this.radius * 0.9 + climbP1, 4, 2.5, 0, Math.PI * 2);
          ctx.arc(this.radius * 0.9 + climbP2, -4, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (this.state === 'jumping' || this.state === 'pouncing') {
          // 飞跃腾空姿态 (Aerial Leap Pose) - 身体前倾流线延伸，前爪向前探伸，后爪向后蹬直
          const leapAngle = Math.atan2(this.vy, Math.abs(this.vx) + 0.1) * 0.42;
          ctx.rotate(leapAngle * this.facing);
          ctx.scale(1.18, 0.8);

          // 躯干流线拉长
          ctx.beginPath();
          ctx.ellipse(0, 4, this.radius * 1.1, this.radius * 0.8, 0, 0, Math.PI * 2);
          ctx.fillStyle = this.breed.bodyColor;
          ctx.fill();

          // 肚皮
          ctx.beginPath();
          ctx.ellipse(this.facing * 3, 6, this.radius * 0.65, this.radius * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = this.breed.bellyColor;
          ctx.fill();

          // 前爪向前探伸
          ctx.fillStyle = this.breed.bodyColor;
          ctx.beginPath();
          ctx.ellipse(this.facing * 16, 8, 7, 3.5, this.facing * 0.3, 0, Math.PI * 2);
          ctx.fill();

          // 后爪向后蹬直
          ctx.beginPath();
          ctx.ellipse(-this.facing * 16, 7, 8, 3.2, -this.facing * 0.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // 标准步态与踩奶肉爪
          const legPhase = Math.sin(this.walkCycle);
          const kneadOffset = Math.sin(this.kneadCycle) * 2.5;
          ctx.fillStyle = this.breed.bodyColor;
          // 前爪
          ctx.beginPath();
          ctx.ellipse(this.facing * 12 + legPhase * 4, this.radius + 1 + kneadOffset, 5, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          // 后爪
          ctx.beginPath();
          ctx.ellipse(-this.facing * 12 - legPhase * 4, this.radius + 1 - kneadOffset, 5, 4, 0, 0, Math.PI * 2);
          ctx.fill();

          // 躯干
          ctx.beginPath();
          ctx.ellipse(0, 4, this.radius, this.radius * 0.85, 0, 0, Math.PI * 2);
          ctx.fillStyle = this.breed.bodyColor;
          ctx.fill();

          // 肚皮
          ctx.beginPath();
          ctx.ellipse(this.facing * 4, 7, this.radius * 0.55, this.radius * 0.52, 0, 0, Math.PI * 2);
          ctx.fillStyle = this.breed.bellyColor;
          ctx.fill();

          // 橘猫斑纹
          if (this.breed.hasStripes) {
            ctx.strokeStyle = this.breed.stripeColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-4, -6); ctx.lineTo(-2, 4);
            ctx.moveTo(4, -6); ctx.lineTo(6, 4);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // 头部绘制 (蹭脸旋转与注视)
      ctx.save();
      const headY = this.inBox ? 0 : (this.state === 'stalking' ? 0 : (this.state === 'loaf' ? -4 : -8));
      const headR = this.radius * 0.76;
      ctx.translate(0, headY);
      ctx.rotate(this.headTilt);
      ctx.translate(0, -headY);

      // 耳朵 (飞机耳检测：过载、烦躁、王座对峙或潜行时耳朵后压)
      let earBackAngle = (this.overstimulation > 30 || this.laserFrustration > 50) ? 0.35 : 0;
      if (this.state === 'throne_challenge') earBackAngle = 0.55;
      if (this.state === 'stealth_stalk' || this.state === 'stealth_freeze') earBackAngle = 0.28;
      ctx.fillStyle = this.breed.bodyColor;
      // 左耳
      ctx.beginPath();
      ctx.moveTo(-headR * 0.8, headY - 4);
      ctx.lineTo(-headR * 0.7 - earBackAngle * 10, headY - headR * 1.4 + earBackAngle * 6);
      ctx.lineTo(-headR * 0.1, headY - headR * 0.8);
      ctx.closePath();
      ctx.fill();
      // 右耳
      ctx.beginPath();
      ctx.moveTo(headR * 0.1, headY - headR * 0.8);
      ctx.lineTo(headR * 0.7 + earBackAngle * 10, headY - headR * 1.4 + earBackAngle * 6);
      ctx.lineTo(headR * 0.8, headY - 4);
      ctx.closePath();
      ctx.fill();

      // 耳蜗粉红
      ctx.fillStyle = this.breed.earColor;
      ctx.beginPath();
      ctx.moveTo(-headR * 0.65, headY - 4);
      ctx.lineTo(-headR * 0.6 - earBackAngle * 8, headY - headR * 1.2 + earBackAngle * 5);
      ctx.lineTo(-headR * 0.2, headY - headR * 0.75);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(headR * 0.2, headY - headR * 0.75);
      ctx.lineTo(headR * 0.6 + earBackAngle * 8, headY - headR * 1.2 + earBackAngle * 5);
      ctx.lineTo(headR * 0.65, headY - 4);
      ctx.closePath();
      ctx.fill();

      // 头脸圆轮廓
      ctx.beginPath();
      ctx.arc(0, headY, headR, 0, Math.PI * 2);
      ctx.fillStyle = this.breed.bodyColor;
      ctx.fill();

      // 奶牛猫面具黑斑
      if (this.breed.hasMask) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, headY - 2);
        ctx.lineTo(-headR * 0.6, headY + headR * 0.7);
        ctx.lineTo(headR * 0.6, headY + headR * 0.7);
        ctx.closePath();
        ctx.fill();
      }

      // 眼睛
      const eyeOffset = this.facing * 3;
      const eyeY = headY - 1;
      const eyeLeftX = -headR * 0.4 + eyeOffset;
      const eyeRightX = headR * 0.4 + eyeOffset;

      if (this.state === 'judging_overlook') {
        // 居高临下蔑视审视眼 (冷漠细横线 - -)
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(eyeLeftX - 4.5, eyeY);
        ctx.lineTo(eyeLeftX + 4.5, eyeY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(eyeRightX - 4.5, eyeY);
        ctx.lineTo(eyeRightX + 4.5, eyeY);
        ctx.stroke();
      } else if (this.state === 'sleeping' || this.purrLevel > 0.6 || this.isBlinking) {
        // 开心眯眯眼 ^ ^
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(eyeLeftX, eyeY, 4, Math.PI, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(eyeRightX, eyeY, 4, Math.PI, 0);
        ctx.stroke();
      } else {
        // 睁大眼睛
        const eyeColorL = this.breed.eyeColor;
        const eyeColorR = this.breed.eyeRightColor || this.breed.eyeColor;

        // 左眼
        ctx.fillStyle = eyeColorL;
        ctx.beginPath();
        ctx.ellipse(eyeLeftX, eyeY, 4.5, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // 右眼
        ctx.fillStyle = eyeColorR;
        ctx.beginPath();
        ctx.ellipse(eyeRightX, eyeY, 4.5, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // 瞳孔
        const pupilW = MathUtils.lerp(1.5, 4.2, this.pupilDilation);
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        ctx.ellipse(eyeLeftX, eyeY, pupilW, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(eyeRightX, eyeY, pupilW, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // 高光
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(eyeLeftX - 1.2, eyeY - 2, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eyeRightX - 1.2, eyeY - 2, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // 鼻子与胡须
      ctx.fillStyle = '#ff7675';
      ctx.beginPath();
      ctx.arc(eyeOffset, headY + 5, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // 胡须
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-headR * 0.3 + eyeOffset, headY + 5);
      ctx.lineTo(-headR * 1.1 + eyeOffset, headY + 2);
      ctx.moveTo(-headR * 0.3 + eyeOffset, headY + 7);
      ctx.lineTo(-headR * 1.1 + eyeOffset, headY + 9);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(headR * 0.3 + eyeOffset, headY + 5);
      ctx.lineTo(headR * 1.1 + eyeOffset, headY + 2);
      ctx.moveTo(headR * 0.3 + eyeOffset, headY + 7);
      ctx.lineTo(headR * 1.1 + eyeOffset, headY + 9);
      ctx.stroke();

      // 帽子
      this.drawHat(ctx, headY, headR);
      ctx.restore();

      // 名字标签
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.name, 0, headY - headR - 10);

      // 喵语同传气泡
      if (this.bubbleTimer > 0 && this.bubbleText) {
        this.drawSpeechBubble(ctx, headY - headR - 24);
      } else if (this.intentIcon && this.currentAgenda && this.currentAgenda !== AGENDAS.NONE) {
        // 战术意图气泡徽章 (在无喵语气泡时常驻指示当前猫生大计)
        this.drawIntentBadge(ctx, headY - headR - 14);
      }

      ctx.restore();
    }

    speak(text) {
      this.bubbleText = text;
      this.bubbleTimer = 160;
    }

    // 绘制猫生战术大计浮动徽章
    drawIntentBadge(ctx, badgeY) {
      ctx.save();
      ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const label = `${this.intentIcon} ${this.intentLabel || ''}`;
      const metrics = ctx.measureText(label);
      const bw = metrics.width + 12;
      const bh = 17;
      const bx = -bw / 2;
      const by = badgeY - bh;

      const pulse = Math.sin(Date.now() * 0.005 + (this.x % 10)) * 0.12 + 0.88;
      ctx.globalAlpha = pulse;

      // 半透明深色胶囊微光底框
      ctx.fillStyle = 'rgba(26, 36, 43, 0.86)';
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, [7]);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#f1f2f6';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, by + bh / 2 + 0.5);
      ctx.restore();
    }

    drawSpeechBubble(ctx, bubbleBottomY) {
      ctx.save();
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const textMetrics = ctx.measureText(this.bubbleText);
      const textW = textMetrics.width;
      const padX = 10;
      const bw = textW + padX * 2;
      const bh = 22;
      const bx = -bw / 2;
      const by = bubbleBottomY - bh;

      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, [8]);
      ctx.fill();

      // 三角箭头
      ctx.beginPath();
      ctx.moveTo(-4, by + bh);
      ctx.lineTo(0, by + bh + 6);
      ctx.lineTo(4, by + bh);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#1e272e';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.bubbleText, 0, by + bh / 2);
      ctx.restore();
    }

    drawHat(ctx, headY, headR) {
      if (this.hat === 'bell') {
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(-headR * 0.7, headY + headR - 2, headR * 1.4, 3);
        ctx.beginPath();
        ctx.arc(0, headY + headR + 2, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#f1c40f';
        ctx.fill();
      } else if (this.hat === 'bow') {
        ctx.fillStyle = '#ff6b81';
        ctx.beginPath();
        ctx.moveTo(0, headY + headR + 2);
        ctx.lineTo(-7, headY + headR - 3);
        ctx.lineTo(-7, headY + headR + 7);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, headY + headR + 2);
        ctx.lineTo(7, headY + headR - 3);
        ctx.lineTo(7, headY + headR + 7);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, headY + headR + 2, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.hat === 'party') {
        ctx.fillStyle = '#2ed573';
        ctx.beginPath();
        ctx.moveTo(0, headY - headR - 16);
        ctx.lineTo(-8, headY - headR + 2);
        ctx.lineTo(8, headY - headR + 2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, headY - headR - 16, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffa502';
        ctx.fill();
      } else if (this.hat === 'wizard') {
        ctx.fillStyle = '#575fcf';
        ctx.beginPath();
        ctx.ellipse(0, headY - headR + 2, 16, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, headY - headR - 20);
        ctx.lineTo(-10, headY - headR + 2);
        ctx.lineTo(10, headY - headR + 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffd32a';
        ctx.font = '10px sans-serif';
        ctx.fillText('★', 0, headY - headR - 4);
      }
    }
  }

  window.CyberMeow = window.CyberMeow || {};
  window.CyberMeow.AGENDAS = AGENDAS;
  window.CyberMeow.BREEDS = BREEDS;
  window.CyberMeow.PERSONALITIES = PERSONALITIES;
  window.CyberMeow.HATS = HATS;
  window.CyberMeow.Cat = Cat;
})(window);
