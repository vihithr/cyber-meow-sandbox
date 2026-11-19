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
    assert.strictEqual(app.cats.length, 3, '默认场景应有 3 只猫');
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
      app.cats = Array.from({ length: 40 }, () => ({
        x: -1000, y: -1000, radius: 2, isGrabbed: false
      }));
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
}

module.exports = { registerRuntimeTests };
