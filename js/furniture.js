/**
 * CyberMeow - 猫生空间家具系统 (Cat-Centric Furniture)
 * 包含：墙面高空跳台 (WallPerch)、景观飞鸟大窗 (WindowSill)、智能扫地机 (Roomba)、多层猫爬架 (CatTree)、瓦楞猫抓板 (Scratcher)、温暖阳光光斑 (Sunbeam)
 */
(function(window) {
  'use strict';

  const { MathUtils, physicsWorld } = window.CyberMeow;
  const FEATHER_COLORS = ['#fd79a8', '#a29bfe', '#ffeaa7'];

  // 帧率无关步长：从 app 已传入的 sceneContext.dt 推导，60fps 时为 1。
  // 上层 dt 已钳制在 1/1000~0.05，这里再限 3 防极端跳变；旧调用不传 scene 时退化为 1，行为不变。
  const frameStep = (scene) => {
    const dt = scene && typeof scene.dt === 'number' && scene.dt > 0 ? scene.dt : 1 / 60;
    return Math.min(dt * 60, 3);
  };

  // 1. 墙面高空跳台 (WallPerch) - 猫咪最爱的高处领地！
  class WallPerch {
    constructor(x, y, w = 120, h = 16) {
      this.type = 'perch';
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.occupant = null;
    }

    getPerchSurfaces() {
      // 复用同一个落脚面对象：几何是静态的，只更新字段，避免每帧为每只猫分配新数组
      if (!this._perchSurfaces) {
        this._perchSurfaces = [{ id: this, x: 0, y: 0, w: 0, h: 0, type: 'perch' }];
      }
      const s = this._perchSurfaces[0];
      s.x = this.x;
      s.y = this.y;
      s.w = this.w;
      s.h = this.h;
      return this._perchSurfaces;
    }

    update(width, height) {
      if (this.occupant && this.occupant.perchedTier !== this) {
        this.occupant = null;
      }
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);

      // 三角支撑架
      ctx.fillStyle = '#8b5a2b';
      ctx.beginPath();
      ctx.moveTo(-this.w * 0.35, this.h);
      ctx.lineTo(-this.w * 0.35, this.h + 24);
      ctx.lineTo(-this.w * 0.15, this.h);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(this.w * 0.35, this.h);
      ctx.lineTo(this.w * 0.35, this.h + 24);
      ctx.lineTo(this.w * 0.15, this.h);
      ctx.closePath();
      ctx.fill();

      // 跳台实木板
      ctx.fillStyle = '#deb887';
      ctx.beginPath();
      ctx.roundRect(-this.w / 2, 0, this.w, this.h, [5]);
      ctx.fill();
      ctx.strokeStyle = '#a0522d';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 柔软绒布软垫
      ctx.fillStyle = '#ffb8b8';
      ctx.beginPath();
      ctx.roundRect(-this.w / 2 + 8, -4, this.w - 16, 5, [3]);
      ctx.fill();

      ctx.restore();
    }
  }

  // 2. 景观大窗台 (WindowSill) - 看飞鸟放空专属
  class WindowSill {
    constructor(x, y, w = 180, h = 140) {
      this.type = 'window';
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.birds = [{ x: -20, y: 30, vx: 1.2, flap: 0, tweetTimer: 180 }];
    }

    getBirdWorldPos() {
      if (this.birds.length === 0) return null;
      const b = this.birds[0];
      return {
        x: this.x - this.w / 2 + b.x,
        y: this.y - this.h / 2 + b.y,
        active: b.x > 0 && b.x < this.w
      };
    }

    update(width, height) {
      // 窗外小鸟飞行模拟
      this.birds.forEach(b => {
        b.x += b.vx;
        b.flap += 0.25;
        if (b.tweetTimer > 0) b.tweetTimer--;
        if (b.tweetTimer <= 0 && b.x > 20 && b.x < this.w - 20) {
          if (window.CyberMeow.soundEngine && Math.random() < 0.4) {
            window.CyberMeow.soundEngine.playBirdTweet();
          }
          b.tweetTimer = 220 + Math.random() * 260;
        }

        if (b.x > this.w + 40) {
          b.x = -40;
          b.y = 20 + Math.random() * (this.h - 50);
          b.vx = 0.8 + Math.random() * 1.0;
        }
      });
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);

      // 窗外天空背景
      ctx.fillStyle = '#81ecec';
      ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);

      // 窗外云朵
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(-20, -20, 22, 0, Math.PI * 2);
      ctx.arc(10, -26, 18, 0, Math.PI * 2);
      ctx.arc(35, -20, 16, 0, Math.PI * 2);
      ctx.fill();

      // 窗外飞过的小鸟 (吸引猫咪注视)
      this.birds.forEach(b => {
        const bx = -this.w / 2 + b.x;
        const by = -this.h / 2 + b.y;
        if (bx >= -this.w / 2 + 5 && bx <= this.w / 2 - 5) {
          ctx.fillStyle = '#2d3436';
          ctx.beginPath();
          ctx.arc(bx, by, 3, 0, Math.PI * 2);
          ctx.fill();
          // 小翅膀扑棱
          const wingY = Math.sin(b.flap) * 4;
          ctx.strokeStyle = '#2d3436';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(bx - 4, by + wingY);
          ctx.lineTo(bx, by);
          ctx.lineTo(bx + 4, by + wingY);
          ctx.stroke();
        }
      });

      // 实木白色窗框
      ctx.strokeStyle = '#dfe4ea';
      ctx.lineWidth = 8;
      ctx.strokeRect(-this.w / 2, -this.h / 2, this.w, this.h);

      // 十字窗格
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -this.h / 2);
      ctx.lineTo(0, this.h / 2);
      ctx.moveTo(-this.w / 2, 0);
      ctx.lineTo(this.w / 2, 0);
      ctx.stroke();

      // 突出窗台 (猫咪可趴卧)
      ctx.fillStyle = '#f1f2f6';
      ctx.fillRect(-this.w / 2 - 12, this.h / 2 - 4, this.w + 24, 12);
      ctx.strokeStyle = '#ced6e0';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-this.w / 2 - 12, this.h / 2 - 4, this.w + 24, 12);

      ctx.restore();
    }
  }

  // 3. 智能扫地机器人 (Roomba)
  class Roomba {
    constructor(x, y) {
      this.type = 'roomba';
      this.x = x;
      this.y = y;
      this.baseVx = 1.4;
      this.vx = this.baseVx;
      this.vy = 0;
      this.radius = 34;
      this.height = 18;
      this.rider = null;
      this.bumpCooldown = 0;
      this.ledPhase = 0;
      // 空降跳杀踢击写入 spin，本类负责消费为机身旋转并在结束后归位
      this.spin = 0;
      this.spinAngle = 0;
    }

    update(width, height, sceneContext) {
      const step = frameStep(sceneContext);
      // 空降跳杀踢击结算：把外部写入的 spin 消费为机身旋转并逐步衰减；
      // 被踢出的超额速度同步回落到基础巡航速度，避免速度/旋转永久残留。
      if (this.spin > 0) {
        this.spinAngle += this.spin * 1.6 * step;
        this.spin *= Math.pow(0.9, step);
        if (this.spin < 0.02) this.spin = 0;
        const dir = Math.sign(this.vx) || 1;
        const excess = Math.abs(this.vx) - this.baseVx;
        if (excess > 0.05) {
          this.vx = dir * (this.baseVx + excess * 0.88);
        } else if (excess > 0) {
          this.vx = dir * this.baseVx;
        }
      } else if (this.spinAngle !== 0) {
        // 旋转特效衰减完毕后走最短路径回正，避免机身永久歪斜
        let a = this.spinAngle % (Math.PI * 2);
        if (a > Math.PI) a -= Math.PI * 2;
        if (a < -Math.PI) a += Math.PI * 2;
        this.spinAngle = Math.abs(a) < 0.01 ? 0 : a * Math.pow(0.85, step);
      }

      const gravity = physicsWorld.getGravity();
      this.vy += gravity * step;

      this.x += this.vx * step;
      this.y += this.vy * step;

      const floor = physicsWorld.getFloorY(height) - this.height / 2;
      if (this.y > floor) {
        this.y = floor;
        this.vy = 0;
      }

      // 撞墙折返
      if (this.bumpCooldown > 0) this.bumpCooldown--;
      if (this.x < this.radius + 15) {
        this.x = this.radius + 15;
        this.vx = Math.abs(this.vx);
        this.bump();
      } else if (this.x > width - this.radius - 15) {
        this.x = width - this.radius - 15;
        this.vx = -Math.abs(this.vx);
        this.bump();
      }

      // 物理推力碰撞：撞击推开挡路的毛线球与纸箱！
      if (sceneContext && sceneContext.toys) {
        for (let t of sceneContext.toys) {
          // 水洼等静态道具不参与物理推撞；过期对象直接跳过
          if (!t || t.type === 'puddle' || (t.isExpired && t.isExpired())) continue;
          const dx = t.x - this.x;
          const dy = t.y - this.y;
          const dist = Math.hypot(dx, dy);
          const radius = Number.isFinite(t.radius) ? t.radius : (Number.isFinite(t.w) ? t.w / 2 : 15);
          const minD = this.radius + radius;
          if (dist < minD && dist > 1) {
            // 将道具弹开推走！
            const pushForce = Math.sign(this.vx) * 3.5;
            t.vx += pushForce;
            t.vy -= 1.8;
            this.bump();
            if (t.type === 'yarn' && window.CyberMeow.soundEngine) {
              window.CyberMeow.soundEngine.playBounce();
            }
          }
        }
      }

      // 乘客猫咪：除双向引用与被抓起状态外，还要清理已从场景移除的猫，避免悬空引用
      if (this.rider) {
        const riderGone = sceneContext && Array.isArray(sceneContext.cats) &&
          sceneContext.cats.indexOf(this.rider) === -1;
        if (this.rider.ridingObj !== this || this.rider.isGrabbed || riderGone) {
          this.rider = null;
        } else {
          this.rider.x = this.x;
          this.rider.y = this.y - this.height - 10;
          this.rider.vx = this.vx;
          this.rider.vy = 0;
        }
      }

      this.ledPhase += 0.05;
    }

    bump() {
      if (this.bumpCooldown === 0) {
        this.bumpCooldown = 20;
        if (window.CyberMeow.soundEngine) {
          window.CyberMeow.soundEngine.playBounce();
        }
      }
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);

      // 阴影
      ctx.beginPath();
      ctx.ellipse(0, 4, this.radius, 10, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fill();

      // 被踢后的机身旋转：阴影保持贴地，仅底盘与上层结构随 spinAngle 转动
      if (this.spinAngle) ctx.rotate(this.spinAngle);

      // 底盘主体
      ctx.beginPath();
      ctx.ellipse(0, 0, this.radius, this.height, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#2f3542';
      ctx.fill();
      ctx.strokeStyle = '#57606f';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 顶盖装饰圈
      ctx.beginPath();
      ctx.ellipse(0, -2, this.radius * 0.72, this.height * 0.72, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1e272e';
      ctx.fill();

      // 激光雷达小凸起
      ctx.beginPath();
      ctx.arc(0, -6, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#485460';
      ctx.fill();

      // 呼吸 LED
      const glow = (Math.sin(this.ledPhase) + 1) * 0.5;
      ctx.beginPath();
      ctx.arc(0, -6, 3, 0, Math.PI * 2);
      ctx.fillStyle = this.rider ? `rgba(46, 213, 115, ${0.4 + glow * 0.6})` : `rgba(30, 144, 255, ${0.4 + glow * 0.6})`;
      ctx.shadowColor = this.rider ? '#2ed573' : '#1e90ff';
      ctx.shadowBlur = 10;
      ctx.fill();

      ctx.restore();
    }
  }

  // 4. 多层豪华猫爬架 (CatTree)
  class CatTree {
    constructor(x, y) {
      this.type = 'cattree';
      this.x = x;
      this.y = y;
      this.width = 130;
      this.tiers = [
        { index: 0, tree: this, yOffset: -110, xOffset: -22, w: 90, h: 14, occupant: null, name: '下层跳台' },
        { index: 1, tree: this, yOffset: -210, xOffset: 22, w: 85, h: 14, occupant: null, name: '顶层王座' }
      ];
      this.dangleBall = {
        x: x + 40,
        y: y - 160,
        vy: 0,
        vx: 0,
        color: '#ff4757',
        radius: 9
      };
    }

    // 拍打摇晃吊球 (Bat Dangle Ball)
    batDangleBall(impulseDir = 1) {
      this.dangleBall.vx = impulseDir * (6.5 + Math.random() * 3);
      this.dangleBall.vy = -3.2;
      if (window.CyberMeow.soundEngine) {
        window.CyberMeow.soundEngine.playPop();
      }
    }

    getTierWorldPos(idx) {
      const t = this.tiers[idx];
      return { x: this.x + t.xOffset, y: this.y + t.yOffset, w: t.w, h: t.h };
    }

    getPerchSurfaces() {
      // 层级数量固定，对象只创建一次；猫数量增多时不再重复分配临时数组
      if (!this._perchSurfaces) {
        this._perchSurfaces = this.tiers.map(t => ({
          id: t, x: 0, y: 0, w: 0, h: 0, type: 'cattree', tier: t, tree: this
        }));
      }
      for (let i = 0; i < this.tiers.length; i++) {
        const t = this.tiers[i];
        const s = this._perchSurfaces[i];
        s.x = this.x + t.xOffset;
        s.y = this.y + t.yOffset;
        s.w = t.w;
        s.h = t.h;
      }
      return this._perchSurfaces;
    }

    update(width, height, sceneContext) {
      const step = frameStep(sceneContext);
      const floor = physicsWorld.getFloorY(height);
      this.y = floor;

      this.tiers.forEach(tier => {
        if (tier.occupant && tier.occupant.perchedTier !== tier) {
          tier.occupant = null;
        }
      });

      // 吊绳小球真实 2D 摆动物理
      this.dangleBall.vx *= Math.pow(0.96, step);
      this.dangleBall.vy += 0.22 * step;
      this.dangleBall.x += this.dangleBall.vx * step;
      this.dangleBall.y += this.dangleBall.vy * step;

      const anchorX = this.x + 40;
      const anchorY = this.y - 200;
      const dx = this.dangleBall.x - anchorX;
      const dy = this.dangleBall.y - anchorY;
      const dist = Math.hypot(dx, dy);
      const ropeLen = 45;
      if (dist > ropeLen) {
        this.dangleBall.x = anchorX + (dx / dist) * ropeLen;
        this.dangleBall.y = anchorY + (dy / dist) * ropeLen;
        this.dangleBall.vx -= (dx / dist) * 0.45;
        this.dangleBall.vy -= (dy / dist) * 0.45;
      }
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);

      // 底座
      ctx.fillStyle = '#d2b48c';
      ctx.fillRect(-this.width / 2, -18, this.width, 18);
      ctx.strokeStyle = '#8b5a2b';
      ctx.strokeRect(-this.width / 2, -18, this.width, 18);

      // 麻绳立柱
      ctx.fillStyle = '#e8d8b8';
      ctx.fillRect(-12, -210, 24, 192);
      ctx.strokeStyle = '#c2a677';
      ctx.lineWidth = 1;
      for (let py = -210; py < -18; py += 8) {
        ctx.beginPath();
        ctx.moveTo(-12, py);
        ctx.lineTo(12, py + 2);
        ctx.stroke();
      }

      // 各层平台
      this.tiers.forEach((tier, idx) => {
        ctx.fillStyle = '#deb887';
        ctx.beginPath();
        ctx.roundRect(tier.xOffset - tier.w / 2, tier.yOffset, tier.w, tier.h, [6]);
        ctx.fill();
        ctx.strokeStyle = '#a0522d';
        ctx.stroke();

        if (idx === 1) {
          ctx.fillStyle = '#ff7675';
          ctx.beginPath();
          ctx.roundRect(tier.xOffset - tier.w / 2 + 6, tier.yOffset - 6, tier.w - 12, 6, [3]);
          ctx.fill();
        }
      });

      // 吊球
      const anchorX = 40;
      const anchorY = -200;
      ctx.strokeStyle = '#f5cd79';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY);
      ctx.lineTo(this.dangleBall.x - this.x, this.dangleBall.y - this.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(this.dangleBall.x - this.x, this.dangleBall.y - this.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = this.dangleBall.color;
      ctx.fill();

      ctx.restore();
    }
  }

  // 5. 瓦楞猫抓板 (Scratcher)
  class Scratcher {
    constructor(x, y) {
      this.type = 'scratcher';
      this.x = x;
      this.y = y;
      this.w = 75;
      this.h = 24;
    }

    update(width, height) {
      this.y = physicsWorld.getFloorY(height);
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);

      ctx.fillStyle = '#c8a06d';
      ctx.fillRect(-this.w / 2, -this.h, this.w, this.h);
      ctx.strokeStyle = '#8b5a2b';
      ctx.strokeRect(-this.w / 2, -this.h, this.w, this.h);

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.lineWidth = 1;
      for (let px = -this.w / 2 + 4; px < this.w / 2; px += 4) {
        ctx.beginPath();
        ctx.moveTo(px, -this.h);
        ctx.lineTo(px, 0);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  // 6. 温暖阳光斑 (Sunbeam)
  class Sunbeam {
    constructor(x, y, w = 190) {
      this.type = 'sunbeam';
      this.baseX = x;
      this.x = x;
      this.y = y;
      this.width = w;
      this.pulse = 0;
      this.driftPhase = 0;
    }

    update(width, height) {
      this.pulse += 0.02;
      this.driftPhase += 0.003;
      // 阳光随白昼慢速横向平移，吸引打盹猫咪追随暖光；缓存 floorY 供 draw 使用
      this.x = this.baseX + Math.sin(this.driftPhase) * 75;
      this.floorY = physicsWorld.getFloorY(height);
    }

    draw(ctx) {
      ctx.save();
      const floorY = Number.isFinite(this.floorY) ? this.floorY : physicsWorld.getFloorY(window.innerHeight);
      const glow = Math.sin(this.pulse) * 0.05 + 0.2;

      // 渐变坐标相对阳光自身，按 floorY 缓存一次即可；呼吸亮度用 globalAlpha 表达
      if (!this._gradient || this._gradientFloorY !== floorY) {
        const grad = ctx.createLinearGradient(-70, 0, 0, floorY);
        grad.addColorStop(0, 'rgba(255, 234, 167, 0.02)');
        grad.addColorStop(0.7, 'rgba(255, 234, 167, 0.25)');
        grad.addColorStop(1, 'rgba(254, 202, 87, 0.35)');
        this._gradient = grad;
        this._gradientFloorY = floorY;
      }

      ctx.translate(this.x, 0);
      ctx.globalAlpha = glow / 0.25;
      ctx.fillStyle = this._gradient;
      ctx.beginPath();
      ctx.moveTo(-80, 0);
      ctx.lineTo(40, 0);
      ctx.lineTo(this.width / 2 + 25, floorY);
      ctx.lineTo(-this.width / 2 - 25, floorY);
      ctx.closePath();
      ctx.fill();

      // 地面温暖光晕
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.ellipse(0, floorY, this.width * 0.55, 12, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 204, 0, ${glow * 0.8})`;
      ctx.fill();

      ctx.restore();
    }
  }

  // 7. 智能自动投喂机 (SmartFeeder) - 全自动奢宠供粮，解决铲屎官喂食烦恼
  class SmartFeeder {
    constructor(x, y) {
      this.type = 'feeder';
      this.x = x;
      this.y = y;
      this.w = 54;
      this.h = 65;
      this.autoTimer = 180;
      this.dispenseAnim = 0;
      this.shakeTimer = 0;
      this.foodBowlLevel = 3;
      this.foodDecayTimer = 0;
    }

    // 接收猫咪猫爪物理拍打 (Cat Paw Tap & Hacker Hack)
    receiveTap(cat, sceneContext) {
      this.shakeTimer = 12;
      this.dispenseAnim = 20;
      if (window.CyberMeow.soundEngine) {
        window.CyberMeow.soundEngine.playPop();
      }
      if (sceneContext && sceneContext.spawnParticle) {
        sceneContext.spawnParticle(this.x + (Math.random() - 0.5) * 16, this.y - 30, '🥣💥');
      }

      // 拍打敲碗有 45% 几率直接物理触发提前掉落美味小鱼干！
      if (Math.random() < 0.45) {
        this.dispense(sceneContext);
        this.autoTimer = 600 + Math.random() * 250;
        return true;
      }
      return false;
    }

    dispense(sceneContext) {
      this.dispenseAnim = 30;
      this.foodBowlLevel = Math.min(6, this.foodBowlLevel + 2);
      if (window.CyberMeow.soundEngine) {
        window.CyberMeow.soundEngine.playCrunch();
      }
      if (sceneContext && sceneContext.toys) {
        const FishTreatClass = window.CyberMeow.FishTreat;
        // 模块加载顺序变化时 FishTreat 可能尚未就绪，避免 new undefined 中断主循环
        if (typeof FishTreatClass !== 'function') return;
        const fish = new FishTreatClass(this.x + 16, this.y - 12);
        fish.vx = 2.2 + Math.random() * 1.5;
        fish.vy = -3.2;
        sceneContext.toys.push(fish);
        if (sceneContext.spawnParticle) {
          sceneContext.spawnParticle(this.x, this.y - 45, '🥣✨');
        }
      }
    }

    update(width, height, sceneContext) {
      if (this.dispenseAnim > 0) this.dispenseAnim--;
      if (this.shakeTimer > 0) this.shakeTimer--;

      // 碗中猫粮随时间被吃掉/风干，避免 foodBowlLevel 只增不减、视觉永远满碗
      if (this.foodBowlLevel > 0) {
        this.foodDecayTimer++;
        if (this.foodDecayTimer >= 150) {
          this.foodDecayTimer = 0;
          this.foodBowlLevel = Math.max(0, this.foodBowlLevel - 1);
        }
      }

      this.autoTimer--;
      // 自动投喂：每隔一段时间或有猫咪想吃点心
      let catNeedsSnack = false;
      if (sceneContext && sceneContext.cats) {
        for (let c of sceneContext.cats) {
          if (c.hunger < 65 && Math.hypot(c.x - this.x, c.y - this.y) < 450) {
            catNeedsSnack = true;
            break;
          }
        }
      }

      if (this.autoTimer <= 0 || (catNeedsSnack && this.autoTimer < 100)) {
        this.dispense(sceneContext);
        this.autoTimer = 550 + Math.random() * 250;
      }
    }

    draw(ctx) {
      ctx.save();
      const shakeX = this.shakeTimer > 0 ? (Math.random() - 0.5) * 3 : 0;
      ctx.translate(this.x + shakeX, this.y);

      // 阴影
      ctx.beginPath();
      ctx.ellipse(0, 4, 30, 7, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fill();

      // 底座食盆
      ctx.fillStyle = '#dfe4ea';
      ctx.beginPath();
      ctx.roundRect(-24, -12, 48, 15, [5]);
      ctx.fill();
      ctx.strokeStyle = '#a4b0be';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 食盆内部
      ctx.fillStyle = '#747d8c';
      ctx.beginPath();
      ctx.ellipse(12, -4, 11, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // 碗里的猫粮小鱼干
      if (this.foodBowlLevel > 0) {
        ctx.fillStyle = '#e67e22';
        for (let i = 0; i < Math.min(4, this.foodBowlLevel); i++) {
          ctx.beginPath();
          ctx.arc(8 + i * 2.5, -5, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 白色主机身
      ctx.fillStyle = '#f1f2f6';
      ctx.beginPath();
      ctx.roundRect(-20, -this.h, 40, this.h - 10, [7]);
      ctx.fill();
      ctx.strokeStyle = '#ced6e0';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 半透明可视储粮仓
      ctx.fillStyle = 'rgba(116, 185, 255, 0.35)';
      ctx.beginPath();
      ctx.roundRect(-15, -this.h + 8, 30, 26, [4]);
      ctx.fill();
      ctx.strokeStyle = 'rgba(9, 132, 227, 0.4)';
      ctx.stroke();

      // 粮仓里金黄的粮食粒
      ctx.fillStyle = '#f39c12';
      for (let rx = -10; rx <= 10; rx += 6) {
        for (let ry = -this.h + 13; ry <= -this.h + 28; ry += 6) {
          ctx.beginPath();
          ctx.arc(rx, ry, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 呼吸指示灯
      const isDispensing = this.dispenseAnim > 0;
      ctx.fillStyle = isDispensing ? '#2ed573' : '#10ac84';
      ctx.shadowColor = '#2ed573';
      ctx.shadowBlur = isDispensing ? 10 : 3;
      ctx.beginPath();
      ctx.arc(0, -this.h + 40, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // 机器品牌 LOGO
      ctx.fillStyle = '#747d8c';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AUTO FEED', 0, -15);

      ctx.restore();
    }
  }

  // 7. 空中猫道悬索桥 (CatSuspensionBridge) - 跨越高空的实木绳索悬索桥，连通高空走廊！
  class CatSuspensionBridge {
    constructor(x, y, w = 280, h = 18) {
      this.type = 'bridge';
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.occupant = null;
      this.plankCount = 11;
      this.sags = new Array(this.plankCount).fill(0);
      this.dynamicSag = 0;
    }

    getPerchSurfaces() {
      if (!this._perchSurfaces) {
        this._perchSurfaces = [{ id: this, x: 0, y: 0, w: 0, h: 0, type: 'bridge' }];
      }
      const s = this._perchSurfaces[0];
      s.x = this.x;
      s.y = this.y + this.dynamicSag; // 桥面随猫咪行走动态下沉
      s.w = this.w;
      s.h = this.h;
      return this._perchSurfaces;
    }

    update(width, height, sceneContext) {
      const step = frameStep(sceneContext);
      // 检查桥上是否有猫行走，并计算局部绳桥下沉形变 (Dynamic Bridge Sag)
      let activeCatOnBridge = null;
      if (sceneContext && sceneContext.cats) {
        for (let cat of sceneContext.cats) {
          if (cat.perchedTier === this) {
            activeCatOnBridge = cat;
            break;
          }
        }
      }

      const halfW = this.w / 2;
      for (let i = 0; i < this.plankCount; i++) {
        const plankX = (this.x - halfW) + (i + 0.5) * (this.w / this.plankCount);
        let targetSag = 0;
        if (activeCatOnBridge) {
          const distToCat = Math.abs(plankX - activeCatOnBridge.x);
          if (distToCat < 55) {
            targetSag = (1 - distToCat / 55) * 7.5;
          }
        }
        this.sags[i] += (targetSag - this.sags[i]) * Math.min(0.2 * step, 1);
        // 无猫时把渐近 0 的浮点尾数直接归零，避免桥面高度长期保留微小偏移
        if (targetSag === 0 && this.sags[i] < 0.05) this.sags[i] = 0;
      }

      if (activeCatOnBridge) {
        const catNorm = Math.abs((activeCatOnBridge.x - this.x) / halfW);
        const centerSag = Math.sin(Math.max(0, 1 - catNorm) * Math.PI) * 6;
        this.dynamicSag += (centerSag - this.dynamicSag) * 0.25;
      } else {
        this.dynamicSag *= 0.85;
        if (this.dynamicSag < 0.05) this.dynamicSag = 0;
      }

      // 桥对决结束后清理可能残留的 occupant 引用（猫可用 perchedTier 或 onBridge 指向桥）
      if (this.occupant && this.occupant.perchedTier !== this && this.occupant.onBridge !== this) {
        this.occupant = null;
      }
    }

    draw(ctx) {
      ctx.save();
      const halfW = this.w / 2;
      const leftX = this.x - halfW;
      const rightX = this.x + halfW;

      // 1. 左右实木锚固端柱与金属滑轮锚
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(leftX - 12, this.y - 20, 12, 36);
      ctx.fillRect(rightX, this.y - 20, 12, 36);
      ctx.fillStyle = '#5c3a1e';
      ctx.fillRect(leftX - 14, this.y - 22, 16, 5);
      ctx.fillRect(rightX - 2, this.y - 22, 16, 5);

      // 金属固定锚环
      ctx.fillStyle = '#b2bec3';
      ctx.beginPath();
      ctx.arc(leftX - 6, this.y - 12, 4, 0, Math.PI * 2);
      ctx.arc(rightX + 6, this.y - 12, 4, 0, Math.PI * 2);
      ctx.fill();

      // 2. 上层麻绳扶手护栏 (Rope Handrail)
      ctx.strokeStyle = '#c2a677';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(leftX, this.y - 18);
      ctx.quadraticCurveTo(this.x, this.y - 10 + this.dynamicSag * 0.8, rightX, this.y - 18);
      ctx.stroke();

      // 3. 悬索主承重绳缆
      ctx.strokeStyle = '#997a48';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(leftX, this.y + 6);
      ctx.quadraticCurveTo(this.x, this.y + 12 + this.dynamicSag, rightX, this.y + 6);
      ctx.stroke();

      // 4. 垂直悬挂吊绳与实木桥板
      const plankW = (this.w / this.plankCount) * 0.88;
      for (let i = 0; i < this.plankCount; i++) {
        const px = leftX + (i + 0.5) * (this.w / this.plankCount);
        const norm = (i + 0.5) / this.plankCount;
        const baseCurve = Math.sin(norm * Math.PI) * 4;
        const py = this.y + baseCurve + this.sags[i];

        // 垂直吊绳
        const topRopeY = (this.y - 18) + (Math.sin(norm * Math.PI) * 8 + this.dynamicSag * 0.8);
        ctx.strokeStyle = '#dfcba4';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, topRopeY);
        ctx.lineTo(px, py);
        ctx.stroke();

        // 独立实木板块
        ctx.save();
        ctx.translate(px, py);
        ctx.fillStyle = i % 2 === 0 ? '#deb887' : '#d2a679';
        ctx.beginPath();
        ctx.roundRect(-plankW / 2, 0, plankW, 8, [2]);
        ctx.fill();
        ctx.strokeStyle = '#8b5a2b';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 防滑绳结 / 凹槽
        ctx.fillStyle = '#a0522d';
        ctx.fillRect(-plankW / 2 + 2, 2, 2, 4);
        ctx.fillRect(plankW / 2 - 4, 2, 2, 4);
        ctx.restore();
      }

      ctx.restore();
    }
  }

  // 8. 空中全景猫吊床 (AerialHammock) - 天花板悬吊双链软榻，尊享高空无敌景观！
  class AerialHammock {
    constructor(x, y, w = 110, h = 32) {
      this.type = 'hammock';
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.swayAngle = 0;
      this.swaySpeed = 0;
      this.occupant = null;
    }

    getPerchSurfaces() {
      if (!this._perchSurfaces) {
        this._perchSurfaces = [{ id: this, x: 0, y: 0, w: 0, h: 0, type: 'hammock' }];
      }
      const s = this._perchSurfaces[0];
      s.x = this.x + Math.sin(this.swayAngle) * 15;
      s.y = this.y;
      s.w = this.w * 0.85;
      s.h = this.h;
      return this._perchSurfaces;
    }

    nudge(impulse = 0.08) {
      this.swaySpeed += impulse;
      if (window.CyberMeow.soundEngine) {
        window.CyberMeow.soundEngine.playPop();
      }
    }

    update(width, height, sceneContext) {
      const step = frameStep(sceneContext);
      // 检查是否有猫躺在吊床里
      let hasCat = false;
      if (sceneContext && sceneContext.cats) {
        for (let cat of sceneContext.cats) {
          if (cat.perchedTier === this) {
            hasCat = true;
            this.occupant = cat;
            break;
          }
        }
      }
      if (!hasCat) this.occupant = null;

      // 吊床摆动阻尼物理
      const gravityRestore = -0.0035 * Math.sin(this.swayAngle);
      this.swaySpeed += gravityRestore * step;
      this.swaySpeed *= Math.pow(0.985, step);
      this.swayAngle += this.swaySpeed * step;

      // 有猫在里面时轻微起伏呼吸感：用帧相位缓慢逼近目标角度，
      // 不直接赋值，避免与上面的弹簧积分相互打断造成视觉跳变
      if (this.occupant && Math.abs(this.swaySpeed) < 0.002) {
        this._breathPhase = (this._breathPhase || 0) + 0.02;
        const target = Math.sin(this._breathPhase) * 0.02;
        this.swayAngle += (target - this.swayAngle) * 0.05;
      }
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.swayAngle);

      const halfW = this.w / 2;

      // 1. 天花板金属吊链 (Brass Suspension Chains)
      ctx.strokeStyle = '#f39c12';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([3, 4]);

      // 从天花板延伸下来的双侧吊链 (以 y = -this.y 为天花板基准)
      const ceilY = -this.y;
      ctx.beginPath();
      ctx.moveTo(-halfW, 0);
      ctx.lineTo(-halfW * 0.7, ceilY);
      ctx.moveTo(halfW, 0);
      ctx.lineTo(halfW * 0.7, ceilY);
      ctx.stroke();
      ctx.setLineDash([]);

      // 天花板金属安装座
      ctx.fillStyle = '#b2bec3';
      ctx.beginPath();
      ctx.arc(-halfW * 0.7, ceilY + 4, 5, 0, Math.PI * 2);
      ctx.arc(halfW * 0.7, ceilY + 4, 5, 0, Math.PI * 2);
      ctx.fill();

      // 2. 吊床弧形帆布兜 (Curved Fabric Sling)
      ctx.fillStyle = '#ffeaa7';
      ctx.beginPath();
      ctx.moveTo(-halfW, 0);
      ctx.bezierCurveTo(-halfW * 0.5, this.h, halfW * 0.5, this.h, halfW, 0);
      ctx.bezierCurveTo(halfW * 0.5, this.h - 6, -halfW * 0.5, this.h - 6, -halfW, 0);
      ctx.fill();
      ctx.strokeStyle = '#fdcb6e';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 3. 蓬松柔软猫咪棉垫 (Plush Cushion)
      ctx.fillStyle = '#fab1a0';
      ctx.beginPath();
      ctx.ellipse(0, this.h * 0.45, halfW * 0.75, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      // 边缘圆球流苏饰品
      ctx.fillStyle = '#ff7675';
      [-halfW * 0.7, -halfW * 0.35, 0, halfW * 0.35, halfW * 0.7].forEach(bx => {
        ctx.beginPath();
        ctx.arc(bx, this.h * 0.75, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // 舒适度小标
      if (this.occupant) {
        ctx.fillStyle = '#ff4757';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('☁️', 0, -18);
      }

      ctx.restore();
    }
  }

  // 9. 阶梯式猫步道 / 爬墙跳板群 (WallClimbLadder) - 连接地面与高空立体网络的踏板！
  class WallClimbLadder {
    constructor(startX, startY, count = 3, dir = 1, stepW = 65, stepH = 14, stepDx = 75, stepDy = -65) {
      this.type = 'ladder';
      this.startX = startX;
      this.startY = startY;
      this.steps = [];
      for (let i = 0; i < count; i++) {
        this.steps.push({
          index: i,
          ladder: this,
          x: startX + i * stepDx * dir,
          y: startY + i * stepDy,
          w: stepW,
          h: stepH,
          occupant: null
        });
      }
    }

    getPerchSurfaces() {
      if (!this._perchSurfaces) {
        this._perchSurfaces = this.steps.map(s => ({
          id: s, x: 0, y: 0, w: 0, h: 0, type: 'ladder', step: s, ladder: this
        }));
      }
      for (let i = 0; i < this.steps.length; i++) {
        const step = this.steps[i];
        const surface = this._perchSurfaces[i];
        surface.x = step.x;
        surface.y = step.y;
        surface.w = step.w;
        surface.h = step.h;
      }
      return this._perchSurfaces;
    }

    update(width, height) {
      this.steps.forEach(s => {
        if (s.occupant && s.occupant.perchedTier !== s) {
          s.occupant = null;
        }
      });
    }

    draw(ctx) {
      ctx.save();
      for (let s of this.steps) {
        ctx.save();
        ctx.translate(s.x, s.y);

        // 墙体斜三角支撑臂
        ctx.fillStyle = '#8b5a2b';
        ctx.beginPath();
        ctx.moveTo(-s.w * 0.25, s.h);
        ctx.lineTo(-s.w * 0.25, s.h + 16);
        ctx.lineTo(s.w * 0.15, s.h);
        ctx.closePath();
        ctx.fill();

        // 原木踏板
        ctx.fillStyle = '#deb887';
        ctx.beginPath();
        ctx.roundRect(-s.w / 2, 0, s.w, s.h, [4]);
        ctx.fill();
        ctx.strokeStyle = '#a0522d';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // 剑麻防滑抓垫 (天然猫抓纹理)
        ctx.fillStyle = '#e5d3b3';
        ctx.beginPath();
        ctx.roundRect(-s.w / 2 + 5, -2, s.w - 10, 4, [2]);
        ctx.fill();

        ctx.restore();
      }
      ctx.restore();
    }
  }

  // 10. 天花板悬吊风铃羽毛球 (CeilingDanglingToy) - 弹力悬垂高空，轻拍悦耳回弹！
  class CeilingDanglingToy {
    constructor(x, restY = 175, color = '#ff7675') {
      this.type = 'ceiling_toy';
      this.x = x;
      this.restY = restY;
      this.y = restY;
      this.vy = 0;
      this.vx = 0;
      this.offsetX = 0;
      this.color = color;
      this.radius = 12;
      this.flutterPhase = Math.random() * Math.PI * 2;
    }

    batToy(impulseX = 4, impulseY = -5) {
      this.vx += impulseX;
      this.vy += impulseY;
      if (window.CyberMeow.soundEngine && window.CyberMeow.soundEngine.playBell) {
        window.CyberMeow.soundEngine.playBell();
      }
    }

    update(width, height, sceneContext) {
      const step = frameStep(sceneContext);
      // 弹力绳谐振与重力阻尼 (Harmonic Spring Physics)
      const k = 0.035; // 弹簧系数
      const damping = 0.95;
      const dy = this.y - this.restY;
      const forceY = -k * dy;
      this.vy += forceY * step;
      this.vy *= Math.pow(damping, step);
      this.y += this.vy * step;

      // 水平摆动阻尼
      this.offsetX += this.vx * step;
      this.vx -= this.offsetX * 0.04 * step;
      this.vx *= Math.pow(0.95, step);

      this.flutterPhase += 0.08 * step;
    }

    draw(ctx) {
      ctx.save();
      const currentX = this.x + this.offsetX;

      // 1. 天花板弹性细绳
      ctx.strokeStyle = '#bdc3c7';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(this.x, 0); // 从天花板 y=0 延伸
      ctx.lineTo(currentX, this.y - 12);
      ctx.stroke();
      ctx.setLineDash([]);

      // 天花板固定座
      ctx.fillStyle = '#7f8c8d';
      ctx.beginPath();
      ctx.arc(this.x, 2, 4, 0, Math.PI * 2);
      ctx.fill();

      // 2. 闪亮金色小铜铃 (Golden Bell)
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(currentX, this.y - 10, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d4ac0d';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 3. 蓬松绒球与飘逸彩色羽毛 (Fluffy Pom-Pom & Feather)
      ctx.save();
      ctx.translate(currentX, this.y);
      const flutter = Math.sin(this.flutterPhase) * 0.25;
      ctx.rotate(flutter + this.offsetX * 0.02);

      // 主色绒球
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();

      // 绒球高光
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.arc(-3, -3, 4, 0, Math.PI * 2);
      ctx.fill();

      // 飘逸羽毛束
      FEATHER_COLORS.forEach((fc, idx) => {
        ctx.fillStyle = fc;
        ctx.beginPath();
        const angle = 0.5 + idx * 0.5 + flutter * 0.5;
        const fx = Math.cos(angle) * 14;
        const fy = 10 + Math.sin(angle) * 12;
        ctx.ellipse(fx, fy, 4, 12, angle, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
      ctx.restore();
    }
  }

  window.CyberMeow = window.CyberMeow || {};
  window.CyberMeow.WallPerch = WallPerch;
  window.CyberMeow.WindowSill = WindowSill;
  window.CyberMeow.Roomba = Roomba;
  window.CyberMeow.CatTree = CatTree;
  window.CyberMeow.Scratcher = Scratcher;
  window.CyberMeow.Sunbeam = Sunbeam;
  window.CyberMeow.SmartFeeder = SmartFeeder;
  window.CyberMeow.CatSuspensionBridge = CatSuspensionBridge;
  window.CyberMeow.AerialHammock = AerialHammock;
  window.CyberMeow.WallClimbLadder = WallClimbLadder;
  window.CyberMeow.CeilingDanglingToy = CeilingDanglingToy;
})(window);
