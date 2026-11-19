'use strict';
/**
 * ECS / SoA 与 OOP 的公平微基准（纯 Node.js，零第三方依赖）
 *
 * 运行：
 *   node experiments/bench.js
 * 推荐（每轮测量前主动 GC，数字更稳）：
 *   node --expose-gc experiments/bench.js
 *
 * 基准内容（每个实体每帧都做，两个实现做完全相同的数学运算）：
 *   System 1 integrate: 按 state 取阻尼 -> 更新速度 -> 更新位置 -> 边界环绕。O(n)
 *   System 2 rangeQuery: 对每个实体统计半径 R 内的邻居数量。O(n^2)
 *
 * 公平性措施：
 *   - 同一规模下，OOP 与 SoA 使用同一份固定种子的初始数据；
 *   - 完全相同的帧数、相同的运算顺序与分支；
 *   - 构造对象/TypedArray 的开销不计入测量（只测稳态逐帧成本），每次测量重建初始状态；
 *   - 预热后取多次运行的中位数；可选 --expose-gc 降低 GC 噪声；
 *   - 用 checksum 汇总结果，防止 JIT 把计算优化掉。
 *
 * 注意：SoA-f32 用 Float32Array 存位置（典型 ECS 做法），与 OOP 的 JS number(f64)
 *       存在末位精度差异，因此两者的 checksum 不要求逐位相同；SoA-f64 用
 *       Float64Array，用于证明「若 SoA 有优势，它来自数据布局而非数值精度」。
 */

const { performance } = require('node:perf_hooks');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// ------------------------- 可调参数 -------------------------
const SIZES = [40, 80, 200, 240, 360, 500, 1000, 2000];
// 各规模的帧数：大规模降低帧数以避免单轮跑太久；同一规模内各实现帧数完全相同。
const FRAMES = {
  40: 2000,
  80: 2000,
  240: 1000,
  360: 1000,
  200: 1000,
  500: 300,
  1000: 120,
  2000: 30,
};
const REPEATS = 7;
const WARMUP = 2;
const R = 40;
const R2 = R * R;
const W = 1280;
const H = 720;
const DRAG = new Float64Array([0.92, 0.97, 0.985, 0.90, 0.95]);
const ACCEL = 0.015;

// ------------------------- 工具函数 -------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeData(n) {
  const rnd = mulberry32((0xC0FFEE ^ n) >>> 0);
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const vx = new Float64Array(n);
  const vy = new Float64Array(n);
  const state = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = rnd() * W;
    y[i] = rnd() * H;
    vx[i] = (rnd() - 0.5) * 4;
    vy[i] = (rnd() - 0.5) * 4;
    state[i] = (rnd() * DRAG.length) | 0;
  }
  return { x, y, vx, vy, state };
}

function ns2ms(ns) {
  return Number(ns) / 1e6;
}

// ------------------------- 实现 A：OOP 基线 -------------------------
class Entity {
  constructor(x, y, vx, vy, state) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.state = state;
  }

  update() {
    const d = DRAG[this.state];
    const nvx = this.vx * d + ACCEL;
    const nvy = this.vy * d - ACCEL * 0.5;
    let nx = this.x + nvx;
    let ny = this.y + nvy;
    if (nx < 0) nx += W;
    else if (nx >= W) nx -= W;
    if (ny < 0) ny += H;
    else if (ny >= H) ny -= H;
    this.vx = nvx;
    this.vy = nvy;
    this.x = nx;
    this.y = ny;
  }

  countNeighbors(all) {
    let c = 0;
    const xi = this.x;
    const yi = this.y;
    for (let j = 0; j < all.length; j++) {
      const o = all[j];
      const dx = o.x - xi;
      if (dx > R || dx < -R) continue;
      const dy = o.y - yi;
      if (dy > R || dy < -R) continue;
      if (dx * dx + dy * dy <= R2) c++;
    }
    return c;
  }
}

function buildOOP(d) {
  const n = d.x.length;
  const a = new Array(n);
  for (let i = 0; i < n; i++) {
    a[i] = new Entity(d.x[i], d.y[i], d.vx[i], d.vy[i], d.state[i]);
  }
  return a;
}

