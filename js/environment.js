/**
 * CyberMeow - 环境、日夜与天气粒子系统
 */
(function(window) {
  'use strict';

  const { MathUtils, physicsWorld } = window.CyberMeow;

  const THEME_PALETTES = {
    sunny_day: {
      roomTop: '#f5efe2',
      roomBottom: '#e4dac5',
      solariumTop: '#eef0df',
      solariumBottom: '#dddcc6',
      readingTop: '#f1dfc7',
      readingBottom: '#dfc3a4',
      workshopTop: '#ede9d9',
      workshopBottom: '#d8d1bd',
      skyTop: '#b7d1d0',
      skyMiddle: '#d9e1d2',
      skyBottom: '#eeddaf',
      outsideFar: '#b2bcab',
      outsideNear: '#93a18f',
      foliage: '#75897a',
      foliageLight: '#96a493',
      trunk: '#806956',
      floorTop: '#bd9062',
      floorBottom: '#81583e',
      floorLine: '#624431',
      wood: '#8c6248',
      woodLight: '#b9855a',
      woodDark: '#573d2e',
      trim: '#f7f0e1',
      trimShadow: '#b99a75',
      sage: '#91a28c',
      sageDark: '#6b7f6b',
      cream: '#f8f0e1',
      creamDeep: '#e9d8c0',
      amber: '#d09a49',
      rust: '#b86e51',
      ink: '#493a31',
      rug: '#bd8761',
      rugEdge: '#805944',
      sun: '#f3c96e',
      glass: 'rgba(244, 255, 249, 0.28)',
      glow: 'rgba(255, 196, 105, 0.24)',
      glowEnd: 'rgba(255, 196, 105, 0)',
      shadow: 'rgba(77, 54, 39, 0.18)',
      wallSpeck: 'rgba(82, 72, 55, 0.10)',
      panelLine: 'rgba(105, 78, 52, 0.23)',
      distantHaze: 'rgba(244, 232, 202, 0.16)',
      floorOcclusion: 'rgba(66, 42, 26, 0.30)',
      cloudBack: 'rgba(217, 226, 218, 0.38)',
      cloudMiddle: 'rgba(239, 239, 224, 0.56)',
      cloudFront: 'rgba(255, 249, 232, 0.72)',
      cloudShadow: 'rgba(151, 170, 168, 0.22)',
      airship: '#cbb481',
      airshipShade: '#8b7654',
      airshipCabin: '#ead9ae',
      airshipTrim: '#66533d',
      celestialInk: '#293a53',
      brass: '#bf9147',
      brassDark: '#6f5129',
      muralInk: '#283a56',
      muralEdge: '#526b7b',
      constellation: '#a8d5de',
      muralStar: '#f5e3ad',
      neon: '#dba349',
      neonAlt: '#4f8d7c'
    },
    cozy_night: {
      roomTop: '#29343d',
      roomBottom: '#1d2831',
      solariumTop: '#25333d',
      solariumBottom: '#192731',
      readingTop: '#2b3035',
      readingBottom: '#20262c',
      workshopTop: '#26333b',
      workshopBottom: '#1b2932',
      skyTop: '#142535',
      skyMiddle: '#263b4a',
      skyBottom: '#4a545a',
      outsideFar: '#354750',
      outsideNear: '#2b3d46',
      foliage: '#304951',
      foliageLight: '#435c62',
      trunk: '#4b4642',
      floorTop: '#5a432f',
      floorBottom: '#2d251f',
      floorLine: '#171512',
      wood: '#6f5942',
      woodLight: '#937858',
      woodDark: '#393127',
      trim: '#b4a488',
      trimShadow: '#5b5143',
      sage: '#465a4c',
      sageDark: '#2d4136',
      cream: '#d7c9ad',
      creamDeep: '#9d8e74',
      amber: '#bd8841',
      rust: '#875743',
      ink: '#d8c8a9',
      rug: '#634b3b',
      rugEdge: '#342b25',
      sun: '#e6b95f',
      glass: 'rgba(152, 205, 205, 0.08)',
      glow: 'rgba(157, 193, 218, 0.13)',
      glowEnd: 'rgba(157, 193, 218, 0)',
      shadow: 'rgba(0, 0, 0, 0.30)',
      wallSpeck: 'rgba(237, 219, 181, 0.055)',
      panelLine: 'rgba(176, 195, 204, 0.14)',
      distantHaze: 'rgba(157, 185, 203, 0.15)',
      floorOcclusion: 'rgba(5, 12, 18, 0.48)',
      cloudBack: 'rgba(82, 108, 126, 0.30)',
      cloudMiddle: 'rgba(111, 139, 157, 0.38)',
      cloudFront: 'rgba(152, 176, 190, 0.46)',
      cloudShadow: 'rgba(20, 37, 50, 0.34)',
      airship: '#8e9da6',
      airshipShade: '#53636d',
      airshipCabin: '#c6ced0',
      airshipTrim: '#384852',
      celestialInk: '#1d2b3d',
      brass: '#aa9368',
      brassDark: '#625640',
      muralInk: '#18243a',
      muralEdge: '#45536b',
      constellation: '#8fc3d0',
      muralStar: '#dce9f2',
      neon: '#b8cad3',
      neonAlt: '#7fa6b5'
    },
    cyber_neon: {
      roomTop: '#12191c',
      roomBottom: '#171b1d',
      solariumTop: '#102126',
      solariumBottom: '#10191c',
      readingTop: '#241e20',
      readingBottom: '#191719',
      workshopTop: '#172425',
      workshopBottom: '#142020',
      skyTop: '#0b1b23',
      skyMiddle: '#173038',
      skyBottom: '#304b49',
      outsideFar: '#2b4648',
      outsideNear: '#223b3b',
      foliage: '#2d554f',
      foliageLight: '#416b64',
      trunk: '#4e4138',
      floorTop: '#4e4036',
      floorBottom: '#292722',
      floorLine: '#151719',
      wood: '#725944',
      woodLight: '#9b7959',
      woodDark: '#342b27',
      trim: '#b4a389',
      trimShadow: '#5a4d42',
      sage: '#3e625b',
      sageDark: '#294942',
      cream: '#d8ccb4',
      creamDeep: '#9e9079',
      amber: '#cf9651',
      rust: '#a45f53',
      ink: '#d9d2c4',
      rug: '#55433e',
      rugEdge: '#2d2829',
      sun: '#69d2c7',
      glass: 'rgba(104, 226, 214, 0.08)',
      glow: 'rgba(232, 111, 158, 0.14)',
      glowEnd: 'rgba(232, 111, 158, 0)',
      shadow: 'rgba(0, 0, 0, 0.34)',
      wallSpeck: 'rgba(134, 213, 199, 0.055)',
      panelLine: 'rgba(106, 203, 188, 0.16)',
      distantHaze: 'rgba(91, 142, 146, 0.12)',
      floorOcclusion: 'rgba(0, 7, 10, 0.50)',
      cloudBack: 'rgba(74, 117, 124, 0.26)',
      cloudMiddle: 'rgba(103, 151, 154, 0.34)',
      cloudFront: 'rgba(137, 185, 184, 0.40)',
      cloudShadow: 'rgba(5, 24, 31, 0.36)',
      airship: '#668b8b',
      airshipShade: '#344f54',
      airshipCabin: '#b6c6c0',
      airshipTrim: '#293f43',
      celestialInk: '#1b2342',
      brass: '#b58a66',
      brassDark: '#665045',
      muralInk: '#171c3b',
      muralEdge: '#4d4d79',
      constellation: '#70d4c8',
      muralStar: '#f0cedc',
      neon: '#e76f9d',
      neonAlt: '#67d2c5'
    }
  };

  const DEFAULT_PALETTE = THEME_PALETTES.sunny_day;

  function hash01(value) {
    const n = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  function traceRoundedRect(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function traceTallArch(ctx, x, y, width, height, shoulderY) {
    const shoulder = Math.min(y + height * 0.48, shoulderY);
    ctx.beginPath();
    ctx.moveTo(x, y + height);
    ctx.lineTo(x, shoulder);
    ctx.quadraticCurveTo(x, y, x + width / 2, y);
    ctx.quadraticCurveTo(x + width, y, x + width, shoulder);
    ctx.lineTo(x + width, y + height);
    ctx.closePath();
  }

  class EnvironmentSystem {
    constructor() {
      this.theme = 'sunny_day'; // 'cozy_night', 'sunny_day', 'cyber_neon'
      this.weather = 'clear'; // 'clear', 'rain', 'fireflies'
      this.dustParticles = [];
      this.rainDrops = [];
      this.sunbeamX = 300;
      this.timeOfDay = 0.35; // 0.0 - 1.0
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

    // 背景离屏层改用视口切片后，切片原点会随相机变化；渐变对象必须按当前变换重建，
    // 否则会沿用旧切片的坐标而错位。仅由缓存重建路径调用，不进入每帧热路径。
    invalidateGradientCache() {
      this._bgCache.key = '';
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

      const cacheKey = `${this.theme}|${Math.round(width)}|${Math.round(height)}`;
      if (this._bgCache.key !== cacheKey) {
        this._buildBackgroundCache(ctx, width, height, cacheKey);
      }

      const floorY = physicsWorld.getFloorY(height);
      const palette = this._bgCache.palette;

      this._drawRoomShell(ctx, width, floorY, palette);
      this._drawSolarium(ctx, floorY, palette);
      this._drawReadingRoom(ctx, width, floorY, palette);
      this._drawWorkshop(ctx, width, floorY, palette);
      this._drawWallTexture(ctx, width, floorY, palette);
      this._drawTimberFloor(ctx, width, height, floorY, palette);
      this._drawFloorOcclusion(ctx, width, floorY);
      this._drawReadingRug(ctx, floorY, palette);
      this._drawRoomStructure(ctx, width, floorY, palette);
      this._drawAmbientLighting(ctx, width, floorY, palette);
      this._drawVignette(ctx, width, height, palette);

      ctx.restore();
    }

    _buildBackgroundCache(ctx, width, height, cacheKey) {
      const palette = THEME_PALETTES[this.theme] || DEFAULT_PALETTE;
      const floorY = physicsWorld.getFloorY(height);
      const roomWall = ctx.createLinearGradient(0, 20, 0, floorY);
      roomWall.addColorStop(0, palette.roomTop);
      roomWall.addColorStop(1, palette.roomBottom);

      const solariumWall = ctx.createLinearGradient(0, 24, 0, floorY);
      solariumWall.addColorStop(0, palette.solariumTop);
      solariumWall.addColorStop(1, palette.solariumBottom);

      const readingWall = ctx.createLinearGradient(0, 24, 0, floorY);
      readingWall.addColorStop(0, palette.readingTop);
      readingWall.addColorStop(1, palette.readingBottom);

      const workshopWall = ctx.createLinearGradient(0, 24, 0, floorY);
      workshopWall.addColorStop(0, palette.workshopTop);
      workshopWall.addColorStop(1, palette.workshopBottom);

      const skyGradient = ctx.createLinearGradient(0, 40, 0, floorY - 60);
      skyGradient.addColorStop(0, palette.skyTop);
      skyGradient.addColorStop(0.58, palette.skyMiddle);
      skyGradient.addColorStop(1, palette.skyBottom);

      const floorGradient = ctx.createLinearGradient(0, floorY, 0, height);
      floorGradient.addColorStop(0, palette.floorTop);
      floorGradient.addColorStop(1, palette.floorBottom);

      const floorOcclusion = ctx.createLinearGradient(0, floorY - 30, 0, floorY + 22);
      floorOcclusion.addColorStop(0, 'rgba(0, 0, 0, 0)');
      floorOcclusion.addColorStop(0.48, palette.floorOcclusion);
      floorOcclusion.addColorStop(1, 'rgba(0, 0, 0, 0)');

      const windowTop = 42;
      const windowBottom = Math.max(windowTop + 210, floorY - 62);
      const windowHeight = windowBottom - windowTop;
      const bayWidth = (968 - 34) / 3;
      const windowReflections = [0, 1, 2].map(index => {
        const bayX = 16 + index * (bayWidth + 17);
        const reflection = ctx.createLinearGradient(bayX, windowTop, bayX + bayWidth, windowBottom);
        reflection.addColorStop(0, palette.glass);
        reflection.addColorStop(0.45, 'rgba(255,255,255,0.03)');
        reflection.addColorStop(1, 'rgba(255,255,255,0)');
        return reflection;
      });

      const vignette = ctx.createRadialGradient(
        width * 0.5, height * 0.38, Math.min(width, height) * 0.18,
        width * 0.5, height * 0.52, Math.max(width * 0.72, height * 0.92)
      );
      vignette.addColorStop(0, 'rgba(30, 23, 17, 0)');
      vignette.addColorStop(0.72, 'rgba(30, 23, 17, 0.02)');
      vignette.addColorStop(1, palette.shadow);

      const workshopCenter = Math.min(width - 420, 2000 + Math.max(470, (width - 2000) * 0.46));
      const glowCenters = [500, 1500, workshopCenter];
      const glows = glowCenters.map(lx => {
        const glow = ctx.createRadialGradient(lx, 96, 5, lx, floorY * 0.30, 190);
        glow.addColorStop(0, palette.glow);
        glow.addColorStop(1, palette.glowEnd);
        return glow;
      });

      this._bgCache = {
        key: cacheKey,
        palette,
        gradient: roomWall,
        solariumWall,
        readingWall,
        workshopWall,
        skyGradient,
        floorGradient,
        floorOcclusion,
        windowReflections,
        vignette,
        glows,
        glowCenters,
        workshopCenter
      };
    }

    _drawRoomShell(ctx, width, floorY, palette) {
      ctx.fillStyle = this._bgCache.gradient;
      ctx.fillRect(0, 0, width, floorY);

      ctx.fillStyle = this._bgCache.solariumWall;
      ctx.fillRect(0, 0, Math.min(1000, width), floorY);

      if (width > 1000) {
        ctx.fillStyle = this._bgCache.readingWall;
        ctx.fillRect(1000, 0, Math.min(1000, width - 1000), floorY);
      }

      if (width > 2000) {
        ctx.fillStyle = this._bgCache.workshopWall;
        ctx.fillRect(2000, 0, width - 2000, floorY);
      }

      ctx.fillStyle = palette.shadow;
      ctx.fillRect(0, 0, width, 18);
      ctx.fillStyle = palette.cream;
      ctx.globalAlpha = 0.12;
      ctx.fillRect(0, 18, width, 3);
      ctx.globalAlpha = 1;
    }

    _drawSolarium(ctx, floorY, palette) {
      const roomLeft = 16;
      const roomRight = 984;
      const gap = 17;
      const bayCount = 3;
      const bayWidth = (roomRight - roomLeft - gap * (bayCount - 1)) / bayCount;
      const windowTop = 42;
      const windowBottom = Math.max(windowTop + 210, floorY - 62);
      const windowHeight = windowBottom - windowTop;

      ctx.save();
      ctx.strokeStyle = palette.panelLine;
      ctx.lineWidth = 1;
      for (let x = 28; x < 980; x += 42) {
        ctx.beginPath();
        ctx.moveTo(x, floorY - 26);
        ctx.lineTo(x + 3, floorY - 192);
        ctx.stroke();
      }
      ctx.restore();

      for (let i = 0; i < bayCount; i++) {
        const x = roomLeft + i * (bayWidth + gap);
        this._drawWindowBay(
          ctx,
          x,
          windowTop,
          bayWidth,
          windowHeight,
          windowTop + Math.min(104, windowHeight * 0.27),
          palette,
          i
        );
      }

      // 通长景窗下的窗台把三扇拱窗收成一间完整的玻璃日光房。
      ctx.fillStyle = palette.trimShadow;
      ctx.fillRect(8, windowBottom + 2, 976, 18);
      ctx.fillStyle = palette.trim;
      ctx.fillRect(8, windowBottom - 2, 976, 8);
      ctx.strokeStyle = palette.panelLine;
      ctx.lineWidth = 1;
      ctx.strokeRect(8.5, windowBottom + 2.5, 975, 17);

      this._drawInteriorPlant(ctx, 55, floorY - 2, palette, 0.88);
      this._drawInteriorPlant(ctx, 942, floorY - 2, palette, 1.0);
    }

    _drawWindowBay(ctx, x, y, width, height, shoulderY, palette, bayIndex) {
      ctx.save();
      traceTallArch(ctx, x + 6, y + 6, width - 12, height - 6, shoulderY + 6);
      ctx.clip();

      ctx.fillStyle = this._bgCache.skyGradient;
      ctx.fillRect(x, y, width, height);
      this._drawWindowLandscape(ctx, x, y, width, height, palette, bayIndex);

      ctx.fillStyle = this._bgCache.windowReflections[bayIndex];
      ctx.beginPath();
      ctx.moveTo(x + width * 0.18, y + height);
      ctx.lineTo(x + width * 0.53, y + height * 0.18);
      ctx.lineTo(x + width * 0.7, y + height * 0.18);
      ctx.lineTo(x + width * 0.34, y + height);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.save();
      traceTallArch(ctx, x + 6, y + 6, width - 12, height - 6, shoulderY + 6);
      ctx.strokeStyle = palette.trimShadow;
      ctx.lineWidth = 11;
      ctx.stroke();
      ctx.strokeStyle = palette.trim;
      ctx.lineWidth = 6;
      ctx.stroke();

      const innerTop = y + 18;
      const innerBottom = y + height - 5;
      ctx.strokeStyle = palette.trim;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + width / 2, innerTop + 42);
      ctx.lineTo(x + width / 2, innerBottom);
      ctx.moveTo(x + 10, y + height * 0.62);
      ctx.lineTo(x + width - 10, y + height * 0.62);
      ctx.stroke();

      ctx.strokeStyle = palette.panelLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + width / 2 - 4, innerTop + 46);
      ctx.lineTo(x + width / 2 - 4, innerBottom);
      ctx.moveTo(x + 12, y + height * 0.62 - 3);
      ctx.lineTo(x + width - 12, y + height * 0.62 - 3);
      ctx.stroke();
      ctx.restore();
    }

    _drawWindowLandscape(ctx, x, y, width, height, palette, bayIndex) {
      const horizon = y + height * 0.70;
      const isDay = this.theme === 'sunny_day';
      const isNeon = this.theme === 'cyber_neon';

      if (isDay && bayIndex === 1) {
        ctx.fillStyle = 'rgba(255, 244, 194, 0.28)';
        ctx.beginPath();
        ctx.arc(x + width * 0.63, y + height * 0.22, width * 0.19, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = palette.sun;
        ctx.beginPath();
        ctx.arc(x + width * 0.63, y + height * 0.22, width * 0.095, 0, Math.PI * 2);
        ctx.fill();
      } else if (!isDay && bayIndex === 1) {
        ctx.fillStyle = isNeon ? 'rgba(103, 210, 197, 0.18)' : 'rgba(240, 209, 146, 0.16)';
        ctx.beginPath();
        ctx.arc(x + width * 0.72, y + height * 0.22, width * 0.105, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = isNeon ? palette.neonAlt : '#ead39c';
        ctx.beginPath();
        ctx.arc(x + width * 0.72, y + height * 0.22, width * 0.052, 0, Math.PI * 2);
        ctx.fill();

        if (this.theme === 'cozy_night') {
          ctx.fillStyle = 'rgba(232, 215, 176, 0.52)';
          for (let i = 0; i < 8; i++) {
            const starX = x + width * (0.1 + hash01(i + bayIndex * 13.2) * 0.78);
            const starY = y + height * (0.08 + hash01(i * 2.7 + bayIndex) * 0.28);
            ctx.fillRect(starX, starY, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
          }
        }
      }

      ctx.fillStyle = palette.outsideFar;
      ctx.beginPath();
      ctx.moveTo(x, horizon + height * 0.08);
      ctx.bezierCurveTo(
        x + width * 0.18, horizon - height * 0.06,
        x + width * 0.35, horizon + height * 0.09,
        x + width * 0.52, horizon - height * 0.02
      );
      ctx.bezierCurveTo(
        x + width * 0.7, horizon - height * 0.10,
        x + width * 0.84, horizon + height * 0.04,
        x + width, horizon - height * 0.03
      );
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x, y + height);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = palette.outsideNear;
      ctx.beginPath();
      ctx.moveTo(x, horizon + height * 0.18);
      ctx.bezierCurveTo(
        x + width * 0.2, horizon + height * 0.10,
        x + width * 0.4, horizon + height * 0.24,
        x + width * 0.61, horizon + height * 0.12
      );
      ctx.bezierCurveTo(
        x + width * 0.75, horizon + height * 0.04,
        x + width * 0.9, horizon + height * 0.18,
        x + width, horizon + height * 0.12
      );
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x, y + height);
      ctx.closePath();
      ctx.fill();

      this._drawCloudSea(ctx, x, y, width, height, palette, bayIndex);
      if (bayIndex === 1) {
        this._drawAirship(ctx, x, y, width, height, palette);
      }

      const trunkX = x + width * (0.28 + bayIndex * 0.11);
      ctx.strokeStyle = palette.trunk;
      ctx.lineWidth = Math.max(4, width * 0.018);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(trunkX, horizon + height * 0.22);
      ctx.quadraticCurveTo(trunkX - 6, y + height * 0.46, trunkX + width * 0.05, y + height * 0.25);
      ctx.moveTo(trunkX + width * 0.025, y + height * 0.39);
      ctx.quadraticCurveTo(trunkX + width * 0.18, y + height * 0.31, trunkX + width * 0.25, y + height * 0.30);
      ctx.stroke();

      ctx.fillStyle = palette.foliage;
      ctx.beginPath();
      const leafOffsets = [
        [-0.04, 0.24, 0.12, 0.07, -0.3],
        [0.06, 0.20, 0.14, 0.08, 0.18],
        [0.18, 0.25, 0.13, 0.07, -0.12],
        [0.28, 0.30, 0.10, 0.06, 0.3],
        [0.02, 0.34, 0.14, 0.07, 0.1]
      ];
      leafOffsets.forEach((leaf, idx) => {
        const wobble = (hash01(bayIndex * 9 + idx) - 0.5) * 0.035;
        ctx.ellipse(
          x + width * (leaf[0] + wobble),
          y + height * leaf[1],
          width * leaf[2],
          height * leaf[3],
          leaf[4],
          0,
          Math.PI * 2
        );
      });
      ctx.fill();

      ctx.fillStyle = palette.foliageLight;
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.ellipse(x + width * 0.18, y + height * 0.27, width * 0.11, height * 0.05, -0.2, 0, Math.PI * 2);
      ctx.ellipse(x + width * 0.27, y + height * 0.24, width * 0.08, height * 0.04, 0.28, 0, Math.PI * 2);
      ctx.ellipse(x + width * 0.08, y + height * 0.34, width * 0.09, height * 0.04, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = palette.foliage;
      const shrubY = y + height * 0.88;
      ctx.beginPath();
      ctx.ellipse(x + width * 0.15, shrubY, width * 0.18, height * 0.08, 0, 0, Math.PI * 2);
      ctx.ellipse(x + width * 0.46, shrubY + height * 0.02, width * 0.22, height * 0.07, 0, 0, Math.PI * 2);
      ctx.ellipse(x + width * 0.83, shrubY, width * 0.16, height * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();

      if (isNeon) {
        ctx.fillStyle = palette.neonAlt;
        ctx.globalAlpha = 0.62;
        for (let i = 0; i < 7; i++) {
          ctx.fillRect(
            x + width * (0.12 + hash01(bayIndex * 31 + i * 1.7) * 0.76),
            y + height * (0.48 + hash01(i * 4.1 + bayIndex) * 0.2),
            3 + (i % 2) * 2,
            2
          );
        }
        ctx.globalAlpha = 1;
      }

      // Keep the landscape readable while giving foreground furniture visual priority.
      ctx.fillStyle = palette.distantHaze;
      ctx.fillRect(x, y, width, height);
    }

    _drawCloudSea(ctx, x, y, width, height, palette, bayIndex) {
      const layers = [
        { top: 0.64, lift: 0.05, color: palette.cloudBack },
        { top: 0.72, lift: 0.075, color: palette.cloudMiddle },
        { top: 0.80, lift: 0.10, color: palette.cloudFront }
      ];

      ctx.save();
      layers.forEach((layer, layerIndex) => {
        const baseY = y + height * layer.top;
        ctx.fillStyle = layer.color;
        ctx.beginPath();
        for (let i = -1; i < 5; i++) {
          const drift = (hash01(bayIndex * 17 + layerIndex * 5 + i) - 0.5) * width * 0.09;
          const cx = x + width * (0.1 + i * 0.23) + drift;
          const rx = width * (0.20 + hash01(i + layerIndex * 3.7) * 0.08);
          const ry = height * (layer.lift + hash01(i * 2.1 + layerIndex) * 0.025);
          ctx.ellipse(cx, baseY + ry * 0.25, rx, ry, 0, 0, Math.PI * 2);
        }
        ctx.fill();
      });

      ctx.fillStyle = palette.cloudShadow;
      ctx.beginPath();
      ctx.ellipse(
        x + width * 0.48,
        y + height * 0.89,
        width * 0.58,
        height * 0.055,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }

    _drawAirship(ctx, x, y, width, height, palette) {
      const bodyWidth = width * 0.54;
      const bodyHeight = Math.max(22, height * 0.105);
      const cx = x + width * 0.59;
      const cy = y + height * 0.26;
      const cabinY = cy + bodyHeight * 0.86;

      ctx.save();
      ctx.lineJoin = 'round';
      ctx.fillStyle = palette.airshipShade;
      ctx.beginPath();
      ctx.ellipse(cx, cy + bodyHeight * 0.12, bodyWidth * 0.51, bodyHeight * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = palette.airship;
      ctx.beginPath();
      ctx.ellipse(cx, cy, bodyWidth * 0.5, bodyHeight * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = palette.cream;
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.ellipse(cx - bodyWidth * 0.08, cy - bodyHeight * 0.16, bodyWidth * 0.29, bodyHeight * 0.12, -0.04, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      const tailX = cx + bodyWidth * 0.42;
      ctx.fillStyle = palette.airshipTrim;
      ctx.beginPath();
      ctx.moveTo(tailX, cy);
      ctx.lineTo(tailX + bodyWidth * 0.13, cy - bodyHeight * 0.68);
      ctx.lineTo(tailX + bodyWidth * 0.08, cy);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(tailX, cy);
      ctx.lineTo(tailX + bodyWidth * 0.13, cy + bodyHeight * 0.68);
      ctx.lineTo(tailX + bodyWidth * 0.08, cy);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = palette.airshipTrim;
      ctx.lineWidth = Math.max(1, bodyHeight * 0.045);
      [-0.18, 0, 0.18].forEach(offset => {
        ctx.beginPath();
        ctx.moveTo(cx + bodyWidth * offset, cy + bodyHeight * 0.36);
        ctx.lineTo(cx + bodyWidth * (offset * 0.58), cabinY);
        ctx.stroke();
      });

      traceRoundedRect(
        ctx,
        cx - bodyWidth * 0.13,
        cabinY,
        bodyWidth * 0.26,
        bodyHeight * 0.40,
        bodyHeight * 0.10
      );
      ctx.fillStyle = palette.airshipCabin;
      ctx.fill();
      ctx.strokeStyle = palette.airshipTrim;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = palette.airshipTrim;
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(
          cx - bodyWidth * 0.09 + i * bodyWidth * 0.075,
          cabinY + bodyHeight * 0.11,
          bodyWidth * 0.035,
          bodyHeight * 0.12
        );
      }

      ctx.fillStyle = palette.cloudShadow;
      ctx.beginPath();
      ctx.ellipse(cx, cabinY + bodyHeight * 0.49, bodyWidth * 0.18, bodyHeight * 0.035, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    _drawInteriorPlant(ctx, x, baseY, palette, scale) {
      const potWidth = 34 * scale;
      const potHeight = 35 * scale;
      ctx.save();
      ctx.strokeStyle = palette.sageDark;
      ctx.lineWidth = 2 * scale;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, baseY - potHeight);
      ctx.quadraticCurveTo(x - 8 * scale, baseY - 70 * scale, x - 13 * scale, baseY - 92 * scale);
      ctx.moveTo(x + 3 * scale, baseY - potHeight);
      ctx.quadraticCurveTo(x + 14 * scale, baseY - 66 * scale, x + 18 * scale, baseY - 82 * scale);
      ctx.stroke();

      ctx.fillStyle = palette.foliage;
      ctx.beginPath();
      ctx.ellipse(x - 14 * scale, baseY - 88 * scale, 15 * scale, 8 * scale, -0.45, 0, Math.PI * 2);
      ctx.ellipse(x + 18 * scale, baseY - 80 * scale, 15 * scale, 7 * scale, 0.42, 0, Math.PI * 2);
      ctx.ellipse(x - 3 * scale, baseY - 105 * scale, 11 * scale, 17 * scale, -0.12, 0, Math.PI * 2);
      ctx.ellipse(x - 19 * scale, baseY - 67 * scale, 13 * scale, 6 * scale, 0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = palette.rust;
      ctx.beginPath();
      ctx.moveTo(x - potWidth / 2, baseY - potHeight);
      ctx.lineTo(x + potWidth / 2, baseY - potHeight);
      ctx.lineTo(x + potWidth * 0.36, baseY);
      ctx.lineTo(x - potWidth * 0.36, baseY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = palette.woodDark;
      ctx.globalAlpha = 0.28;
      ctx.fillRect(x - potWidth * 0.43, baseY - potHeight, potWidth * 0.86, 4 * scale);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    _drawReadingRoom(ctx, width, floorY, palette) {
      if (width <= 1000) return;

      const roomRight = Math.min(2000, width);
      const panelTop = floorY - Math.min(188, floorY * 0.24);
      ctx.fillStyle = palette.creamDeep;
      ctx.globalAlpha = 0.24;
      ctx.fillRect(1000, panelTop, roomRight - 1000, floorY - panelTop);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = palette.panelLine;
      ctx.lineWidth = 1;
      for (let x = 1028; x < roomRight; x += 88) {
        ctx.beginPath();
        ctx.moveTo(x, panelTop + 14);
        ctx.lineTo(x, floorY - 22);
        ctx.stroke();
      }
      ctx.fillStyle = palette.wood;
      ctx.fillRect(1000, panelTop - 5, roomRight - 1000, 6);
      ctx.fillStyle = palette.woodLight;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(1000, panelTop - 5, roomRight - 1000, 2);
      ctx.globalAlpha = 1;

      const artTop = Math.max(72, floorY * 0.105);
      this._drawFrame(ctx, 1120, artTop + 14, 92, 116, palette, 'botanical');
      this._drawFrame(ctx, 1460, artTop, 260, 160, palette, 'celestial');
      this._drawFrame(ctx, 1770, artTop + 28, 88, 112, palette, 'sun');
      this._drawArmillarySphere(ctx, 1164, floorY - 152, 80, floorY, palette);

      const shelfY = Math.max(205, floorY * 0.30);
      this._drawShelf(ctx, 1037, shelfY, 126, palette, 4, false);
      this._drawShelf(ctx, 1800, shelfY + 38, 156, palette, 3, true);
      this._drawShelf(ctx, 1822, shelfY + 126, 112, palette, 2, false);

      ctx.fillStyle = palette.amber;
      ctx.globalAlpha = 0.58;
      ctx.beginPath();
      ctx.arc(1975, floorY * 0.26, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = palette.panelLine;
      ctx.beginPath();
      ctx.moveTo(1975, 24);
      ctx.lineTo(1975, floorY * 0.26 - 8);
      ctx.stroke();
    }

    _drawFrame(ctx, x, y, width, height, palette, artwork) {
      ctx.save();
      ctx.fillStyle = palette.shadow;
      ctx.fillRect(x + 5, y + 6, width, height);
      ctx.fillStyle = palette.woodDark;
      ctx.fillRect(x, y, width, height);
      ctx.fillStyle = palette.woodLight;
      ctx.fillRect(x + 5, y + 5, width - 10, height - 10);
      ctx.fillStyle = palette.cream;
      ctx.fillRect(x + 10, y + 10, width - 20, height - 20);

      const ix = x + 14;
      const iy = y + 14;
      const iw = width - 28;
      const ih = height - 28;
      ctx.strokeStyle = palette.sageDark;
      ctx.fillStyle = palette.sage;
      ctx.lineWidth = 1.5;

      if (artwork === 'botanical') {
        ctx.beginPath();
        ctx.moveTo(ix + iw / 2, iy + ih - 4);
        ctx.quadraticCurveTo(ix + iw * 0.42, iy + ih * 0.5, ix + iw * 0.56, iy + 5);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(ix + iw * 0.4, iy + ih * 0.46, 7, 3, -0.55, 0, Math.PI * 2);
        ctx.ellipse(ix + iw * 0.64, iy + ih * 0.61, 8, 3, 0.45, 0, Math.PI * 2);
        ctx.ellipse(ix + iw * 0.54, iy + ih * 0.31, 7, 3, -0.20, 0, Math.PI * 2);
        ctx.fill();
      } else if (artwork === 'landscape') {
        ctx.fillStyle = palette.outsideFar;
        ctx.beginPath();
        ctx.moveTo(ix, iy + ih);
        ctx.lineTo(ix, iy + ih * 0.63);
        ctx.quadraticCurveTo(ix + iw * 0.28, iy + ih * 0.42, ix + iw * 0.52, iy + ih * 0.62);
        ctx.quadraticCurveTo(ix + iw * 0.76, iy + ih * 0.40, ix + iw, iy + ih * 0.58);
        ctx.lineTo(ix + iw, iy + ih);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = palette.amber;
        ctx.beginPath();
        ctx.arc(ix + iw * 0.7, iy + ih * 0.27, 8, 0, Math.PI * 2);
        ctx.fill();
      } else if (artwork === 'celestial') {
        ctx.fillStyle = palette.celestialInk;
        ctx.fillRect(ix, iy, iw, ih);
        ctx.strokeStyle = palette.constellation;
        ctx.globalAlpha = 0.46;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(ix + iw * 0.5, iy + ih * 0.52, iw * 0.34, ih * 0.23, -0.28, 0, Math.PI * 2);
        ctx.ellipse(ix + iw * 0.5, iy + ih * 0.52, iw * 0.20, ih * 0.43, 0.18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.strokeStyle = palette.muralStar;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(ix + iw * 0.16, iy + ih * 0.28);
        ctx.lineTo(ix + iw * 0.34, iy + ih * 0.40);
        ctx.lineTo(ix + iw * 0.49, iy + ih * 0.30);
        ctx.lineTo(ix + iw * 0.65, iy + ih * 0.46);
        ctx.lineTo(ix + iw * 0.83, iy + ih * 0.34);
        ctx.stroke();

        ctx.fillStyle = palette.muralStar;
        for (let i = 0; i < 16; i++) {
          const sx = ix + iw * (0.08 + hash01(i * 2.17 + 1) * 0.84);
          const sy = iy + ih * (0.08 + hash01(i * 4.31 + 3) * 0.84);
          ctx.beginPath();
          ctx.arc(sx, sy, i % 5 === 0 ? 2 : 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = palette.brass;
        ctx.beginPath();
        ctx.arc(ix + iw * 0.72, iy + ih * 0.22, 6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = palette.amber;
        ctx.globalAlpha = 0.72;
        ctx.beginPath();
        ctx.arc(ix + iw / 2, iy + ih / 2, Math.min(iw, ih) * 0.23, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = palette.rust;
        ctx.beginPath();
        ctx.arc(ix + iw / 2, iy + ih / 2, Math.min(iw, ih) * 0.33, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.strokeStyle = palette.panelLine;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
      ctx.restore();
    }

    _drawArmillarySphere(ctx, centerX, centerY, radius, floorY, palette) {
      ctx.save();
      ctx.lineCap = 'round';

      ctx.fillStyle = palette.shadow;
      ctx.globalAlpha = 0.34;
      ctx.beginPath();
      ctx.ellipse(centerX, floorY - 7, radius * 0.66, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.strokeStyle = palette.brassDark;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY + radius * 0.74);
      ctx.lineTo(centerX, floorY - 15);
      ctx.stroke();
      ctx.strokeStyle = palette.brass;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = palette.brassDark;
      ctx.beginPath();
      ctx.ellipse(centerX, floorY - 8, radius * 0.48, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = palette.brass;
      ctx.beginPath();
      ctx.ellipse(centerX, floorY - 12, radius * 0.35, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = palette.brassDark;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = palette.brass;
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.strokeStyle = palette.brass;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radius * 0.82, radius * 0.32, -0.34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radius * 0.53, radius * 0.94, 0.55, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = palette.brassDark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX - radius * 0.80, centerY - radius * 0.58);
      ctx.lineTo(centerX + radius * 0.80, centerY + radius * 0.58);
      ctx.stroke();

      ctx.fillStyle = palette.amber;
      ctx.shadowColor = palette.amber;
      ctx.shadowBlur = 7;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.105, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    _drawShelf(ctx, x, y, width, palette, bookCount, basket) {
      ctx.save();
      ctx.fillStyle = palette.shadow;
      ctx.fillRect(x + 4, y + 5, width, 7);
      ctx.fillStyle = palette.wood;
      ctx.fillRect(x, y, width, 6);
      ctx.fillStyle = palette.woodLight;
      ctx.fillRect(x, y, width, 2);
      ctx.strokeStyle = palette.woodDark;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 16, y + 6);
      ctx.lineTo(x + 30, y + 20);
      ctx.lineTo(x + 44, y + 6);
      ctx.moveTo(x + width - 40, y + 6);
      ctx.lineTo(x + width - 26, y + 20);
      ctx.lineTo(x + width - 12, y + 6);
      ctx.stroke();

      const bookColors = [palette.rust, palette.sage, palette.amber, palette.creamDeep];
      for (let i = 0; i < bookCount; i++) {
        const bw = 7 + (i % 2) * 2;
        const bh = 20 + (i % 3) * 5;
        ctx.fillStyle = bookColors[i % bookColors.length];
        ctx.fillRect(x + 12 + i * 11, y - bh, bw, bh);
        ctx.fillStyle = palette.panelLine;
        ctx.fillRect(x + 14 + i * 11, y - bh + 5, bw - 4, 1);
      }

      if (basket) {
        ctx.fillStyle = palette.woodLight;
        traceRoundedRect(ctx, x + width - 48, y - 26, 37, 26, 5);
        ctx.fill();
        ctx.strokeStyle = palette.woodDark;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + width - 30, y - 25, 12, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = palette.panelLine;
        ctx.lineWidth = 1;
        for (let by = y - 20; by < y - 3; by += 7) {
          ctx.beginPath();
          ctx.moveTo(x + width - 46, by);
          ctx.lineTo(x + width - 13, by);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    _drawWorkshop(ctx, width, floorY, palette) {
      if (width <= 2000) return;

      const wainscotY = Math.max(150, floorY - Math.min(206, floorY * 0.24));
      const roomWidth = width - 2000;
      ctx.fillStyle = palette.sage;
      ctx.fillRect(2000, wainscotY, roomWidth, floorY - wainscotY);

      ctx.strokeStyle = palette.panelLine;
      ctx.lineWidth = 1;
      for (let x = 2010; x < width; x += 38) {
        ctx.beginPath();
        ctx.moveTo(x, wainscotY + 18);
        ctx.lineTo(x, floorY - 24);
        ctx.stroke();
      }

      ctx.fillStyle = palette.sageDark;
      ctx.fillRect(2000, wainscotY - 6, roomWidth, 7);
      ctx.fillStyle = palette.cream;
      ctx.globalAlpha = 0.28;
      ctx.fillRect(2000, wainscotY - 6, roomWidth, 2);
      ctx.globalAlpha = 1;

      const cabinetX = 2028;
      const cabinetY = Math.max(154, floorY * 0.20);
      const cabinetW = 152;
      const cabinetH = Math.min(232, floorY - cabinetY - 220);
      if (cabinetH > 90) {
        ctx.fillStyle = palette.creamDeep;
        ctx.fillRect(cabinetX, cabinetY, cabinetW, cabinetH);
        ctx.strokeStyle = palette.woodDark;
        ctx.lineWidth = 3;
        ctx.strokeRect(cabinetX, cabinetY, cabinetW, cabinetH);
        for (let row = 1; row <= 3; row++) {
          const shelfLineY = cabinetY + (cabinetH / 3) * row;
          ctx.fillStyle = palette.wood;
          ctx.fillRect(cabinetX + 5, shelfLineY - 4, cabinetW - 10, 5);
        }
        for (let i = 0; i < 4; i++) {
          const jarX = cabinetX + 17 + i * 33;
          const jarH = 20 + (i % 2) * 8;
          ctx.fillStyle = i % 2 ? palette.amber : palette.rust;
          traceRoundedRect(ctx, jarX, cabinetY + cabinetH / 3 - jarH - 5, 18, jarH, 4);
          ctx.fill();
          ctx.fillStyle = palette.cream;
          ctx.fillRect(jarX + 2, cabinetY + cabinetH / 3 - jarH - 2, 14, 3);
        }
      }

      const pegX = Math.min(2260, width - 760);
      const pegY = Math.max(180, floorY * 0.24);
      const pegW = Math.min(258, width - pegX - 250);
      if (pegW > 120) {
        ctx.fillStyle = palette.wood;
        ctx.globalAlpha = 0.62;
        ctx.fillRect(pegX, pegY, pegW, 7);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = palette.trimShadow;
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          const hookX = pegX + 24 + i * ((pegW - 48) / 4);
          ctx.beginPath();
          ctx.arc(hookX, pegY + 8, 5, Math.PI * 0.15, Math.PI * 1.05);
          ctx.stroke();
          ctx.strokeStyle = i % 2 ? palette.rust : palette.sageDark;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(hookX, pegY + 13);
          ctx.quadraticCurveTo(hookX - 8, pegY + 43, hookX + 4, pegY + 60);
          ctx.stroke();
          ctx.strokeStyle = palette.trimShadow;
          ctx.lineWidth = 2;
        }
      }

      const holdColors = [palette.amber, palette.rust, palette.sageDark];
      const holdXs = [2218, 2392, 2542, 2716, 2920];
      holdXs.forEach((holdX, i) => {
        if (holdX > width - 70) return;
        const holdY = Math.max(270, floorY * (0.35 + (i % 2) * 0.08));
        ctx.fillStyle = holdColors[i % holdColors.length];
        ctx.beginPath();
        ctx.ellipse(holdX, holdY, 10, 6, i % 2 ? 0.35 : -0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = palette.shadow;
        ctx.beginPath();
        ctx.arc(holdX + 2, holdY + 2, 2, 0, Math.PI * 2);
        ctx.fill();
      });

      if (this.theme === 'cyber_neon') {
        ctx.strokeStyle = palette.neonAlt;
        ctx.globalAlpha = 0.28;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(2018, wainscotY - 2);
        ctx.lineTo(width - 18, wainscotY - 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      const muralWidth = Math.min(570, width - 2240);
      if (muralWidth > 320) {
        this._drawConstellationMural(
          ctx,
          2200,
          Math.max(46, floorY * 0.055),
          muralWidth,
          Math.max(156, Math.min(220, floorY * 0.25)),
          palette
        );
      }
    }

    _drawConstellationMural(ctx, x, y, width, height, palette) {
      ctx.save();
      traceRoundedRect(ctx, x, y, width, height, 12);
      ctx.fillStyle = palette.muralEdge;
      ctx.fill();
      traceRoundedRect(ctx, x + 7, y + 7, width - 14, height - 14, 9);
      ctx.fillStyle = palette.muralInk;
      ctx.fill();

      ctx.strokeStyle = palette.constellation;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 1;
      for (let i = 1; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(x + 16, y + (height / 6) * i);
        ctx.lineTo(x + width - 16, y + (height / 6) * i);
        ctx.stroke();
      }
      for (let i = 1; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(x + (width / 10) * i, y + 14);
        ctx.lineTo(x + (width / 10) * i, y + height - 14);
        ctx.stroke();
      }

      ctx.globalAlpha = 0.42;
      ctx.beginPath();
      ctx.ellipse(x + width * 0.48, y + height * 0.54, width * 0.31, height * 0.25, -0.22, 0, Math.PI * 2);
      ctx.ellipse(x + width * 0.56, y + height * 0.48, width * 0.19, height * 0.48, 0.18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      const stars = [
        [0.10, 0.34], [0.19, 0.21], [0.31, 0.31], [0.43, 0.20],
        [0.55, 0.34], [0.69, 0.20], [0.82, 0.32], [0.91, 0.17],
        [0.68, 0.57], [0.52, 0.62], [0.36, 0.50], [0.18, 0.68],
        [0.78, 0.72], [0.45, 0.82], [0.62, 0.84]
      ];
      const links = [
        [0, 1, 2, 3, 4, 5, 6, 7],
        [2, 10, 9, 8, 6],
        [1, 10, 11, 13],
        [8, 12, 14],
        [9, 14]
      ];

      ctx.strokeStyle = palette.constellation;
      ctx.lineWidth = 1.6;
      links.forEach(link => {
        ctx.beginPath();
        link.forEach((starIndex, index) => {
          const sx = x + width * stars[starIndex][0];
          const sy = y + height * stars[starIndex][1];
          if (index === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.stroke();
      });

      stars.forEach((star, index) => {
        const radius = index % 4 === 0 ? 3.4 : 2.1;
        ctx.fillStyle = palette.muralStar;
        ctx.beginPath();
        ctx.arc(x + width * star[0], y + height * star[1], radius, 0, Math.PI * 2);
        ctx.fill();
        if (index % 4 === 0) {
          ctx.strokeStyle = palette.muralStar;
          ctx.globalAlpha = 0.44;
          ctx.beginPath();
          ctx.arc(x + width * star[0], y + height * star[1], radius * 2.6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      });

      ctx.strokeStyle = palette.muralStar;
      ctx.globalAlpha = 0.62;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 7.5, y + 7.5, width - 15, height - 15);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    _drawWallTexture(ctx, width, floorY, palette) {
      ctx.save();
      ctx.fillStyle = palette.wallSpeck;
      for (let i = 0; i < 150; i++) {
        const x = hash01(i * 1.63 + 4.7) * width;
        const y = 42 + hash01(i * 2.37 + 8.1) * Math.max(20, floorY - 78);
        const size = hash01(i * 5.13) > 0.86 ? 2 : 1;
        ctx.fillRect(x, y, size, size);
      }

      ctx.strokeStyle = palette.panelLine;
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = 1;
      for (let i = 0; i < 24; i++) {
        const x = hash01(i * 8.9 + 1.3) * width;
        const y = 70 + hash01(i * 3.2 + 5.6) * Math.max(40, floorY - 160);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 5, y + 11, x + 1, y + 22);
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawTimberFloor(ctx, width, height, floorY, palette) {
      ctx.fillStyle = this._bgCache.floorGradient;
      ctx.fillRect(0, floorY, width, height - floorY);

      const boardHeight = 24;
      const rows = Math.ceil((height - floorY) / boardHeight);
      for (let row = 0; row < rows; row++) {
        const y = floorY + row * boardHeight;
        ctx.fillStyle = row % 2 ? palette.woodLight : palette.woodDark;
        ctx.globalAlpha = row % 2 ? 0.08 : 0.06;
        ctx.fillRect(0, y, width, boardHeight - 1);
        ctx.globalAlpha = 1;

        ctx.strokeStyle = palette.floorLine;
        ctx.globalAlpha = 0.34;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y + boardHeight - 0.5);
        ctx.lineTo(width, y + boardHeight - 0.5);
        ctx.stroke();
        ctx.globalAlpha = 1;

        const offset = (row % 2) * 156;
        ctx.strokeStyle = palette.floorLine;
        ctx.globalAlpha = 0.18;
        for (let x = 84 + offset; x < width; x += 312) {
          ctx.beginPath();
          ctx.moveTo(x, y + 3);
          ctx.lineTo(x + 2, y + boardHeight - 3);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      ctx.strokeStyle = palette.woodLight;
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = 1;
      for (let row = 0; row < rows; row++) {
        const y = floorY + row * boardHeight + 8 + (row % 3) * 3;
        ctx.beginPath();
        for (let x = 0; x <= width; x += 180) {
          const yy = y + Math.sin((x + row * 41) * 0.012) * 1.1;
          if (x === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = palette.wood;
      ctx.fillRect(0, floorY - 18, width, 18);
      ctx.fillStyle = palette.woodLight;
      ctx.fillRect(0, floorY - 18, width, 3);
      ctx.strokeStyle = palette.floorLine;
      ctx.globalAlpha = 0.72;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, floorY - 0.5);
      ctx.lineTo(width, floorY - 0.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    _drawFloorOcclusion(ctx, width, floorY) {
      ctx.fillStyle = this._bgCache.floorOcclusion;
      ctx.fillRect(0, floorY - 32, width, 58);
    }

    _drawReadingRug(ctx, floorY, palette) {
      const topY = floorY + 18;
      const bottomY = floorY + 86;
      ctx.save();
      ctx.fillStyle = palette.shadow;
      ctx.globalAlpha = 0.36;
      ctx.beginPath();
      ctx.moveTo(1289, topY + 5);
      ctx.lineTo(1749, topY + 5);
      ctx.lineTo(1782, bottomY + 7);
      ctx.lineTo(1253, bottomY + 7);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = palette.rug;
      ctx.beginPath();
      ctx.moveTo(1289, topY);
      ctx.lineTo(1749, topY);
      ctx.lineTo(1782, bottomY);
      ctx.lineTo(1253, bottomY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = palette.rugEdge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(1307, topY + 10);
      ctx.lineTo(1732, topY + 10);
      ctx.lineTo(1758, bottomY - 9);
      ctx.lineTo(1275, bottomY - 9);
      ctx.closePath();
      ctx.stroke();

      ctx.strokeStyle = palette.cream;
      ctx.globalAlpha = 0.34;
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 9]);
      ctx.beginPath();
      ctx.moveTo(1400, topY + 22);
      ctx.lineTo(1650, topY + 22);
      ctx.moveTo(1385, bottomY - 21);
      ctx.lineTo(1668, bottomY - 21);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = palette.cream;
      ctx.globalAlpha = 0.42;
      for (let x = 1262; x < 1772; x += 13) {
        ctx.beginPath();
        ctx.moveTo(x, bottomY);
        ctx.lineTo(x + ((x - 1517) * 0.02), bottomY + 5);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    _drawRoomStructure(ctx, width, floorY, palette) {
      ctx.save();
      ctx.fillStyle = palette.woodDark;
      ctx.fillRect(0, 0, width, 21);
      ctx.fillStyle = palette.wood;
      ctx.fillRect(0, 5, width, 12);
      ctx.fillStyle = palette.woodLight;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(0, 5, width, 3);
      ctx.globalAlpha = 1;

      [1000, 2000].forEach(dividerX => {
        if (dividerX > width) return;
        ctx.fillStyle = palette.shadow;
        ctx.fillRect(dividerX - 30, 20, 30, floorY - 20);
        ctx.fillStyle = palette.woodDark;
        ctx.fillRect(dividerX - 13, 18, 26, floorY - 18);
        ctx.fillStyle = palette.woodLight;
        ctx.fillRect(dividerX - 8, 22, 7, floorY - 26);
        ctx.strokeStyle = palette.floorLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(dividerX - 13.5, 20);
        ctx.lineTo(dividerX - 13.5, floorY);
        ctx.moveTo(dividerX + 12.5, 20);
        ctx.lineTo(dividerX + 12.5, floorY);
        ctx.stroke();

        ctx.fillStyle = palette.trim;
        ctx.fillRect(dividerX - 18, 32, 36, 5);
        ctx.fillRect(dividerX - 18, floorY - 54, 36, 5);
      });

      ctx.fillStyle = palette.shadow;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(0, 21, width, 4);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    _drawAmbientLighting(ctx, width, floorY, palette) {
      const centers = this._bgCache.glowCenters;
      const glows = this._bgCache.glows;
      const radius = Math.max(125, Math.min(205, floorY * 0.24));

      glows.forEach((glow, index) => {
        if (centers[index] > width - 20) return;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(centers[index], floorY * 0.30, radius, 0, Math.PI * 2);
        ctx.fill();
      });

      [1500, this._bgCache.workshopCenter].forEach((lx, index) => {
        if (lx > width - 90) return;
        ctx.strokeStyle = palette.woodDark;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(lx, 21);
        ctx.lineTo(lx, 82);
        ctx.stroke();
        ctx.fillStyle = index === 0 ? palette.amber : palette.rust;
        ctx.beginPath();
        ctx.moveTo(lx - 22, 105);
        ctx.lineTo(lx + 22, 105);
        ctx.lineTo(lx + 13, 82);
        ctx.lineTo(lx - 13, 82);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = palette.cream;
        ctx.globalAlpha = 0.25;
        ctx.fillRect(lx - 18, 102, 36, 2);
        ctx.globalAlpha = 1;
      });
    }

    _drawVignette(ctx, width, height, palette) {
      ctx.fillStyle = this._bgCache.vignette;
      ctx.fillRect(0, 0, width, height);

      if (this.theme === 'cyber_neon') {
        ctx.strokeStyle = palette.neon;
        ctx.globalAlpha = 0.2;
        ctx.lineWidth = 1;
        for (let y = physicsWorld.getFloorY(height) - 96; y < height; y += 24) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }

    // 动态天气粒子层：微尘/雨滴每帧位置都会变，单独绘制以免被静态背景缓存冻结。
    // 按视口范围裁剪、粒子预算限流并按透明度分桶合批，将 60 次 fill() 压减至 <=3 次。
    drawWeatherParticles(ctx, width, height, options = {}) {
      ctx.save();

      // 飘浮微尘 / 萤火虫：阴影状态按天气设置一次，避免逐粒子切换昂贵状态
      // 低画质下完全关闭发光阴影，这是移动端最贵的效果之一
      const lowQuality = (typeof window !== 'undefined' && window.CyberMeow
        && window.CyberMeow.renderQuality === 'low');
      const isFirefly = !lowQuality && this.weather === 'fireflies';
      if (isFirefly) {
        ctx.shadowColor = '#f1c40f';
        ctx.shadowBlur = 8;
      } else {
        ctx.shadowBlur = 0;
      }

      const minX = Number.isFinite(options.minX) ? options.minX : -Infinity;
      const maxX = Number.isFinite(options.maxX) ? options.maxX : Infinity;
      const budget = Number.isFinite(options.particleBudget) ? options.particleBudget : 240;
      const maxDust = Math.min(this.dustParticles.length, Math.max(8, Math.round(budget * 0.6)));
      const buckets = this._dustBuckets || (this._dustBuckets = [[], [], []]);
      buckets[0].length = 0;
      buckets[1].length = 0;
      buckets[2].length = 0;

      for (let i = 0; i < maxDust; i++) {
        const p = this.dustParticles[i];
        if (p.x + p.radius < minX || p.x - p.radius > maxX) continue;
        const idx = p.alpha < 0.22 ? 0 : (p.alpha < 0.36 ? 1 : 2);
        buckets[idx].push(p);
      }

      const bucketAlphas = isFirefly
        ? ['rgba(241, 196, 15, 0.24)', 'rgba(241, 196, 15, 0.44)', 'rgba(241, 196, 15, 0.68)']
        : ['rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.19)'];
      for (let b = 0; b < 3; b++) {
        const list = buckets[b];
        if (list.length === 0) continue;
        ctx.fillStyle = bucketAlphas[b];
        ctx.beginPath();
        for (let i = 0; i < list.length; i++) {
          const p = list[i];
          ctx.moveTo(p.x + p.radius, p.y);
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // 雨丝
      if (this.weather === 'rain') {
        ctx.strokeStyle = 'rgba(116, 185, 255, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const maxRain = Math.min(this.rainDrops.length, Math.max(12, budget));
        for (let i = 0; i < maxRain; i++) {
          const r = this.rainDrops[i];
          if (r.x < minX || r.x - 4 > maxX) continue;
          ctx.moveTo(r.x, r.y);
          ctx.lineTo(r.x - 3, r.y + r.len);
        }
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
