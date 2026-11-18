/**
 * CyberMeow - 猫咪智能体 (Cat Agent)
 * 具备：Verlet尾巴、多节脊椎动力学、动态表情、注视反向动力学(IK)、行为树状态机、个性系统与撸猫反馈
 */
(function(window) {
  'use strict';

  const { MathUtils, VerletChain, physicsWorld, soundEngine } = window.CyberMeow;

  const CAT_NAMES = [
    '芝麻', '年糕', '大橘', '皮皮', '布丁', '奥利奥', '咪咪', '豆包', '雪球', '琥珀', '抹茶', '炭炭', '奶茶'
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
      stripeColor: '#d35400'
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
      eyeRightColor: '#f1c40f', // 异瞳
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
    { id: 'GLUTTON', name: '贪吃鬼 🍗', desc: '满脑子都是小鱼干，闻到香味就会飞奔！' },
    { id: 'ZOOMER', name: '跑酷狂人 ⚡', desc: '精力充沛，热衷追逐红点与高空跳跃！' },
    { id: 'CHILL', name: '佛系咸鱼 💤', desc: '随遇而安，最喜欢在阳光下或箱子里打盹。' },
    { id: 'CLINGY', name: '超级粘人 🥰', desc: '喜欢被摸摸，一靠近就会发出满分呼噜声。' },
    { id: 'CURIOUS', name: '好奇宝宝 🔍', desc: '对所有新家具和逗猫棒都抱有强烈好奇心。' }
  ];

  const HATS = ['none', 'bell', 'bow', 'wizard', 'party'];

  class Cat {
    constructor(x, y, customConfig = {}) {
      this.id = 'cat_' + Math.random().toString(36).substring(2, 9);
      this.name = customConfig.name || CAT_NAMES[Math.floor(Math.random() * CAT_NAMES.length)];
      this.breed = customConfig.breed || BREEDS[Math.floor(Math.random() * BREEDS.length)];
      this.personality = customConfig.personality || PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
      this.hat = customConfig.hat || HATS[Math.floor(Math.random() * HATS.length)];

      // 坐标与速度
      this.x = x;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 2;
      this.vy = 0;
      this.radius = this.breed.chunky ? 26 : 22;
      this.facing = this.vx >= 0 ? 1 : -1;

      // Verlet 物理尾巴 (5节段)
      this.tailChain = new VerletChain(this.x, this.y, 5, 7);

      // 状态机
      // 'idle', 'walking', 'stalking', 'pouncing', 'sleeping', 'scratching', 'in_box', 'riding', 'petting', 'grabbed'
      this.state = 'idle';
      this.stateTimer = 60 + Math.random() * 120;
      this.buttWiggle = 0; // 扑食前摇屁股角度

      // 属性值
      this.hunger = 80; // 0-100 (低了想吃鱼)
      this.energy = 80; // 0-100
      this.affection = 60; // 亲密度
      this.purrLevel = 0;

      // 动画辅助
      this.blinkTimer = 100 + Math.random() * 150;
      this.isBlinking = false;
      this.pupilDilation = 0.5; // 0.1 细缝 - 0.9 放大圆瞳
      this.earTwitchLeft = 0;
      this.earTwitchRight = 0;
      this.walkCycle = 0;
      this.kneadCycle = 0;
      this.headTilt = 0;

      // 互动引用
      this.target = null;
      this.inBox = null;
      this.ridingObj = null;
      this.perchedTier = null;
      this.isGrabbed = false;
      this.catnipEnergy = 0;
      this.bubbleText = null;
      this.bubbleTimer = 0;

      this.pitchMod = 0.85 + Math.random() * 0.35;
    }

    update(width, height, sceneContext) {
      const gravity = physicsWorld.getGravity();

      // 如果被抓起
      if (this.isGrabbed) {
        this.state = 'grabbed';
        this.tailChain.update(this.x - this.facing * 12, this.y + 8, 0.2);
        return;
      }

      // 呼噜声平滑与气泡计时
      if (this.bubbleTimer > 0) this.bubbleTimer--;
      if (this.purrLevel > 0) {
        this.purrLevel -= 0.005;
        if (this.purrLevel <= 0) soundEngine.stopPurr();
      }

      // 靠近人手时的蹭头与踩奶物理感知
      if (sceneContext && sceneContext.mouse) {
        const mouseDist = Math.hypot(sceneContext.mouse.x - this.x, sceneContext.mouse.y - this.y);
        if (mouseDist < 65) {
          this.headTilt = MathUtils.clamp((sceneContext.mouse.x - this.x) * 0.005, -0.25, 0.25);
          this.kneadCycle += 0.18;
        } else {
          this.headTilt *= 0.88;
        }
      }

      // 猫薄荷狂欢
      if (this.catnipEnergy > 0) {
        this.catnipEnergy--;
        this.vx += (Math.random() - 0.5) * 3;
        this.vy += (Math.random() - 0.5) * 3;
        if (Math.random() < 0.15) {
          sceneContext.spawnParticle(this.x, this.y - 20, '✨');
        }
      }

      // 状态机逻辑
      this.runStateMachine(width, height, sceneContext);

      // 物理应用
      if (this.state !== 'in_box' && this.state !== 'riding') {
        this.vy += gravity;
        this.vx *= physicsWorld.isZeroG() ? 0.985 : 0.92;
        this.vy *= physicsWorld.isZeroG() ? 0.985 : 0.99;

        const maxSpeed = this.state === 'pouncing' ? 9 : (this.catnipEnergy > 0 ? 7 : 4);
        this.vx = MathUtils.clamp(this.vx, -maxSpeed, maxSpeed);
        this.vy = MathUtils.clamp(this.vy, -maxSpeed, maxSpeed);

        this.x += this.vx;
        this.y += this.vy;

        // 边界与跳台碰撞处理
        const floor = physicsWorld.getFloorY(height) - this.radius;

        // 检查墙壁跳台与家具高台停靠 (猫咪喜欢登高)
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

        if (this.y > floor) {
          this.y = floor;
          this.vy = -this.vy * 0.35;
          if (Math.abs(this.vy) < 0.2) this.vy = 0;
          if (this.state === 'pouncing') this.state = 'idle';
        }
        if (this.y < this.radius + 10) {
          this.y = this.radius + 10;
          this.vy = -this.vy * 0.4;
        }
        if (this.x > width - this.radius - 6) {
          this.x = width - this.radius - 6;
          this.vx = -this.vx * 0.6;
          this.facing = -1;
        }
        if (this.x < this.radius + 6) {
          this.x = this.radius + 6;
          this.vx = -this.vx * 0.6;
          this.facing = 1;
        }
      }

      // 更新尾巴物理
      const tailRootX = this.x - this.facing * (this.radius * 0.7);
      const tailRootY = this.y + (this.state === 'sleeping' ? 6 : 4);
      let tailGrav = 0.06;
      if (this.purrLevel > 0.5) tailGrav = -0.05; // 开心时尾巴翘起
      this.tailChain.update(tailRootX, tailRootY, tailGrav, 0.92);

      // 眨眼与面部表情更新
      this.blinkTimer--;
      if (this.blinkTimer <= 0) {
        this.isBlinking = true;
        if (this.blinkTimer < -10) {
          this.isBlinking = false;
          this.blinkTimer = 120 + Math.random() * 200;
        }
      }

      // 行走循环动画
      if (Math.abs(this.vx) > 0.3) {
        this.walkCycle += 0.25;
      }
    }

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

      // 优先级3：寻找猎物与互动目标
      let foundTarget = this.evaluateSensors(sceneContext);

      if (foundTarget) {
        const dx = foundTarget.x - this.x;
        const dy = foundTarget.y - this.y;
        const dist = Math.hypot(dx, dy);

        this.facing = dx >= 0 ? 1 : -1;
        this.pupilDilation = 0.85; // 兴奋放大瞳孔

        if (foundTarget.type === 'laser' || foundTarget.type === 'feather' || foundTarget.type === 'yarn') {
          if (dist > 140) {
            // 潜伏接近
            this.state = 'stalking';
            this.vx += (dx / dist) * 0.35;
          } else if (dist > 40) {
            // 屁股摇摆预备扑咬
            this.state = 'stalking';
            this.buttWiggle = Math.sin(Date.now() * 0.03) * 0.4;
            if (Math.random() < 0.06 && this.y >= height - this.radius - 16) {
              // 猛烈扑杀！
              this.state = 'pouncing';
              this.vy = -6.5 - Math.random() * 2.5;
              this.vx = (dx / dist) * 7.5;
              soundEngine.playMeow(this.pitchMod, 'chatter');
              if (Math.random() < 0.4) this.speak(Math.random() < 0.5 ? '绝学·飞扑！' : '红点休逃！');
            }
          } else {
            // 扑到了！拍打
            if (foundTarget.obj && foundTarget.type === 'yarn') {
              foundTarget.obj.vx += (this.vx + (Math.random() - 0.5) * 4) * 1.5;
              foundTarget.obj.vy -= 4 + Math.random() * 2;
              soundEngine.playBounce();
              sceneContext.spawnParticle(this.x, this.y - 20, '🐾');
              if (Math.random() < 0.25) this.speak('看我喵喵拳！');
            }
          }
        } else if (foundTarget.type === 'fish') {
          // 吃鱼
          if (dist > 25) {
            this.state = 'walking';
            this.vx += (dx / dist) * 0.45;
          } else {
            const idx = sceneContext.toys.indexOf(foundTarget.obj);
            if (idx !== -1) {
              sceneContext.toys.splice(idx, 1);
              soundEngine.playCrunch();
              this.hunger = Math.min(100, this.hunger + 35);
              sceneContext.spawnParticle(this.x, this.y - 25, '❤️🐟');
              this.speak(Math.random() < 0.5 ? '小鱼干超赞！' : '本喵很满意~');
              this.state = 'idle';
              this.stateTimer = 40;
            }
          }
        } else if (foundTarget.type === 'box') {
          // 钻箱子
          if (dist > 20) {
            this.state = 'walking';
            this.vx += (dx / dist) * 0.3;
          } else {
            this.inBox = foundTarget.obj;
            foundTarget.obj.occupant = this;
            this.state = 'in_box';
            soundEngine.playMeow(this.pitchMod, 'chirp');
            sceneContext.spawnParticle(this.x, this.y - 20, '📦✨');
            this.speak('If it fits, I sits 📦');
          }
        } else if (foundTarget.type === 'roomba') {
          // 跳上扫地机
          if (dist < 35 && Math.abs(this.vy) < 2) {
            this.ridingObj = foundTarget.obj;
            foundTarget.obj.rider = this;
            this.state = 'riding';
            soundEngine.playMeow(this.pitchMod, 'pleading');
            sceneContext.spawnParticle(this.x, this.y - 20, '🤖🐱');
            this.speak('扫地机，全速巡航！');
          } else {
            this.vx += (dx / dist) * 0.25;
          }
        } else if (foundTarget.type === 'scratcher') {
          // 磨爪子
          if (dist < 30) {
            this.state = 'scratching';
            if (Math.random() < 0.25) soundEngine.playScratch();
            if (Math.random() < 0.08) sceneContext.spawnParticle(this.x, this.y - 20, '✨');
          } else {
            this.vx += (dx / dist) * 0.3;
          }
        }
        return;
      }

      // 没有具体目标时的自主随机行为
      this.pupilDilation = 0.45;
      if (this.stateTimer <= 0) {
        // 猫咪本能：跳上高处跳台俯瞰全场
        if (Math.random() < 0.28 && sceneContext.furniture && !this.perchedTier) {
          const perches = sceneContext.furniture.filter(f => f.type === 'perch');
          if (perches.length > 0) {
            const targetPerch = perches[Math.floor(Math.random() * perches.length)];
            const dx = targetPerch.x - this.x;
            if (Math.abs(dx) < 280 && this.y > targetPerch.y + 20) {
              this.vy = -Math.sqrt(2 * 0.28 * (this.y - targetPerch.y + 25));
              this.vx = dx * 0.035;
              this.state = 'idle';
              this.speak(Math.random() < 0.5 ? '登高俯瞰领地！' : '高处才配得上朕~');
              soundEngine.playMeow(this.pitchMod * 1.1, 'chirp');
              this.stateTimer = 120;
              return;
            }
          }
        }

        const rand = Math.random();
        if (rand < 0.4) {
          this.state = 'idle';
          this.vx = 0;
          this.stateTimer = 60 + Math.random() * 100;
        } else if (rand < 0.75) {
          this.state = 'walking';
          this.facing = Math.random() < 0.5 ? 1 : -1;
          this.vx = this.facing * (0.8 + Math.random() * 1.2);
          this.stateTimer = 40 + Math.random() * 80;
        } else if (rand < 0.9) {
          // 检查阳光光斑打盹
          const sun = sceneContext.sunbeam;
          if (sun && Math.abs(this.x - sun.x) < sun.width * 0.4) {
            this.state = 'sleeping';
            this.stateTimer = 180 + Math.random() * 200;
            sceneContext.spawnParticle(this.x, this.y - 20, '💤');
            this.speak('阳光好暖和呀~');
          } else {
            this.state = 'idle';
            this.stateTimer = 60;
          }
        } else {
          // 伸懒腰叫一声
          this.state = 'idle';
          soundEngine.playMeow(this.pitchMod, 'chirp');
          const idleQuotes = ['铲屎的开罐头！', '喵呜~', '本喵是液体~', '陪我玩嘛！'];
          this.speak(idleQuotes[Math.floor(Math.random() * idleQuotes.length)]);
          this.stateTimer = 40;
        }
      }
    }

    evaluateSensors(sceneContext) {
      const { laser, featherWand, toys, furniture } = sceneContext;

      // 1. 激光红点 (跑酷狂人或正常猫咪都极度狂热)
      if (laser && laser.active) {
        return { type: 'laser', x: laser.x, y: laser.y };
      }

      // 2. 逗猫棒羽毛
      if (featherWand && featherWand.active) {
        const tip = featherWand.getTip();
        return { type: 'feather', x: tip.x, y: tip.y };
      }

      // 3. 小鱼干 (饥饿或贪吃猫高优先级)
      for (let t of toys) {
        if (t.type === 'fish') {
          const d = Math.hypot(t.x - this.x, t.y - this.y);
          if (d < 500) return { type: 'fish', obj: t, x: t.x, y: t.y };
        }
      }

      // 4. 空纸箱
      for (let f of furniture) {
        if (f.type === 'box' && !f.occupant) {
          const d = Math.hypot(f.x - this.x, f.y - this.y);
          if (d < 300) return { type: 'box', obj: f, x: f.x, y: f.y };
        }
      }

      // 5. 扫地机器人 (好奇猫喜欢跳上去)
      if (this.personality.id === 'CURIOUS' || this.personality.id === 'ZOOMER') {
        for (let f of furniture) {
          if (f.type === 'roomba' && !f.rider) {
            const d = Math.hypot(f.x - this.x, f.y - this.y);
            if (d < 180) return { type: 'roomba', obj: f, x: f.x, y: f.y };
          }
        }
      }

      // 6. 猫抓板
      for (let f of furniture) {
        if (f.type === 'scratcher') {
          const d = Math.hypot(f.x - this.x, f.y - this.y);
          if (d < 140 && Math.random() < 0.3) return { type: 'scratcher', obj: f, x: f.x, y: f.y };
        }
      }

      // 7. 毛线球
      for (let t of toys) {
        if (t.type === 'yarn') {
          const d = Math.hypot(t.x - this.x, t.y - this.y);
          if (d < 220) return { type: 'yarn', obj: t, x: t.x, y: t.y };
        }
      }

      return null;
    }

    // 接收玩家抚摸
    pet(sceneContext) {
      this.purrLevel = Math.min(1.0, this.purrLevel + 0.15);
      this.affection = Math.min(100, this.affection + 2);
      soundEngine.startPurr();

      if (Math.random() < 0.25) {
        sceneContext.spawnParticle(this.x + (Math.random() - 0.5) * 20, this.y - 25, '❤️');
        soundEngine.playMeow(this.pitchMod * 1.2, 'pleading');
        const petQuotes = ['呼噜噜……好舒服~', '继续摸，不要停！', '本喵准你摸肚皮~', '呼噜噜噜……❤️'];
        this.speak(petQuotes[Math.floor(Math.random() * petQuotes.length)]);
      }
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);

      // 纸箱露出萌头
      if (this.inBox) {
        ctx.translate(0, -4);
      }

      // 地面阴影
      if (!physicsWorld.isZeroG() && !this.inBox && !this.ridingObj) {
        ctx.beginPath();
        ctx.ellipse(0, this.radius + 6, this.radius * 0.9, 5, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fill();
      }

      // 绘制物理多节尾巴
      if (!this.inBox) {
        this.tailChain.draw(ctx, this.breed.bodyColor, 6, 2.5);
      }

      // 身体旋转（潜伏摇屁股）
      if (this.state === 'stalking') {
        ctx.rotate(this.buttWiggle * 0.15);
      }

      // 身体躯干绘制
      if (!this.inBox) {
        ctx.save();
        // 睡眠状态身体蜷缩成团
        if (this.state === 'sleeping') {
          ctx.beginPath();
          ctx.ellipse(0, 8, this.radius * 1.1, this.radius * 0.75, 0, 0, Math.PI * 2);
          ctx.fillStyle = this.breed.bodyColor;
          ctx.fill();
        } else {
          // 四肢小肉爪步态与踩奶 (Kneading) 律动
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

          // 身体
          ctx.beginPath();
          ctx.ellipse(0, 4, this.radius, this.radius * 0.85, 0, 0, Math.PI * 2);
          ctx.fillStyle = this.breed.bodyColor;
          ctx.fill();

          // 肚皮白色/黄色毛发
          ctx.beginPath();
          ctx.ellipse(this.facing * 4, 7, this.radius * 0.55, this.radius * 0.52, 0, 0, Math.PI * 2);
          ctx.fillStyle = this.breed.bellyColor;
          ctx.fill();

          // 虎斑纹条纹 (橘猫)
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

      // 头部 (融入蹭脸 headTilt 物理)
      ctx.save();
      const headY = this.inBox ? 0 : (this.state === 'stalking' ? 0 : -8);
      const headR = this.radius * 0.76;
      ctx.translate(0, headY);
      ctx.rotate(this.headTilt);
      ctx.translate(0, -headY);

      // 耳朵绘制
      ctx.fillStyle = this.breed.bodyColor;
      // 左耳
      ctx.beginPath();
      ctx.moveTo(-headR * 0.8, headY - 4);
      ctx.lineTo(-headR * 0.7, headY - headR * 1.4);
      ctx.lineTo(-headR * 0.1, headY - headR * 0.8);
      ctx.closePath();
      ctx.fill();
      // 右耳
      ctx.beginPath();
      ctx.moveTo(headR * 0.1, headY - headR * 0.8);
      ctx.lineTo(headR * 0.7, headY - headR * 1.4);
      ctx.lineTo(headR * 0.8, headY - 4);
      ctx.closePath();
      ctx.fill();

      // 耳蜗粉红
      ctx.fillStyle = this.breed.earColor;
      ctx.beginPath();
      ctx.moveTo(-headR * 0.65, headY - 4);
      ctx.lineTo(-headR * 0.6, headY - headR * 1.2);
      ctx.lineTo(-headR * 0.2, headY - headR * 0.75);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(headR * 0.2, headY - headR * 0.75);
      ctx.lineTo(headR * 0.6, headY - headR * 1.2);
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
        // 开心闭眼 ^ ^
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(eyeLeftX, eyeY, 4, Math.PI, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(eyeRightX, eyeY, 4, Math.PI, 0);
        ctx.stroke();
      } else {
        // 睁眼
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
        const pupilW = MathUtils.lerp(1.5, 4.0, this.pupilDilation);
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

      // 帽子 / 装扮
      this.drawHat(ctx, headY, headR);
      ctx.restore(); // 恢复头部蹭脸旋转变换

      // 名字标签
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.name, 0, headY - headR - 10);

      // 喵语同传气泡 (Speech Bubble)
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
      const padX = 10, padY = 5;
      const bw = textW + padX * 2;
      const bh = 22;
      const bx = -bw / 2;
      const by = bubbleBottomY - bh;

      // 气泡圆角矩形
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, [8]);
      ctx.fill();

      // 小三角指示箭头
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
        // 金色小铃铛项圈
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(-headR * 0.7, headY + headR - 2, headR * 1.4, 3);
        ctx.beginPath();
        ctx.arc(0, headY + headR + 2, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#f1c40f';
        ctx.fill();
      } else if (this.hat === 'bow') {
        // 蝴蝶结
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
        // 派对小彩帽
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
        // 魔法巫师帽
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
