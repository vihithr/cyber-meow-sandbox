/**
 * CyberMeow - 运行时 + 性能/统计型测试
 *
 * 由 tests/verify.js 引入并共享同一套 test()/assert 计数。
 * 这里在独立 VM 中加载全部 8 个模块，用 tests/dom-mock.js 提供 DOM/RAF/canvas，
 * 从而让 environment.js / ui.js / app.js 真正执行，而非只做语法检查。
 */
'use strict';

const { createBrowserMock, noop } = require('./dom-mock');

const ALL_MODULES = [
  'js/physics.js',
  'js/audio.js',
  'js/furniture.js',
  'js/toys.js',
  'js/cat.js',
  'js/environment.js',
  'js/ui.js',
  'js/app.js'
];

function registerRuntimeTests(options) {
  const { basePath, fs, vm, assert, test } = options;

  console.log('\n🐾 正在真实执行 environment / ui / app（浏览器 API mock）...');

  const mock = createBrowserMock({ innerWidth: 1920, innerHeight: 1080, devicePixelRatio: 3 });
  const sandbox = mock.window;
  const context = vm.createContext(sandbox);

  let loadError = null;
  try {
    ALL_MODULES.forEach(relPath => {
      vm.runInContext(fs.readFileSync(require('path').join(basePath, relPath), 'utf8'), context, {
        filename: relPath
      });
    });
  } catch (err) {
    loadError = err;
  }

  const CyberMeow = sandbox.CyberMeow || {};

  test('environment / ui / app 三个模块可在 VM 中真实加载（无异常）', () => {
    assert.strictEqual(loadError, null, loadError && loadError.stack ? loadError.stack : String(loadError));
    assert.ok(CyberMeow.environment, 'environment 未挂载');
    assert.ok(CyberMeow.uiManager, 'uiManager 未挂载');
  });

  test('environment.js 初始化默认粒子池', () => {
    assert.ok(CyberMeow.environment, 'environment 不存在');
    assert.strictEqual(CyberMeow.environment.dustParticles.length, 60, '默认粒子数不是 60');
  });

  test('ui.js 初始化 UIManager 默认字段', () => {
    assert.ok(CyberMeow.uiManager, 'uiManager 不存在');
    assert.strictEqual(CyberMeow.uiManager.challengeActive, false);
    assert.strictEqual(CyberMeow.uiManager.challengeScore, 0);
  });

  test('app.js 在 DOMContentLoaded 中初始化并挂载 CyberMeow.app', () => {
    assert.strictEqual(loadError, null, '模块加载失败，无法触发 DOMContentLoaded');
    mock.fire('DOMContentLoaded', {});
    const app = CyberMeow.app;
    assert.ok(app, 'DOMContentLoaded 后未挂载 app');
    assert.ok(app.canvas, 'app.canvas 缺失');
    assert.ok(app.ctx, 'app.ctx 缺失');
    assert.strictEqual(app.cats.length, 4, '默认场景应有 4 只猫');
    assert.ok(app.furniture.length > 0, '默认场景缺少家具');
    assert.ok(app.toys.length > 0, '默认场景缺少玩具');
  });

  const app = CyberMeow.app;
  const env = CyberMeow.environment;
  const ui = CyberMeow.uiManager;

  test('主循环由受控 rAF 驱动：init 只登记一帧，不会自动跑飞', () => {
    assert.strictEqual(mock.counters.rafRequests, 1, 'init 应恰好登记一帧');
    assert.strictEqual(mock.rafQueue.length, 1, 'rAF 回调应停留在队列中而非被执行');
    let clearCalls = 0;
    const originalClearRect = app.ctx.clearRect;
    app.ctx.clearRect = function () { clearCalls++; };
    try {
      app.loop(); // 手动推进一帧
    } finally {
      app.ctx.clearRect = originalClearRect;
    }
    assert.strictEqual(clearCalls, 1, '单帧应只清屏一次');
    assert.strictEqual(mock.counters.rafRequests, 2, '单帧结束应只再登记一帧');
    assert.strictEqual(app.ctx.canvas, app.canvas, 'ctx 关联的 canvas 不正确');
  });

  // -------------------------------------------------------------------------
  // 环境与缓存：通过 mock 的渐变创建计数验证缓存，而非读取未导出的模块私有变量
  // -------------------------------------------------------------------------
  console.log('\n🐾 正在测试环境缓存与统计...');

  test('环境粒子数可重设，天气按 clear→rain→fireflies 循环', () => {
    env.initParticles(7);
    assert.strictEqual(env.dustParticles.length, 7, '重设粒子数失败');
    assert.strictEqual(env.weather, 'clear', '初始天气不是 clear');
    assert.strictEqual(env.toggleWeather(), 'rain');
    assert.strictEqual(env.toggleWeather(), 'fireflies');
    assert.strictEqual(env.toggleWeather(), 'clear');
    env.initParticles(60);
  });

  test('雨天雨滴上限 80，切回晴天立即清空', () => {
    env.weather = 'rain';
    for (let i = 0; i < 200; i++) env.update(3000, 1080);
    assert.ok(env.rainDrops.length <= 80, `雨滴超过上限: ${env.rainDrops.length}`);
    assert.ok(env.rainDrops.length > 0, '雨天未生成雨滴');
    env.weather = 'clear';
    env.update(3000, 1080);
    assert.strictEqual(env.rainDrops.length, 0, '切晴天未清空雨滴');
  });

  function gradientCount() {
    return mock.counters.linearGradients + mock.counters.radialGradients + mock.counters.conicGradients;
  }

  test('性能：同主题同视口下背景渐变缓存只创建一次', () => {
    const ctx = mock.document.createElement('canvas').getContext('2d');
    env.setTheme('cozy_night');
    env.weather = 'clear';
    env.drawBackground(ctx, 3000, 1080); // 先用一次调用建立缓存键
    const afterFirst = gradientCount();
    assert.ok(afterFirst > 0, '首帧没有创建任何渐变');
    for (let i = 0; i < 8; i++) env.drawBackground(ctx, 3000, 1080);
    assert.strictEqual(gradientCount(), afterFirst, '缓存命中时仍重复创建渐变');
  });

  test('性能：主题变化和视口尺寸变化使渐变缓存失效，天气变化不失效', () => {
    const ctx = mock.document.createElement('canvas').getContext('2d');
    env.setTheme('cozy_night');
    env.weather = 'clear';
    env.drawBackground(ctx, 3000, 1080); // 建立 cozy_night 基线
    let baseline = gradientCount();

    env.setTheme('sunny_day');
    env.drawBackground(ctx, 3000, 1080);
    const afterTheme = gradientCount();
    assert.ok(afterTheme > baseline, '主题变化后缓存未失效');
    env.drawBackground(ctx, 3000, 1080);
    assert.strictEqual(gradientCount(), afterTheme, '新主题缓存未生效');
    baseline = afterTheme;

    env.drawBackground(ctx, 3200, 1080);
    assert.ok(gradientCount() > baseline, '视口宽度变化后缓存未失效');
    baseline = gradientCount();

    env.toggleWeather(); // clear -> rain（天气不在缓存键内）
    env.drawBackground(ctx, 3200, 1080);
    assert.strictEqual(gradientCount(), baseline, '天气变化不应使渐变缓存失效');
    env.weather = 'clear';
    env.setTheme('cozy_night');
  });

  // -------------------------------------------------------------------------
  // UI：真实执行 ui.js 的交互路径
  // -------------------------------------------------------------------------
  console.log('\n🐾 正在测试 UI 真实交互路径...');

  test('showToast 写入提示文本与透明度', () => {
    const hint = mock.document.getElementById('hint-text');
    ui.showToast('测试提示', 50);
    assert.strictEqual(hint.innerText, '测试提示');
    assert.strictEqual(hint.style.opacity, '1');
  });

  test('红点目标生成严格遵守相机/缩放/世界边界（统计 200 次）', () => {
    const scene = {
      zoom: 0.62,
      viewportWidth: 1920,
      viewportHeight: 1080,
      cameraX: 1300,
      worldWidth: 3000
    };
    const margin = 100;
    const x0 = Math.max(margin, scene.cameraX + margin / scene.zoom);
    const x1 = Math.min(scene.worldWidth - margin,
      scene.cameraX + (scene.viewportWidth - margin) / scene.zoom);
    const y0 = margin / scene.zoom;
    const y1 = (scene.viewportHeight - margin) / scene.zoom;
    for (let i = 0; i < 200; i++) {
      ui.spawnNextTarget(scene);
      const star = ui.targetStar;
      assert.ok(star.x >= x0 - 1e-9 && star.x <= x1 + 1e-9,
        `目标 x 越界: ${star.x} 不在 [${x0}, ${x1}]`);
      assert.ok(star.y >= y0 - 1e-9 && star.y <= y1 + 1e-9,
        `目标 y 越界: ${star.y} 不在 [${y0}, ${y1}]`);
    }
  });

  test('红点挑战：猫咪命中星星得 100 分并刷新目标', () => {
    ui.challengeActive = true;
    ui.challengeScore = 0;
    ui.targetStar = { x: 500, y: 400, radius: 22, pulse: 0 };
    const scene = {
      zoom: 1, viewportWidth: 1920, viewportHeight: 1080,
      cameraX: 0, worldWidth: 3000, spawnParticle: noop
    };
    const cat = { x: 500, y: 400, radius: 12, pitchMod: 1 };
    ui.updateChallenge([cat], scene);
    assert.strictEqual(ui.challengeScore, 100, '命中未得分');
    assert.notDeepStrictEqual(
      { x: ui.targetStar.x, y: ui.targetStar.y },
      { x: 500, y: 400 },
      '命中后未刷新目标'
    );
    ui.challengeActive = false;
    ui.targetStar = null;
  });

  test('护照弹窗、帽子选项与头像绘制在 mock DOM/canvas 上完整执行', () => {
    const cat = app.cats[0];
    ui.openCatPassport(cat);
    const modal = mock.document.getElementById('passport-modal');
    assert.strictEqual(modal.classList.contains('open'), true, '护照弹窗未打开');
    assert.strictEqual(mock.document.getElementById('cat-name-input').value, cat.name);
    assert.ok(mock.document.getElementById('hat-picker-opts').children.length > 0, '未渲染帽子选项');
    assert.doesNotThrow(() => ui.drawChallengeTarget(
      mock.document.createElement('canvas').getContext('2d')));
    ui.closeCatPassport();
    assert.strictEqual(modal.classList.contains('open'), false, '护照弹窗未关闭');
  });

  test('拍立得快照生成 dataURL 并打开快照弹窗', () => {
    const before = mock.counters.toDataURL;
    ui.takeSnapshot(app.canvas);
    assert.ok(mock.counters.toDataURL > before, '未调用 canvas.toDataURL');
    const modal = mock.document.getElementById('snapshot-modal');
    assert.strictEqual(modal.classList.contains('open'), true, '快照弹窗未打开');
    assert.ok(mock.document.getElementById('snapshot-img').src.indexOf('data:image/png') === 0);
    assert.strictEqual(mock.document.getElementById('game-shell').inert, true, '场景仍可以接收输入');
    ui.dismissModal();
    assert.strictEqual(modal.classList.contains('open'), false, '快照弹窗未关闭');
    assert.strictEqual(mock.document.getElementById('game-shell').inert, false, '场景仍锁定');
  });

  // -------------------------------------------------------------------------
  // App：实体上限、相机换算、HUD 等统计型断言
  // -------------------------------------------------------------------------
  console.log('\n🐾 正在测试实体上限与相机统计...');

  test('性能：主循环将玩具/家具裁剪到上限内', () => {
    const saved = { toys: app.toys, furniture: app.furniture, cats: app.cats, particles: app.particles };
    const dummy = (n) => Array.from({ length: n }, () => ({ x: -9999, y: -9999, update: noop, draw: noop }));
    try {
      ui.challengeActive = false;
      app.toys = dummy(100);
      app.furniture = dummy(80);
      app.cats = [];
      app.particles = [];
      app.loop();
      assert.ok(app.toys.length <= 80, `玩具未裁剪: ${app.toys.length}`);
      assert.ok(app.furniture.length <= 60, `家具未裁剪: ${app.furniture.length}`);
    } finally {
      app.toys = saved.toys;
      app.furniture = saved.furniture;
      app.cats = saved.cats;
      app.particles = saved.particles;
    }
  });

  test('性能：粒子数量上限 240（spawnParticle 自裁剪 + 主循环回收）', () => {
    const saved = app.particles;
    try {
      app.particles = [];
      for (let i = 0; i < 300; i++) app.spawnParticle(100, 100, '🌿');
      assert.ok(app.particles.length <= 240, `粒子超过上限: ${app.particles.length}`);
      app.loop();
      assert.ok(app.particles.length <= 240, '主循环后粒子仍超过上限');
    } finally {
      app.particles = saved;
    }
  });

  test('猫咪数量上限 40：达到上限后召唤不再增加', () => {
    const saved = { cats: app.cats, furniture: app.furniture, tool: app.currentTool };
    const canvasEl = mock.document.getElementById('playground');
    try {
      ui.challengeActive = false;
      app.currentTool = 'cat';
      app.furniture = [];
      app.cats = Array.from({ length: 40 }, () => new CyberMeow.Cat(-1000, -1000, { radius: 2 }));
      canvasEl.dispatch('pointerdown', {
        button: 0, clientX: 5, clientY: 5, pointerId: 0, preventDefault: noop
      });
      assert.strictEqual(app.cats.length, 40, '超过上限仍召唤了新猫');
      assert.ok(mock.document.getElementById('hint-text').innerText.indexOf('上限') !== -1,
        '未提示已达上限');
    } finally {
      app.cats = saved.cats;
      app.furniture = saved.furniture;
      app.currentTool = saved.tool;
    }
  });

  test('resize 按 DPR(上限 2) 设置后备缓冲，setTool 切换激光/逗猫棒状态', () => {
    assert.strictEqual(app.dpr, 2, 'devicePixelRatio=3 应被钳制为 2');
    assert.strictEqual(app.canvas.width, app.viewportWidth * 2, '画布宽度未按 DPR 放大');
    app.setTool('laser');
    assert.strictEqual(app.laser.active, true);
    assert.strictEqual(CyberMeow.featherWand.active, false);
    app.setTool('feather');
    assert.strictEqual(app.laser.active, false);
    assert.strictEqual(CyberMeow.featherWand.active, true);
    app.setTool('pet');
  });

  test('getWorldPos 按相机与缩放换算世界坐标', () => {
    const saved = { cameraX: app.cameraX, zoom: app.zoom };
    try {
      app.cameraX = 1000;
      app.zoom = 0.5;
      const pos = app.getWorldPos({ clientX: 200, clientY: 100 });
      assert.strictEqual(pos.x, 1400, '世界 X 换算错误');
      assert.strictEqual(pos.y, 200, '世界 Y 换算错误');
      assert.strictEqual(pos.screenX, 200);
    } finally {
      app.cameraX = saved.cameraX;
      app.zoom = saved.zoom;
    }
  });

  test('updateHud 将实体数量写回统计 DOM', () => {
    app.updateHud();
    assert.strictEqual(mock.document.getElementById('stat-cats').innerText, String(app.cats.length));
    assert.strictEqual(mock.document.getElementById('stat-toys').innerText,
      String(app.toys.length + app.furniture.length));
  });

  // -------------------------------------------------------------------------
  // 视口裁剪与离屏缓存（lead 新增的渲染优化路径）
  // -------------------------------------------------------------------------
  test('视口裁剪：_refreshVisibleRange + _isVisibleX 正确筛选世界对象', () => {
    const saved = {
      cameraX: app.cameraX, zoom: app.zoom,
      targetCameraX: app.targetCameraX, targetZoom: app.targetZoom,
      range: app._visibleRange
    };
    try {
      app.cameraX = 1000;
      app.zoom = 1;
      app._refreshVisibleRange();
      const range = app._visibleRange;
      assert.ok(range.left <= 1000, '可见范围左界应覆盖相机起点');
      assert.ok(range.right >= 1000 + app.viewportWidth / app.zoom,
        '可见范围右界应覆盖视口右缘');

      assert.strictEqual(app._isVisibleX(1500, 20), true, '视口内对象被裁掉');
      assert.strictEqual(app._isVisibleX(50, 20), false, '视口外对象未被裁掉');
      assert.strictEqual(app._isVisibleX(range.left - 100), false, '左侧余量外仍判可见');
      assert.strictEqual(app._isVisibleX(range.right + 100), false, '右侧余量外仍判可见');
      assert.strictEqual(app._isVisibleX(range.right + 10, 40), true,
        '中心略超界但半宽仍相交的对象应判可见');

      assert.strictEqual(app._halfWidth({ w: 80 }), 40);
      assert.strictEqual(app._halfWidth({ width: 60 }), 30);
      assert.strictEqual(app._halfWidth({ radius: 15 }), 15);

      app.zoom = 0.5;
      app._refreshVisibleRange();
      assert.ok(app._visibleRange.right >= 1000 + app.viewportWidth / 0.5,
        '缩小后可见世界范围应随之变宽');
    } finally {
      app.cameraX = saved.cameraX;
      app.zoom = saved.zoom;
      app.targetCameraX = saved.targetCameraX;
      app.targetZoom = saved.targetZoom;
      app._visibleRange = saved.range;
    }
  });

  test('离屏缓存：背景层命中不重绘，主题/DPR 变化才失效', () => {
    let bgDraws = 0;
    const originalDraw = env.drawStaticBackground;
    env.drawStaticBackground = function () {
      bgDraws++;
      return originalDraw.apply(this, arguments);
    };
    const savedTheme = env.theme;
    const savedDpr = app.dpr;
    const savedLayer = app._bgLayer;
    const savedKey = app._bgLayerKey;
    try {
      app._bgLayer = null;
      app._bgLayerKey = '';
      app._ensureBgLayer();
      assert.strictEqual(bgDraws, 1, '首次应绘制背景层');
      const key = app._bgLayerKey;
      assert.ok(key, '未记录背景层签名');

      app._ensureBgLayer();
      assert.strictEqual(bgDraws, 1, '签名未变时不应重复绘制背景');
      assert.strictEqual(app._bgLayerKey, key, '签名被意外改写');

      env.setTheme(savedTheme === 'sunny_day' ? 'cozy_night' : 'sunny_day');
      app._ensureBgLayer();
      assert.strictEqual(bgDraws, 2, '主题变化未使背景层失效');
      assert.notStrictEqual(app._bgLayerKey, key, '主题变化后签名未更新');
      const themeKey = app._bgLayerKey;

      app.dpr = 1;
      app._ensureBgLayer();
      assert.strictEqual(bgDraws, 3, 'DPR 变化未使背景层失效');
      assert.notStrictEqual(app._bgLayerKey, themeKey, 'DPR 变化后签名未更新');
      assert.strictEqual(bgDraws, 3, '签名变化后仍未重绘');
    } finally {
      env.drawStaticBackground = originalDraw;
      env.setTheme(savedTheme);
      app.dpr = savedDpr;
      app._bgLayer = savedLayer;
      app._bgLayerKey = savedKey;
    }
  });

  test('离屏缓存：静态家具层仅随可烘焙家具几何变化而失效', () => {
    const savedFurniture = app.furniture;
    const savedLayer = app._staticFurnitureLayer;
    const savedKey = app._staticFurnitureLayerKey;
    try {
      app._staticFurnitureLayer = null;
      app._staticFurnitureLayerKey = '';
      app._ensureStaticFurnitureLayer();
      const key = app._staticFurnitureLayerKey;
      assert.ok(key, '未记录静态家具层签名');

      // 动态家具（Roomba）不应进入烘焙签名
      app.furniture = savedFurniture.concat([{ type: 'roomba', x: 600, y: 700, w: 40, update: noop, draw: noop }]);
      app._ensureStaticFurnitureLayer();
      assert.strictEqual(app._staticFurnitureLayerKey, key, '动态家具不应使烘焙层失效');

      // 可烘焙家具（跳台）新增/移动应使签名失效
      app.furniture = savedFurniture.concat([{ type: 'perch', x: 600, y: 700, w: 100, update: noop, draw: noop }]);
      app._ensureStaticFurnitureLayer();
      const movedKey = app._staticFurnitureLayerKey;
      assert.notStrictEqual(movedKey, key, '新增可烘焙家具未使缓存失效');
      app.furniture = savedFurniture.concat([{ type: 'perch', x: 640, y: 700, w: 100, update: noop, draw: noop }]);
      app._ensureStaticFurnitureLayer();
      assert.notStrictEqual(app._staticFurnitureLayerKey, movedKey, '家具位移未使缓存失效');
    } finally {
      app.furniture = savedFurniture;
      app._staticFurnitureLayer = savedLayer;
      app._staticFurnitureLayerKey = savedKey;
    }
  });

  // -------------------------------------------------------------------------
  // 视口裁剪：若 lead / 其他 agent 引入了更多裁剪函数则自动启用断言，否则明确跳过
  // -------------------------------------------------------------------------
  function callFlexible(fn, subject, view) {
    const appView = app || {};
    const patterns = [
      () => fn(subject, view),
      () => fn(subject, view.cameraX, view.viewportWidth, view.viewportHeight, view.zoom),
      () => fn(subject, view.cameraX, view.cameraX + view.viewportWidth / view.zoom),
      () => fn(subject),
      () => fn(subject, appView.cameraX, appView.viewportWidth, appView.viewportHeight, appView.zoom || 1)
    ];
    for (let i = 0; i < patterns.length; i++) {
      try {
        const result = patterns[i]();
        if (result !== undefined) return result;
      } catch (err) { /* 尝试下一种签名 */ }
    }
    return undefined;
  }

  const view = {
    cameraX: 1000, viewportWidth: 1920, viewportHeight: 1080,
    zoom: 1, worldWidth: 3000
  };
  const cullCandidates = [];
  [
    'isVisible', 'cullVisible', 'viewportCull', 'cullObjects',
    'filterVisible', 'isInViewport', 'frustumCull', 'isOnScreen'
  ].forEach(name => {
    if (typeof CyberMeow[name] === 'function') cullCandidates.push([name, CyberMeow[name], 'CyberMeow']);
    if (app && typeof app[name] === 'function') {
      cullCandidates.push([name, app[name].bind(app), 'app']);
    }
  });

  if (cullCandidates.length === 0) {
    console.log('⏭️ 未发现其他命名的视口裁剪函数：_isVisibleX 已由专项测试覆盖，条件测试跳过。');
  } else {
    cullCandidates.forEach(([name, fn, where]) => {
      test(`视口裁剪 ${where}.${name} 正确筛选可见对象`, () => {
        const savedCam = app ? { x: app.cameraX, z: app.zoom } : null;
        try {
          if (app) { app.cameraX = 1000; app.zoom = 1; }
          const inside = { x: 1500, y: 500, radius: 20, w: 40, h: 40 };
          const outside = { x: 50, y: 500, radius: 20, w: 40, h: 40 };
          const filtered = callFlexible(fn, [inside, outside], view);
          if (Array.isArray(filtered)) {
            assert.ok(filtered.indexOf(inside) !== -1, '可见对象被裁掉');
            assert.ok(filtered.indexOf(outside) === -1, '不可见对象未被裁掉');
          } else {
            const rIn = callFlexible(fn, inside, view);
            const rOut = callFlexible(fn, outside, view);
            assert.ok(rIn !== undefined, '无法调用裁剪谓词（签名不匹配）');
            assert.ok(rIn, '视口内对象被判为不可见');
            assert.ok(!rOut, '视口外对象被判为可见');
          }
        } finally {
          if (app && savedCam) { app.cameraX = savedCam.x; app.zoom = savedCam.z; }
        }
      });
    });
  }

  test('存档往返：名字、装扮与 0 值属性能正确恢复', () => {
    const cat = app.cats[0];
    const original = { name: cat.name, hunger: cat.hunger, affection: cat.affection };
    const saved = { cats: app.cats, furniture: app.furniture, toys: app.toys };
    try {
      cat.name = '测试喵';
      cat.hunger = 0;
      cat.affection = 0;
      app.saveState();

      const raw = sandbox.localStorage.getItem('cybermeow_cats_save');
      assert.ok(raw, '存档未写入 localStorage');
      const parsed = JSON.parse(raw);
      assert.strictEqual(parsed[0].name, '测试喵');
      assert.strictEqual(parsed[0].hunger, 0, '0 值未写入存档');

      // loadState 会重建家具，先清空猫并暂存家具，验证后完整恢复运行时状态
      app.cats = [];
      assert.ok(app.loadState(), 'loadState 返回失败');
      assert.strictEqual(app.cats.length, saved.cats.length);
      assert.strictEqual(app.cats[0].name, '测试喵');
      assert.strictEqual(app.cats[0].hunger, 0, '0 值饥饿度未恢复');
      assert.strictEqual(app.cats[0].affection, 0, '0 值亲密度未恢复');
    } finally {
      app.cats = saved.cats;
      app.furniture = saved.furniture;
      app.toys = saved.toys;
      cat.name = original.name;
      cat.hunger = original.hunger;
      cat.affection = original.affection;
    }
  });

  test('自适应画质：连续慢帧降级，持续流畅后回升', () => {
    const savedQuality = app.renderQuality;
    const savedCap = app._dprCap;
    const savedEma = app._frameEma;
    const savedSlow = app._slowFrames;
    const savedFast = app._fastFrames;
    const savedLocked = app._qualityLocked;
    try {
      app._qualityLocked = false; // 自适应测试需要解锁（Q 键测试会锁定）
      app.renderQuality = 'high';
      app._dprCap = 2;
      app._slowFrames = 0;
      app._fastFrames = 0;
      app._frameEma = 35;
      for (let i = 0; i < 21; i++) app._updateRenderQuality();
      assert.strictEqual(app.renderQuality, 'low', '慢帧未触发降级');
      assert.strictEqual(app._dprCap, 1, '降级后 DPR 上限未降低');
      assert.strictEqual(sandbox.CyberMeow.renderQuality, 'low', '全局画质标记未同步');

      app._frameEma = 12;
      app._slowFrames = 0;
      app._fastFrames = 0;
      for (let i = 0; i < 181; i++) app._updateRenderQuality();
      assert.strictEqual(app.renderQuality, 'high', '流畅后未恢复画质');
      assert.strictEqual(app._dprCap, 2, '恢复后 DPR 上限未回升');
    } finally {
      app.renderQuality = savedQuality;
      app._dprCap = savedCap;
      app._frameEma = savedEma;
      app._slowFrames = savedSlow;
      app._fastFrames = savedFast;
      app._qualityLocked = savedLocked;
      sandbox.CyberMeow.renderQuality = savedQuality;
      if (app.dpr !== Math.min(3, savedCap)) app.resize();
    }
  });

  test('喵视角：按 C 切换后镜头跟随目标猫', () => {
    const savedCatCam = app.catCam;
    const savedTarget = app.targetCameraX;
    const savedCatX = app.cats[0].x;
    const savedMouseX = app.mouse.x;
    const savedMouseY = app.mouse.y;
    try {
      app.catCam = null;
      app.cats[0].x = 1200;
      app.mouse.x = 1200;
      app.mouse.y = app.cats[0].y;
      app.toggleCatCam();
      assert.ok(app.catCam, '喵视角未启动');
      assert.strictEqual(app.catCam, app.cats[0], '未跟随离鼠标最近的猫');

      app.loop();
      const maxCamX = Math.max(0, app.worldWidth - app.viewportWidth / app.zoom);
      const expected = Math.max(0, Math.min(maxCamX,
        1200 - app.viewportWidth / (2 * app.zoom)));
      assert.ok(Math.abs(app.targetCameraX - expected) < 1e-6,
        `镜头未跟随目标猫: ${app.targetCameraX} != ${expected}`);

      app.toggleCatCam();
      assert.strictEqual(app.catCam, null, '喵视角未退出');
    } finally {
      app.catCam = savedCatCam;
      app.targetCameraX = savedTarget;
      app.cats[0].x = savedCatX;
      app.mouse.x = savedMouseX;
      app.mouse.y = savedMouseY;
    }
  });

  // -------------------------------------------------------------------------
  // 手动画质切换（Q 键）与低画质渲染的实际开销差异
  // -------------------------------------------------------------------------
  console.log('\n🐾 正在测试手动画质切换与低画质渲染开销...');

  test('手动 Q 键按 高→均衡→流畅→高 循环切换画质并同步 DPR 上限', () => {
    const saved = {
      quality: app.renderQuality, cap: app._dprCap,
      ema: app._frameEma, slow: app._slowFrames, fast: app._fastFrames,
      locked: app._qualityLocked
    };
    const pressQ = () => mock.fire('keydown', {
      target: { tagName: 'CANVAS' }, key: 'q', code: 'KeyQ', preventDefault: noop
    });
    try {
      app.renderQuality = 'high';
      app._dprCap = 2;
      app._slowFrames = 0;
      app._fastFrames = 0;
      app._qualityLocked = false;

      pressQ();
      assert.strictEqual(app.renderQuality, 'medium', '高→均衡切换失败');
      assert.strictEqual(app._dprCap, 1.25, '均衡档 DPR 上限错误');
      assert.strictEqual(sandbox.CyberMeow.renderQuality, 'medium', '全局画质标记未同步');
      assert.strictEqual(app._frameEma, 20, '均衡档帧间隔基线错误');

      pressQ();
      assert.strictEqual(app.renderQuality, 'low', '均衡→流畅切换失败');
      assert.strictEqual(app._dprCap, 1, '流畅档 DPR 上限错误');
      assert.strictEqual(app._frameEma, 35, '流畅档帧间隔基线错误');

      pressQ();
      assert.strictEqual(app.renderQuality, 'high', '流畅→高循环失败');
      assert.strictEqual(app._dprCap, 2, '高档 DPR 上限未恢复');
      assert.strictEqual(app._frameEma, 14, '高档帧间隔基线错误');
      assert.strictEqual(app._qualityLocked, true, '按 Q 后未锁定手动档位');
    } finally {
      app.renderQuality = saved.quality;
      app._dprCap = saved.cap;
      app._frameEma = saved.ema;
      app._slowFrames = saved.slow;
      app._fastFrames = saved.fast;
      app._qualityLocked = saved.locked;
      sandbox.CyberMeow.renderQuality = saved.quality;
      app.resize();
    }
  });

  test('Q 锁定后自适应画质不再回切（切 low 做性能对照的前提）', () => {
    const saved = {
      quality: app.renderQuality, cap: app._dprCap,
      ema: app._frameEma, slow: app._slowFrames, fast: app._fastFrames,
      locked: app._qualityLocked
    };
    const pressQ = () => mock.fire('keydown', {
      target: { tagName: 'CANVAS' }, key: 'q', code: 'KeyQ', preventDefault: noop
    });
    try {
      app.renderQuality = 'medium';
      app._dprCap = 1.25;
      app._slowFrames = 0;
      app._fastFrames = 0;
      app._qualityLocked = false;

      pressQ(); // medium → low，同时锁定
      assert.strictEqual(app.renderQuality, 'low', '未切到 low');
      assert.strictEqual(app._qualityLocked, true, 'Q 键未锁定档位');

      // 模拟持续流畅 300 帧：未锁定时 _fastFrames>=180 会升回 high
      app._frameEma = 10;
      for (let i = 0; i < 300; i++) app._updateRenderQuality();
      assert.strictEqual(app.renderQuality, 'low', '锁定后自适应仍回切了档位');
      assert.strictEqual(sandbox.CyberMeow.renderQuality, 'low', '全局标记被自适应改写');
      assert.strictEqual(app._fastFrames, 0, '锁定时不应累计升级计数');
    } finally {
      app.renderQuality = saved.quality;
      app._dprCap = saved.cap;
      app._frameEma = saved.ema;
      app._slowFrames = saved.slow;
      app._fastFrames = saved.fast;
      app._qualityLocked = saved.locked;
      sandbox.CyberMeow.renderQuality = saved.quality;
      app.resize();
    }
  });

  test('自适应画质：中等慢帧进入均衡档（EMA 22~30）', () => {
    const saved = {
      quality: app.renderQuality, cap: app._dprCap,
      ema: app._frameEma, slow: app._slowFrames, fast: app._fastFrames,
      locked: app._qualityLocked
    };
    try {
      app._qualityLocked = false; // 自适应测试需要解锁
      app.renderQuality = 'high';
      app._dprCap = 2;
      app._slowFrames = 0;
      app._fastFrames = 0;
      app._frameEma = 25;
      for (let i = 0; i < 21; i++) app._updateRenderQuality();
      assert.strictEqual(app.renderQuality, 'medium', '中等慢帧未进入均衡档');
      assert.strictEqual(app._dprCap, 1.25, '均衡档 DPR 上限错误');
      assert.strictEqual(sandbox.CyberMeow.renderQuality, 'medium', '全局标记未同步');
    } finally {
      app.renderQuality = saved.quality;
      app._dprCap = saved.cap;
      app._frameEma = saved.ema;
      app._slowFrames = saved.slow;
      app._fastFrames = saved.fast;
      app._qualityLocked = saved.locked;
      sandbox.CyberMeow.renderQuality = saved.quality;
      app.resize();
    }
  });

  test('低画质渲染确实减少渐变创建（宝石眼/毛发细节降级）', () => {
    const savedQuality = sandbox.CyberMeow.renderQuality;
    const cat = new sandbox.CyberMeow.Cat(500, 500, { breed: sandbox.CyberMeow.BREEDS[0] });
    cat.state = 'idle';
    cat.purrLevel = 0;
    cat._blinkAmt = 0;
    const ctx = mock.document.createElement('canvas').getContext('2d');
    const countGradients = () =>
      mock.counters.linearGradients + mock.counters.radialGradients + mock.counters.conicGradients;
    // 每档先预热一帧建立一次性缓存，再累计 5 帧，消除单帧随机性
    const measure = (quality) => {
      sandbox.CyberMeow.renderQuality = quality;
      assert.doesNotThrow(() => cat.draw(ctx, 1920, 1080));
      let total = 0;
      for (let i = 0; i < 5; i++) {
        const before = countGradients();
        assert.doesNotThrow(() => cat.draw(ctx, 1920, 1080));
        total += countGradients() - before;
      }
      return total;
    };
    try {
      const highTotal = measure('high');
      const lowTotal = measure('low');
      assert.ok(highTotal > 0, '高画质渲染未创建任何渐变，基准无意义');
      assert.ok(lowTotal < highTotal,
        `低画质未减少渐变创建: high=${highTotal}, low=${lowTotal}`);
      console.log(`     5 帧单猫渐变创建总数: high=${highTotal}, low=${lowTotal}`);
    } finally {
      sandbox.CyberMeow.renderQuality = savedQuality;
    }
  });

  test('镜像文字：facing=-1 的猫，名字/气泡/徽章文字均为正向（矩阵 a>0）', () => {
    const cat = new sandbox.CyberMeow.Cat(500, 500, { breed: sandbox.CyberMeow.BREEDS[0] });
    const ctx = mock.document.createElement('canvas').getContext('2d');
    const capture = () => {
      const texts = [];
      const original = ctx.fillText;
      ctx.fillText = function (...args) {
        texts.push({ text: args[0], a: ctx.getTransform().a });
        return original.apply(this, args);
      };
      return { texts, restore: () => { ctx.fillText = original; } };
    };

    // 朝右：文字正向
    cat.facing = 1;
    cat.state = 'idle';
    cat.bubbleTimer = 100;
    cat.bubbleText = '喵';
    cat.name = '测试猫';
    let cap = capture();
    assert.doesNotThrow(() => cat.draw(ctx, 1920, 1080));
    cap.restore();
    const rightTexts = cap.texts.filter(t => t.text === '测试猫' || t.text === '喵');
    assert.ok(rightTexts.length >= 2, '未捕获到名字/气泡文字');
    rightTexts.forEach(t => assert.ok(t.a > 0, `facing=1 文字被镜像: a=${t.a}`));

    // 朝左：文字仍须正向（这是原 bug 所在）
    cat.facing = -1;
    cap = capture();
    assert.doesNotThrow(() => cat.draw(ctx, 1920, 1080));
    cap.restore();
    const leftTexts = cap.texts.filter(t => t.text === '测试猫' || t.text === '喵');
    assert.ok(leftTexts.length >= 2, '未捕获到朝左猫的名字/气泡文字');
    leftTexts.forEach(t => assert.ok(t.a > 0, `facing=-1 文字倒转: a=${t.a}`));

    // 爬树姿态：文字不应随躯干旋转 90°（b 分量应接近 0）
    cat.state = 'climbing';
    cat._climbBlend = 1;
    const nameTransform = [];
    const original = ctx.fillText;
    ctx.fillText = function (...args) {
      if (args[0] === '测试猫') { const t = ctx.getTransform(); nameTransform.push({ a: t.a, b: t.b }); }
      return original.apply(this, args);
    };
    assert.doesNotThrow(() => cat.draw(ctx, 1920, 1080));
    ctx.fillText = original;
    assert.ok(nameTransform.length >= 1, '爬树状态未捕获到名字变换');
    nameTransform.forEach(t => {
      assert.ok(t.a > 0, `爬树文字被镜像: a=${t.a}`);
      assert.ok(Math.abs(t.b) < 0.01, `爬树文字随躯干倾斜: b=${t.b}`);
    });
  });

  test('空间连通分量聚类与多猫标签折叠引擎', () => {
    const engine = sandbox.CyberMeow.LabelClusterEngine;
    assert.ok(engine, '缺少 LabelClusterEngine 挂载');

    const Cat = sandbox.CyberMeow.Cat;
    const BREEDS = sandbox.CyberMeow.BREEDS;

    // 3 只扎堆猫咪 (水平距离 < 75px)
    const catA = new Cat(500, 400, { breed: BREEDS[0] });
    const catB = new Cat(530, 410, { breed: BREEDS[1] });
    const catC = new Cat(560, 405, { breed: BREEDS[2] });
    // 1 只落单猫咪 (远距离 1200px)
    const catD = new Cat(1200, 400, { breed: BREEDS[3] });

    const viewport = { cameraX: 0, zoom: 1.0, width: 1920, height: 1080 };
    const { clusters, singletons } = engine.clusterCats([catA, catB, catC, catD], viewport, 75);

    assert.strictEqual(clusters.length, 1, '扎堆猫咪未正确聚类为 1 个团簇');
    assert.strictEqual(clusters[0].count, 3, '聚类团簇内猫咪数量应为 3');
    assert.strictEqual(singletons.length, 1, '落单猫咪应作为 1 个独立项');
    assert.strictEqual(singletons[0], catD);

    // 测试智能聚类渲染无异常
    const ctx = mock.document.createElement('canvas').getContext('2d');
    assert.doesNotThrow(() => {
      engine.renderLabels(ctx, [catA, catB, catC, catD], viewport, { clusterMode: 'smart' });
      engine.renderLabels(ctx, [catA, catB, catC, catD], viewport, { clusterMode: 'minimal' });
      engine.renderLabels(ctx, [catA, catB, catC, catD], viewport, { clusterMode: 'full' });
    }, 'LabelClusterEngine 渲染多模式抛异常');
  });

  test('底层绘制引擎调控中枢与预设切换', () => {
    const mgr = sandbox.CyberMeow.renderEngineManager;
    assert.ok(mgr, '缺少 renderEngineManager 挂载');

    mgr.applyPreset('saver');
    assert.strictEqual(mgr.config.pipeline, 'chibi_cached', '节能预设管线异常');
    assert.strictEqual(mgr.config.clusterMode, 'minimal', '节能预设折叠异常');
    assert.strictEqual(mgr.config.particleBudget, 30, '节能预设粒子异常');

    mgr.applyPreset('ultra');
    assert.strictEqual(mgr.config.pipeline, 'procedural', '次世代预设管线异常');
    assert.strictEqual(mgr.config.clusterMode, 'full', '次世代预设折叠异常');
    assert.strictEqual(mgr.config.particleBudget, 240, '次世代预设粒子异常');

    mgr.applyPreset('balanced');
    assert.strictEqual(mgr.config.pipeline, 'chibi', '平衡预设管线异常');
    assert.strictEqual(mgr.config.clusterMode, 'smart', '平衡预设折叠异常');
    assert.strictEqual(mgr.config.spriteCache, true, '平衡预设 Sprite 缓存应开启');
  });
}

module.exports = { registerRuntimeTests };