function runOOP(entities, frames) {
  const n = entities.length;
  let checksum = 0;
  const t0 = process.hrtime.bigint();
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < n; i++) entities[i].update();
  }
  const t1 = process.hrtime.bigint();
  for (let f = 0; f < frames; f++) {
    let querySum = 0;
    for (let i = 0; i < n; i++) querySum += entities[i].countNeighbors(entities);
    checksum = (checksum + querySum) | 0;
  }
  const t2 = process.hrtime.bigint();
  return {
    checksum,
    integrateMs: ns2ms(t1 - t0),
    queryMs: ns2ms(t2 - t1),
    totalMs: ns2ms(t2 - t0),
  };
}

// ------------------------- 实现 B/C：SoA + system 函数 -------------------------
function buildSoA(d, ArrayType) {
  const n = d.x.length;
  return {
    n,
    x: ArrayType.from(d.x),
    y: ArrayType.from(d.y),
    vx: ArrayType.from(d.vx),
    vy: ArrayType.from(d.vy),
    state: d.state, // 只读共享，两个实现拿到的初始 state 完全一致
  };
}

function runSoA(a, frames) {
  const n = a.n;
  const x = a.x;
  const y = a.y;
  const vx = a.vx;
  const vy = a.vy;
  const state = a.state;
  let checksum = 0;

  const t0 = process.hrtime.bigint();
  // System 1: integrate（连续内存顺序写）
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < n; i++) {
      const d = DRAG[state[i]];
      const nvx = vx[i] * d + ACCEL;
      const nvy = vy[i] * d - ACCEL * 0.5;
      let nx = x[i] + nvx;
      let ny = y[i] + nvy;
      if (nx < 0) nx += W;
      else if (nx >= W) nx -= W;
      if (ny < 0) ny += H;
      else if (ny >= H) ny -= H;
      vx[i] = nvx;
      vy[i] = nvy;
      x[i] = nx;
      y[i] = ny;
    }
  }
  const t1 = process.hrtime.bigint();

  // System 2: rangeQuery（紧凑的 TypedArray 双层循环）
  for (let f = 0; f < frames; f++) {
    let querySum = 0;
    for (let i = 0; i < n; i++) {
      const xi = x[i];
      const yi = y[i];
      let c = 0;
      for (let j = 0; j < n; j++) {
        const dx = x[j] - xi;
        if (dx > R || dx < -R) continue;
        const dy = y[j] - yi;
        if (dy > R || dy < -R) continue;
        if (dx * dx + dy * dy <= R2) c++;
      }
      querySum += c;
    }
    checksum = (checksum + querySum) | 0;
  }
  const t2 = process.hrtime.bigint();

  return {
    checksum,
    integrateMs: ns2ms(t1 - t0),
    queryMs: ns2ms(t2 - t1),
    totalMs: ns2ms(t2 - t0),
  };
}

// ------------------------- 测量框架 -------------------------
const ARMS = [
  { key: 'oop', label: 'OOP   ', build: (d) => buildOOP(d), run: runOOP },
  { key: 'soa64', label: 'SoA64 ', build: (d) => buildSoA(d, Float64Array), run: runSoA },
  { key: 'soa32', label: 'SoA32 ', build: (d) => buildSoA(d, Float32Array), run: runSoA },
];

