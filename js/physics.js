/**
 * CyberMeow - 物理计算、Verlet 绳索与向量数学库
 */
(function(window) {
  'use strict';

  const MathUtils = {
    clamp(val, min, max) {
      return Math.max(min, Math.min(max, val));
    },
    lerp(a, b, t) {
      return a + (b - a) * t;
    },
    dist(x1, y1, x2, y2) {
      return Math.hypot(x2 - x1, y2 - y1);
    },
    angle(x1, y1, x2, y2) {
      return Math.atan2(y2 - y1, x2 - x1);
    },
    randomRange(min, max) {
      return min + Math.random() * (max - min);
    }
  };

  // Verlet 物理链（用于拟真猫尾摇摆、逗猫棒绳索）
  class VerletChain {
    constructor(startX, startY, segmentCount, segmentLength) {
      this.segmentCount = segmentCount;
      this.segmentLength = segmentLength;
      this.points = [];
      for (let i = 0; i < segmentCount; i++) {
        this.points.push({
          x: startX,
          y: startY + i * segmentLength,
          oldX: startX,
          oldY: startY + i * segmentLength
        });
      }
    }

    update(rootX, rootY, gravityY = 0.08, airResistance = 0.94, step = 1) {
      // 锚定根节点
      this.points[0].x = rootX;
      this.points[0].y = rootY;

      // Verlet 积分计算其他节点：阻尼按 step 次幂，加速度作用于位移需 step²
      const damp = Math.pow(airResistance, step);
      const accel = gravityY * step * step;
      for (let i = 1; i < this.points.length; i++) {
        const p = this.points[i];
        const vx = (p.x - p.oldX) * damp;
        const vy = (p.y - p.oldY) * damp + accel;
        p.oldX = p.x;
        p.oldY = p.y;
        p.x += vx;
        p.y += vy;
      }

      // 距离约束松弛迭代 (2次迭代足以平滑)
      for (let iter = 0; iter < 3; iter++) {
        this.points[0].x = rootX;
        this.points[0].y = rootY;
        for (let i = 0; i < this.points.length - 1; i++) {
          const p1 = this.points[i];
          const p2 = this.points[i + 1];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.hypot(dx, dy) || 0.001;
          const diff = (dist - this.segmentLength) / dist;
          if (i === 0) {
            p2.x -= dx * diff;
            p2.y -= dy * diff;
          } else {
            p1.x += dx * diff * 0.5;
            p1.y += dy * diff * 0.5;
            p2.x -= dx * diff * 0.5;
            p2.y -= dy * diff * 0.5;
          }
        }
      }
    }

    draw(ctx, color, widthStart = 7, widthEnd = 3) {
      if (this.points.length < 2) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 0; i < this.points.length - 1; i++) {
        const p1 = this.points[i];
        const p2 = this.points[i + 1];
        const progress = i / (this.points.length - 1);
        ctx.lineWidth = MathUtils.lerp(widthStart, widthEnd, progress);
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // 物理环境控制
  class PhysicsWorld {
    constructor() {
      this.gravityMode = 'earth'; // 'earth', 'moon', 'jupiter', 'antigravity'
      this.gravityValues = {
        earth: 0.28,
        moon: 0.07,
        jupiter: 0.65,
        antigravity: -0.06
      };
      this.groundFriction = 0.86;
      this.airResistance = 0.985;
      this.elasticity = 0.45;
    }

    getGravity() {
      return this.gravityValues[this.gravityMode] || 0.28;
    }

    getFloorY(height) {
      // 底部留出 130px 物理安全区，与 Dock 彻底隔离，确保玩家能轻松点击、抚摸地面的猫咪
      return height - 130;
    }

    isZeroG() {
      return this.gravityMode === 'antigravity';
    }
  }

  window.CyberMeow = window.CyberMeow || {};
  window.CyberMeow.MathUtils = MathUtils;
  window.CyberMeow.VerletChain = VerletChain;
  window.CyberMeow.physicsWorld = new PhysicsWorld();
})(window);
