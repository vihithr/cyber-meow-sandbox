/**
 * Cyber Meow Sandbox — Next-Gen Procedural Cat Agent & Kinematic Rig (FUSED EDITION)
 * 纯原生 HTML5 Canvas 2D + Web Audio API · 零外部素材依赖
 *
 * 核心架构融合：
 * 1. 运动学与渲染核心（来自首席生物视觉模型设计）：
 *    - 5 节段铰接腰椎骨骼（Croup 十字部 -> Pelvis 骨盆 -> Rear/Front Lumbar 腰椎 -> Withers 鬐甲）
 *    - 国际动物学 4 拍侧序漫步步态（Zoological 4-Beat Lateral Sequence: BL 0.00 -> FL 0.24 -> BR 0.50 -> FR 0.74）
 *    - 6 关键帧 Catmull-Rom 样条，前足着地缓冲（Impact Cushion）精准联动肩胛骨耸起与腰椎横滚
 *    - 零穿帮 3 段式趾行动物解剖肢体（两段解析式 IK solve2Bone + 实心圆盘关节点 + 切线梯形填充）
 *    - WSAVA 国际猫咪体况评分（BCS 2-9）+ 阈值平滑连续毛蓬度（Fluff 0-1）+ 原始袋（Primordial Pouch）悬垂
 *    - 3/4 雕塑微观面部：平缓颅顶、眼窝微凹、饱满双球胡须垫（Whisker Pads）、下巴垫与 `:3` 唇线
 *    - 宝石级多层水晶猫眼（Gemstone Eyes）：孔径裁切、径向彩虹膜、透镜焦散反光月牙、动态狭缝-大圆瞳孔与双高光
 *    - 全局共享 64x64 离线微毛发纹理（_sharedFurTile）极速 60 FPS 渲染
 * 2. 深度行为与战术大脑（10 大猫生大计 + 赛博混沌生态）：
 *    - 真实生理驱动引擎：饥饿衰减、精力耗散、无聊累积、激光挫败感、抚摸过载度
 *    - 10 大猫生战术大计 (THRONEC_QUEST, TREE_CLIMB, AERIAL_PATROL, STEALTH_HUNT, FEEDER_CAMP, MISCHIEF_DEMO, BELLY_TRAP, SUNBEAM_PILGRIM, PARKOUR_CIRCUIT)
 *    - 霸念与创想：空降跳杀扑击 (Aerial Pounce)、吊桥狭路相逢猫猫拳对决 (Bridge Duel)、高台手贱推落碎裂 (Knock-over)、窗外观鸟齿颤 (Ek-ek-ek Chattering)、依偎舔毛过载反咬、凌晨 3:00 虚空注视与全屋狂飙 (3 AM Greebles & Midnight Zoomies)
 */
