'use strict';
/**
 * CyberMeow 主循环渲染性能基准（可复现、无硬阈值断言）
 *
 * 运行：
 *   node tests/bench.js
 *   BENCH_FRAMES=600 node tests/bench.js   # 自定义帧数
 *
 * 方法：
 *   - 在独立 VM 中真实加载全部 8 个模块，用 tests/dom-mock.js 提供 DOM/canvas/RAF；
 *   - rAF 只入队不执行，由脚本手动调用 app.loop() 推进固定帧数；
 *   - 每帧前后读取 dom-mock 的全局计数，得到「每帧渐变创建数 / 路径操作数 / drawImage 次数」；
 *   - JS 侧耗时用 process.hrtime.bigint() 测量，只输出数字；
 *   - 分别在高画质 / 低画质下各跑一轮，输出对比。
 *
 * 设计约束：
 *   - 不设帧耗时阈值，不做通过/失败断言，避免 CI 抖动造成假失败；
 *   - 每帧「钉住」画质与帧间隔基线，排除 loop 内自适应画质切换对基准的干扰；
 *   - 固定视口/DPR/预热帧数，保证同一环境下数字可复现。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createBrowserMock, noop } = require('./dom-mock');

const basePath = path.resolve(__dirname, '..');
const FRAMES = Math.max(1, Number(process.env.BENCH_FRAMES || 300) || 300);
const WARMUP = 10;

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

function createApp() {
  const mock = createBrowserMock({ innerWidth: 1920, innerHeight: 1080, devicePixelRatio: 2 });
  const sandbox = mock.window;
  const context = vm.createContext(sandbox);
  for (const rel of ALL_MODULES) {
    vm.runInContext(fs.readFileSync(path.join(basePath, rel), 'utf8'), context, { filename: rel });
  }
  mock.fire('DOMContentLoaded', {});
  const app = sandbox.CyberMeow && sandbox.CyberMeow.app;
  if (!app) throw new Error('app 未初始化：DOMContentLoaded 未挂载 CyberMeow.app');
  return { mock, sandbox, app };
}

function snapshot(counters) {
  return {
    grad: counters.linearGradients + counters.radialGradients + counters.conicGradients,
    path: counters.pathOps,
    blit: counters.drawImages
  };
}

/**
 * 跑一轮固定帧数。pin() 把画质与 EMA 基线钉住，
 * 保证 app.loop() 内的 _updateRenderQuality() 不会自行切换画质。
 */
function runPass(app, sandbox, mock, quality, frames) {
  const pin = () => {
    app.renderQuality = quality;
    sandbox.CyberMeow.renderQuality = quality;
    app._frameEma = 16; // 落在 13~22 的中性区间：既不降级也不回升
    app._slowFrames = 0;
    app._fastFrames = 0;
  };
  pin();
  for (let i = 0; i < WARMUP; i++) {
    pin();
    app.loop();
  }

  const counters = mock.counters;
  const perFrame = [];
  let prev = snapshot(counters);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < frames; i++) {
    pin();
    app.loop();
    const cur = snapshot(counters);
    perFrame.push({
      grad: cur.grad - prev.grad,
      path: cur.path - prev.path,
      blit: cur.blit - prev.blit
    });
    prev = cur;
  }
  const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;
  return { quality, frames, perFrame, elapsedMs };
}

function stats(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const total = values.reduce((a, b) => a + b, 0);
  return {
    total,
    avg: total / values.length,
    median: sorted[Math.floor(sorted.length / 2)],
    min: sorted[0],
    max: sorted[sorted.length - 1]
  };
}

function fmt(n, digits) {
  return Number(n).toFixed(digits === undefined ? 1 : digits);
}

function printPass(r) {
  const g = stats(r.perFrame.map(x => x.grad));
  const p = stats(r.perFrame.map(x => x.path));
  const b = stats(r.perFrame.map(x => x.blit));

  console.log(`--- 画质: ${r.quality}（${r.frames} 帧） ---`);
  console.log(
    '指标'.padEnd(16) + '总计'.padStart(12) + '每帧均值'.padStart(12) +
    '每帧中位数'.padStart(12) + '每帧最小'.padStart(12) + '每帧最大'.padStart(12)
  );
  const row = (label, s) => console.log(
    label.padEnd(16) + String(s.total).padStart(12) +
    fmt(s.avg).padStart(12) + fmt(s.median).padStart(12) +
    String(s.min).padStart(12) + String(s.max).padStart(12)
  );
  row('渐变创建数', g);
  row('路径操作数', p);
  row('drawImage', b);
  console.log(`JS 耗时: 总计 ${fmt(r.elapsedMs, 2)} ms | 平均 ${fmt(r.elapsedMs * 1000 / r.frames)} µs/帧`);
  console.log('');
  return { g, p, b };
}

function main() {
  console.log('=== CyberMeow 主循环渲染性能基准（仅输出数字，无阈值断言） ===');
  console.log(`Node ${process.version} | ${process.platform}/${process.arch} | 帧数=${FRAMES}`);
  console.log(`视口=1920x1080, DPR=2, 预热=${WARMUP} 帧, 场景=默认主场景`);
  console.log('');

  let mock, sandbox, app;
  try {
    ({ mock, sandbox, app } = createApp());
  } catch (err) {
    console.error('基准初始化失败：', err && err.stack ? err.stack : err);
    process.exit(1);
    return;
  }

  let high, low;
  try {
    high = runPass(app, sandbox, mock, 'high', FRAMES);
    low = runPass(app, sandbox, mock, 'low', FRAMES);
  } catch (err) {
    console.error('基准运行失败：', err && err.stack ? err.stack : err);
    process.exit(1);
    return;
  }

  const hs = printPass(high);
  const ls = printPass(low);

  console.log('=== 画质对比摘要 ===');
  const drop = hs.g.avg > 0 ? (1 - ls.g.avg / hs.g.avg) * 100 : 0;
  console.log(`每帧渐变创建数均值: high=${fmt(hs.g.avg)}, low=${fmt(ls.g.avg)}, 降幅=${fmt(drop)}%`);
  console.log(`每帧路径操作数均值: high=${fmt(hs.p.avg)}, low=${fmt(ls.p.avg)}`);
  console.log(`每帧 drawImage 均值: high=${fmt(hs.b.avg)}, low=${fmt(ls.b.avg)}`);
  console.log('注：以上均为实测数字，本基准不设帧耗时阈值、不做通过/失败断言。');
}

main();
