/**
 * CyberMeow - 家具与环境设施系统
 * 包含：智能扫地机 (Roomba)、多层猫爬架 (Cat Tree)、猫抓板 (Scratcher)、纸箱 (Box)、温暖阳光斑 (Sunbeam)
 */
(function(window) {
  'use strict';

  const { MathUtils, physicsWorld } = window.CyberMeow;

  // 1. 智能扫地机器人 (Roomba)
  class Roomba {
    constructor(x, y) {
      this.type = 'roomba';
      this.x = x;
      this.y = y;
      this.vx = 1.4;
      this.vy = 0;
      this.radius = 32;
      this.height = 16;
      this.rider = null; // 坐在上面的猫咪
      this.bumpCooldown = 0;
      this.ledPhase = 0;
    }

    update(width, height) {
      const gravity = physicsWorld.getGravity();
      this.vy += gravity;

      this.x += this.vx;
      this.y += this.vy;

      const floor = height - this.height;
      if (this.y > floor) {
        this.y = floor;
        this.vy = 0;
      }

      // 撞墙折返
      if (this.bumpCooldown > 0) this.bumpCooldown--;
      if (this.x < this.radius + 10) {
        this.x = this.radius + 10;
        this.vx = Math.abs(this.vx);
        this.bump();
      } else if (this.x > width - this.radius - 10) {
        this.x = width - this.radius - 10;
        this.vx = -Math.abs(this.vx);
        this.bump();
      }

      // 检查乘客猫咪
      if (this.rider) {
        if (this.rider.ridingObj !== this || this.rider.isGrabbed) {
          this.rider = null;
        } else {
          this.rider.x = this.x;
          this.rider.y = this.y - this.height - 12;
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

      // 激光雷达小圆凸起
      ctx.beginPath();
      ctx.arc(0, -6, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#485460';
      ctx.fill();

      // 呼吸 LED 灯
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

  // 2. 多层豪华猫爬架 (Cat Tree)
  class CatTree {
    constructor(x, y) {
      this.type = 'cattree';
      this.x = x;
      this.y = y; // 底座坐标
      this.width = 120;
      this.tiers = [
        { yOffset: -120, xOffset: -20, w: 90, h: 14, occupant: null }, // 中层平台
        { yOffset: -240, xOffset: 20, w: 80, h: 14, occupant: null }   // 顶层观景台
      ];
      // 吊绳毛球
      this.dangleBall = {
        x: x + 40,
        y: y - 180,
        vy: 0,
        vx: 0,
        color: '#ff4757'
      };
    }

    update(width, height) {
      // 检查各层占用者
      this.tiers.forEach(tier => {
        if (tier.occupant) {
          if (tier.occupant.perchedTier !== tier) {
            tier.occupant = null;
          }
        }
      });

      // 摇晃吊绳毛球
      this.dangleBall.vx *= 0.95;
      this.dangleBall.vy += 0.15;
      this.dangleBall.y += this.dangleBall.vy;
      const anchorY = this.y - 230;
      const ropeLen = 50;
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

      // 立柱 (缠绕麻绳纹理)
      ctx.fillStyle = '#e8d8b8';
      ctx.fillRect(-12, -240, 24, 222);
      ctx.strokeStyle = '#c2a677';
      ctx.lineWidth = 1;
      for (let py = -240; py < -18; py += 8) {
        ctx.beginPath();
        ctx.moveTo(-12, py);
        ctx.lineTo(12, py + 2);
        ctx.stroke();
      }

      // 绘制各层平台
      this.tiers.forEach((tier, idx) => {
        ctx.fillStyle = '#deb887';
        ctx.beginPath();
        ctx.roundRect(tier.xOffset - tier.w / 2, tier.yOffset, tier.w, tier.h, [6]);
        ctx.fill();
        ctx.strokeStyle = '#a0522d';
        ctx.stroke();

        // 顶层软垫
        if (idx === 1) {
          ctx.fillStyle = '#ff7675';
          ctx.beginPath();
          ctx.roundRect(tier.xOffset - tier.w / 2 + 6, tier.yOffset - 6, tier.w - 12, 6, [3]);
          ctx.fill();
        }
      });

      // 吊绳与小球
      const anchorX = 40;
      const anchorY = -230;
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

  // 3. 瓦楞纸猫抓板 (Scratching Post)
  class Scratcher {
    constructor(x, y) {
      this.type = 'scratcher';
      this.x = x;
      this.y = y;
      this.w = 70;
      this.h = 24;
      this.user = null;
    }

    update(width, height) {
      this.y = height - 8;
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);

      // 瓦楞纸横截面
      ctx.fillStyle = '#c8a06d';
      ctx.fillRect(-this.w / 2, -this.h, this.w, this.h);
      ctx.strokeStyle = '#8b5a2b';
      ctx.strokeRect(-this.w / 2, -this.h, this.w, this.h);

      // 瓦楞细密纹理
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
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

  // 4. 温暖阳光斑 (Sunbeam)
  class Sunbeam {
    constructor(x, y, w = 180) {
      this.type = 'sunbeam';
      this.x = x;
      this.y = y;
      this.width = w;
      this.pulse = 0;
    }

    update(width, height) {
      this.pulse += 0.02;
    }

    draw(ctx, height) {
      ctx.save();
      const glow = Math.sin(this.pulse) * 0.05 + 0.18;

      // 阳光光锥渐变
      const grad = ctx.createLinearGradient(this.x - 60, 0, this.x, height);
      grad.addColorStop(0, 'rgba(255, 234, 167, 0.02)');
      grad.addColorStop(0.7, `rgba(255, 234, 167, ${glow})`);
      grad.addColorStop(1, `rgba(254, 202, 87, ${glow + 0.08})`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(this.x - 80, 0);
      ctx.lineTo(this.x + 40, 0);
      ctx.lineTo(this.x + this.width / 2 + 30, height - 8);
      ctx.lineTo(this.x - this.width / 2 - 30, height - 8);
      ctx.closePath();
      ctx.fill();

      // 地面温暖光晕
      ctx.beginPath();
      ctx.ellipse(this.x, height - 8, this.width * 0.6, 14, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 204, 0, ${glow * 0.8})`;
      ctx.fill();

      ctx.restore();
    }
  }

  window.CyberMeow = window.CyberMeow || {};
  window.CyberMeow.Roomba = Roomba;
  window.CyberMeow.CatTree = CatTree;
  window.CyberMeow.Scratcher = Scratcher;
  window.CyberMeow.Sunbeam = Sunbeam;
})(window);