const median = (arr) => {
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/**
 * 关键：三个实现在同一轮内交错测量，并逐轮轮换顺序，
 * 避免「某实现的所有重复都排在最后」而系统性吃到热漂移/负载噪声。
 */
function measureAll(data, frames) {
  for (const arm of ARMS) {
    for (let i = 0; i < WARMUP; i++) arm.run(arm.build(data), frames);
  }

  const samples = {};
  const checksums = {};
  for (const arm of ARMS) {
    samples[arm.key] = { totalMs: [], integrateMs: [], queryMs: [] };
  }

  for (let r = 0; r < REPEATS; r++) {
    const offset = r % ARMS.length;
    const order = ARMS.slice(offset).concat(ARMS.slice(0, offset));
    for (const arm of order) {
      if (typeof global.gc === 'function') global.gc();
      const obj = arm.build(data);
      const res = arm.run(obj, frames);
      checksums[arm.key] = res.checksum;
      for (const k of Object.keys(samples[arm.key])) samples[arm.key][k].push(res[k]);
    }
  }

  const result = {};
  for (const arm of ARMS) {
    const s = samples[arm.key];
    result[arm.key] = {
      key: arm.key,
      checksum: checksums[arm.key],
      totalMs: median(s.totalMs),
      minTotalMs: Math.min(...s.totalMs),
      maxTotalMs: Math.max(...s.totalMs),
      integrateMs: median(s.integrateMs),
      queryMs: median(s.queryMs),
    };
  }
  return result;
}

function main() {
  const env = {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpu: os.cpus() && os.cpus().length ? os.cpus()[0].model : 'unknown',
    gcEnabled: typeof global.gc === 'function',
    params: { REPEATS, WARMUP, R, W, H, FRAMES },
  };
  console.log('=== ECS/SoA vs OOP micro-benchmark ===');
  console.log(`Node ${env.node} | ${env.platform}/${env.arch} | ${env.cpu}`);
  console.log(`REPEATS=${REPEATS}, WARMUP=${WARMUP}, radius=${R}, world=${W}x${H}, gc=${env.gcEnabled}`);
  console.log('');

  const header =
    'size'.padStart(6) + ' frames'.padStart(8) +
    ' OOP(ms)'.padStart(11) + ' SoA64(ms)'.padStart(12) + ' SoA32(ms)'.padStart(12) +
    ' spd64'.padStart(9) + ' spd32'.padStart(9) +
    ' OOPµs/f'.padStart(11) + ' S32µs/f'.padStart(11);
  console.log(header);
  console.log('-'.repeat(header.length));

  const rows = [];
  for (const n of SIZES) {
    const frames = FRAMES[n];
    const data = makeData(n);
    const res = measureAll(data, frames);
    const spd64 = res.oop.totalMs / res.soa64.totalMs;
    const spd32 = res.oop.totalMs / res.soa32.totalMs;
    const oopUs = (res.oop.totalMs * 1000) / frames;
    const s32Us = (res.soa32.totalMs * 1000) / frames;
    rows.push({ n, frames, ...res, spd64, spd32, oopUs, s32Us });

    console.log(
      String(n).padStart(6) + String(frames).padStart(8) +
      res.oop.totalMs.toFixed(3).padStart(11) +
      res.soa64.totalMs.toFixed(3).padStart(12) +
      res.soa32.totalMs.toFixed(3).padStart(12) +
      (spd64.toFixed(2) + 'x').padStart(9) +
      (spd32.toFixed(2) + 'x').padStart(9) +
      oopUs.toFixed(1).padStart(11) +
      s32Us.toFixed(1).padStart(11)
    );
  }

  console.log('');
  console.log('分项中位数（ms，积分 / 范围查询）：');
  for (const r of rows) {
    console.log(
      `  n=${String(r.n).padStart(4)}  ` +
      `OOP ${r.oop.integrateMs.toFixed(3)}/${r.oop.queryMs.toFixed(3)}  ` +
      `SoA64 ${r.soa64.integrateMs.toFixed(3)}/${r.soa64.queryMs.toFixed(3)}  ` +
      `SoA32 ${r.soa32.integrateMs.toFixed(3)}/${r.soa32.queryMs.toFixed(3)}`
    );
  }

  console.log('');
  console.log('测量波动（同一规模下 min/median/max，ms）——用于判断倍率差是否落在噪声里：');
  for (const r of rows) {
    const f = (x) => `${x.minTotalMs.toFixed(1)}/${x.totalMs.toFixed(1)}/${x.maxTotalMs.toFixed(1)}`;
    console.log(`  n=${String(r.n).padStart(4)}  OOP ${f(r.oop)}  SoA32 ${f(r.soa32)}`);
  }

  const out = { env, rows };
  const outPath = path.join(__dirname, 'results.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log('');
  console.log(`原始数字已写入 ${outPath}`);
}

main();