(function(window) {
  'use strict';

  const { MathUtils, VerletChain, physicsWorld, soundEngine } = window.CyberMeow;

  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const CAT_NAMES = [
    '芝麻', '年糕', '大橘', '皮皮', '布丁', '奥利奥', '咪咪', '豆包', '雪球', '琥珀', '抹茶', '炭炭', '奶茶', '花卷'
  ];

  // ============================================================================
  // 1. BREED CONFIGURATIONS (融合高阶调色板与解剖学生物先验)
  // ============================================================================
  const BREEDS_CONFIG = [
    {
      id: 'orange',
      name: '橘猫',
      bodyColor: '#e58e35',
      lightColor: '#f6c27a',
      shadowColor: '#b35b14',
      bellyColor: '#fcf0dc',
      eyeColor: '#36b065',
      eyeRightColor: null,
      earColor: '#eea0a0',
      noseColor: '#dd7676',
      noseDark: '#9e4747',
      chunky: true,
      tabby: true,
      hasStripes: true,
      stripeColor: '#ad5310',
      prior: { skullW: 1.04, earSize: 1.02, earSpread: 0.60, eyeSlant: 0.12, muzzle: 0.56, legRatio: 1.05, bcs: 6.0, fluff: 0.32 }
    },
    {
      id: 'tuxedo',
      name: '奶牛猫',
      bodyColor: '#273240',
      lightColor: '#44556b',
      shadowColor: '#141b24',
      bellyColor: '#f7f8fa',
      eyeColor: '#3bc975',
      eyeRightColor: null,
      earColor: '#e69ea6',
      noseColor: '#eb96a4',
      noseDark: '#a85a68',
      hasMask: true,
      socks: true,
      prior: { skullW: 0.99, earSize: 1.05, earSpread: 0.58, eyeSlant: 0.15, muzzle: 0.58, legRatio: 1.08, bcs: 5.0, fluff: 0.24 }
    },
    {
      id: 'blue',
      name: '英短蓝猫',
      bodyColor: '#7c8b99',
      lightColor: '#a5b4c2',
      shadowColor: '#4f5d6b',
      bellyColor: '#c6d1db',
      eyeColor: '#e5921c',
      eyeRightColor: null,
      earColor: '#a79fa8',
      noseColor: '#4e5863',
      noseDark: '#2c333b',
      chunky: true,
      velvet: true,
      prior: { skullW: 1.15, earSize: 0.84, earSpread: 0.66, eyeSlant: 0.00, muzzle: 0.40, legRatio: 0.97, bcs: 6.2, fluff: 0.54 }
    },
    {
      id: 'white',
      name: '纯白异瞳',
      bodyColor: '#f5f6fa',
      lightColor: '#ffffff',
      shadowColor: '#cbd3e3',
      bellyColor: '#ffffff',
      eyeColor: '#2f92e6',
      eyeRightColor: '#e8b326',
      earColor: '#f5b5c0',
      noseColor: '#f098a6',
      noseDark: '#bd6876',
      prior: { skullW: 1.01, earSize: 1.03, earSpread: 0.59, eyeSlant: 0.13, muzzle: 0.54, legRatio: 1.06, bcs: 5.0, fluff: 0.45 }
    },
    {
      id: 'calico',
      name: '三花猫',
      bodyColor: '#faf5ed',
      lightColor: '#ffffff',
      shadowColor: '#dad1c4',
      bellyColor: '#ffffff',
      eyeColor: '#24b399',
      eyeRightColor: null,
      earColor: '#e8a2a0',
      noseColor: '#e6888e',
      noseDark: '#a6545a',
      hasPatches: true,
      prior: { skullW: 1.01, earSize: 1.02, earSpread: 0.60, eyeSlant: 0.14, muzzle: 0.56, legRatio: 1.06, bcs: 5.2, fluff: 0.30 }
    },
    {
      id: 'siamese',
      name: '暹罗猫',
      bodyColor: '#efe6d8',
      lightColor: '#faf5ec',
      shadowColor: '#c9baa5',
      bellyColor: '#f7f1e7',
      eyeColor: '#2b80de',
      eyeRightColor: null,
      earColor: '#59473d',
      noseColor: '#3a2d26',
      noseDark: '#1c1512',
      isPointColor: true,
      pointColor: '#3d2e26',
      prior: { skullW: 0.88, earSize: 1.24, earSpread: 0.65, eyeSlant: 0.25, muzzle: 0.74, legRatio: 1.15, bcs: 4.2, fluff: 0.10 }
    }
  ];

  // 既保持数组索引访问（BREEDS[0]），又支持字典属性访问（BREEDS.orange）
  const BREEDS = BREEDS_CONFIG;
  BREEDS_CONFIG.forEach(b => { BREEDS[b.id] = b; });

  const PERSONALITIES = [
    { id: 'GLUTTON', name: '贪吃鬼 🍗', desc: '满脑子都是小鱼干，闻到香味就会飞奔，吃饱后喜欢舔毛。' },
    { id: 'ZOOMER', name: '跑酷狂人 ⚡', desc: '精力充沛，热衷登高与夜半暴冲，追逐红点速度加倍！' },
    { id: 'CHILL', name: '佛系咸鱼 💤', desc: '随遇而安，最喜欢在阳光下母鸡蹲或在箱子里长睡不醒。' },
    { id: 'CLINGY', name: '超级粘人 🥰', desc: '喜欢寸步不离跟随人手，被摸时发出满分共鸣呼噜。' },
    { id: 'CURIOUS', name: '好奇宝宝 🔍', desc: '热衷高空推物、观鸟嗑牙与研究扫地机，是天生的物理学家！' }
  ];

  const HATS = ['none', 'bell', 'bow', 'wizard', 'party'];

  // 10 大真实猫生战术大计 (Feline Strategic Agendas)
  const AGENDAS = {
    NONE: 'NONE',                       // 自由日常
    THRONEC_QUEST: 'THRONEC_QUEST',     // 登高霸权：夺取豪宅最高王座与蔑视俯瞰
    TREE_CLIMB: 'TREE_CLIMB',           // 阶梯攀爬：猫爬架抱柱磨爪、阶梯飞跃与狂拍吊球
    AERIAL_PATROL: 'AERIAL_PATROL',     // 飞天巡视：穿梭空中天桥、高空俯瞰与吊床荡秋千
    STEALTH_HUNT: 'STEALTH_HUNT',       // 隐秘刺客：一二三木头人战术潜行突袭
    FEEDER_CAMP: 'FEEDER_CAMP',         // 守仓黑客：蹲守自动投喂机与猫爪拍机敲碗
    MISCHIEF_DEMO: 'MISCHIEF_DEMO',     // 搞事拆迁：跳台边缘试探轻推与暴击推物打碎
    BELLY_TRAP: 'BELLY_TRAP',           // 心机碰瓷：光标前翻肚皮假意求摸过载反咬
    SUNBEAM_PILGRIM: 'SUNBEAM_PILGRIM', // 逐日朝圣：巡游大平层追随阳光光斑
    PARKOUR_CIRCUIT: 'PARKOUR_CIRCUIT'  // 战术跑酷：三维跳台高速连跳与侧滑急停
  };

  const CAT_NOMINAL_DT = 1 / 60;
  const CAT_MAX_DT = 0.05;
  // 猫咪视觉体型分母：scaleFactor = radius / 该值。数值越大猫越小。
  // 24 是旧值（视觉约为碰撞体 3 倍），34 仍明显偏大；44 使视觉身长接近碰撞直径。
  // 想调整大小只改这里，不影响物理碰撞、交互判定与存档。
  const CAT_VISUAL_SCALE_DENOM = 44;

  // 自适应画质：由主循环写入全局，渲染时按档位跳过昂贵的微细节
  function currentRenderQuality() {
    return (typeof window !== 'undefined' && window.CyberMeow && window.CyberMeow.renderQuality) || 'high';
  }

  // 起跳弹道计算
  function calcJumpArc(rise, fallOffset = 1) {
    const g = physicsWorld.getGravity();
    if (!Number.isFinite(g) || g <= 0) return null;
    const vy = -Math.sqrt(2 * g * Math.max(1, rise));
    const tApex = Math.abs(vy) / g;
    const tFall = Math.sqrt(2 * Math.max(1, fallOffset) / g);
    return { vy: vy, totalFrames: Math.max(14, tApex + tFall) };
  }

  // ============================================================================
  // 2. MATH, PRNG & PERIODIC 6-KEYFRAME FELINE GAIT SPLINE
  // ============================================================================
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 6-Keyframe 真实猫咪不对称步态曲线 (Soft Toe Plant -> Cushion -> Push -> Peel-Off -> Glide -> Hover)
  const GAIT_KEYS = [
    { u: 0.00, x:  1.00, y: 0.00, curl: 0.04, cush: 0.00 },
    { u: 0.14, x:  0.58, y: 0.00, curl: 0.00, cush: 1.00 },
    { u: 0.45, x: -0.45, y: 0.00, curl: 0.00, cush: 0.10 },
    { u: 0.62, x: -1.00, y: 0.10, curl: 0.90, cush: 0.00 },
    { u: 0.78, x:  0.10, y: 0.96, curl: 1.00, cush: 0.00 },
    { u: 0.92, x:  0.93, y: 0.34, curl: 0.26, cush: 0.00 }
  ];

  function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
      2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
  }

  function sampleFelineGait(phase) {
    const u = ((phase / TAU) % 1 + 1) % 1;
    const n = GAIT_KEYS.length;
    let idx = 0;
    for (let i = 0; i < n; i++) {
      const nextU = i === n - 1 ? 1.0 : GAIT_KEYS[i + 1].u;
      if (u >= GAIT_KEYS[i].u && u <= nextU) { idx = i; break; }
    }
    const k0 = GAIT_KEYS[(idx - 1 + n) % n];
    const k1 = GAIT_KEYS[idx];
    const k2 = GAIT_KEYS[(idx + 1) % n];
    const k3 = GAIT_KEYS[(idx + 2) % n];
    const uStart = k1.u;
    const uEnd = idx === n - 1 ? 1.0 : k2.u;
    const localT = clamp((u - uStart) / Math.max(0.001, uEnd - uStart), 0, 1);

    const x = clamp(catmullRom(k0.x, k1.x, k2.x, k3.x, localT), -1.08, 1.08);
    const yRaw = catmullRom(k0.y, k1.y, k2.y, k3.y, localT);
    const y = u < 0.54 ? 0 : Math.max(0, yRaw);
    const curl = clamp(catmullRom(k0.curl, k1.curl, k2.curl, k3.curl, localT), 0, 1);
    const cush = clamp(catmullRom(k0.cush, k1.cush, k2.cush, k3.cush, localT), 0, 1);
    return { x, y, curl, cush };
  }

  function generateCatGenome(breedId, seed = Math.floor(1000 + Math.random() * 8999)) {
    const breed = BREEDS[breedId] || BREEDS.orange || BREEDS_CONFIG[0];
    const p = breed.prior || { skullW: 1.0, earSize: 1.0, earSpread: 0.6, eyeSlant: 0.1, muzzle: 0.5, legRatio: 1.0, bcs: 5.0, fluff: 0.3 };
    const rand = mulberry32(seed);
    const jitter = (range) => (rand() - 0.5) * 2 * range;
    return {
      seed,
      skullW: clamp(p.skullW + jitter(0.07), 0.85, 1.20),
      earSize: clamp(p.earSize + jitter(0.12), 0.78, 1.30),
      earSpread: clamp(p.earSpread + jitter(0.05), 0.52, 0.70),
      eyeSlant: clamp(p.eyeSlant + jitter(0.07), -0.10, 0.28),
      eyeSize: 0.26 + rand() * 0.05,
      browWeight: rand() * 0.30,
      muzzle: clamp(p.muzzle + jitter(0.09), 0.32, 0.80),
      legRatio: p.legRatio || 1.0,
      blazeSkew: jitter(0.24),
      beautySpot: rand() > 0.55 ? (rand() > 0.5 ? 1 : -1) : 0,
      patchA: { x: jitter(0.50), y: -0.38 + jitter(0.18), rx: 0.36 + rand() * 0.24, ry: 0.28 + rand() * 0.18 },
      patchB: { x: jitter(0.50), y: -0.25 + jitter(0.22), rx: 0.30 + rand() * 0.24, ry: 0.24 + rand() * 0.18 },
      whiskerDroop: 0.08 + rand() * 0.14,
      lynxTip: rand() > 0.55
    };
  }

  // ============================================================================
  // 3. SHARED OFFSCREEN MICRO-FUR TEXTURE (全局共享离线微毛发纹理 — 60 FPS)
  // ============================================================================
  let _sharedFurTile = null;
  function getFurPattern(ctx) {
    if (typeof document === 'undefined') return null;
    if (!_sharedFurTile) {
      _sharedFurTile = document.createElement('canvas');
      _sharedFurTile.width = 64;
      _sharedFurTile.height = 64;
      const fctx = _sharedFurTile.getContext('2d');
      if (fctx) {
        const rand = mulberry32(99123);
        for (let i = 0; i < 240; i++) {
          const fx = rand() * 64;
          const fy = rand() * 64;
          const len = 3 + rand() * 5;
          fctx.strokeStyle = i % 2 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
          fctx.lineWidth = 0.8;
          fctx.beginPath();
          fctx.moveTo(fx, fy);
          fctx.lineTo(fx + len, fy + (rand() - 0.5) * 1.6);
          fctx.stroke();
        }
      }
    }
    try {
      return ctx.createPattern(_sharedFurTile, 'repeat');
    } catch (e) {
      return null;
    }
  }

  // ============================================================================
  // 4. ANALYTIC 2-BONE IK & SEAMLESS ZERO-HOLE LIMB RENDERING (两段解析式 IK)
  // ============================================================================
  function solve2Bone(ax, ay, tx, ty, L1, L2, bendSign) {
    const dx = tx - ax;
    const dy = ty - ay;
    const dRaw = Math.hypot(dx, dy) || 0.001;
    const maxReach = (L1 + L2) * 0.985;
    const minReach = Math.abs(L1 - L2) + 1.5;
    const d = clamp(dRaw, minReach, maxReach);
    const base = Math.atan2(dy, dx);
    const cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
    const ang = base + bendSign * Math.acos(cosA);
    return {
      jx: ax + Math.cos(ang) * L1,
      jy: ay + Math.sin(ang) * L1,
      ex: ax + (dx / dRaw) * d,
      ey: ay + (dy / dRaw) * d
    };
  }

  function drawSeamlessSegment(ctx, a, b, rA, rB, color) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 0.001;
    const nx = -dy / d;
    const ny = dx / d;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(a.x + nx * rA, a.y + ny * rA);
    ctx.lineTo(b.x + nx * rB, b.y + ny * rB);
    ctx.lineTo(b.x - nx * rB, b.y - ny * rB);
    ctx.lineTo(a.x - nx * rA, a.y - ny * rA);
    ctx.closePath();
    ctx.fill();

    // 关节点实心圆盘，在数学上彻底杜绝任意屈伸折叠角度下的接缝穿帮裂隙
    ctx.beginPath();
    ctx.moveTo(a.x + rA, a.y);
    ctx.arc(a.x, a.y, rA, 0, TAU);
    ctx.moveTo(b.x + rB, b.y);
    ctx.arc(b.x, b.y, rB, 0, TAU);
    ctx.fill();
  }

  // 同色多段肢体一次 fill：把原本每段各自的梯形+关节圆盘合并进同一条 path。
  // segments: [{a,b,ra,rb}, ...]；discs: [{x,y,r}, ...]（同一关节可有两个半径，
  // 与原 drawSeamlessSegment 调用完全一致，因此视觉无差异）。
  function fillLimbChain(ctx, segments, discs, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      const dx = s.b.x - s.a.x;
      const dy = s.b.y - s.a.y;
      const d = Math.hypot(dx, dy) || 0.001;
      const nx = -dy / d;
      const ny = dx / d;
      ctx.moveTo(s.a.x + nx * s.ra, s.a.y + ny * s.ra);
      ctx.lineTo(s.b.x + nx * s.rb, s.b.y + ny * s.rb);
      ctx.lineTo(s.b.x - nx * s.rb, s.b.y - ny * s.rb);
      ctx.lineTo(s.a.x - nx * s.ra, s.a.y - ny * s.ra);
      ctx.closePath();
    }
    for (let i = 0; i < discs.length; i++) {
      const c = discs[i];
      ctx.moveTo(c.x + c.r, c.y);
      ctx.arc(c.x, c.y, c.r, 0, TAU);
    }
    ctx.fill();
  }

  // ============================================================================
  // 5. LIVING CAT AGENT CLASS (融合视觉骨骼与智慧决策引擎)
  // ============================================================================
  class Cat {
    constructor(xOrOptions = 0, y = 0, customConfig = {}) {
      let posX = 0;
      let posY = 0;
      let cfg = {};

      if (typeof xOrOptions === 'object' && xOrOptions !== null) {
        posX = xOrOptions.x ?? 0;
        posY = xOrOptions.y ?? 0;
        cfg = xOrOptions;
      } else {
        posX = xOrOptions ?? 0;
        posY = y ?? 0;
        cfg = customConfig || {};
      }

      this.id = cfg.id || 'cat_' + Math.random().toString(36).substring(2, 9);
      this.name = cfg.name || CAT_NAMES[Math.floor(Math.random() * CAT_NAMES.length)];

      // 品种解析 (支持字符串 id 或对象配置)
      let resolvedBreed = null;
      if (typeof cfg.breed === 'string') {
        resolvedBreed = BREEDS[cfg.breed] || BREEDS_CONFIG.find(b => b.id === cfg.breed);
      } else if (cfg.breed && typeof cfg.breed === 'object') {
        resolvedBreed = cfg.breed;
      }
      this.breed = resolvedBreed || BREEDS_CONFIG[Math.floor(Math.random() * BREEDS_CONFIG.length)];
      this.personality = cfg.personality || PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
      this.hat = cfg.hat || HATS[Math.floor(Math.random() * HATS.length)];

      // 空间位置与物理运动学
      this.x = posX;
      this.y = posY;
      this.vx = cfg.vx ?? (Math.random() - 0.5) * 2;
      this.vy = cfg.vy ?? 0;
      this.radius = cfg.radius ?? (this.breed.chunky ? 26 : 22);
      this.facing = cfg.facing ?? (this.vx >= 0 ? 1 : -1);

      // 解剖形态与多维变体参数 (Morphable Body Parameters)
      this.age = cfg.age ?? (0.65 + (Math.random() - 0.5) * 0.35); // 0: 奶猫 -> 1: 成年猫
      this.bcs = cfg.bcs ?? (this.breed.prior?.bcs ?? (this.breed.chunky ? 6.2 : 5.0)); // WSAVA 体况评分
      this.fluff = cfg.fluff ?? (this.breed.prior?.fluff ?? 0.35); // 0-1 蓬松度
      this.dna = cfg.dna || generateCatGenome(this.breed.id, cfg.seed || Math.floor(Math.random() * 99999));

      // Verlet 物理尾巴 (保留 5 节段供接口兼容，同时渲染升级为 7 节点真实骨骼)
      this.tailChain = new VerletChain(this.x, this.y, 5, 7);

      // --- 生理驱动引擎 (Drive Engine) ---
      this.hunger = 75;         // 0-100, 持续衰减
      this.energy = 85;         // 0-100, 活动消耗, 睡眠恢复
      this.boredom = 10;        // 0-100, 积攒到 80+ 触发 Zoomies 狂奔
      this.affection = 60;      // 0-100, 亲密度
      this.purrLevel = 0;       // 0-1.0
      this.laserFrustration = 0;// 追激光抓不到的挫败感
      this.overstimulation = 0; // 抚摸与舔毛过载度 (过载触发暴起反咬)
      this.catnipEnergy = 0;    // 猫薄荷能量
      this.pitchMod = 0.9 + Math.random() * 0.25;

      // --- 行为状态机与战术大计 ---
      this.state = cfg.state || 'idle';
      this.stateTimer = 60;
      this.currentAgenda = AGENDAS.NONE;
      this.agendaTarget = null;
      this.agendaPhase = 0;
      this.agendaTimer = 0;

      // 视觉动画相位计时器
      this.walkCycle = 0;
      this.kneadCycle = 0;
      this.loafBreathe = 0;
      this.climbCycle = 0;
      this.buttWiggle = 0;
      this.chatterPhase = 0;
      this.swatProgress = 0;
      this.bunnyKickPhase = 0;
      this.headTilt = 0;
      this.pupilDilation = cfg.pupilDilation ?? 0.5;
      this.isBlinking = false;
      this.grabStretch = 1.0;
      this.isGrabbed = false;
      this.inBox = null;
      this.ridingObj = null;
      this.perchedTier = null;
      this.onBridge = false;          // 落在悬索桥上时同步为桥对象，供对决/空降判定使用
      this.bridgeRival = null;
      this.aerialTarget = null;
      this.aerialTargetType = null;
      this.inHammock = false;
      this.heldYarn = null;
      this.rival = null;

      // 冷却器
      this.yarnCooldown = 0;
      this.socialCooldown = 0;
      this.socialTimer = 0;
      this.blinkTimer = 120 + Math.random() * 200;
      this.rideTimer = 0;
      this.boxTimer = 0;
      this._frameStep = 1;
      this._lastDt = CAT_NOMINAL_DT;

      // 喵语同传与意图徽章
      this.bubbleText = null;
      this.bubbleTimer = 0;
      this.intentIcon = null;
      this.intentLabel = null;

      // 内部临界阻尼骨骼平滑状态 (Critically-Damped Rig State)
      this._tailPhase = 0;
      this._blinkTimerSec = 2.5 + Math.random() * 2.5;
      this._blinkAmt = 0;
      this._climbBlend = 0;   // 爬树姿态平滑因子（0=常态，1=完全贴柱竖立）
      this.lookTarget = null; // 视线注视点
      this._smooth = {
        initialized: false,
        hipX: 0, hipY: 0, shX: 0, shY: 0, midY: 0, neckX: 0, neckY: 0,
        scapCrest: 0, gazeX: 0.2, gazeY: 0.05, headTurn: 0.38,
        legs: [null, null, null, null]
      };

      // 渲染渐变缓存：局部坐标系下参数固定的渐变跨帧复用，避免每帧 createGradient
      this._gradCache = new Map();
    }

    speak(text) {
      this.bubbleText = text;
      this.bubbleTimer = 160;
    }

    // 局部坐标系渐变缓存：key 由用途与固定尺寸/颜色组成，跨帧命中后不再 createGradient
    _cachedGradient(key, ctx, factory) {
      let g = this._gradCache.get(key);
      if (g === undefined) {
        // 防御性上限：正常 key 均为静态组合，远低于此值；若未来误加动态 key，
        // 超限时整体清空而非无限增长，避免长时间会话的 Map 泄漏。
        if (this._gradCache.size >= 64) this._gradCache.clear();
        g = factory(ctx);
        this._gradCache.set(key, g);
      }
      return g;
    }

    // 在已被 facing 镜像／爬树旋转的坐标系里正向绘制文字。
    // 用 render() 抓取的 textCTM（仅平移+缩放，不含姿态旋转）重置，再反向抵消 facing。
    _drawUprightText(ctx, draw) {
      const ctm = this._textCTM;
      if (!ctm) { draw(); return; }
      ctx.save();
      ctx.setTransform(ctm.a, ctm.b, ctm.c, ctm.d, ctm.e, ctm.f);
      ctx.scale(this.facing, 1);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      draw();
      ctx.restore();
    }

    _dampPt(cur, target, rate, dt) {
      const k = 1 - Math.exp(-rate * dt);
      return { x: lerp(cur.x, target.x, k), y: lerp(cur.y, target.y, k) };
    }

    _dampLeg(idx, targetLeg, dt) {
      const s = this._smooth;
      if (!s.legs[idx]) {
        s.legs[idx] = {
          p0: { ...targetLeg.p0 }, p1: { ...targetLeg.p1 },
          p2: { ...targetLeg.p2 }, p3: { ...targetLeg.p3 },
          curl: targetLeg.curl, yLift: targetLeg.yLift
        };
        return s.legs[idx];
      }
      const cur = s.legs[idx];
      const rate = 20;
      cur.p0 = this._dampPt(cur.p0, targetLeg.p0, rate, dt);
      cur.p1 = this._dampPt(cur.p1, targetLeg.p1, rate, dt);
      cur.p2 = this._dampPt(cur.p2, targetLeg.p2, rate, dt);
      cur.p3 = this._dampPt(cur.p3, targetLeg.p3, rate, dt);
      cur.curl = lerp(cur.curl, targetLeg.curl, 1 - Math.exp(-16 * dt));
      cur.yLift = lerp(cur.yLift, targetLeg.yLift, 1 - Math.exp(-18 * dt));
      return cur;
    }

    // 爬树专用爪位：身体被旋转 -90° 后，局部 +Y 指向柱面（屏幕右/左由 facing 决定）。
    // 四爪沿局部 X（旋转后为屏幕竖直方向）对角交替抓握，由 climbCycle 驱动，避免四爪定格。
    _computeClimbLeg(anchor, phaseOffset, baseX, scale) {
      const reach = Math.sin(this.climbCycle + phaseOffset);
      const tx = baseX + reach * 20 * scale;          // 沿柱面上下交替
      const ty = 26 + (1 - Math.cos(this.climbCycle + phaseOffset)) * 5 * scale; // 抓握深度
      const curl = 0.45 + Math.abs(reach) * 0.4;      // 抓握弯曲度随相位变化
      const L1 = 22 * scale;
      const L2 = 26 * scale;
      const ik = solve2Bone(anchor.x, anchor.y, tx, ty, L1, L2, +1);
      const pawAng = lerp(0.2, 1.1, curl);
      const px = lerp(tx, ik.ex + Math.cos(pawAng) * 7 * 0.6, curl);
      const py = lerp(ty, ik.ey + Math.sin(pawAng) * 7, curl);
      return { p0: anchor, p1: { x: ik.jx, y: ik.jy }, p2: { x: ik.ex, y: ik.ey }, p3: { x: px, y: py }, curl, yLift: 0 };
    }

    _computeFrontLeg(shoulder, gSample, baseX, stride, lift, scale, isWalk) {
      const tx = isWalk ? baseX + gSample.x * stride : baseX;
      const ty = isWalk ? -gSample.y * lift : 0;
      const curl = isWalk ? gSample.curl : 0;
      const cush = isWalk ? gSample.cush : 0;

      const L1 = 22.5 * scale;
      const L2 = 30.5 * scale;
      const L3 = 8.0 * scale;
      const wx = tx - curl * 7.0 * scale;
      const wy = ty - L3 * (1 - curl * 0.25 - cush * 0.12);
      const ik = solve2Bone(shoulder.x, shoulder.y, wx, wy, L1, L2, +1);

      const pawAng = lerp(0.05, 1.35, curl);
      const px = lerp(tx, ik.ex + Math.cos(pawAng) * L3 * 0.65, curl);
      const py = lerp(ty, ik.ey + Math.sin(pawAng) * L3, curl);
      return { p0: shoulder, p1: { x: ik.jx, y: ik.jy }, p2: { x: ik.ex, y: ik.ey }, p3: { x: px, y: py }, curl, yLift: isWalk ? gSample.y : 0 };
    }

    _computeHindLeg(hip, gSample, baseX, stride, lift, scale, isWalk) {
      const tx = isWalk ? baseX + gSample.x * stride : baseX;
      const ty = isWalk ? -gSample.y * lift : 0;
      const curl = isWalk ? gSample.curl : 0;
      const pushExt = isWalk ? clamp(-gSample.x, 0, 1) : 0;

      const L1 = 26.5 * scale;
      const L2 = 29.0 * scale;
      const L3 = 15.0 * scale;
      const hockBack = lerp(8.5, 1.5, pushExt) + curl * 4.5;
      const hockX = tx - hockBack * scale;
      const hockY = ty - L3 * (0.95 - curl * 0.16);
      const ik = solve2Bone(hip.x, hip.y, hockX, hockY, L1, L2, -1);
      return { p0: hip, p1: { x: ik.jx, y: ik.jy }, p2: { x: ik.ex, y: ik.ey }, p3: { x: tx, y: ty }, curl, yLift: isWalk ? gSample.y : 0 };
    }

    _drawLegMesh(ctx, leg, isHind, isFar, torsoMidY) {
      const breed = this.breed;
      const lowQuality = currentRenderQuality() === 'low';
      const bcsNorm = clamp((this.bcs - 2) / 7, 0, 1);
      const fluff = this.fluff;
      const thick = lerp(0.86, 1.18, bcsNorm) * lerp(0.95, 1.18, fluff) * lerp(0.92, 1.0, this.age);

      ctx.save();
      let upperCol = isFar ? breed.shadowColor : breed.bodyColor;
      if (!isFar && torsoMidY !== undefined && currentRenderQuality() !== 'low') {
        const lg = ctx.createLinearGradient(leg.p0.x, torsoMidY - 26, leg.p0.x, leg.p2.y + 10);
        lg.addColorStop(0, breed.lightColor);
        lg.addColorStop(0.52, breed.bodyColor);
        lg.addColorStop(1, breed.shadowColor);
        upperCol = lg;
      }
      const lowerCol = breed.isPointColor ? breed.pointColor : (isFar ? breed.shadowColor : breed.bodyColor);
      const pawCol = breed.socks ? breed.bellyColor : (breed.isPointColor ? breed.pointColor : (isFar ? breed.shadowColor : breed.bodyColor));

      if (isHind) {
        // 猫科侧腹柔软皮褶 (Flank Web - 腹底平滑连入膝盖前侧)
        if (!isFar && !lowQuality) {
          ctx.fillStyle = upperCol;
          ctx.beginPath();
          ctx.moveTo(leg.p0.x + 12, leg.p0.y - 6);
          ctx.quadraticCurveTo(leg.p1.x + 12, (leg.p0.y + leg.p1.y) * 0.52, leg.p1.x + 4, leg.p1.y + 2);
          ctx.lineTo(leg.p0.x - 10, leg.p0.y + 4);
          ctx.closePath();
          ctx.fill();
        }
        // 上臂两段同色，合并进同一条 path（圆盘半径各自保留，视觉与原两段一致）
        fillLimbChain(ctx, [
          { a: leg.p0, b: leg.p1, ra: 13.0 * thick, rb: 8.8 * thick },
          { a: leg.p1, b: leg.p2, ra: 8.6 * thick, rb: 5.0 * thick }
        ], [
          { x: leg.p0.x, y: leg.p0.y, r: 13.0 * thick },
          { x: leg.p1.x, y: leg.p1.y, r: 8.8 * thick },
          { x: leg.p1.x, y: leg.p1.y, r: 8.6 * thick },
          { x: leg.p2.x, y: leg.p2.y, r: 5.0 * thick }
        ], upperCol);
        drawSeamlessSegment(ctx, leg.p2, leg.p3, 4.8 * thick, 4.1 * thick, lowerCol);

        // 阈值平滑连续毛裤腿 (Britches Fur)
        if (fluff > 0.005 && !lowQuality) {
          const bScale = fluff * fluff;
          ctx.save();
          ctx.globalAlpha = clamp(fluff * 1.15, 0, 1);
          ctx.fillStyle = upperCol;
          const midBackX = (leg.p0.x + leg.p2.x) * 0.5 - (3 + bScale * 10);
          const midBackY = (leg.p0.y + leg.p2.y) * 0.50;
          ctx.beginPath();
          ctx.ellipse(midBackX + 4, midBackY, 2 + bScale * 10.5, 4 + bScale * 12.5, -0.22, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
      } else {
        drawSeamlessSegment(ctx, leg.p0, leg.p1, 9.8 * thick, 7.0 * thick, upperCol);
        if (lowerCol === pawCol) {
          // 下臂与掌同色（多数品种），两段合并为一次 fill
          fillLimbChain(ctx, [
            { a: leg.p1, b: leg.p2, ra: 6.8 * thick, rb: 4.4 * thick },
            { a: leg.p2, b: leg.p3, ra: 4.3 * thick, rb: 3.9 * thick }
          ], [
            { x: leg.p1.x, y: leg.p1.y, r: 6.8 * thick },
            { x: leg.p2.x, y: leg.p2.y, r: 4.4 * thick },
            { x: leg.p2.x, y: leg.p2.y, r: 4.3 * thick },
            { x: leg.p3.x, y: leg.p3.y, r: 3.9 * thick }
          ], lowerCol);
        } else {
          drawSeamlessSegment(ctx, leg.p1, leg.p2, 6.8 * thick, 4.4 * thick, lowerCol);
          drawSeamlessSegment(ctx, leg.p2, leg.p3, 4.3 * thick, 3.9 * thick, pawCol);
        }
      }

      const sq = lerp(1.15, 0.90, leg.yLift);
      const pawRot = lerp(0, 0.55, leg.curl);
      ctx.fillStyle = pawCol;
      ctx.beginPath();
      ctx.ellipse(leg.p3.x + 3.6, leg.p3.y - 1.2, 6.2 * sq, 3.7 / sq, pawRot, 0, TAU);
      ctx.fill();

      if (!isFar && !lowQuality) {
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(leg.p3.x + 5.2, leg.p3.y - 1);
        ctx.lineTo(leg.p3.x + 8.0, leg.p3.y + 1.4);
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawTail(ctx, root, hipRoll, isClimbing) {
      const breed = this.breed;
      const pts = [];
      let x = root.x;
      let y = root.y;
      const segLen = lerp(8.0, 12.5, this.age);
      const tension = clamp(this.overstimulation / 100, 0, 1);
      // 爬树时身体旋转 -90°，尾巴应在屏幕上下垂（局部角度 ≈ +π/2），随爬升相位轻摆
      let ang = isClimbing
        ? Math.PI * 0.5 + Math.sin(this.climbCycle * 0.6) * 0.12
        : lerp(-Math.PI * 0.62, -Math.PI * 0.86, this.age) + hipRoll * 0.04;
      pts.push({ x, y });
      for (let i = 1; i <= 7; i++) {
        const k = i / 7;
        const curve = isClimbing ? 0.02 : lerp(0.06 - k * 0.10, 0.19 - k * 0.32, this.age);
        ang += curve + Math.sin(this._tailPhase - k * 2.1) * (isClimbing ? 0.04 : 0.08 + k * 0.09 + tension * 0.12);
        x += Math.cos(ang) * segLen;
        y += Math.sin(ang) * segLen;
        pts.push({ x, y });
      }
      ctx.save();
      ctx.lineCap = 'round';
      const plumeScale = (1 + Math.pow(this.fluff, 1.3) * 1.45) * (1 + tension * 0.25);
      // 低画质每两步取一个关节点：7 段降为 4 段，仍保留锥度与配色
      const tailStep = currentRenderQuality() === 'low' ? 2 : 1;
      for (let i = 0; i < pts.length - 1; i += tailStep) {
        const k = i / (pts.length - 1);
        const j = Math.min(i + tailStep, pts.length - 1);
        ctx.strokeStyle = (breed.isPointColor && k > 0.45) ? breed.pointColor : breed.bodyColor;
        if (breed.hasPatches && i >= 4) ctx.strokeStyle = '#332d2b';
        ctx.lineWidth = lerp(lerp(11.5, 10.2, this.age), lerp(4.2, 6.8, this.age), k) * plumeScale;
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[j].x, pts[j].y);
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawGemEye(ctx, cx, cy, rx, ry, slant, irisColor, browWeight, gazeX, gazeY, isRight) {
      const lowQuality = currentRenderQuality() === 'low';
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(slant);

      const innerX = isRight ? -rx : rx;
      const outerX = isRight ? rx : -rx;
      const blinkAmt = this._blinkAmt;

      // 呼噜眯眯眼 (^ ^)
      if (this.purrLevel > 0.72) {
        ctx.strokeStyle = 'rgba(24, 28, 34, 0.85)';
        ctx.lineWidth = 1.9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(innerX * 0.9, 1.5);
        ctx.quadraticCurveTo(0, -ry * 0.65, outerX * 0.9, 1.0);
        ctx.stroke();
        ctx.restore();
        return;
      }

      // 高台蔑视审视冷漠眼 (- -)
      if (this.state === 'judging_overlook') {
        ctx.strokeStyle = 'rgba(24, 28, 34, 0.9)';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(innerX * 1.05, 0);
        ctx.lineTo(outerX * 1.05, 0);
        ctx.stroke();
        ctx.restore();
        return;
      }

      const openRy = Math.max(1.2, ry * (1 - blinkAmt * 0.92));
      if (blinkAmt > 0.85) {
        ctx.strokeStyle = 'rgba(24, 28, 34, 0.82)';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(innerX, 1);
        ctx.quadraticCurveTo(0, 3.5, outerX, -0.5);
        ctx.stroke();
        ctx.restore();
        return;
      }

      const traceAperture = () => {
        ctx.beginPath();
        ctx.moveTo(innerX * 1.05, openRy * 0.22);
        ctx.bezierCurveTo(innerX * 0.4, -openRy * 1.15, outerX * 0.55, -openRy * 1.08, outerX * 1.02, -openRy * 0.08);
        ctx.bezierCurveTo(outerX * 0.55, openRy * 1.05, innerX * 0.35, openRy * 1.02, innerX * 1.05, openRy * 0.22);
        ctx.closePath();
      };

      ctx.save();
      traceAperture();
      ctx.clip();

      const gx = clamp(gazeX, -1, 1) * rx * 0.22;
      const gy = clamp(gazeY, -1, 1) * ry * 0.16;

      if (lowQuality) {
        // 低画质用纯色宝石眼，省掉每帧两只眼的径向渐变
        ctx.fillStyle = irisColor;
        ctx.fillRect(-rx * 1.3, -ry * 1.3, rx * 2.6, ry * 2.6);
      } else {
        // 渐变以固定基准半径创建，key 只依赖虹膜色；rx/ry 由绘制时的 scale 适配。
        // 远眼 rx 随头部转动逐帧变化，若纳入 key 会让 _gradCache 无限增长；此处固定 key 消除泄漏。
        const GEM_BASE = 10;
        const sx = rx / GEM_BASE;
        const sy = ry / GEM_BASE;
        ctx.save();
        ctx.scale(sx, sy);
        // scale 后再平移：实际世界偏移 = (gx, gy)，与原版的 translate(gx,gy) 等价
        ctx.translate(gx / sx, gy / sy);
        ctx.fillStyle = this._cachedGradient('gem_' + irisColor, ctx, (c) => {
          const grad = c.createRadialGradient(0, GEM_BASE * 0.22, GEM_BASE * 0.12, 0, 0, GEM_BASE * 1.18);
          grad.addColorStop(0, '#fff7cc');
          grad.addColorStop(0.26, irisColor);
          grad.addColorStop(0.80, irisColor);
          grad.addColorStop(1, '#10161e');
          return grad;
        });
        ctx.fillRect(-GEM_BASE * 1.3, -GEM_BASE * 1.3, GEM_BASE * 2.6, GEM_BASE * 2.6);
        ctx.restore();
      }

      // 底部透镜焦散反光月牙 (Caustic Crescent) — 低画质省略，保留瞳孔/高光即可辨识
      if (!lowQuality) {
        ctx.fillStyle = 'rgba(255, 255, 235, 0.36)';
        ctx.beginPath();
        ctx.ellipse(gx, gy + ry * 0.44, rx * 0.65, ry * 0.34, 0, 0, TAU);
        ctx.fill();
      }

      // 动态瞳孔调节 (年龄/激光挫败感/捕猎注视联动)
      const dil = clamp(this.pupilDilation + (this.laserFrustration / 100) * 0.35 + (1 - this.age) * 0.22, 0.1, 1.0);
      ctx.fillStyle = '#0c0f15';
      ctx.beginPath();
      ctx.ellipse(gx, gy, rx * lerp(0.20, 0.78, dil), ry * lerp(0.78, 0.86, dil), 0, 0, TAU);
      ctx.fill();

      // 上眼睑投影 (Upper Eyelid Shadow) — 渐变以 -openRy 为原点缓存，眨眼时临时平移保持一致
      // 压眼皮变浅，眼神由审视转为无辜（幼态关键）
      const lidH = ry * (0.28 + browWeight * 0.30);
      if (lowQuality) {
        ctx.fillStyle = 'rgba(12, 16, 24, 0.36)';
        ctx.fillRect(-rx * 1.3, -openRy - 2, rx * 2.6, lidH + 2);
      } else {
        ctx.save();
        ctx.translate(0, -openRy);
        ctx.fillStyle = this._cachedGradient('lid_' + lidH.toFixed(2), ctx, (c) => {
          const grad = c.createLinearGradient(0, 0, 0, lidH);
          grad.addColorStop(0, 'rgba(12, 16, 24, 0.72)');
          grad.addColorStop(1, 'rgba(12, 16, 24, 0)');
          return grad;
        });
        ctx.fillRect(-rx * 1.3, -2, rx * 2.6, lidH + 2);
        ctx.restore();
      }

      // 双高光灵动微光 (Dual Specular Catchlights)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
      ctx.ellipse(-rx * 0.28 + gx * 0.3, -ry * 0.25 + gy * 0.3, rx * 0.26, ry * 0.20, -0.32, 0, TAU);
      ctx.fill();
      if (!lowQuality) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
        ctx.beginPath();
        ctx.arc(rx * 0.28 + gx * 0.3, ry * 0.32 + gy * 0.3, rx * 0.11, 0, TAU);
        ctx.fill();
      }

      ctx.restore();

      ctx.strokeStyle = 'rgba(18, 22, 28, 0.78)';
      ctx.lineWidth = Math.max(1.1, rx * 0.12);
      traceAperture();
      ctx.stroke();

      ctx.restore();
    }

    _drawHead(ctx, hx, hy, R, furPattern) {
      const breed = this.breed;
      const dna = this.dna;
      const lowQuality = currentRenderQuality() === 'low';
      const turn = this._smooth.headTurn;
      const gazeX = this._smooth.gazeX;
      const gazeY = this._smooth.gazeY;
      const tension = clamp((this.overstimulation + this.laserFrustration * 0.5) / 100, 0, 1);
      const earAirplane = tension * 0.58;

      ctx.save();
      ctx.translate(hx, hy);
      // 头部微角度注视 + 观鸟嗑牙震颤
      const chatterOffset = this.state === 'chattering' ? Math.sin(this.chatterPhase * 3) * 0.08 : 0;
      ctx.rotate(this.headTilt + gazeY * 0.12 + chatterOffset);

      const cheekW = R * 1.04 * dna.skullW * lerp(0.93, 1.13, clamp((this.bcs - 2) / 7, 0, 1)) * (1 + this.fluff * 0.14);
      const muzzleShift = turn * R * 0.50;
      const muzzleShelf = dna.muzzle * R * 0.24;
      const crownY = -R * 0.66;

      const drawEar = (side) => {
        const isFar = side === 1;
        const px = side * R * dna.earSpread + (isFar ? -turn * R * 0.16 : -turn * R * 0.06);
        const py = crownY + R * 0.14;
        const h = R * 0.66 * dna.earSize; // 耳朵缩小，不抢脸部焦点
        const w = R * 0.38 * (isFar ? (1 - turn * 0.18) : 1);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(side * (0.20 + (dna.earSpread - 0.58) * 0.7 + earAirplane) - turn * 0.14);

        ctx.fillStyle = breed.isPointColor ? breed.pointColor : (isFar ? breed.shadowColor : breed.bodyColor);
        if (breed.hasPatches && side === -1) ctx.fillStyle = '#332d2b';
        if (breed.hasPatches && side === 1) ctx.fillStyle = '#df7d27';

        ctx.beginPath();
        ctx.moveTo(-w, R * 0.30);
        // 耳尖改圆钝（原尖角 → 平缓双二次曲线），幼态更友好
        ctx.quadraticCurveTo(-w * 0.85, -h * 0.92, -w * 0.22, -h);
        ctx.quadraticCurveTo(w * 0.22, -h, w * 0.85, -h * 0.92);
        ctx.quadraticCurveTo(w * 0.72, -h * 0.74, w, R * 0.30);
        ctx.closePath();
        ctx.fill();

        // 内耳渐变参数在耳局部坐标中固定（-h*0.65 → R*0.20），可直接缓存
        if (lowQuality) {
          ctx.fillStyle = breed.earColor;
        } else {
          ctx.fillStyle = this._cachedGradient('ear_' + R.toFixed(2) + '_' + h.toFixed(2) + '_' + breed.earColor, ctx, (c) => {
            const grad = c.createLinearGradient(0, -h * 0.65, 0, R * 0.20);
            grad.addColorStop(0, breed.earColor);
            grad.addColorStop(1, 'rgba(70, 42, 46, 0.36)');
            return grad;
          });
        }
        ctx.beginPath();
        ctx.moveTo(-w * 0.56, R * 0.18);
        ctx.quadraticCurveTo(-w * 0.38, -h * 0.48, 0, -h * 0.66);
        ctx.quadraticCurveTo(w * 0.38, -h * 0.48, w * 0.54, R * 0.18);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };

      drawEar(1);
      drawEar(-1);

      // 3/4 雕塑微观猫脸轮廓 (平缓颅顶 + 眉骨微弯 + 胡须垫外展 + 紧凑下颚)
      const chinY = R * 0.70; // 下颚抬高，脸型更圆润幼态
      const browX = cheekW * (0.86 - turn * 0.16);
      const eyeIndentX = cheekW * (0.94 - turn * 0.34);
      const muzzleOuterX = cheekW * (0.72 - turn * 0.10) + muzzleShelf * (0.35 + turn * 1.15);
      const leftCheekX = -cheekW * (1.02 + turn * 0.06);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-R * 0.42, crownY + R * 0.04);
      ctx.quadraticCurveTo(0, crownY - R * 0.06, R * 0.42, crownY + R * 0.04);
      ctx.bezierCurveTo(browX * 0.92, crownY + R * 0.14, browX, -R * 0.32, eyeIndentX, -R * 0.04);
      ctx.bezierCurveTo(eyeIndentX + R * 0.06, R * 0.12, muzzleOuterX, R * 0.24, muzzleOuterX * 0.96, R * 0.46);
      ctx.bezierCurveTo(muzzleOuterX * 0.82, R * 0.70, muzzleShift + R * 0.28, chinY, muzzleShift * 0.72, chinY);
      ctx.bezierCurveTo(-R * 0.28, chinY, leftCheekX * 0.74, R * 0.66, leftCheekX * 0.92, R * 0.34);
      ctx.quadraticCurveTo(leftCheekX * 1.04, R * 0.18, leftCheekX * 0.96, -R * 0.04);
      ctx.bezierCurveTo(leftCheekX * 0.86, -R * 0.42, -R * 0.64, crownY + R * 0.14, -R * 0.42, crownY + R * 0.04);
      ctx.closePath();
      ctx.clip();

      // 面部球形受光渐变参数全部为 R 的倍数，在头部局部坐标中固定，可缓存
      if (lowQuality) {
        ctx.fillStyle = breed.bodyColor;
      } else {
        ctx.fillStyle = this._cachedGradient('face_' + R.toFixed(2) + '_' + breed.id, ctx, (c) => {
          const grad = c.createRadialGradient(-R * 0.22, -R * 0.36, R * 0.1, 0, R * 0.05, R * 1.32);
          grad.addColorStop(0, breed.lightColor);
          grad.addColorStop(0.56, breed.bodyColor);
          grad.addColorStop(1, breed.shadowColor);
          return grad;
        });
      }
      ctx.fillRect(-cheekW * 1.5, -R * 1.1, cheekW * 3.0, R * 2.2);

      if (furPattern) {
        ctx.fillStyle = furPattern;
        ctx.fillRect(-cheekW * 1.5, -R * 1.1, cheekW * 3.0, R * 2.2);
      }

      // 品种专属面部标记
      if (breed.tabby) {
        ctx.strokeStyle = breed.stripeColor;
        ctx.lineWidth = Math.max(1.6, R * 0.068);
        ctx.lineCap = 'round';
        const mx = muzzleShift * 0.65;
        ctx.beginPath();
        ctx.moveTo(mx - R * 0.22, -R * 0.34);
        ctx.lineTo(mx - R * 0.14, -R * 0.58);
        ctx.lineTo(mx, -R * 0.44);
        ctx.lineTo(mx + R * 0.14, -R * 0.58);
        ctx.lineTo(mx + R * 0.22, -R * 0.34);
        ctx.stroke();
      } else if (breed.hasMask) {
        ctx.fillStyle = breed.bellyColor;
        const bx = muzzleShift + dna.blazeSkew * R * 0.22;
        ctx.beginPath();
        ctx.moveTo(bx, -R * 0.12);
        ctx.quadraticCurveTo(bx + R * 0.52, R * 0.26, cheekW * 1.05, R * 0.98);
        ctx.lineTo(-cheekW * 0.95, R * 0.98);
        ctx.quadraticCurveTo(bx - R * 0.52, R * 0.26, bx, -R * 0.12);
        ctx.closePath();
        ctx.fill();
      } else if (breed.isPointColor) {
        if (lowQuality) {
          ctx.fillStyle = 'rgba(61, 46, 38, 0.55)';
        } else {
          const mg = ctx.createRadialGradient(muzzleShift * 1.12, R * 0.22, R * 0.1, muzzleShift * 1.08, R * 0.20, R * 0.84);
          mg.addColorStop(0, breed.pointColor);
          mg.addColorStop(0.62, 'rgba(61, 46, 38, 0.76)');
          mg.addColorStop(1, 'rgba(61, 46, 38, 0)');
          ctx.fillStyle = mg;
        }
        ctx.fillRect(-cheekW * 1.4, -R * 1.1, cheekW * 2.8, R * 2.2);
      } else if (breed.hasPatches) {
        ctx.fillStyle = '#df7d27';
        ctx.beginPath();
        ctx.ellipse(dna.patchA.x * R, dna.patchA.y * R, dna.patchA.rx * R, dna.patchA.ry * R, 0.35, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#332d2b';
        ctx.beginPath();
        ctx.ellipse(dna.patchB.x * R, dna.patchB.y * R, dna.patchB.rx * R, dna.patchB.ry * R, -0.3, 0, TAU);
        ctx.fill();
      }
      ctx.restore();

      // 双眼绘制
      const kEyeScale = lerp(1.26, 1.0, this.age);
      const kSlant = lerp(dna.eyeSlant * 0.35, dna.eyeSlant, this.age);
      const kBrow = lerp(dna.browWeight * 0.35, dna.browWeight, this.age);
      const eyeY = -R * 0.02 + lerp(R * 0.05, 0, this.age);
      const nearEyeX = muzzleShift - R * 0.38;
      const farEyeX = muzzleShift + R * 0.35 * (1 - turn * 0.28);
      const eyeRx = R * dna.eyeSize * kEyeScale;
      const eyeRy = R * (dna.eyeSize * lerp(1.16, 1.06, this.age)) * kEyeScale;
      this._drawGemEye(ctx, nearEyeX, eyeY, eyeRx, eyeRy, -kSlant, breed.eyeColor, kBrow, gazeX, gazeY, false);
      this._drawGemEye(ctx, farEyeX, eyeY, eyeRx * (1 - turn * 0.26), eyeRy * 0.96, kSlant, breed.eyeRightColor || breed.eyeColor, kBrow, gazeX, gazeY, true);

      // 胡须垫双球 (Whisker Pads) + 下巴垫 + 人中 + ":3" 唇线
      const padY = R * 0.38;
      const padR = R * (0.18 + dna.muzzle * 0.05);
      const padNearX = muzzleShift - R * 0.16;
      const padFarX = muzzleShift + R * 0.15 * (1 - turn * 0.24);

      ctx.fillStyle = breed.isPointColor ? 'rgba(42, 31, 26, 0.45)' : 'rgba(255, 255, 255, 0.42)';
      ctx.beginPath();
      ctx.ellipse(muzzleShift * 0.92, padY + padR * 1.12, padR * 0.66, padR * 0.40, 0, 0, TAU);
      ctx.fill();

      ctx.fillStyle = breed.isPointColor ? 'rgba(42, 31, 26, 0.52)' : 'rgba(255, 255, 255, 0.48)';
      ctx.beginPath();
      ctx.ellipse(padNearX, padY, padR, padR * 0.86, 0, 0, TAU);
      ctx.ellipse(padFarX, padY, padR * (1 - turn * 0.22), padR * 0.84, 0, 0, TAU);
      ctx.fill();

      const noseY = R * 0.24;
      ctx.strokeStyle = 'rgba(38, 30, 28, 0.68)';
      ctx.lineWidth = Math.max(1.0, R * 0.038);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(muzzleShift, noseY + R * 0.09);
      ctx.lineTo(muzzleShift, padY + padR * 0.34);
      ctx.moveTo(padNearX - padR * 0.82, padY + padR * 0.42);
      ctx.quadraticCurveTo(padNearX, padY + padR * 0.96, muzzleShift, padY + padR * 0.34);
      ctx.quadraticCurveTo(padFarX, padY + padR * 0.96, padFarX + padR * 0.68, padY + padR * 0.42);
      ctx.stroke();

      // 鼻子渐变皮质 (Nose Leather) — 竖直渐变，x 坐标不影响结果，可按尺寸缓存
      if (lowQuality) {
        ctx.fillStyle = breed.noseColor;
      } else {
        ctx.fillStyle = this._cachedGradient(
          'nose_' + R.toFixed(2) + '_' + breed.noseColor + '_' + breed.noseDark, ctx, (c) => {
            const grad = c.createLinearGradient(0, noseY - R * 0.08, 0, noseY + R * 0.11);
            grad.addColorStop(0, breed.noseColor);
            grad.addColorStop(1, breed.noseDark);
            return grad;
          });
      }
      ctx.beginPath();
      ctx.moveTo(muzzleShift - R * 0.12, noseY - R * 0.04);
      ctx.quadraticCurveTo(muzzleShift, noseY - R * 0.09, muzzleShift + R * 0.12, noseY - R * 0.04);
      ctx.quadraticCurveTo(muzzleShift + R * 0.09, noseY + R * 0.08, muzzleShift, noseY + R * 0.10);
      ctx.quadraticCurveTo(muzzleShift - R * 0.09, noseY + R * 0.08, muzzleShift - R * 0.12, noseY - R * 0.04);
      ctx.closePath();
      ctx.fill();

      // 呼吸与重力下垂的柔性胡须
      ctx.strokeStyle = breed.bodyColor === '#f5f6fa' ? 'rgba(130, 140, 160, 0.45)' : 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = Math.max(1.1, R * 0.030);
      // 6 根胡须同色同宽，合并为一次 stroke（moveTo 保持各自独立子路径）
      ctx.beginPath();
      [-1, 1].forEach((side) => {
        const lenScale = side === 1 ? (1 - turn * 0.26) : 1.04;
        for (let i = -1; i <= 1; i++) {
          ctx.moveTo(muzzleShift + side * R * 0.25 * lenScale, padY + i * R * 0.07);
          ctx.quadraticCurveTo(
            muzzleShift + side * R * 0.80 * lenScale, padY + i * R * 0.10,
            muzzleShift + side * R * 1.20 * lenScale, padY + i * R * 0.18 + dna.whiskerDroop * R * 0.42
          );
        }
      });
      ctx.stroke();

      // 帽子
      this.drawHat(ctx, crownY, R);

      ctx.restore();
    }

    drawHat(ctx, crownY, headR) {
      if (this.hat === 'bell') {
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(-headR * 0.7, headR * 0.5, headR * 1.4, 3);
        ctx.beginPath();
        ctx.arc(0, headR * 0.5 + 4, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#f1c40f';
        ctx.fill();
      } else if (this.hat === 'bow') {
        ctx.fillStyle = '#ff6b81';
        ctx.beginPath();
        ctx.moveTo(0, crownY + 2);
        ctx.lineTo(-8, crownY - 4);
        ctx.lineTo(-8, crownY + 8);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, crownY + 2);
        ctx.lineTo(8, crownY - 4);
        ctx.lineTo(8, crownY + 8);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, crownY + 2, 3.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.hat === 'party') {
        ctx.fillStyle = '#2ed573';
        ctx.beginPath();
        ctx.moveTo(0, crownY - headR * 0.9);
        ctx.lineTo(-8, crownY + 2);
        ctx.lineTo(8, crownY + 2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, crownY - headR * 0.9, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ff4757';
        ctx.fill();
      } else if (this.hat === 'wizard') {
        ctx.fillStyle = '#3742fa';
        ctx.beginPath();
        ctx.moveTo(0, crownY - headR * 1.1);
        ctx.lineTo(-11, crownY + 4);
        ctx.lineTo(11, crownY + 4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffa502';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, crownY + 4, 13, 3.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
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
      this._drawUprightText(ctx, () => ctx.fillText(this.bubbleText, 0, by + bh / 2));
      ctx.restore();
    }

    drawIntentBadge(ctx, badgeY) {
      ctx.save();
      ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const label = `${this.intentIcon} ${this.intentLabel || ''}`;
      const metrics = ctx.measureText(label);
      const bw = metrics.width + 12;
      const bh = 17;
      const bx = -bw / 2;
      const by = badgeY - bh;

      const pulse = Math.sin(Date.now() * 0.005 + (this.x % 10)) * 0.12 + 0.88;
      ctx.globalAlpha = pulse;

      ctx.fillStyle = 'rgba(26, 36, 43, 0.86)';
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, [7]);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#f1f2f6';
      this._drawUprightText(ctx, () => ctx.fillText(label, 0, by + bh / 2 + 0.5));
      ctx.restore();
    }

    // ============================================================================
    // 6. CANVAS 2D RENDER PIPELINE (5节腰椎 + Catmull-Rom 步态 + 3体积身躯)
    // ============================================================================
    render(ctx, width, height, options = {}) {
      const dt = this._lastDt || CAT_NOMINAL_DT;
      const quality = currentRenderQuality();
      const lowQuality = quality === 'low';
      // 低画质下跳过微毛发纹理与部分渐变，保留体型、花纹与表情辨识度
      const furPattern = lowQuality ? null : getFurPattern(ctx);
      // 渲染设计坐标系的基准身长约 96px，而物理半径仅 22~26px（直径 44~52px）。
      // 旧系数 /24 让视觉体型约为碰撞体的 3 倍，既显得过大也推高填充率；
      // /44 后视觉身长与碰撞直径基本相当，物理碰撞与交互判定保持不变。
      const scaleFactor = this.radius / CAT_VISUAL_SCALE_DENOM;
      const breed = this.breed;
      const age = this.age;
      const fluff = this.fluff;
      const bcsNorm = clamp((this.bcs - 2) / 7, 0, 1);

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(this.facing * scaleFactor, scaleFactor);
      // 抓取"仅含平移+镜像缩放"的变换，供文字正向绘制使用（姿态旋转发生在之后，不进来）
      this._textCTM = ctx.getTransform ? ctx.getTransform() : null;

      // 特殊姿态全局几何形变 (爬树90度 / 空中起跳俯冲 / 抱腿长条拉伸)
      // 爬树用 _climbBlend 平滑过渡，避免进出状态时姿态瞬间硬切
      const climbBlend = this._climbBlend || 0;
      if (climbBlend > 0.001) {
        ctx.rotate(-Math.PI / 2 * climbBlend);
        ctx.scale(lerp(1, 1.08, climbBlend), lerp(1, 0.90, climbBlend));
      } else if (this.state === 'jumping' || this.state === 'pouncing' || this.state === 'aerial_pounce_drop') {
        const leapAngle = Math.atan2(this.vy, Math.abs(this.vx) + 0.1) * 0.38;
        ctx.rotate(leapAngle);
        ctx.scale(1.14, 0.86);
      } else if (this.state === 'grabbed' || this.isGrabbed) {
        ctx.scale(0.76, clamp(this.grabStretch, 1.0, 1.85));
      } else if (this.state === 'belly_trap') {
        ctx.rotate(0.38);
      }

      // 1. 柔和地面接触阴影 (腾空/爬树/被拎起时不画地面阴影)
      if (this.state !== 'jumping' && this.state !== 'pouncing' && this.state !== 'aerial_pounce_drop' &&
          this.state !== 'grabbed' && !this.isGrabbed && this.state !== 'climbing') {
        const sw = this.state === 'loaf' ? 56 : 74;
        // 阴影渐变在局部坐标中完全固定，按 sw 缓存即可
        ctx.fillStyle = this._cachedGradient('shadow_' + sw, ctx, (c) => {
          const grad = c.createRadialGradient(0, 2, 6, 0, 2, sw);
          grad.addColorStop(0, 'rgba(0,0,0,0.22)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          return grad;
        });
        ctx.beginPath();
        ctx.ellipse(0, 2, sw, 10, 0, 0, TAU);
        ctx.fill();
      }

      const isWalk = (this.state === 'walk' || this.state === 'walking' || this.state === 'running' ||
                      this.state === 'trot' || this.state === 'zoomies' || this.state === 'aerial_patrol_walk');
      const isTrot = this.state === 'running' || this.state === 'zoomies';
      const isCrouch = (this.state === 'crouch' || this.state === 'stalking' || this.state === 'stealth_stalk' ||
                        this.state === 'stealth_freeze' || this.state === 'aerial_pounce_aim');
      const isLoaf = this.state === 'loaf';

      const legScale = (this.dna.legRatio || 1.0) * lerp(0.70, 1.02, age);
      const legH = lerp(40, 57, age) * (this.dna.legRatio || 1.0);

      // 2. 国际动物学 4 拍侧序漫步样条计算
      const dFL = isTrot ? 0.52 : 0.24;
      const dBR = 0.50;
      const dFR = isTrot ? 0.02 : 0.74;
      const gBL = sampleFelineGait(this.walkCycle);
      const gFL = sampleFelineGait(this.walkCycle - dFL * TAU);
      const gBR = sampleFelineGait(this.walkCycle - dBR * TAU);
      const gFR = sampleFelineGait(this.walkCycle - dFR * TAU);

      const spineStretch = isWalk ? Math.sin(this.walkCycle * 2 - 0.7) * 4.8 * lerp(0.55, 1.0, age) : 0;
      const baseBodyLen = lerp(66, 96, age) * (isLoaf ? 0.84 : 1.0);
      const bodyLen = baseBodyLen + spineStretch;
      const frontCushion = isWalk ? (gFL.cush + gFR.cush) * 2.6 : 0;
      const scapCrestTarget = isWalk ? Math.max(gFL.cush, gFR.cush) * 4.0 : 0;
      const hipRoll = isWalk ? (gBL.cush - gBR.cush) * 2.0 : (isCrouch ? Math.sin(this.buttWiggle) * 4.2 : 0);

      const loafBreatheY = isLoaf ? Math.sin(this.loafBreathe) * 1.8 : 0;
      const tHipX = -bodyLen * 0.52;
      const tShX = bodyLen * 0.48;
      const tHipY = -(isLoaf ? 20 : (isCrouch ? legH * 0.86 : legH * 1.05)) + hipRoll + loafBreatheY;
      const tShY = -(isLoaf ? 20 : (isCrouch ? legH * 0.56 : legH * 0.93)) + frontCushion + loafBreatheY;
      const tMidY = (tHipY + tShY) * 0.5 + (isLoaf ? 1 : (isCrouch ? 8 : 5.5)) + spineStretch * 0.25;
      const tNeckX = tShX + lerp(16, 22, age) * (isLoaf ? 0.6 : 1.0);
      const tNeckY = -(isLoaf ? 34 : (isCrouch ? legH * 0.58 + 13 : legH * 0.96 + lerp(18, 25, age))) + frontCushion * 0.22 + loafBreatheY;

      const sm = this._smooth;
      if (!sm.initialized) {
        sm.hipX = tHipX; sm.hipY = tHipY; sm.shX = tShX; sm.shY = tShY;
        sm.midY = tMidY; sm.neckX = tNeckX; sm.neckY = tNeckY; sm.scapCrest = scapCrestTarget;
        sm.initialized = true;
      } else {
        const k = 1 - Math.exp(-11 * dt);
        sm.hipX = lerp(sm.hipX, tHipX, k); sm.hipY = lerp(sm.hipY, tHipY, k);
        sm.shX = lerp(sm.shX, tShX, k);   sm.shY = lerp(sm.shY, tShY, k);
        sm.midY = lerp(sm.midY, tMidY, k);
        sm.neckX = lerp(sm.neckX, tNeckX, k); sm.neckY = lerp(sm.neckY, tNeckY, k);
        sm.scapCrest = lerp(sm.scapCrest, scapCrestTarget, 1 - Math.exp(-14 * dt));
      }

      const hip = { x: sm.hipX, y: sm.hipY };
      const sh = { x: sm.shX, y: sm.shY };
      const mid = { x: (hip.x + sh.x) * 0.5, y: sm.midY };
      const neckTop = { x: sm.neckX, y: sm.neckY };

      // 3. 5 节段铰接腰椎骨骼 (s0 Croup -> s1 Pelvis -> s2 Rear Lumbar -> s3 Front Lumbar -> s4 Withers)
      const waveAmp = isWalk ? 2.4 : 0.4;
      const s0 = { x: hip.x - (sh.x - hip.x) * 0.16, y: hip.y - (isLoaf ? 1 : 7.5) + Math.sin(this.walkCycle * 2) * waveAmp };
      const s1 = { x: hip.x,                         y: hip.y - (isLoaf ? 0 : 2.0) + Math.sin(this.walkCycle * 2 - 0.5) * waveAmp };
      const s2 = { x: lerp(hip.x, sh.x, 0.34),       y: lerp(hip.y, mid.y, 0.85) + 1.5 + Math.sin(this.walkCycle * 2 - 1.1) * waveAmp };
      const s3 = { x: lerp(hip.x, sh.x, 0.67),       y: lerp(mid.y, sh.y, 0.55) + 1.2 + Math.sin(this.walkCycle * 2 - 1.7) * waveAmp };
      const s4 = { x: sh.x,                          y: sh.y + Math.sin(this.walkCycle * 2 - 2.2) * waveAmp * 0.7 };

      // 4. 尾巴绘制 (锚定在十字部 s0)
      if (!this.inBox) {
        this._drawTail(ctx, { x: s0.x + 2, y: s0.y - 3 }, hipRoll, this.state === 'climbing');
      }

      // 5. 远端四肢绘制 (母鸡蹲时收于体底，跳过绘制)
      let legBL, legFL, legBR, legFR;
      if (!isLoaf && !this.inBox) {
        const stride = (isTrot ? 35 : 32) * lerp(0.68, 1.0, age);
        const lift = (isTrot ? 15.5 : 12.0) * lerp(0.74, 1.0, age);
        const hindCenter = -baseBodyLen * 0.52;
        const frontCenter = baseBodyLen * 0.54;
        const isClimb = this.state === 'climbing';
        legBL = this._dampLeg(0, isClimb
          ? this._computeClimbLeg({ x: hip.x + 1, y: hip.y - 1 }, 0, hindCenter - 2, legScale)
          : this._computeHindLeg({ x: hip.x + 1, y: hip.y - 1 }, gBL, hindCenter - 2, stride, lift, legScale, isWalk), dt);
        legFL = this._dampLeg(1, isClimb
          ? this._computeClimbLeg({ x: sh.x - 3, y: sh.y + 2 }, Math.PI, frontCenter - 2, legScale)
          : this._computeFrontLeg({ x: sh.x - 3, y: sh.y + 2 }, gFL, frontCenter - 2, stride, lift, legScale, isWalk), dt);
        legBR = this._dampLeg(2, isClimb
          ? this._computeClimbLeg({ x: hip.x + 5, y: hip.y - 1 }, Math.PI, hindCenter + 2, legScale)
          : this._computeHindLeg({ x: hip.x + 5, y: hip.y - 1 }, gBR, hindCenter + 2, stride, lift, legScale, isWalk), dt);
        legFR = this._dampLeg(3, isClimb
          ? this._computeClimbLeg({ x: sh.x + 1, y: sh.y + 3 }, 0, frontCenter + 2, legScale)
          : this._computeFrontLeg({ x: sh.x + 1, y: sh.y + 3 }, gFR, frontCenter + 2, stride, lift, legScale, isWalk), dt);

        this._drawLegMesh(ctx, legBL, true, true, mid.y);
        this._drawLegMesh(ctx, legFL, false, true, mid.y);
      }

      // 6. 3 体积解剖躯干 (受 5 节脊椎 + WSAVA 评分 + 原始袋下垂联合驱动)
      if (!this.inBox) {
        const L = Math.max(55, sh.x - hip.x);
        const furPad = fluff * 4.8;
        const ribDepth = lerp(15.5, 22.0, age) * lerp(0.84, 1.24, bcsNorm) + furPad;
        const lumbarDip = lerp(4.8, -4.0, bcsNorm) * lerp(0.45, 1.0, age) * (1 - fluff * 0.65);
        const waistYOff = (isLoaf ? 18 : lerp(6.5, 31.5, Math.pow(bcsNorm, 1.15))) + fluff * 6.5;
        const pouchDrop = lerp(0, 14.5, clamp((this.bcs - 4) / 5, 0, 1)) * lerp(0.4, 1.0, age) + fluff * 4.0;
        const ruffOut = Math.pow(fluff, 1.35) * 7.5;

        const nape = { x: neckTop.x - 8 - fluff * 2.5, y: neckTop.y - 2 - fluff * 1.5 };
        const withers = { x: s4.x - L * 0.04, y: s4.y - ribDepth * 0.88 - sm.scapCrest * (1 - fluff * 0.45) };
        const saddle = { x: s3.x, y: s3.y - ribDepth * 0.80 + lumbarDip };
        const iliac = { x: s1.x + L * 0.06, y: s1.y - ribDepth * 1.06 };
        const tailDock = { x: s0.x - fluff * 2.5, y: s0.y - ribDepth * 0.62 };
        const ischium = { x: s0.x - L * 0.06 - fluff * 3.5, y: s1.y + ribDepth * 0.18 };
        const flankBase = { x: s2.x - L * 0.10, y: s2.y + ribDepth * 0.52 + pouchDrop };
        const waist = { x: s2.x + L * 0.12, y: s2.y + waistYOff };
        const sternumLow = { x: s4.x - L * 0.04, y: s4.y + ribDepth * 0.92 + ruffOut * 0.25 };
        const prosternum = { x: s4.x + L * 0.15 + ruffOut * 0.75, y: s4.y + ribDepth * 0.28 + ruffOut * 0.2 };
        const throat = { x: neckTop.x + 4 + ruffOut * 0.3, y: neckTop.y + 7 };

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(nape.x, nape.y);
        ctx.bezierCurveTo(nape.x - 4, lerp(nape.y, withers.y, 0.72), withers.x + L * 0.14, withers.y + 2, withers.x, withers.y);
        ctx.bezierCurveTo(withers.x - L * 0.16, withers.y + 1, saddle.x + L * 0.10, saddle.y, saddle.x, saddle.y);
        ctx.bezierCurveTo(saddle.x - L * 0.14, saddle.y, iliac.x + L * 0.14, iliac.y - 1, iliac.x, iliac.y);
        ctx.bezierCurveTo(iliac.x - L * 0.12, iliac.y + 1, tailDock.x + L * 0.09, tailDock.y - 4, tailDock.x, tailDock.y);
        ctx.bezierCurveTo(tailDock.x - L * 0.08, tailDock.y + 6, ischium.x - 4, ischium.y - 8, ischium.x, ischium.y);
        ctx.bezierCurveTo(ischium.x + 2, ischium.y + 12, flankBase.x - L * 0.14, flankBase.y + 3, flankBase.x, flankBase.y);
        ctx.bezierCurveTo(flankBase.x + L * 0.10, flankBase.y - 1, waist.x - L * 0.10, waist.y + 1, waist.x, waist.y);
        ctx.bezierCurveTo(waist.x + L * 0.16, waist.y + 3, sternumLow.x - L * 0.12, sternumLow.y + 2, sternumLow.x, sternumLow.y);
        ctx.bezierCurveTo(sternumLow.x + L * 0.14, sternumLow.y, prosternum.x, prosternum.y + 12, prosternum.x, prosternum.y);
        ctx.bezierCurveTo(prosternum.x, prosternum.y - 11, throat.x + 6, throat.y + 8, throat.x, throat.y);
        ctx.closePath();
        ctx.clip();

        if (!lowQuality) {
          // 渐变以 mid 为原点缓存，绘制时临时平移到 mid，与原 (mid.x, mid.y-28→+32) 完全等价
          ctx.save();
          ctx.translate(mid.x, mid.y);
          ctx.fillStyle = this._cachedGradient('body_' + breed.id, ctx, (c) => {
            const grad = c.createLinearGradient(0, -28, 0, 32);
            grad.addColorStop(0, breed.lightColor);
            grad.addColorStop(0.55, breed.bodyColor);
            grad.addColorStop(1, breed.shadowColor);
            return grad;
          });
          ctx.fillRect(-130 - mid.x, -165 - mid.y, 260, 175);
          ctx.restore();
        } else {
          ctx.fillStyle = breed.bodyColor;
          ctx.fillRect(-130, -165, 260, 175);
        }

        if (furPattern) {
          ctx.fillStyle = furPattern;
          ctx.fillRect(-130, -165, 260, 175);
        }

        if (!lowQuality) {
          const bx = mid.x + 12;
          const by = mid.y + 22;
          ctx.save();
          ctx.translate(bx, by);
          ctx.fillStyle = this._cachedGradient('belly_' + breed.bellyColor, ctx, (c) => {
            const grad = c.createRadialGradient(0, 0, 4, 0, 0, 44);
            grad.addColorStop(0, breed.bellyColor);
            grad.addColorStop(0.6, breed.bellyColor);
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            return grad;
          });
          ctx.fillRect(-105 - bx, -140 - by, 210, 150);
          ctx.restore();
        }

        if (breed.tabby || breed.hasStripes) {
          ctx.strokeStyle = breed.stripeColor;
          ctx.lineCap = 'round';
          // 4 条虎斑按线宽分两组，各合并为一次 stroke
          for (let parity = 0; parity < 2; parity++) {
            ctx.lineWidth = parity === 0 ? 5.5 : 4;
            ctx.beginPath();
            [-32, -12, 8, 28].forEach((ox, i) => {
              if (i % 2 !== parity) return;
              ctx.moveTo(mid.x + ox, mid.y - 26);
              ctx.quadraticCurveTo(mid.x + ox - 6, mid.y - 2, mid.x + ox + 2, mid.y + 15);
            });
            ctx.stroke();
          }
        } else if (breed.hasPatches) {
          ctx.fillStyle = '#df7d27';
          ctx.beginPath();
          ctx.ellipse(mid.x - 8, mid.y - 10, 26, 18, -0.2, 0, TAU);
          ctx.fill();
          ctx.fillStyle = '#332d2b';
          ctx.beginPath();
          ctx.ellipse(hip.x - 4, hip.y - 6, 22, 18, 0.3, 0, TAU);
          ctx.fill();
        }
        ctx.restore();

        // 7. 连续蓬松胸前围脖 (Chest Ruff)
        if (fluff > 0.005 && !lowQuality) {
          const fEase = fluff * fluff;
          ctx.save();
          // 渐变原点固定在 prosternum：缓存后临时平移到该点，半径由 fluff 决定（逐猫固定）
          const ox = prosternum.x - 6;
          const oy = prosternum.y - 2;
          ctx.translate(ox, oy);
          ctx.fillStyle = this._cachedGradient(
            'ruff_' + fEase.toFixed(4) + '_' + breed.bellyColor + '_' + breed.lightColor, ctx, (c) => {
              const grad = c.createRadialGradient(0, 0, 1, 1, 4, 12 + fEase * 16);
              grad.addColorStop(0, breed.bellyColor);
              grad.addColorStop(0.68, breed.lightColor);
              grad.addColorStop(1, 'rgba(255,255,255,0)');
              return grad;
            });
          ctx.globalAlpha = 0.72 * fEase;
          const rxBase = 1;   // (prosternum.x - 5) - ox
          const ryBase = 3;   // (prosternum.y + 1) - oy
          const r1 = 2 + fEase * 11;
          const r2 = 2 + fEase * 12;
          const r3 = 2 + fEase * 10;
          ctx.beginPath();
          ctx.moveTo(rxBase + 3 * fEase + r1, ryBase - 3);
          ctx.arc(rxBase + 3 * fEase, ryBase - 3, r1, 0, TAU);
          ctx.moveTo(rxBase + 2 * fEase + r2, ryBase + 3);
          ctx.arc(rxBase + 2 * fEase, ryBase + 3, r2, 0, TAU);
          ctx.moveTo(rxBase - 4 + r3, ryBase + 6);
          ctx.arc(rxBase - 4, ryBase + 6, r3, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
      }

      // 8. 近端四肢或母鸡蹲揣手小肉垫
      if (!isLoaf && !this.inBox) {
        this._drawLegMesh(ctx, legBR, true, false, mid.y);
        this._drawLegMesh(ctx, legFR, false, false, mid.y);
      } else if (isLoaf && !this.inBox) {
        ctx.fillStyle = breed.socks ? breed.bellyColor : (breed.isPointColor ? breed.pointColor : breed.lightColor);
        ctx.beginPath();
        ctx.ellipse(sh.x + 6, -3, 11, 5.5, 0.08, 0, TAU);
        ctx.fill();
      }

      // 9. 3/4 雕塑微观猫头与面部
      const bodyHeadR = lerp(34.5, 29.5, age); // 头身比放大，幼态可爱
      this._drawHead(ctx, neckTop.x + 9, neckTop.y - 3 - lerp(3, 0, age), bodyHeadR, furPattern);

      // 10. 名字标签（正向绘制：抵消 facing 镜像与爬树旋转）
      this._drawUprightText(ctx, () => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '10px -apple-system, sans-serif';
        ctx.fillText(this.name, (neckTop.x + 9) * this.facing, neckTop.y - bodyHeadR - 10);
      });

      // 11. 喵语同传气泡与战术大计徽章
      if (this.bubbleTimer > 0 && this.bubbleText) {
        this.drawSpeechBubble(ctx, neckTop.y - bodyHeadR - 24);
      } else if (this.intentIcon && this.currentAgenda && this.currentAgenda !== AGENDAS.NONE) {
        this.drawIntentBadge(ctx, neckTop.y - bodyHeadR - 14);
      }

      ctx.restore();
    }

    // ============================================================================
    // 7. BEHAVIORAL AI & PHYSICAL TICK ENGINE (大脑与物理世界推进)
    // ============================================================================
    update(width, height, sceneContext) {
      const dt = (sceneContext && typeof sceneContext.dt === 'number' && sceneContext.dt > 0)
        ? Math.min(sceneContext.dt, CAT_MAX_DT)
        : CAT_NOMINAL_DT;
      this._lastDt = dt;
      const frameStep = dt / CAT_NOMINAL_DT;
      this._frameStep = frameStep;

      const gravity = physicsWorld.getGravity();

      // 1. 生理驱动引擎衰减
      if (this.state !== 'sleeping') {
        this.energy = Math.max(0, this.energy - (this.personality.id === 'ZOOMER' ? 0.03 : 0.012) * frameStep);
        this.hunger = Math.max(0, this.hunger - (this.personality.id === 'GLUTTON' ? 0.045 : 0.02) * frameStep);
        this.boredom = Math.min(100, this.boredom + (this.personality.id === 'ZOOMER' ? 0.04 : 0.015) * frameStep);
      }

      // 计时器推进
      if (this.socialCooldown > 0) this.socialCooldown = Math.max(0, this.socialCooldown - frameStep);
      if (this.yarnCooldown > 0) this.yarnCooldown = Math.max(0, this.yarnCooldown - frameStep);
      if (this.overstimulation > 0) this.overstimulation = Math.max(0, this.overstimulation - 0.05 * frameStep);
      if (this.bubbleTimer > 0) this.bubbleTimer = Math.max(0, this.bubbleTimer - frameStep);
      if (this.laserFrustration > 0) this.laserFrustration = Math.max(0, this.laserFrustration - 0.1 * frameStep);

      // 呼噜声平滑衰减
      if (this.purrLevel > 0) {
        this.purrLevel -= 0.005 * frameStep;
        if (this.purrLevel <= 0 && soundEngine.stopPurr) soundEngine.stopPurr();
      }

      // 2. 长条液体猫抓取状态 (Scruff Grab)
      if (this.isGrabbed) {
        this.state = 'grabbed';
        if (this.ridingObj) {
          if (this.ridingObj.rider === this) this.ridingObj.rider = null;
          this.ridingObj = null;
          this.rideTimer = 0;
        }
        if (this.inBox) {
          if (this.inBox.occupant === this) this.inBox.occupant = null;
          this.inBox = null;
          this.boxTimer = 0;
        }
        if (this.heldYarn) {
          if (this.heldYarn.heldBy === this) this.heldYarn.heldBy = null;
          this.heldYarn = null;
        }
        this.perchedTier = null;
        this.grabStretch = MathUtils.lerp(this.grabStretch, 1.55, 0.12);
        this.tailChain.update(this.x, this.y + this.radius * 1.4, 0.35, 0.85, frameStep);
        return;
      } else {
        this.grabStretch = MathUtils.lerp(this.grabStretch, 1.0, 0.18);
        if (this.state === 'grabbed') {
          this.state = 'idle';
        }
      }

      // 3. 视线平滑追视目标解算 (Look-At)
      let currentLookTarget = null;
      if (sceneContext?.laser?.active) {
        currentLookTarget = { x: sceneContext.laser.x, y: sceneContext.laser.y };
      } else if (sceneContext?.featherWand?.active) {
        currentLookTarget = sceneContext.featherWand.getTip();
      } else if (sceneContext?.environment?.getBird) {
        const bird = sceneContext.environment.getBird();
        if (bird && bird.active && Math.hypot(bird.x - this.x, bird.y - this.y) < 600) {
          currentLookTarget = bird;
        }
      } else if (this.aerialTarget) {
        currentLookTarget = this.aerialTarget;
      }
      this.lookTarget = currentLookTarget;

      // 平滑注视更新
      let targetGazeX = 0.22;
      let targetGazeY = 0.04;
      let targetTurn = 0.38;
      if (this.lookTarget) {
        const localDx = (this.lookTarget.x - this.x) * this.facing;
        const localDy = this.lookTarget.y - (this.y - this.radius * 2.4);
        targetGazeX = clamp(localDx / 140, -1, 1);
        targetGazeY = clamp(localDy / 120, -0.8, 0.8);
        targetTurn = clamp(0.32 + targetGazeX * 0.16, 0.14, 0.46);
      }
      const gk = 1 - Math.exp(-8 * dt);
      this._smooth.gazeX = lerp(this._smooth.gazeX, targetGazeX, gk);
      this._smooth.gazeY = lerp(this._smooth.gazeY, targetGazeY, gk);
      this._smooth.headTurn = lerp(this._smooth.headTurn, targetTurn, gk);

      // 4. 自然慢眨眼
      if (this.isBlinking) {
        this._blinkAmt = lerp(this._blinkAmt, 1, 1 - Math.exp(-22 * dt));
      } else {
        this._blinkTimerSec -= dt;
        if (this._blinkTimerSec <= 0) {
          this._blinkAmt = Math.sin(clamp(-this._blinkTimerSec / 0.18, 0, 1) * Math.PI);
          if (this._blinkTimerSec < -0.18) {
            this._blinkAmt = 0;
            this._blinkTimerSec = 3.0 + Math.random() * 2.8;
          }
        } else {
          this._blinkAmt = lerp(this._blinkAmt, 0, 1 - Math.exp(-18 * dt));
        }
      }

      // 5. 步态与动画周期推进
      const speedMag = Math.hypot(this.vx, this.vy);
      if (this.state === 'walking' || this.state === 'running' || this.state === 'trot' ||
          this.state === 'zoomies' || this.state === 'aerial_patrol_walk') {
        const rate = (this.state === 'running' || this.state === 'zoomies') ? 5.8 : 3.6;
        const speedMul = speedMag > 1 ? clamp(speedMag / 80, 0.5, 2.0) : 1.0;
        this.walkCycle += dt * rate * speedMul;
        this._tailPhase += dt * 2.2 * speedMul;
      } else {
        this._tailPhase += dt * 1.3;
      }

      this.loafBreathe += dt * 2.2;
      // 爬树姿态平滑：用与骨骼平滑相同的时间常数逼近目标，进出 climbing 不再瞬间翻转
      const climbTarget = this.state === 'climbing' ? 1 : 0;
      this._climbBlend = lerp(this._climbBlend, climbTarget, 1 - Math.exp(-11 * dt));
      this.climbCycle += dt * 6.0;
      this.kneadCycle += dt * 3.5;
      if (this.state === 'stalking' || this.state === 'aerial_pounce_aim') {
        this.buttWiggle += dt * 14.0;
      }
      if (this.state === 'chattering') {
        this.chatterPhase += dt * 22.0;
      }

      // 靠近人手时的蹭脸与踩奶
      if (sceneContext?.mouse && !this.inBox && !this.ridingObj) {
        const mouseDist = Math.hypot(sceneContext.mouse.x - this.x, sceneContext.mouse.y - this.y);
        const clingThreshold = this.personality.id === 'CLINGY' ? 120 : 65;
        if (mouseDist < clingThreshold) {
          this.headTilt = MathUtils.clamp((sceneContext.mouse.x - this.x) * 0.006, -0.28, 0.28);
          this.kneadCycle += 0.22;
          if (this.personality.id === 'CLINGY' && Math.random() < 0.03 && this.purrLevel < 0.3) {
            this.purrLevel = 0.6;
            if (soundEngine.startPurr) soundEngine.startPurr();
          }
        } else {
          this.headTilt *= 0.85;
        }
      }

      // 猫薄荷癫狂
      if (this.catnipEnergy > 0) {
        this.catnipEnergy -= frameStep;
        this.state = 'catnip_high';
        this.bunnyKickPhase += 0.45;
        this.vx += (Math.random() - 0.5) * 4;
        this.vy += (Math.random() - 0.5) * 4;
        if (Math.random() < 0.2 && sceneContext?.spawnParticle) {
          sceneContext.spawnParticle(this.x + (Math.random() - 0.5) * 30, this.y - 20, '✨🌿');
        }
      }

      // 6. 状态机与智能决策决策推进
      this.runStateMachine(width, height, sceneContext);

      // 7. 物理学与边界应用
      if (this.state !== 'in_box' && this.state !== 'riding') {
        const floor = physicsWorld.getFloorY(height) - this.radius;

        if (this.state === 'climbing') {
          // 真实爬树：抱柱匀速向上攀爬（按帧步长缩放，速度上限量纲保持 @60fps）
          this.vx = 0;
          this.vy = -3.2;
          this.y += this.vy * frameStep;
          if (Math.random() < 0.25 && sceneContext?.spawnParticle) {
            sceneContext.spawnParticle(this.x + this.facing * 8, this.y - 10, '🪵✨');
          }
          if (Math.random() < 0.1 && soundEngine?.playScratch) {
            soundEngine.playScratch();
          }
        } else {
          this.vy += gravity * frameStep;
          const drag = physicsWorld.isZeroG() ? 0.985 : (this.state === 'zoomies' ? 0.97 : 0.92);
          this.vx *= Math.pow(drag, frameStep);
          this.vy *= Math.pow(physicsWorld.isZeroG() ? 0.985 : 0.99, frameStep);

          const maxSpeed = this.state === 'zoomies' ? 11.5 : (this.state === 'pouncing' || this.state === 'jumping' || this.state === 'aerial_pounce_drop' ? 9.5 : 4.5);
          this.vx = MathUtils.clamp(this.vx, -maxSpeed, maxSpeed);
          // 纵向速度极限解禁 (高达 16px/frame，赋予猫咪高达 450px+ 的弹跳腾空力)
          this.vy = MathUtils.clamp(this.vy, -16.0, 16.0);

          this.x += this.vx * frameStep;
          this.y += this.vy * frameStep;

          // 检查墙壁跳台、猫爬架各层高台、空中悬索桥与全景吊床
          let landedOnPerch = false;
          if (this.vy >= -0.5 && sceneContext?.furniture) {
            for (let f of sceneContext.furniture) {
              const surfaces = f.getPerchSurfaces ? f.getPerchSurfaces() : (
                f.type === 'perch' ? [{ id: f, x: f.x, y: f.y, w: f.w, type: 'perch' }] :
                (f.type === 'cattree' && f.tiers ? f.tiers.map(t => ({ id: t, x: f.x + t.xOffset, y: f.y + t.yOffset, w: t.w, type: 'cattree', tier: t, tree: f })) : [])
              );

              for (let s of surfaces) {
                const halfW = (s.w || 60) / 2;
                const catFeetY = this.y + this.radius;
                if (Math.abs(this.x - s.x) <= halfW + 6) {
                  if (catFeetY >= s.y - 14 && catFeetY <= s.y + Math.max(16, this.vy + 6)) {
                    this.y = s.y - this.radius;
                    this.vy = 0;
                    this.vx *= 0.82;
                    this.perchedTier = s.id;
                    // 同步桥面落脚状态：只有真正落在悬索桥上才记为 onBridge（值为桥对象）
                    this.onBridge = (f.type === 'bridge') ? f : false;
                    landedOnPerch = true;
                    if (this.state === 'jumping' || this.state === 'aerial_pounce_drop') {
                      this.state = 'idle';
                      if (soundEngine?.playWoodThud && Math.random() < 0.4) soundEngine.playWoodThud();
                    }
                    break;
                  }
                }
              }
              if (landedOnPerch) break;
            }
          }

          if (!landedOnPerch) {
            this.perchedTier = null;
            this.onBridge = false;
          }

          // 落地与边界碰撞
          if (this.y > floor) {
            this.y = floor;
            this.vy = -this.vy * 0.35;
            if (Math.abs(this.vy) < 0.2) this.vy = 0;
            if (this.state === 'pouncing' || this.state === 'jumping' || this.state === 'aerial_pounce_drop') {
              this.state = 'idle';
            }
          }

          // 空降跳杀撞击结算 (Aerial Drop Strike Impact Resolution)
          // 条件放宽到"锁定目标且不在蓄力中"：落地会把 drop 改成 idle，但仍需完成本次结算
          if (this.aerialTarget && this.state !== 'aerial_pounce_aim') {
            const tgt = this.aerialTarget;
            const tgtType = this.aerialTargetType;
            // 目标可能已被场景清理（外部清理按钮只解 inBox/ridingObj，不清 aerialTarget），
            // 结算前校验在场性与坐标有效性，失效则直接丢弃目标
            const coordsOk = Number.isFinite(tgt.x) && Number.isFinite(tgt.y);
            // 目标所在集合按类型区分：扫地机与纸箱在 furniture（纸箱也可能在 toys），猫在 cats。
            // 之前 roomba 误用 toys 判定，导致跳杀落地结算被当成"目标失效"而跳过。
            const inAny = (...arrays) => {
              const present = arrays.filter(Array.isArray);
              return present.length === 0 || present.some(arr => arr.includes(tgt));
            };
            const inScene =
              tgtType === 'cat' ? inAny(sceneContext?.cats) :
              tgtType === 'roomba' ? inAny(sceneContext?.furniture) :
              tgtType === 'box' ? inAny(sceneContext?.furniture, sceneContext?.toys) : true;
            if (!coordsOk || !inScene) {
              this.aerialTarget = null;
              this.aerialTargetType = null;
            } else {
              const dist = Math.hypot(tgt.x - this.x, tgt.y - this.y);
              if (dist < 48) {
                if (tgtType === 'roomba') {
                  tgt.vx = this.facing * 5.5;
                  tgt.spin = 0.35;
                  if (soundEngine.playBounce) soundEngine.playBounce();
                  if (sceneContext?.spawnParticle) sceneContext.spawnParticle(this.x, this.y, '💥🛸⚡');
                  this.speak('精准空降！拦截扫地机！😼🛸');
                  this.state = 'idle';
                  this.stateTimer = 50;
                  this.aerialTarget = null;
                  this.aerialTargetType = null;
                } else if (tgtType === 'cat') {
                  tgt.vx = this.facing * 4.8;
                  tgt.vy = -3.8;
                  tgt.state = 'idle';
                  tgt.stateTimer = 55;
                  tgt.speak('喵嗷！天降神猫！🙀💥');
                  if (soundEngine.playSlap) soundEngine.playSlap();
                  if (sceneContext?.spawnParticle) sceneContext.spawnParticle((this.x + tgt.x)/2, this.y, '💨💥🐾');
                  this.speak('双猫抱摔大成功！😼💫');
                  this.state = 'idle';
                  this.stateTimer = 50;
                  this.aerialTarget = null;
                  this.aerialTargetType = null;
                } else if (tgtType === 'box') {
                  // 蓄力期间目标箱可能已被别的猫占据：先清掉旧占用者，避免其 inBox 悬空指向
                  const prevOccupant = tgt.occupant;
                  if (prevOccupant && prevOccupant !== this) {
                    prevOccupant.inBox = null;
                    prevOccupant.boxTimer = 0;
                    if (prevOccupant.state === 'in_box') {
                      prevOccupant.state = 'idle';
                      prevOccupant.stateTimer = 60;
                    }
                    prevOccupant.speak('被天降神猫挤出来了！📦💨');
                  }
                  tgt.occupant = this;
                  this.inBox = tgt;
                  this.state = 'in_box';
                  this.x = tgt.x;
                  this.y = tgt.y;
                  if (soundEngine.playPop) soundEngine.playPop();
                  if (sceneContext?.spawnParticle) sceneContext.spawnParticle(this.x, this.y, '📦✨');
                  this.speak('满分入水进箱！本喵是纯流体！📦🌊');
                  this.aerialTarget = null;
                  this.aerialTargetType = null;
                }
              } else if (this.state !== 'aerial_pounce_drop') {
                // 已落地却未命中：放弃目标，避免 aerialTarget 永久残留
                this.aerialTarget = null;
                this.aerialTargetType = null;
              }
            }
          }
        }

        // 地面避水与水洼甩水
        if (sceneContext?.toys && this.y >= floor - 6 && !this.isGrabbed) {
          for (let t of sceneContext.toys) {
            if (t.type === 'puddle' && t.contains && t.contains(this.x, this.y + this.radius)) {
              if (this.state !== 'wet_shake' && this.state !== 'puddle_jump') {
                this.state = 'wet_shake';
                this.stateTimer = 85;
                this.vx = 0;
                this.currentAgenda = AGENDAS.NONE;
                this.intentIcon = '💦';
                this.intentLabel = '嫌弃甩爪';
                if (soundEngine?.playWaterSplash) soundEngine.playWaterSplash();
                this.speak('噫！踩到水了！恶心甩爪！💦😾');
                if (sceneContext.spawnParticle) {
                  for (let pi = 0; pi < 3; pi++) sceneContext.spawnParticle(this.x, this.y - 5, '💦💧');
                }
                break;
              }
            }
          }
        }
      }

      // 豪宅左右边界约束
      if (this.x < this.radius + 10) {
        this.x = this.radius + 10;
        this.vx = -this.vx * 0.5;
        this.facing = 1;
      }
      if (this.x > width - this.radius - 10) {
        this.x = width - this.radius - 10;
        this.vx = -this.vx * 0.5;
        this.facing = -1;
      }

      // 尾巴骨骼更新
      const tailRootX = this.x - this.facing * this.radius * 0.75;
      const tailRootY = this.y - 2;
      this.tailChain.update(tailRootX, tailRootY, 0.28, 0.88, frameStep);
    }

    // 状态机核心分支与优先级调度
    runStateMachine(width, height, sceneContext) {
      this.stateTimer -= this._frameStep;

      // 优先级1：扫地机骑乘中
      if (this.ridingObj) {
        this.rideTimer = (this.rideTimer || 0) + this._frameStep;
        if (this.rideTimer > 600) {
          if (this.ridingObj.rider === this) this.ridingObj.rider = null;
          this.ridingObj = null;
          this.rideTimer = 0;
          this.state = 'idle';
          this.stateTimer = 60;
          return;
        }
        this.state = 'riding';
        return;
      }

      // 优先级2：纸箱中
      if (this.inBox) {
        this.boxTimer = (this.boxTimer || 0) + this._frameStep;
        if (this.boxTimer > 600) {
          if (this.inBox.occupant === this) this.inBox.occupant = null;
          this.inBox = null;
          this.boxTimer = 0;
          this.state = 'idle';
          this.stateTimer = 60;
          return;
        }
        this.state = 'in_box';
        return;
      }

      // 优先级2.4：空降跳杀蓄力中 (Aerial Pounce Aim)
      if (this.state === 'aerial_pounce_aim') {
        this.vx = 0;
        if (this.stateTimer <= 0) {
          this.state = 'aerial_pounce_drop';
          this.perchedTier = null;
          this.onBridge = false;
          this.inHammock = false;
          const target = this.aerialTarget;
          const dx = target ? (target.x - this.x) : this.facing * 50;
          this.vx = MathUtils.clamp(dx / 16, -7, 7);
          this.vy = -3.2;
          if (soundEngine.playMeow) soundEngine.playMeow(this.pitchMod * 1.2, 'chirp');
          if (soundEngine.playZoomies) soundEngine.playZoomies();
          this.speak('看招！天降神猫！💥🐾');
        }
        return;
      }

      // 优先级2.5：吊桥狭路相逢猫猫拳对决 (Bridge Duel)
      if (this.state === 'bridge_duel') {
        this.vx = 0;
        this.swatProgress = Math.sin(Date.now() * 0.035);
        if (Math.random() < 0.22 && soundEngine.playSlap) soundEngine.playSlap();
        if (this.stateTimer <= 0) {
          const rival = this.bridgeRival;
          // 只由一方（id 较小者，或对手已脱离对决时的存活方）掷骰一次并同时结算双方，
          // 避免双方各自判定出现"都赢"，也避免败者 state 永久残留、每帧重掷。
          const iAmJudge = !rival || rival.state !== 'bridge_duel' || this.id <= rival.id;
          if (iAmJudge) {
            const thisPower = (this.energy * 0.5) + (this.personality.id === 'ZOOMER' ? 30 : 0) + Math.random() * 20;
            const rivalPower = rival ? ((rival.energy * 0.5) + (rival.personality.id === 'ZOOMER' ? 30 : 0) + Math.random() * 20) : 0;
            const iWin = thisPower >= rivalPower;
            if (iWin) {
              this.speak('本喵胜出！昂首巡视！👑✨');
              this.state = 'aerial_patrol_walk';
              this.stateTimer = 90;
              this.vx = this.facing * 2.8;
              if (rival) {
                rival.speak('可恶！单爪挂桥溜了！🙀💦');
                rival.state = 'idle';
                rival.vx = -this.facing * 3.5;
                rival.stateTimer = 70;
              }
            } else if (rival) {
              rival.speak('本喵胜出！昂首巡视！👑✨');
              rival.state = 'aerial_patrol_walk';
              rival.stateTimer = 90;
              rival.vx = rival.facing * 2.8;
              this.speak('可恶！单爪挂桥溜了！🙀💦');
              this.state = 'idle';
              this.vx = -rival.facing * 3.5;
              this.stateTimer = 70;
            }
            if (rival) {
              rival.bridgeRival = null;
              rival.intentIcon = null;
              rival.intentLabel = null;
            }
            this.bridgeRival = null;
            this.intentIcon = null;
            this.intentLabel = null;
          }
        }
        return;
      }

      // 优先级2.6：观鸟捕猎齿颤 (Ek-ek-ek Chattering)
      if (this.state === 'chattering') {
        this.vx = 0;
        if (Math.random() < 0.15 && soundEngine.playChatter) {
          soundEngine.playChatter();
        }
        if (this.stateTimer <= 0) {
          this.state = 'idle';
          this.stateTimer = 60;
          this.speak('呼…鸟飞走了…没抓着…🕊️💭');
        }
        return;
      }

      // 优先级2.7：抱球疯狂兔子蹬 (Hug & Bunny Kick)
      if (this.state === 'hug_kick') {
        this.bunnyKickPhase += 0.5;
        this.vx = 0;
        if (Math.random() < 0.25 && soundEngine.playScratch) soundEngine.playScratch();
        if (this.stateTimer <= 0) {
          if (this.heldYarn) {
            this.heldYarn.heldBy = null;
            this.heldYarn.vx = this.facing * (6.5 + Math.random() * 3);
            this.heldYarn.vy = -4.5 - Math.random() * 2;
            if (soundEngine.playBounce) soundEngine.playBounce();
            this.heldYarn = null;
          }
          this.state = 'idle';
          this.stateTimer = 60;
          this.speak('呼…蹬爽了！舔个毛~ ✨');
        }
        return;
      }

      // 优先级2.8：湿爪甩水
      if (this.state === 'wet_shake') {
        this.vx = 0;
        if (this.stateTimer <= 0) {
          this.state = 'idle';
          this.stateTimer = 45;
          this.intentIcon = null;
          this.speak('呼…爪子终于甩干了！✨');
        }
        return;
      }

      // 优先级2.9：王座争夺对峙
      if (this.state === 'throne_challenge') {
        this.vx = 0;
        if (this.stateTimer <= 0) {
          this.resolveThroneChallenge(sceneContext);
        }
        return;
      }

      // 优先级2.95：高台蔑视俯瞰
      if (this.state === 'judging_overlook') {
        this.vx = 0;
        if (this.stateTimer <= 0) {
          this.clearAgenda();
          this.state = 'loaf';
          this.stateTimer = 180;
          this.speak('俯瞰完毕，高台母鸡蹲~ 🍞');
        }
        return;
      }

      // 优先级2.98：心机碰瓷肚皮陷阱
      if (this.state === 'belly_trap') {
        this.vx = 0;
        this.purrLevel = Math.max(0.4, this.purrLevel);
        if (this.stateTimer <= 0) {
          this.clearAgenda();
          this.state = 'idle';
          this.stateTimer = 60;
          this.speak('两脚兽居然不上钩？真不懂享受！😼');
        }
        return;
      }

      // 优先级3：猫薄荷癫狂
      if (this.catnipEnergy > 0) return;

      // 优先级4：多猫社交互动 (碰鼻礼 / 互相舔毛过载反咬)
      if (this.socialTimer > 0) {
        this.socialTimer -= this._frameStep;
        return;
      }
      if (this.socialCooldown <= 0 && sceneContext?.cats && sceneContext.cats.length > 1) {
        const metPartner = this.checkSocialInteraction(sceneContext);
        if (metPartner) return;
      }

      // 优先级4.5：吊桥狭路相逢检测
      if (this.onBridge && this.checkBridgeDuel(sceneContext)) return;

      // 优先级4.8：高空跳台空降跳杀蓄力检测
      if ((this.perchedTier || this.onBridge || this.inHammock) && Math.random() < 0.12) {
        const pouncing = this.checkAerialPounce(sceneContext);
        if (pouncing) return;
      }

      // 优先级5：高空推物本能 (Knocking things off edges)
      if (this.perchedTier && this.state !== 'swatting' && (this.personality.id === 'CURIOUS' || Math.random() < 0.15)) {
        const canSwat = this.checkHighPerchSwat(sceneContext);
        if (canSwat) return;
      }

      // 优先级6：窗外观鸟齿颤检测
      if (this.checkWindowBirdChatter(sceneContext)) return;

      // 优先级7：猫生战术大计策略引擎 (全神贯注推进既定战术)
      if (this.currentAgenda && this.currentAgenda !== AGENDAS.NONE) {
        if (sceneContext?.laser?.active && this.laserFrustration < 80) {
          this.handleTargetAction({ type: 'laser', x: sceneContext.laser.x, y: sceneContext.laser.y }, width, height, sceneContext);
          return;
        }
        if (sceneContext?.featherWand?.active) {
          const tip = sceneContext.featherWand.getTip();
          this.handleTargetAction({ type: 'feather', x: tip.x, y: tip.y }, width, height, sceneContext);
          return;
        }
        this.runAgenda(width, height, sceneContext);
        return;
      }

      // 优先级8：凌晨 3 点虚空凝视与狂飙大暴走 (Greebles & Zoomies)
      if (this.boredom > 75 && this.energy > 40 && this.state !== 'zoomies') {
        if (Math.random() < 0.05 || this.personality.id === 'ZOOMER') {
          this.triggerMidnightZoomies(sceneContext);
          return;
        }
      }

      // 优先级9：环境传感器目标寻路
      const target = this.evaluateSensors(sceneContext);
      if (target) {
        this.handleTargetAction(target, width, height, sceneContext);
        return;
      }

      // 兜底日常：评估新大计或舒缓母鸡蹲
      this.pupilDilation = 0.45;
      if (this.stateTimer <= 0) {
        const startedAgenda = this.evaluateNewAgenda(sceneContext);
        if (startedAgenda) {
          this.runAgenda(width, height, sceneContext);
          return;
        }

        const rand = Math.random();
        if (rand < 0.45) {
          this.state = 'loaf';
          this.vx = 0;
          this.stateTimer = 160 + Math.random() * 150;
          this.speak(Math.random() < 0.5 ? '揣小爪爪，缩成面包~ 🍞' : '舒适母鸡蹲…');
        } else if (rand < 0.78) {
          this.state = 'walking';
          this.facing = Math.random() < 0.5 ? 1 : -1;
          const speedMod = this.personality.id === 'ZOOMER' ? 1.4 : (this.personality.id === 'CHILL' ? 0.7 : 1.0);
          this.vx = this.facing * (0.8 + Math.random() * 0.9) * speedMod;
          this.stateTimer = 50 + Math.random() * 60;
        } else {
          this.state = 'idle';
          if (soundEngine?.playMeow) soundEngine.playMeow(this.pitchMod, 'chirp');
          const quotes = ['铲屎的，快伺候本喵！', '喵呜~', '本喵是液体~', '粮仓满不满呀？', '晒太阳真棒~'];
          this.speak(quotes[Math.floor(Math.random() * quotes.length)]);
          this.stateTimer = 65;
        }
      }
    }

    // 空降跳杀目标扫描 (Aerial Pounce Target Scan)
    checkAerialPounce(sceneContext) {
      if (this.state === 'aerial_pounce_aim' || this.state === 'aerial_pounce_drop') return false;
      if (!sceneContext) return false;

      const { furniture, cats } = sceneContext;
      let tgt = null;
      let tgtType = null;

      // 1. 扫描下方的扫地机
      if (furniture) {
        for (let f of furniture) {
          if (f.type === 'roomba') {
            const dx = Math.abs(f.x - this.x);
            const dy = f.y - this.y;
            if (dx < 140 && dy > 70 && dy < 420) {
              tgt = f;
              tgtType = 'roomba';
              break;
            }
          }
        }
      }

      // 2. 扫描下方路过的其他猫
      if (!tgt && cats) {
        for (let c of cats) {
          if (c !== this && !c.perchedTier && !c.onBridge && !c.inHammock) {
            const dx = Math.abs(c.x - this.x);
            const dy = c.y - this.y;
            if (dx < 120 && dy > 70 && dy < 400) {
              tgt = c;
              tgtType = 'cat';
              break;
            }
          }
        }
      }

      // 3. 扫描下方的空纸箱
      if (!tgt && furniture) {
        for (let f of furniture) {
          if (f.type === 'box' && !f.occupant) {
            const dx = Math.abs(f.x - this.x);
            const dy = f.y - this.y;
            if (dx < 130 && dy > 70 && dy < 400) {
              tgt = f;
              tgtType = 'box';
              break;
            }
          }
        }
      }

      if (tgt) {
        this.aerialTarget = tgt;
        this.aerialTargetType = tgtType;
        this.state = 'aerial_pounce_aim';
        this.stateTimer = 45;
        this.facing = (tgt.x >= this.x) ? 1 : -1;
        this.intentIcon = '🎯';
        this.intentLabel = '空降跳杀蓄力';
        this.speak('锁定猎物！蓄力摇屁股中…🎯');
        return true;
      }
      return false;
    }

    // 吊桥狭路相逢检测
    checkBridgeDuel(sceneContext) {
      if (!this.onBridge || this.state === 'bridge_duel') return false;
      if (!sceneContext?.cats) return false;

      for (let other of sceneContext.cats) {
        if (other !== this && other.onBridge === this.onBridge && other.state !== 'bridge_duel') {
          const dist = Math.abs(other.x - this.x);
          if (dist < 46) {
            this.state = 'bridge_duel';
            other.state = 'bridge_duel';
            this.bridgeRival = other;
            other.bridgeRival = this;
            this.stateTimer = 75;
            other.stateTimer = 75;
            this.facing = (other.x >= this.x) ? 1 : -1;
            other.facing = -this.facing;
            this.intentIcon = '🥊';
            this.intentLabel = '吊桥狭路对决';
            other.intentIcon = '🥊';
            other.intentLabel = '吊桥狭路对决';
            if (soundEngine.playHiss) soundEngine.playHiss();
            this.speak('此桥为本喵所开！退后！😾🥊');
            other.speak('你才退后！看本喵无影爪！😾⚡');
            return true;
          }
        }
      }
      return false;
    }

    // 窗外飞鸟视线锁定与齿颤
    checkWindowBirdChatter(sceneContext) {
      if (this.state === 'chattering') return true;
      const bird = sceneContext?.environment?.getBird?.();
      if (bird && bird.active) {
        const dist = Math.hypot(bird.x - this.x, bird.y - this.y);
        if (dist < 550 && this.y > 100) {
          this.state = 'chattering';
          this.stateTimer = 90;
          this.lookTarget = { x: bird.x, y: bird.y };
          this.facing = (bird.x >= this.x) ? 1 : -1;
          this.intentIcon = '🕊️';
          this.intentLabel = '观鸟齿颤 Ek-ek';
          this.speak('咔咔咔…有鸟！ Ek-ek-ek! 🕊️👀');
          if (soundEngine?.playChatter) soundEngine.playChatter();
          return true;
        }
      }
      return false;
    }

    // 凌晨三点全屋大狂飙
    triggerMidnightZoomies(sceneContext) {
      this.state = 'zoomies';
      this.stateTimer = 240 + Math.random() * 120;
      this.energy = 100;
      this.facing = Math.random() < 0.5 ? 1 : -1;
      this.vx = this.facing * 10.5;
      this.vy = -6.5;
      this.intentIcon = '⚡';
      this.intentLabel = '凌晨三点全屋狂飙';
      if (soundEngine?.playZoomies) soundEngine.playZoomies();
      this.speak('⚡ 3AM 发疯狂暴跑酷！谁也别想睡！');
      if (sceneContext?.spawnParticle) sceneContext.spawnParticle(this.x, this.y - 20, '⚡💥💨');
    }

    // 多猫社交互动 (碰鼻礼 / 互相舔毛过载反咬)
    checkSocialInteraction(sceneContext) {
      if (!sceneContext?.cats) return false;
      for (let other of sceneContext.cats) {
        if (other !== this && Math.hypot(other.x - this.x, other.y - this.y) < 48) {
          this.socialCooldown = 300;
          other.socialCooldown = 300;
          this.socialTimer = 60;
          other.socialTimer = 60;

          // 互相舔毛增加过载，过载过高触发暴起反咬
          other.overstimulation += 25;
          if (other.overstimulation >= 60) {
            other.speak('咬你！舔太久了本喵过载啦！😾⚡');
            other.state = 'hug_kick';
            other.stateTimer = 50;
            this.state = 'idle';
            this.vx = -this.facing * 4;
            this.vy = -3;
            if (soundEngine.playSlap) soundEngine.playSlap();
            if (soundEngine.playHiss) soundEngine.playHiss();
            if (sceneContext.spawnParticle) sceneContext.spawnParticle((this.x + other.x) / 2, this.y - 10, '💥🐾⚡');
          } else {
            this.speak('嗅嗅…碰鼻礼~ 🐾');
            other.speak('呼噜呼噜…蹭蹭额头~ 💕');
            if (soundEngine.playMeow) soundEngine.playMeow(this.pitchMod * 1.2, 'chirp');
            if (sceneContext.spawnParticle) sceneContext.spawnParticle((this.x + other.x) / 2, this.y - 10, '💖✨');
          }
          return true;
        }
      }
      return false;
    }

    // 高台贱爪推物判定
    checkHighPerchSwat(sceneContext) {
      if (!this.perchedTier) return false;
      if (!sceneContext || !sceneContext.toys) return false;

      for (let t of sceneContext.toys) {
        if (Math.abs(t.y - this.y) < 35 && Math.abs(t.x - this.x) < 45) {
          this.state = 'swatting';
          this.stateTimer = 40;
          this.facing = t.x >= this.x ? 1 : -1;
          this.speak('爪子痒了…推下去看看！😼');
          if (t.smash) {
            t.smash(this.facing);
          } else {
            t.vx = this.facing * (4.5 + Math.random() * 2);
            t.vy = -2.5;
          }
          if (soundEngine?.playSlap) soundEngine.playSlap();
          return true;
        }
      }
      return false;
    }

    // 传感器评估 (融入性格敏感度)
    evaluateSensors(sceneContext) {
      if (!sceneContext) return null;
      const { laser, featherWand, toys, furniture } = sceneContext;

      if (laser && laser.active && this.laserFrustration < 80) {
        return { type: 'laser', x: laser.x, y: laser.y };
      }

      if (featherWand && featherWand.active) {
        const tip = featherWand.getTip();
        return { type: 'feather', x: tip.x, y: tip.y };
      }

      if (toys) {
        const fishDetectRange = (this.personality.id === 'GLUTTON' || this.hunger < 45) ? 750 : 380;
        for (let t of toys) {
          if (t.type === 'fish') {
            const d = Math.hypot(t.x - this.x, t.y - this.y);
            if (d < fishDetectRange) return { type: 'fish', obj: t, x: t.x, y: t.y };
          }
        }
      }

      if (furniture) {
        for (let f of furniture) {
          if (f.type === 'box' && !f.occupant) {
            const d = Math.hypot(f.x - this.x, f.y - this.y);
            if (d < 320) return { type: 'box', obj: f, x: f.x, y: f.y };
          }
        }

        if (this.personality.id === 'CURIOUS' || this.personality.id === 'ZOOMER') {
          for (let f of furniture) {
            if (f.type === 'roomba' && !f.rider) {
              const d = Math.hypot(f.x - this.x, f.y - this.y);
              if (d < 220) return { type: 'roomba', obj: f, x: f.x, y: f.y };
            }
          }
        }
      }

      if (toys) {
        for (let t of toys) {
          if (t.type === 'yarn') {
            const d = Math.hypot(t.x - this.x, t.y - this.y);
            if (d < 260) return { type: 'yarn', obj: t, x: t.x, y: t.y };
          }
        }
      }

      if (furniture && !this.perchedTier && (!this.currentAgenda || this.currentAgenda === AGENDAS.NONE)) {
        for (let f of furniture) {
          if (f.type === 'cattree') {
            const d = Math.hypot(f.x - this.x, f.y - this.y);
            if (d < 380 && Math.random() < 0.45) return { type: 'cattree', obj: f, x: f.x, y: f.y };
          }
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
        this.laserFrustration += 0.22;
        if (this.laserFrustration >= 80) {
          this.speak('红点抓不住…好气！😾');
          if (soundEngine.playHiss) soundEngine.playHiss();
          this.state = 'idle';
          this.stateTimer = 100;
          return;
        }

        if (dist > 130) {
          this.state = 'stalking';
          this.vx += (dx / dist) * 0.45;
        } else if (dist > 35) {
          this.state = 'stalking';
          if (Math.random() < 0.08) {
            this.state = 'pouncing';
            this.vy = -6.5 - Math.random() * 2.5;
            this.vx = (dx / dist) * 8.0;
            if (soundEngine.playMeow) soundEngine.playMeow(this.pitchMod, 'chatter');
          }
        } else {
          if (sceneContext?.spawnParticle) sceneContext.spawnParticle(this.x, this.y - 15, '🐾');
        }
      } else if (target.type === 'yarn') {
        if (this.yarnCooldown > 0) return;

        if (dist > 120) {
          this.state = 'stalking';
          this.vx += (dx / dist) * 0.4;
        } else if (dist > 35) {
          this.state = 'stalking';
          if (Math.random() < 0.07) {
            this.state = 'pouncing';
            this.vy = -5.8;
            this.vx = (dx / dist) * 7.2;
          }
        } else {
          this.laserFrustration = 0;
          this.state = 'hug_kick';
          this.stateTimer = 55;
          this.heldYarn = target.obj;
          if (target.obj) target.obj.heldBy = this;
          this.yarnCooldown = 180;
          if (soundEngine.playScratch) soundEngine.playScratch();
          if (soundEngine.playMeow) soundEngine.playMeow(this.pitchMod * 1.2, 'chirp');
        }
      } else if (target.type === 'cattree') {
        if (dist > 60) {
          this.state = 'walking';
          this.vx += (dx / dist) * 0.35;
        } else {
          this.currentAgenda = AGENDAS.TREE_CLIMB;
          this.agendaTarget = target.obj;
          this.agendaPhase = 0;
          this.agendaTimer = 400;
          this.intentIcon = '🪵';
          this.intentLabel = '猫爬架攀爬';
        }
      }
    }

    // 评估并开启全新的猫生战术大计
    evaluateNewAgenda(sceneContext) {
      if (!sceneContext || this.currentAgenda !== AGENDAS.NONE) return false;
      const { furniture } = sceneContext;
      if (!furniture) return false;

      const candidates = [];
      const tree = furniture.find(f => f.type === 'cattree');
      if (tree) candidates.push({ agenda: AGENDAS.TREE_CLIMB, target: tree, weight: 35 });

      const bridge = furniture.find(f => f.type === 'bridge');
      if (bridge) candidates.push({ agenda: AGENDAS.AERIAL_PATROL, target: bridge, weight: 30 });

      const feeder = furniture.find(f => f.type === 'smart_feeder');
      if (feeder) candidates.push({ agenda: AGENDAS.FEEDER_CAMP, target: feeder, weight: 25 });

      if (candidates.length === 0) return false;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      this.currentAgenda = pick.agenda;
      this.agendaTarget = pick.target;
      this.agendaPhase = 0;
      this.agendaTimer = 420;
      return true;
    }

    // 战术大计执行引擎
    runAgenda(width, height, sceneContext) {
      if (!this.currentAgenda || this.currentAgenda === AGENDAS.NONE) return;

      if (this.currentAgenda === AGENDAS.TREE_CLIMB) {
        const tree = this.agendaTarget;
        if (!tree) { this.clearAgenda(); return; }

        if (this.agendaPhase === 0) {
          // 阶段0：跑向猫爬架立柱
          const trunkX = tree.x;
          const dx = trunkX - this.x;
          this.facing = dx >= 0 ? 1 : -1;
          this.intentIcon = '🪵';
          this.intentLabel = '攀爬猫爬架';
          if (Math.abs(dx) > 20) {
            this.state = 'walking';
            this.vx = this.facing * 2.2;
          } else {
            // 贴柱一侧而非钉在柱心，避免钻进剑麻柱内部（柱半宽约 12px）
            this.x = trunkX - this.facing * (12 + this.radius * 0.5);
            this.vx = 0;
            this.agendaPhase = 1;
            this.state = 'scratcher';
            this.stateTimer = 45;
            this.speak('抱住剑麻柱！爪感绝佳！🪵✨');
          }
        } else if (this.agendaPhase === 1) {
          // 阶段1：磨爪
          if (this.stateTimer <= 0) {
            this.agendaPhase = 2;
            this.state = 'climbing';
            this.vy = -3.2;
            this.speak('开爬！蹭蹭蹭直冲一层！🚀🐾');
          }
        } else if (this.agendaPhase === 2) {
          // 阶段2：垂直爬升到 Tier 0
          const tier0Y = tree.y + tree.tiers[0].yOffset - this.radius;
          if (this.y <= tier0Y + 8) {
            this.y = tier0Y;
            this.vy = 0;
            this.perchedTier = tree.tiers[0];
            this.state = 'idle';
            this.agendaPhase = 3;
            this.stateTimer = 50;
            tree.batDangleBall(this.facing);
            this.speak('击打小吊球！晃起来了！🎾✨');
          }
        } else if (this.agendaPhase === 3) {
          // 阶段3：拍打吊球后继续冲顶
          if (this.stateTimer <= 0) {
            this.agendaPhase = 4;
            this.state = 'climbing';
            this.vy = -3.2;
            this.speak('冲顶！登临王座！👑');
          }
        } else if (this.agendaPhase === 4) {
          // 阶段4：登顶
          const tier1Y = tree.y + tree.tiers[1].yOffset - this.radius;
          if (this.y <= tier1Y + 8) {
            this.y = tier1Y;
            this.vy = 0;
            this.perchedTier = tree.tiers[1];
            this.state = 'judging_overlook';
            this.stateTimer = 90;
            this.agendaPhase = 5;
            this.speak('居高临下，俯视两脚兽！😼👑');
          }
        }
      } else if (this.currentAgenda === AGENDAS.AERIAL_PATROL) {
        const bridge = this.agendaTarget;
        if (!bridge) { this.clearAgenda(); return; }

        if (this.agendaPhase === 0) {
          const entryX = bridge.x - bridge.w / 2;
          const dx = entryX - this.x;
          this.facing = dx >= 0 ? 1 : -1;
          this.intentIcon = '🌉';
          this.intentLabel = '巡视空中天桥';
          if (Math.abs(dx) > 25) {
            this.state = 'walking';
            this.vx = this.facing * 2.5;
          } else {
            this.agendaPhase = 1;
            this.state = 'jumping';
            this.vy = -9.2;
            this.vx = this.facing * 3.5;
            this.speak('起跳！跃上空中走道！🌉✨');
          }
        } else if (this.agendaPhase === 1) {
          if (this.perchedTier || this.onBridge) {
            this.agendaPhase = 2;
            this.state = 'aerial_patrol_walk';
            this.stateTimer = 120;
            this.vx = this.facing * 2.2;
            this.speak('走在晃悠悠的吊桥上，风景真棒~ ☁️');
          }
        }
      }
    }

    clearAgenda(options = {}) {
      this.currentAgenda = AGENDAS.NONE;
      this.agendaTarget = null;
      this.agendaPhase = 0;
      this.agendaTimer = 0;
      this.intentIcon = null;
      this.intentLabel = null;
      if (options.releasePerch) {
        this.perchedTier = null;
        this.onBridge = false;
        this.inHammock = false;
      }
    }

    // 王座对决结算 (Throne Challenge Resolution)
    resolveThroneChallenge(sceneContext) {
      const winner = this;
      const loser = this.rival;

      if (!loser) {
        this.state = 'idle';
        this.rival = null;
        return;
      }

      loser.perchedTier = null;
      loser.vy = -4.5;
      loser.vx = (loser.x > winner.x ? 1 : -1) * 5;
      loser.state = 'idle';
      loser.stateTimer = 90;
      loser.rival = null;
      loser.speak('切！本喵才不稀罕这个破台子！🙀');

      winner.speak('王座易主！朕才是唯一的霸主！👑✨');
      if (sceneContext?.spawnParticle) {
        sceneContext.spawnParticle((winner.x + loser.x) / 2, winner.y - 20, '💥👑');
      }
      this.rival = null;
      this.state = 'judging_overlook';
      this.stateTimer = 100;
    }

    draw(ctx, width, height, options = {}) {
      return this.render(ctx, width, height, options);
    }

    // 抚摸交互
    pet(sceneContext) {
      if (this.state === 'belly_trap') {
        // 心机碰瓷反咬逃逸
        this.state = 'idle';
        this.stateTimer = 60;
        this.vx = (Math.random() > 0.5 ? 1 : -1) * 6.5;
        this.vy = -4.5;
        if (soundEngine?.playSlap) soundEngine.playSlap();
        this.speak('哈哈上当了！爱情暴击！😾⚡');
        if (sceneContext?.spawnParticle) sceneContext.spawnParticle(this.x, this.y - 15, '⚡🐾💔');
        return;
      }

      this.affection = Math.min(100, this.affection + 5);
      this.purrLevel = Math.min(1.0, this.purrLevel + 0.35);
      if (soundEngine?.startPurr) soundEngine.startPurr();
      if (soundEngine?.playMeow) soundEngine.playMeow(this.pitchMod * 1.1, 'chirp');
      if (sceneContext?.spawnParticle) sceneContext.spawnParticle(this.x, this.y - 20, '💖✨');
      this.speak('呼噜呼噜…再摸摸下巴~ 🥰');
    }
  }

  // 挂载至全局命名空间
  window.CyberMeow = window.CyberMeow || {};
  window.CyberMeow.BREEDS = BREEDS;
  window.CyberMeow.PERSONALITIES = PERSONALITIES;
  window.CyberMeow.HATS = HATS;
  window.CyberMeow.AGENDAS = AGENDAS;
  window.CyberMeow.Cat = Cat;
})(window);
