/**
 * CyberMeow - 环境、日夜与天气粒子系统
 */
(function(window) {
  'use strict';

  const { MathUtils, physicsWorld } = window.CyberMeow;

  class EnvironmentSystem {
    constructor() {
      this.theme = 'cozy_night'; // 'cozy_night', 'sunny_day', 'cyber_neon'
      this.weather = 'clear'; // 'clear', 'rain', 'fireflies'
      this.dustParticles = [];
      this.rainDrops = [];
      this.sunbeamX = 300;
      this.timeOfDay = 0.7; // 0.0 - 1.0
      // 赛博飞鸟 / 窗外蜂鸟 (供猫咪视线追踪与 Ek-ek 齿颤)
      this.bird = {
        active: true,
        x: -40,
        y: 110,
        vx: 2.2,
        wingPhase: 0,
        spawnCooldown: 60
      };
      // 凌晨三点狂飙暴走状态
      this.midnightZoomies = false;
      this.zoomiesTimer = 0;
      // 背景与灯光渐变缓存：仅在主题或视口尺寸变化时重建，避免每帧创建 CanvasGradient
      this._bgCache = { key: '', gradient: null, glows: null };
      this.initParticles(60);
    }

    initParticles(count) {
      this.dustParticles = [];
      for (let i = 0; i < count; i++) {
        this.dustParticles.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          radius: 1 + Math.random() * 2,
          alpha: 0.1 + Math.random() * 0.4,
          vx: (Math.random() - 0.5) * 0.3,
          vy: -0.2 - Math.random() * 0.3
        });
      }
    }

    setTheme(theme) {
      this.theme = theme;
    }

    toggleWeather() {
      const weathers = ['clear', 'rain', 'fireflies'];
      const nextIdx = (weathers.indexOf(this.weather) + 1) % weathers.length;
      this.weather = weathers[nextIdx];
      return this.weather;
    }

    getBird() {
      return (this.bird && this.bird.active) ? this.bird : null;
    }

    triggerMidnightZoomies() {
      this.midnightZoomies = true;
      this.zoomiesTimer = 480; // 8 秒暴走
    }

    update(width, height) {
      // 粒子更新
      this.dustParticles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < 0) p.y = height;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
      });

      // 窗外赛博小鸟飞掠逻辑
      if (this.bird.active) {
        this.bird.x += this.bird.vx;
        this.bird.wingPhase += 0.35;
        this.bird.y = 80 + Math.sin(this.bird.x * 0.008) * 35;
        if (this.bird.x > width + 60) {
          this.bird.active = false;
          this.bird.spawnCooldown = 300 + Math.floor(Math.random() * 400);
        }
      } else {
        if (this.bird.spawnCooldown > 0) {
          this.bird.spawnCooldown--;
        } else {
          this.bird.active = true;
          this.bird.x = -50;
          this.bird.y = 70 + Math.random() * 60;
          this.bird.vx = 2.0 + Math.random() * 1.5;
        }
      }

      // 凌晨暴走倒计时
      if (this.midnightZoomies) {
        this.zoomiesTimer--;
        if (this.zoomiesTimer <= 0) {
          this.midnightZoomies = false;
        }
      }

      // 雨滴更新
      if (this.weather === 'rain') {
        if (this.rainDrops.length < 80) {
          this.rainDrops.push({
            x: Math.random() * width,
            y: -10,
            vy: 12 + Math.random() * 6,
            len: 14 + Math.random() * 10
          });
        }
        for (let i = this.rainDrops.length - 1; i >= 0; i--) {
          const r = this.rainDrops[i];
          r.y += r.vy;
          if (r.y > height) {
            this.rainDrops.splice(i, 1);
          }
        }
      } else {
        this.rainDrops.length = 0;
      }
    }

    // 公开接口保持不变：静态背景 + 动态天气粒子，视觉行为与拆分前一致。
    drawBackground(ctx, width, height) {
      this.drawStaticBackground(ctx, width, height);
      this.drawWeatherParticles(ctx, width, height);
    }

    // 静态背景层：只依赖主题、尺寸与 _bgCache，可安全烘焙到离屏 canvas。
    drawStaticBackground(ctx, width, height) {
      ctx.save();

      // 渐变只依赖主题与视口尺寸，命中缓存后直接复用
      const cacheKey = `${this.theme}|${Math.round(width)}|${Math.round(height)}`;
      if (this._bgCache.key !== cacheKey) {
        const isDay = this.theme === 'sunny_day';
        let gradient;
        if (this.theme === 'sunny_day') {
          gradient = ctx.createLinearGradient(0, 0, 0, height);
          gradient.addColorStop(0, '#74b9ff');
          gradient.addColorStop(0.7, '#dfe6e9');
          gradient.addColorStop(1, '#ffeaa7');
        } else if (this.theme === 'cyber_neon') {
          gradient = ctx.createRadialGradient(width / 2, height / 2, 80, width / 2, height / 2, Math.max(width, height));
          gradient.addColorStop(0, '#191929');
          gradient.addColorStop(0.6, '#0f0c1b');
          gradient.addColorStop(1, '#05030a');
        } else {
          gradient = ctx.createRadialGradient(width / 2, height * 0.4, 100, width / 2, height * 0.5, Math.max(width, height));
          gradient.addColorStop(0, '#222336');
          gradient.addColorStop(0.7, '#141421');
          gradient.addColorStop(1, '#0b0b12');
        }
        this._bgCache.gradient = gradient;
        this._bgCache.glows = [500, 1480, 2500].map(lx => {
          const glow = ctx.createRadialGradient(lx, 95, 4, lx, 110, 70);
          glow.addColorStop(0, isDay ? 'rgba(254, 202, 87, 0.28)' : 'rgba(254, 202, 87, 0.16)');
          glow.addColorStop(1, 'rgba(254, 202, 87, 0)');
          return glow;
        });
        this._bgCache.key = cacheKey;
      }

      ctx.fillStyle = this._bgCache.gradient;
      ctx.fillRect(0, 0, width, height);

      if (this.theme === 'cyber_neon') {
        // 赛博霓虹网格
        ctx.strokeStyle = 'rgba(255, 0, 128, 0.08)';
        ctx.lineWidth = 1;
        for (let y = height - 120; y < height; y += 20) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      }

      // 物理地板与室内空间分区
      const floorY = physicsWorld.getFloorY(height);
      const isDay = this.theme === 'sunny_day';

      // 0. 豪宅天花板实木顶梁与吊灯体系 (消除上层虚空感)
      ctx.fillStyle = isDay ? '#b88b5a' : '#151620';
      ctx.fillRect(0, 0, width, 14);
      ctx.fillStyle = isDay ? '#deb887' : '#1f212f';
      ctx.fillRect(0, 14, width, 6);
      ctx.strokeStyle = isDay ? '#8b5a2b' : '#0b0c12';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, width, 20);

      // 三大分区优雅建筑实木立柱 (Zone Dividers: x=1000 露台/客厅界, x=2000 客厅/高塔界)
      [1000, 2000].forEach(px => {
        ctx.fillStyle = isDay ? 'rgba(210, 180, 140, 0.25)' : 'rgba(25, 27, 38, 0.45)';
        ctx.fillRect(px - 14, 0, 28, floorY);
        ctx.strokeStyle = isDay ? 'rgba(139, 90, 43, 0.2)' : 'rgba(255, 255, 255, 0.05)';
        ctx.strokeRect(px - 14, 0, 28, floorY);
      });

      // 三大分区高空气质小吊灯 (Pendant Ambient Lamps)
      [500, 1480, 2500].forEach((lx, gi) => {
        // 细吊线
        ctx.strokeStyle = isDay ? '#a0522d' : '#4b6584';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx, 20);
        ctx.lineTo(lx, 75);
        ctx.stroke();

        // 暖黄柔光灯罩
        ctx.fillStyle = isDay ? '#f7d794' : '#fdcb6e';
        ctx.beginPath();
        ctx.moveTo(lx - 15, 95);
        ctx.lineTo(lx + 15, 95);
        ctx.lineTo(lx + 8, 75);
        ctx.lineTo(lx - 8, 75);
        ctx.closePath();
        ctx.fill();

        // 柔和环境光晕（复用缓存渐变）
        ctx.fillStyle = this._bgCache.glows[gi];
        ctx.beginPath();
        ctx.arc(lx, 110, 70, 0, Math.PI * 2);
        ctx.fill();
      });

      // 1. 实木地板 (从安全线 floorY 到底部)
      ctx.fillStyle = isDay ? '#cda372' : '#1c1e28';
      ctx.fillRect(0, floorY, width, height - floorY);

      // 地板木纹拼缝线条
      ctx.strokeStyle = isDay ? 'rgba(139, 90, 43, 0.15)' : 'rgba(0, 0, 0, 0.25)';
      ctx.lineWidth = 1;
      for (let x = 60; x < width; x += 140) {
        ctx.beginPath();
        ctx.moveTo(x, floorY);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // 实木踢脚线 (Skirting Line) 明确墙地交界
      ctx.fillStyle = isDay ? '#8b5a2b' : '#14151e';
      ctx.fillRect(0, floorY - 8, width, 8);
      ctx.strokeStyle = isDay ? '#5c3a1e' : '#0b0c12';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0, floorY - 8, width, 8);

      // 2. 居中豪华羊毛绒地毯 (波斯/奶油流苏毯，猫咪最喜欢的趴卧中心)
      const rugW = Math.min(width * 0.45, 420);
      const rugH = 24;
      const rugY = floorY + 12;

      // 地毯阴影
      ctx.beginPath();
      ctx.ellipse(width / 2, rugY + 3, rugW + 4, rugH + 4, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.fill();

      // 地毯本体
      ctx.beginPath();
      ctx.ellipse(width / 2, rugY, rugW, rugH, 0, 0, Math.PI * 2);
      ctx.fillStyle = isDay ? '#f7d794' : '#303952';
      ctx.fill();
      ctx.strokeStyle = isDay ? '#e77f67' : '#596275';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 地毯内圈花纹
      ctx.beginPath();
      ctx.ellipse(width / 2, rugY, rugW * 0.75, rugH * 0.65, 0, 0, Math.PI * 2);
      ctx.strokeStyle = isDay ? 'rgba(231, 127, 103, 0.4)' : 'rgba(255, 255, 255, 0.15)';
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // 地毯边缘两端流苏
      ctx.fillStyle = isDay ? '#fff' : '#dfe4ea';
      for (let i = -rugW + 10; i < rugW - 10; i += 12) {
        ctx.fillRect(width / 2 + i, rugY + rugH - 2, 2, 4);
      }

      ctx.restore();
    }

    // 动态天气粒子层：微尘/雨滴每帧位置都会变，单独绘制以免被静态背景缓存冻结。
    drawWeatherParticles(ctx, width, height) {
      ctx.save();

      // 飘浮微尘 / 萤火虫：阴影状态按天气设置一次，避免逐粒子切换昂贵状态
      const isFirefly = this.weather === 'fireflies';
      if (isFirefly) {
        ctx.shadowColor = '#f1c40f';
        ctx.shadowBlur = 8;
      } else {
        ctx.shadowBlur = 0;
      }
      this.dustParticles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = isFirefly
          ? `rgba(241, 196, 15, ${p.alpha * 1.5})`
          : `rgba(255, 255, 255, ${p.alpha * 0.4})`;
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      // 雨丝
      if (this.weather === 'rain') {
        ctx.strokeStyle = 'rgba(116, 185, 255, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        this.rainDrops.forEach(r => {
          ctx.moveTo(r.x, r.y);
          ctx.lineTo(r.x - 3, r.y + r.len);
        });
        ctx.stroke();
      }

      // 窗外赛博飞鸟
      if (this.bird && this.bird.active) {
        ctx.save();
        ctx.translate(this.bird.x, this.bird.y);
        const wingY = Math.sin(this.bird.wingPhase) * 6;
        ctx.fillStyle = '#48dbfb';
        ctx.beginPath();
        // 鸟身
        ctx.ellipse(0, 0, 7, 3.5, 0.1, 0, Math.PI * 2);
        ctx.fill();
        // 扇动双翼
        ctx.strokeStyle = '#0abde3';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-2, 0);
        ctx.lineTo(2, -wingY);
        ctx.lineTo(7, 0);
        ctx.stroke();
        // 微光
        ctx.fillStyle = 'rgba(72, 219, 251, 0.4)';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    }
  }

  window.CyberMeow = window.CyberMeow || {};
  window.CyberMeow.environment = new EnvironmentSystem();
})(window);
