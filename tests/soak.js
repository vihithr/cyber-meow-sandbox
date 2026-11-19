/**
 * CyberMeow - 压力与鲁棒性测试
 *
 * 由 tests/verify.js 引入并共享同一套 test()/assert 计数。
 * 覆盖三类常规断言容易漏掉的问题：
 *   1. 所有状态分支的渲染参数是否出现 NaN（Canvas 会静默吞掉 NaN，肉眼只看到猫消失）
 *   2. 长时间逐帧仿真 + 随机交互是否累积出非有限数值 / 数组泄漏 / rAF 重复登记
 *   3. 视觉体型与物理碰撞体是否脱节（猫看起来比交互范围大很多）
 */
'use strict';

const path = require('path');
const { createBrowserMock } = require('./dom-mock');

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

const TOOLS = ['pet', 'cat', 'laser', 'feather', 'fish', 'yarn', 'box', 'cattree', 'roomba', 'scratcher', 'catnip'];
const noop = () => {};

function registerSoakTests(options) {
  const { basePath, fs, vm, assert, test } = options;

  console.log('\n🐾 正在压力测试：全状态渲染 / 长时间仿真 / 视觉体型...');

  const mock = createBrowserMock({ innerWidth: 1280, innerHeight: 720, devicePixelRatio: 2 });
  const sandbox = mock.window;
  const context = vm.createContext(sandbox);
  let loadError = null;
  try {
    ALL_MODULES.forEach(rel => {
      vm.runInContext(fs.readFileSync(path.join(basePath, rel), 'utf8'), context, { filename: rel });
    });
    mock.fire('DOMContentLoaded', {});
  } catch (err) {
    loadError = err;
  }
  const app = sandbox.CyberMeow && sandbox.CyberMeow.app;

  test('压力环境：全部模块加载并完成初始化', () => {
    assert.strictEqual(loadError, null, loadError && loadError.stack ? loadError.stack : String(loadError));
    assert.ok(app, 'app 未初始化');
  });
  if (!app) return;

  // 从源码提取真实存在的状态字符串，新增状态会自动纳入覆盖
  const catSource = fs.readFileSync(path.join(basePath, 'js/cat.js'), 'utf8');
  const states = Array.from(new Set(
    [...catSource.matchAll(/this\.state\s*=\s*'([a-z_]+)'/g)].map(m => m[1])
  ));

  // 用可控时钟驱动 rAF，避免真实时间波动影响帧间隔与自适应画质
  let clock = 0;
  let currentFrame = -1;
  sandbox.performance.now = () => clock;

  function tick(dtMs) {
    clock += dtMs;
    const queue = mock.rafQueue.splice(0);
    if (queue.length !== 1) throw new Error(`每帧应恰好有 1 个 rAF 回调，实际 ${queue.length}`);
    queue.forEach(cb => cb());
  }

  // Canvas 对 NaN 参数完全静默：包裹绘制方法，把隐蔽的数值错误变成可断言的异常
  const GUARDED = [
    'translate', 'scale', 'rotate', 'transform', 'setTransform',
    'clearRect', 'fillRect', 'strokeRect', 'rect', 'roundRect',
    'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo',
    'arc', 'arcTo', 'ellipse', 'drawImage', 'fillText', 'strokeText',
    'createLinearGradient', 'createRadialGradient'
  ];

  function withNaNGuard(ctx, fn) {
    const saved = {};
    GUARDED.forEach(name => {
      saved[name] = ctx[name];
      ctx[name] = function (...args) {
        for (const a of args) {
          if (typeof a === 'number' && !Number.isFinite(a)) {
            const stack = new Error().stack.split('\n').slice(2, 7).join('\n');
            const bad = [];
            app.cats.forEach(c => {
              if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) {
                bad.push(`猫 ${c.name}@${c.x},${c.y} state=${c.state} heldYarn=${!!c.heldYarn}`);
              }
            });
            app.toys.forEach(t => {
              if (!Number.isFinite(t.x) || !Number.isFinite(t.y)) {
                bad.push(`玩具 ${t.type}@${t.x},${t.y} heldBy=${t.heldBy ? `${t.heldBy.x},${t.heldBy.y}` : 'none'}`);
              }
            });
            throw new Error(
              `第 ${currentFrame} 帧 ${name}() 收到非有限参数：${args.join(', ')}\n${stack}\nDIAG: ${bad.join(' | ') || '无已注册对象异常'}`
            );
          }
        }
        return saved[name] && saved[name].apply(this, args);
      };
    });
    try {
      return fn();
    } finally {
      GUARDED.forEach(name => { ctx[name] = saved[name]; });
    }
  }

  test(`全状态渲染：源码中 ${states.length} 个状态均不产生 NaN 绘制参数`, () => {
    assert.ok(states.length >= 20, `提取到的状态过少：${states.length}`);
    const cat = app.cats[0];
    states.forEach(state => {
      cat.state = state;
      assert.doesNotThrow(
        () => withNaNGuard(app.ctx, () => cat.render(app.ctx, app.viewportWidth, app.viewportHeight)),
        `状态 ${state} 渲染异常`
      );
    });
  });

  test('视觉体型：主缩放使设计身长不超过碰撞直径的 1.15 倍', () => {
    const cat = app.cats[0];
    const scales = [];
    const originalScale = app.ctx.scale;
    app.ctx.scale = function (x, y) {
      scales.push({ x, y });
      return originalScale.apply(this, arguments);
    };
    try {
      cat.render(app.ctx, app.viewportWidth, app.viewportHeight);
    } finally {
      app.ctx.scale = originalScale;
    }
    // 主缩放的正负由 facing 决定，y 恒为正；姿态形变是后续额外的 scale 调用
    const primary = scales.find(s => s.y > 0 && Math.abs(Math.abs(s.x) - s.y) < 1e-9);
    assert.ok(primary, '未捕获到主缩放调用');
    assert.ok(
      Math.abs(primary.y - cat.radius / 44) < 1e-6,
      `主缩放 ${primary.y.toFixed(4)} 与期望 ${(cat.radius / 44).toFixed(4)} 不符`
    );
    assert.ok(
      96 * primary.y <= 2 * cat.radius * 1.15,
      `视觉身长 ${(96 * primary.y).toFixed(1)}px 仍显著大于碰撞直径 ${2 * cat.radius}px`
    );
  });

  test('异常 dt：0 / 负数 / NaN / 超大值不会让猫咪数值爆炸', () => {
    const cat = app.cats[0];
    const scene = {
      dt: 0, cats: app.cats, toys: app.toys, furniture: app.furniture,
      mouse: { x: 0, y: 0 }, laser: { active: false }, spawnParticle: noop
    };
    [0, -1, NaN, 1e6].forEach(dt => {
      scene.dt = dt;
      assert.doesNotThrow(() => cat.update(app.worldWidth, app.height, scene), `dt=${dt} 更新抛异常`);
      assert.ok(Number.isFinite(cat.x) && Number.isFinite(cat.y), `dt=${dt} 后坐标非有限`);
      assert.ok(Number.isFinite(cat.vx) && Number.isFinite(cat.vy), `dt=${dt} 后速度非有限`);
    });
  });

  test('边界坐标：画布顶边/左边的 0 坐标不会被误判为缺失', () => {
    const p = app.getWorldPos({ clientX: 0, clientY: 0 });
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), '指针 0 坐标换算出了非有限世界坐标');
    const t = app.getWorldPos({ touches: [{ clientX: 0, clientY: 0 }] });
    assert.ok(Number.isFinite(t.x) && Number.isFinite(t.y), '触摸 0 坐标换算出了非有限世界坐标');

    app.setTool('yarn');
    const before = app.toys.length;
    const evt = { clientX: 0, clientY: 0, button: 0, pointerId: 1, preventDefault: noop };
    app.canvas.dispatch('pointerdown', evt);
    mock.fire('pointerup', evt);
    assert.strictEqual(app.toys.length, before + 1, '顶边点击未生成毛线球');
    const yarn = app.toys[app.toys.length - 1];
    assert.ok(Number.isFinite(yarn.x) && Number.isFinite(yarn.y), '生成的毛线球坐标非有限');
  });

  test('3000 帧随机交互仿真：无异常、无 NaN、数组不泄漏、rAF 不重复登记', () => {
    let toolIndex = 0;
    const env = sandbox.CyberMeow.environment;
    const originalTheme = env.theme;
    try {
      for (let i = 0; i < 3000; i++) {
        currentFrame = i;
        if (i % 90 === 0) app.setTool(TOOLS[toolIndex++ % TOOLS.length]);

        if (i % 45 === 0) {
          const evt = {
            clientX: (i * 137) % app.viewportWidth,
            clientY: (i * 83) % app.viewportHeight,
            button: 0,
            pointerId: 1,
            preventDefault: noop
          };
          app.canvas.dispatch('pointerdown', evt);
          mock.fire('pointerup', evt);
        }

        if (i % 600 === 0) {
          env.theme = env.theme === 'cyber_neon' ? 'day' : 'cyber_neon';
          env.toggleWeather();
        }

        withNaNGuard(app.ctx, () => tick(16.7));

        app.cats.forEach(cat => {
          assert.ok(Number.isFinite(cat.x) && Number.isFinite(cat.y), `第 ${i} 帧坐标非有限`);
          assert.ok(Number.isFinite(cat.vx) && Number.isFinite(cat.vy), `第 ${i} 帧速度非有限`);
          assert.ok(Number.isFinite(cat.energy) && Number.isFinite(cat.hunger), `第 ${i} 帧生理值非有限`);
          assert.ok(typeof cat.state === 'string' && cat.state.length > 0, `第 ${i} 帧状态非法`);
        });
        app.furniture.forEach(f => {
          if (f.x !== undefined) assert.ok(Number.isFinite(f.x), `第 ${i} 帧家具 ${f.type} 的 x 非有限`);
          if (f.y !== undefined) assert.ok(Number.isFinite(f.y), `第 ${i} 帧家具 ${f.type} 的 y 非有限`);
        });
        app.toys.forEach(t => {
          if (t.x !== undefined) assert.ok(Number.isFinite(t.x), `第 ${i} 帧玩具 ${t.type} 的 x 非有限`);
          if (t.y !== undefined) assert.ok(Number.isFinite(t.y), `第 ${i} 帧玩具 ${t.type} 的 y 非有限`);
          if (t.vx !== undefined) assert.ok(Number.isFinite(t.vx), `第 ${i} 帧玩具 ${t.type} 的 vx 非有限`);
          if (t.vy !== undefined) assert.ok(Number.isFinite(t.vy), `第 ${i} 帧玩具 ${t.type} 的 vy 非有限`);
          if (t.heldBy) {
            assert.ok(Number.isFinite(t.heldBy.x) && Number.isFinite(t.heldBy.y),
              `第 ${i} 帧玩具 ${t.type} 的持有者坐标非有限`);
          }
        });
        assert.ok(app.cats.length <= 40, `第 ${i} 帧猫咪数 ${app.cats.length} 超过上限`);
        assert.ok(app.toys.length <= 80, `第 ${i} 帧玩具数 ${app.toys.length} 超过上限`);
        assert.ok(app.furniture.length <= 60, `第 ${i} 帧家具数 ${app.furniture.length} 超过上限`);
        assert.ok(mock.rafQueue.length === 1, `第 ${i} 帧 rAF 队列长度 ${mock.rafQueue.length}`);
      }
    } finally {
      env.theme = originalTheme;
      app.setTool('pet');
    }
  });
}

module.exports = { registerSoakTests };
