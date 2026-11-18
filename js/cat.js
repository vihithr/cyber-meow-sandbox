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

      // --- 姿态与行为状态机 ---
      // 状态: 'idle', 'walking', 'stalking', 'pouncing', 'sleeping', 'loaf', 'scratching',
      //      'in_box', 'riding', 'grabbed', 'zoomies', 'swatting', 'chattering',
      //      'catnip_high', 'tangled', 'social_bump', 'social_groom', 'slapping'
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

      // 1. 生理驱动自然代谢消耗
      this.hunger = Math.max(0, this.hunger - 0.007);
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
      if (this.overstimulation > 0) this.overstimulation -= 0.05;
      if (this.bubbleTimer > 0) this.bubbleTimer--;

      // 呼噜声平滑衰减
      if (this.purrLevel > 0) {
        this.purrLevel -= 0.005;
        if (this.purrLevel <= 0) soundEngine.stopPurr();
      }

      // 2. 长条液体猫抓取状态 (Scruff Grab)
      if (this.isGrabbed) {
        this.state = 'grabbed';
        this.grabStretch = MathUtils.lerp(this.grabStretch, 1.55, 0.12);
        this.tailChain.update(this.x, this.y + this.radius * 1.4, 0.35, 0.85);
        return;
      } else {
        this.grabStretch = MathUtils.lerp(this.grabStretch, 1.0, 0.18);
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
        this.vy += gravity;
        const drag = physicsWorld.isZeroG() ? 0.985 : (this.state === 'zoomies' ? 0.97 : 0.92);
        this.vx *= drag;
        this.vy *= physicsWorld.isZeroG() ? 0.985 : 0.99;

        const maxSpeed = this.state === 'zoomies' ? 10.5 : (this.state === 'pouncing' ? 8.5 : 4.5);
        this.vx = MathUtils.clamp(this.vx, -maxSpeed, maxSpeed);
        this.vy = MathUtils.clamp(this.vy, -maxSpeed, maxSpeed);

        this.x += this.vx;
        this.y += this.vy;

        // 地面与高台停靠碰撞
        const floor = physicsWorld.getFloorY(height) - this.radius;

        // 检查墙壁跳台与猫爬架高台 (猫咪喜爱居高临下)
        let landedOnPerch = false;
        if (this.vy >= 0 && sceneContext.furniture) {
          for (let f of sceneContext.furniture) {
            if (f.type === 'perch') {
              if (Math.abs(this.x - f.x) < f.w / 2 && Math.abs((this.y + this.radius) - f.y) < 14) {
                this.y = f.y - this.radius;
                this.vy = 0;
                this.vx *= 0.8;
                this.perchedTier = f;
                landedOnPerch = true;
                break;
              }
            } else if (f.type === 'cattree' && f.tiers) {
              for (let tier of f.tiers) {
                const tierY = f.y + tier.yOffset;
                const tierX = f.x + tier.xOffset;
                if (Math.abs(this.x - tierX) < tier.w / 2 && Math.abs((this.y + this.radius) - tierY) < 14) {
                  this.y = tierY - this.radius;
                  this.vy = 0;
                  this.vx *= 0.8;
                  this.perchedTier = tier;
                  landedOnPerch = true;
                  break;
                }
              }
            }
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
          if (this.state === 'pouncing') this.state = 'idle';
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

      // 优先级2：纸箱中
      if (this.inBox) {
        this.state = 'in_box';
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

      // 优先级7：环境传感器目标寻路 (激光 / 逗猫棒 / 鱼干 / 纸箱 / 扫地机 / 毛线)
      const target = this.evaluateSensors(sceneContext);
      if (target) {
        this.handleTargetAction(target, width, height, sceneContext);
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

      // 优先级9：自主随机日常行为 (融入性格矩阵)
      this.pupilDilation = 0.45;
      if (this.stateTimer <= 0) {
        // 登高跳台欲望 (跑酷猫与好奇猫极度偏爱)
        const climbBias = this.personality.id === 'ZOOMER' ? 0.55 : 0.28;
        if (Math.random() < climbBias && sceneContext.furniture && !this.perchedTier) {
          const perches = sceneContext.furniture.filter(f => f.type === 'perch');
          if (perches.length > 0) {
            const targetPerch = perches[Math.floor(Math.random() * perches.length)];
            const dx = targetPerch.x - this.x;
            if (Math.abs(dx) < 320 && this.y > targetPerch.y + 20) {
              this.vy = -Math.sqrt(2 * 0.28 * (this.y - targetPerch.y + 25));
              this.vx = dx * 0.035;
              this.state = 'idle';
              this.speak(Math.random() < 0.5 ? '登高俯瞰朕的领地！' : '高处视野才是王道~');
              soundEngine.playMeow(this.pitchMod * 1.1, 'chirp');
              this.stateTimer = 140;
              return;
            }
          }
        }

        const rand = Math.random();
        if (rand < 0.35) {
          // 佛系猫偏好：母鸡蹲 (Loafing)
          if (this.personality.id === 'CHILL' || rand < 0.18) {
            this.state = 'loaf';
            this.vx = 0;
            this.stateTimer = 160 + Math.random() * 150;
            this.speak(Math.random() < 0.5 ? '揣小爪爪，缩成面包~ 🍞' : '舒适母鸡蹲…');
          } else {
            this.state = 'idle';
            this.vx = 0;
            this.stateTimer = 60 + Math.random() * 80;
          }
        } else if (rand < 0.65) {
          // 巡逻走动
          this.state = 'walking';
          this.facing = Math.random() < 0.5 ? 1 : -1;
          const speedMod = this.personality.id === 'ZOOMER' ? 1.5 : (this.personality.id === 'CHILL' ? 0.7 : 1.0);
          this.vx = this.facing * (0.8 + Math.random() * 1.0) * speedMod;
          this.stateTimer = 40 + Math.random() * 80;
        } else if (rand < 0.85) {
          // 寻找阳光打盹
          const sun = sceneContext.sunbeam;
          if (sun && Math.abs(this.x - sun.x) < sun.width * 0.45) {
            this.state = 'sleeping';
            this.stateTimer = 220 + Math.random() * 200;
            sceneContext.spawnParticle(this.x, this.y - 20, '💤✨');
            this.speak('追着阳光睡个好觉~ ☀️');
          } else {
            this.state = 'idle';
            this.stateTimer = 60;
          }
        } else {
          // 伸懒腰并撒娇呼唤
          this.state = 'idle';
          soundEngine.playMeow(this.pitchMod, 'chirp');
          const quotes = ['铲屎的，快伺候本喵！', '喵呜~', '本喵是液体~', '陪我玩嘛！', '粮碗又见底啦！'];
          this.speak(quotes[Math.floor(Math.random() * quotes.length)]);
          this.stateTimer = 60;
        }
      }
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
          // 扑到了毛线！拍打并解脱激光挫败感
          this.laserFrustration = 0;
          if (target.obj) {
            target.obj.vx += (this.vx + (Math.random() - 0.5) * 5) * 1.6;
            target.obj.vy -= 4 + Math.random() * 2.5;
            soundEngine.playBounce();
            soundEngine.playMeow(this.pitchMod * 1.2, 'chirp');
            sceneContext.spawnParticle(this.x, this.y - 20, '🧶✨');
            this.speak('喵喵连环掌！');
          }
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

    // 高台贱爪推物检查 (Knocking things off)
    checkHighPerchSwat(sceneContext) {
      if (!sceneContext.toys) return false;
      for (let t of sceneContext.toys) {
        if (t.type === 'yarn' || t.type === 'fish') {
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

      // 耳朵 (飞机耳检测：过载或烦躁时耳朵后压)
      const earBackAngle = (this.overstimulation > 30 || this.laserFrustration > 50) ? 0.35 : 0;
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

      if (this.state === 'sleeping' || this.purrLevel > 0.6 || this.isBlinking) {
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
      }

      ctx.restore();
    }

    speak(text) {
      this.bubbleText = text;
      this.bubbleTimer = 160;
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
  window.CyberMeow.BREEDS = BREEDS;
  window.CyberMeow.PERSONALITIES = PERSONALITIES;
  window.CyberMeow.HATS = HATS;
  window.CyberMeow.Cat = Cat;
})(window);
