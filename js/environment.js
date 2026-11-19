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

    update(width, height) {
      // 粒子更新
      this.dustParticles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < 0) p.y = height;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
      });

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

    drawBackground(ctx, width, height) {
      ctx.save();

      // 主背景渐变
      if (this.theme === 'sunny_day') {
        const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
        skyGrad.addColorStop(0, '#74b9ff');
        skyGrad.addColorStop(0.7, '#dfe6e9');
        skyGrad.addColorStop(1, '#ffeaa7');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, height);
      } else if (this.theme === 'cyber_neon') {
        const neonGrad = ctx.createRadialGradient(width / 2, height / 2, 80, width / 2, height / 2, Math.max(width, height));
        neonGrad.addColorStop(0, '#191929');
        neonGrad.addColorStop(0.6, '#0f0c1b');
        neonGrad.addColorStop(1, '#05030a');
        ctx.fillStyle = neonGrad;
        ctx.fillRect(0, 0, width, height);

        // 赛博霓虹网格
        ctx.strokeStyle = 'rgba(255, 0, 128, 0.08)';
        ctx.lineWidth = 1;
        for (let y = height - 120; y < height; y += 20) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      } else {
        // cozy_night (默认温馨深色)
        const nightGrad = ctx.createRadialGradient(width / 2, height * 0.4, 100, width / 2, height * 0.5, Math.max(width, height));
        nightGrad.addColorStop(0, '#222336');
        nightGrad.addColorStop(0.7, '#141421');
        nightGrad.addColorStop(1, '#0b0b12');
        ctx.fillStyle = nightGrad;
        ctx.fillRect(0, 0, width, height);
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
      [500, 1480, 2500].forEach(lx => {
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

        // 柔和环境光晕
        const glowGrad = ctx.createRadialGradient(lx, 95, 4, lx, 110, 70);
        glowGrad.addColorStop(0, isDay ? 'rgba(254, 202, 87, 0.28)' : 'rgba(254, 202, 87, 0.16)');
        glowGrad.addColorStop(1, 'rgba(254, 202, 87, 0)');
        ctx.fillStyle = glowGrad;
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

      // 飘浮微尘 / 萤火虫
      this.dustParticles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        if (this.weather === 'fireflies') {
          ctx.fillStyle = `rgba(241, 196, 15, ${p.alpha * 1.5})`;
          ctx.shadowColor = '#f1c40f';
          ctx.shadowBlur = 8;
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.4})`;
          ctx.shadowBlur = 0;
        }
        ctx.fill();
      });

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

      ctx.restore();
    }
  }

  window.CyberMeow = window.CyberMeow || {};
  window.CyberMeow.environment = new EnvironmentSystem();
})(window);
