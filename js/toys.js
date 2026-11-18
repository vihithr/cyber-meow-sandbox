/**
 * CyberMeow - 玩具与道具系统
 * 包含：羽毛逗猫棒 (Feather Wand)、毛线球 (Yarn)、小鱼干 (Fish)、纸箱 (Box)、激光笔 (Laser)、猫薄荷 (Catnip)
 */
(function(window) {
  'use strict';

  const { MathUtils, VerletChain, physicsWorld } = window.CyberMeow;

  // 1. 弹性毛线球 (带解体散线与缠绕物理)
  class YarnBall {
    constructor(x, y, customRadius = 16, customColor = null) {
      this.type = 'yarn';
      this.x = x;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 5;
      this.vy = -3.5;
      this.radius = customRadius;
      this.initialRadius = customRadius;
      this.rotation = 0;
      this.vRot = (Math.random() - 0.5) * 0.2;
      this.color = customColor || ['#ff4757', '#2ed573', '#1e90ff', '#ffa502', '#9b59b6', '#ff6b81'][Math.floor(Math.random() * 6)];
      this.trail = [];
      this.looseThreads = []; // 散落在地面上的毛线节段
      this.dropThreadCooldown = 0;
    }

    update(width, height) {
      const gravity = physicsWorld.getGravity();
      this.vy += gravity;

      this.vx *= physicsWorld.isZeroG() ? 0.99 : 0.985;
      this.vy *= physicsWorld.isZeroG() ? 0.99 : 0.99;

      this.x += this.vx;
      this.y += this.vy;
      this.rotation += this.vx * 0.08;

      // 拖尾记录
      if (Math.hypot(this.vx, this.vy) > 0.4) {
        this.trail.unshift({ x: this.x, y: this.y, alpha: 0.6 });
        if (this.trail.length > 14) this.trail.pop();
      }

      // 快速滚动时在地面留下散落的毛线段 (解体感)
      if (this.dropThreadCooldown > 0) this.dropThreadCooldown--;
      if (Math.abs(this.vx) > 2.5 && this.dropThreadCooldown === 0 && this.radius > 10) {
        this.looseThreads.push({
          x: this.x,
          y: this.y + this.radius - 2,
          w: 12 + Math.random() * 16,
          h: (Math.random() - 0.5) * 8
        });
        if (this.looseThreads.length > 12) this.looseThreads.shift();
        this.radius = Math.max(10, this.radius - 0.15); // 轻微缩减
        this.dropThreadCooldown = 25;
      }

      // 地面与边界碰撞
      const floor = physicsWorld.getFloorY(height) - this.radius;
      if (this.y > floor) {
        this.y = floor;
        this.vy = -this.vy * 0.65;
        this.vx *= physicsWorld.groundFriction;
        if (Math.abs(this.vy) < 0.2) this.vy = 0;
      }
      if (this.x < this.radius + 6) {
        this.x = this.radius + 6;
        this.vx = -this.vx * 0.7;
      }
      if (this.x > width - this.radius - 6) {
        this.x = width - this.radius - 6;
        this.vx = -this.vx * 0.7;
      }
    }

    draw(ctx) {
      ctx.save();

      // 绘制散落在地上的毛线段
      if (this.looseThreads.length > 0) {
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        this.looseThreads.forEach(t => {
          ctx.beginPath();
          ctx.moveTo(t.x, t.y);
          ctx.quadraticCurveTo(t.x + t.w * 0.5, t.y + t.h, t.x + t.w, t.y);
          ctx.stroke();
        });
      }

      // 运动毛线拖尾
      if (this.trail.length > 1) {
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(this.trail[0].x, this.trail[0].y);
        for (let i = 1; i < this.trail.length; i++) {
          ctx.globalAlpha = (1 - i / this.trail.length) * 0.5;
          ctx.lineTo(this.trail[i].x, this.trail[i].y);
        }
        ctx.stroke();
      }

      ctx.globalAlpha = 1.0;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);

      // 球体
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();

      // 缠绕线纹
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(-3, -3, this.radius * 0.7, 0.2, Math.PI * 1.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(3, 3, this.radius * 0.6, Math.PI * 0.7, Math.PI * 1.9);
      ctx.stroke();

      ctx.restore();
    }
  }

  // 2. 小鱼干 / 猫零食
  class FishTreat {
    constructor(x, y) {
      this.type = 'fish';
      this.x = x;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 4;
      this.vy = -3;
      this.rotation = (Math.random() - 0.5) * 1.5;
      this.radius = 12;
    }

    update(width, height) {
      const gravity = physicsWorld.getGravity();
      this.vy += gravity;

      this.vx *= physicsWorld.isZeroG() ? 0.99 : 0.96;
      this.vy *= physicsWorld.isZeroG() ? 0.99 : 0.98;

      this.x += this.vx;
      this.y += this.vy;

      const floor = physicsWorld.getFloorY(height) - 8;
      if (this.y > floor) {
        this.y = floor;
        this.vy = -this.vy * 0.3;
        this.vx *= 0.7;
      }
      if (this.x < 15) { this.x = 15; this.vx = -this.vx * 0.5; }
      if (this.x > width - 15) { this.x = width - 15; this.vx = -this.vx * 0.5; }
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🐟', 0, 0);
      ctx.restore();
    }
  }

  // 3. 经典纸箱 (Cardboard Box - 支持胖猫卡屁股与猫猫装甲车)
  class CardboardBox {
    constructor(x, y) {
      this.type = 'box';
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.w = 58;
      this.h = 38;
      this.occupant = null;
      this.wigglePhase = 0;
      this.isArmoredTank = false;
      this.tankTimer = 0;
      this.scratches = [
        { x: -14, y: -4, len: 10, ang: 0.3 },
        { x: -10, y: -2, len: 12, ang: 0.4 },
        { x: 12, y: 6, len: 9, ang: -0.2 }
      ];
    }

    triggerArmoredTank(dir = 1) {
      this.isArmoredTank = true;
      this.tankTimer = 90;
      this.vx = dir * 4.5;
      if (window.CyberMeow.soundEngine) {
        window.CyberMeow.soundEngine.playMeow(1.2, 'chatter');
      }
    }

    update(width, height) {
      const gravity = physicsWorld.getGravity();
      this.vy += gravity;

      if (this.isArmoredTank) {
        this.tankTimer--;
        this.wigglePhase += 0.4;
        if (this.tankTimer <= 0) {
          this.isArmoredTank = false;
        }
      } else {
        this.wigglePhase = 0;
      }

      this.vx *= this.isArmoredTank ? 0.96 : 0.88;
      this.vy *= 0.98;

      this.x += this.vx;
      this.y += this.vy;

      const floor = physicsWorld.getFloorY(height) - this.h / 2;
      if (this.y > floor) {
        this.y = floor;
        this.vy = 0;
      }
      if (this.x < this.w / 2 + 10) {
        this.x = this.w / 2 + 10;
        this.vx = -this.vx * 0.8;
      }
      if (this.x > width - this.w / 2 - 10) {
        this.x = width - this.w / 2 - 10;
        this.vx = -this.vx * 0.8;
      }

      // 验证在箱子里的猫咪是否依然有效
      if (this.occupant && this.occupant.inBox !== this) {
        this.occupant = null;
      }
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);

      // 装甲车开动时纸箱轻微颠簸
      if (this.isArmoredTank) {
        ctx.rotate(Math.sin(this.wigglePhase) * 0.08);
      }

      // 纸箱底色
      ctx.fillStyle = '#b7791f';
      ctx.beginPath();
      ctx.roundRect(-this.w / 2, -this.h / 2, this.w, this.h, [4]);
      ctx.fill();

      // 边框折痕
      ctx.strokeStyle = '#8c5011';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 猫咪抓咬抓痕
      ctx.strokeStyle = 'rgba(74, 44, 15, 0.55)';
      ctx.lineWidth = 1.2;
      this.scratches.forEach(s => {
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + Math.cos(s.ang) * s.len, s.y + Math.sin(s.ang) * s.len);
        ctx.stroke();
      });

      // 纸箱封口缝隙
      ctx.strokeStyle = '#8c5011';
      ctx.beginPath();
      ctx.moveTo(-this.w / 2, 0);
      ctx.lineTo(this.w / 2, 0);
      ctx.stroke();

      // 文字
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.isArmoredTank ? '🚀 TANK BOX' : '📦 AMAZON', 0, 12);

      ctx.restore();
    }
  }

  // 4. 动态羽毛逗猫棒 (Feather Wand)
  class FeatherWand {
    constructor() {
      this.chain = new VerletChain(0, 0, 8, 12);
      this.active = false;
      this.targetX = 0;
      this.targetY = 0;
      this.colors = ['#ff4757', '#ffa502', '#2ed573'];
    }

    update(mouseX, mouseY) {
      if (!this.active) return;
      this.targetX = mouseX;
      this.targetY = mouseY;
      this.chain.update(mouseX, mouseY, 0.25, 0.91);
    }

    getTip() {
      const tip = this.chain.points[this.chain.points.length - 1];
      return { x: tip.x, y: tip.y };
    }

    draw(ctx) {
      if (!this.active) return;
      ctx.save();

      // 绘制竿子
      ctx.strokeStyle = '#dfe4ea';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(this.targetX + 40, this.targetY - 50);
      ctx.lineTo(this.targetX, this.targetY);
      ctx.stroke();

      // 绘制细绳
      ctx.strokeStyle = '#f1f2f6';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(this.chain.points[0].x, this.chain.points[0].y);
      for (let i = 1; i < this.chain.points.length; i++) {
        ctx.lineTo(this.chain.points[i].x, this.chain.points[i].y);
      }
      ctx.stroke();

      // 绘制羽毛末梢
      const tip = this.getTip();
      const prev = this.chain.points[this.chain.points.length - 2];
      const angle = Math.atan2(tip.y - prev.y, tip.x - prev.x);

      ctx.translate(tip.x, tip.y);
      ctx.rotate(angle);

      // 三片彩色羽毛
      this.colors.forEach((col, idx) => {
        ctx.save();
        ctx.rotate((idx - 1) * 0.4);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(12, 0, 16, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 铃铛
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fed330';
      ctx.fill();

      ctx.restore();
    }
  }

  window.CyberMeow = window.CyberMeow || {};
  window.CyberMeow.YarnBall = YarnBall;
  window.CyberMeow.FishTreat = FishTreat;
  window.CyberMeow.CardboardBox = CardboardBox;
  window.CyberMeow.featherWand = new FeatherWand();
})(window);
