/**
 * CyberMeow - 猫生空间家具系统 (Cat-Centric Furniture)
 * 包含：墙面高空跳台 (WallPerch)、景观飞鸟大窗 (WindowSill)、智能扫地机 (Roomba)、多层猫爬架 (CatTree)、瓦楞猫抓板 (Scratcher)、温暖阳光光斑 (Sunbeam)
 */
(function(window) {
  'use strict';

  const { MathUtils, physicsWorld } = window.CyberMeow;

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
      this.vx = 1.4;
      this.vy = 0;
      this.radius = 34;
      this.height = 18;
      this.rider = null;
      this.bumpCooldown = 0;
      this.ledPhase = 0;
    }

    update(width, height, sceneContext) {
      const gravity = physicsWorld.getGravity();
      this.vy += gravity;

      this.x += this.vx;
      this.y += this.vy;

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
          const dx = t.x - this.x;
          const dy = t.y - this.y;
          const dist = Math.hypot(dx, dy);
          const minD = this.radius + (t.radius || t.w / 2 || 15);
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

      // 乘客猫咪
      if (this.rider) {
        if (this.rider.ridingObj !== this || this.rider.isGrabbed) {
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
        { yOffset: -110, xOffset: -22, w: 90, h: 14, occupant: null },
        { yOffset: -210, xOffset: 22, w: 85, h: 14, occupant: null }
      ];
      this.dangleBall = {
        x: x + 40,
        y: y - 160,
        vy: 0,
        vx: 0,
        color: '#ff4757'
      };
    }

    update(width, height) {
      const floor = physicsWorld.getFloorY(height);
      this.y = floor;

      this.tiers.forEach(tier => {
        if (tier.occupant && tier.occupant.perchedTier !== tier) {
          tier.occupant = null;
        }
      });

      // 吊绳小球晃动
      this.dangleBall.vx *= 0.95;
      this.dangleBall.vy += 0.15;
      this.dangleBall.y += this.dangleBall.vy;
      const anchorY = this.y - 200;
      const ropeLen = 45;
      if (this.dangleBall.y > anchorY + ropeLen) {
        this.dangleBall.y = anchorY + ropeLen;
        this.dangleBall.vy = -this.dangleBall.vy * 0.5;
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
      // 阳光随白昼慢速横向平移，吸引打盹猫咪追随暖光
      this.x = this.baseX + Math.sin(this.driftPhase) * 75;
    }

    draw(ctx, height) {
      ctx.save();
      const floorY = physicsWorld.getFloorY(height);
      const glow = Math.sin(this.pulse) * 0.05 + 0.2;

      const grad = ctx.createLinearGradient(this.x - 70, 0, this.x, floorY);
      grad.addColorStop(0, 'rgba(255, 234, 167, 0.02)');
      grad.addColorStop(0.7, `rgba(255, 234, 167, ${glow})`);
      grad.addColorStop(1, `rgba(254, 202, 87, ${glow + 0.1})`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(this.x - 80, 0);
      ctx.lineTo(this.x + 40, 0);
      ctx.lineTo(this.x + this.width / 2 + 25, floorY);
      ctx.lineTo(this.x - this.width / 2 - 25, floorY);
      ctx.closePath();
      ctx.fill();

      // 地面温暖光晕
      ctx.beginPath();
      ctx.ellipse(this.x, floorY, this.width * 0.55, 12, 0, 0, Math.PI * 2);
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
      this.foodBowlLevel = 3;
    }

    dispense(sceneContext) {
      this.dispenseAnim = 30;
      this.foodBowlLevel = Math.min(6, this.foodBowlLevel + 2);
      if (window.CyberMeow.soundEngine) {
        window.CyberMeow.soundEngine.playCrunch();
      }
      if (sceneContext && sceneContext.toys) {
        const FishTreatClass = window.CyberMeow.FishTreat;
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
      ctx.translate(this.x, this.y);

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

  window.CyberMeow = window.CyberMeow || {};
  window.CyberMeow.WallPerch = WallPerch;
  window.CyberMeow.WindowSill = WindowSill;
  window.CyberMeow.Roomba = Roomba;
  window.CyberMeow.CatTree = CatTree;
  window.CyberMeow.Scratcher = Scratcher;
  window.CyberMeow.Sunbeam = Sunbeam;
  window.CyberMeow.SmartFeeder = SmartFeeder;
})(window);
