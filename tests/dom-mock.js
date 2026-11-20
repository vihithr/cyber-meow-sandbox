/**
 * CyberMeow - 浏览器环境最小 mock（仅供 Node VM 测试使用）
 *
 * 设计目标：
 * 1. environment.js / ui.js / app.js 需要 document、canvas 2D、RAF、localStorage 等浏览器 API，
 *    这里提供刚好够用的实现，让它们能在 VM 里被真实执行（而非仅语法检查）。
 * 2. requestAnimationFrame 只把回调放进队列、绝不自动执行，
 *    因此 app.init() 启动的主循环不会跑飞；测试用 runOneFrame() 手动推进单帧。
 * 3. 所有副作用都可通过 counters / rafQueue / 元素状态观察，便于统计型断言。
 */
'use strict';

const noop = () => {};

// 标准 CanvasRenderingContext2D 方法：统一兜底为空函数，
// 这样队友后续新增绘制调用时不会把测试打挂。
const CANVAS_METHODS = [
  'save', 'restore', 'scale', 'rotate', 'translate', 'transform', 'setTransform', 'resetTransform',
  'clearRect', 'fillRect', 'strokeRect', 'beginPath', 'closePath', 'moveTo', 'lineTo',
  'bezierCurveTo', 'quadraticCurveTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect',
  'fill', 'stroke', 'clip', 'drawImage', 'fillText', 'strokeText', 'putImageData',
  'isPointInPath', 'isPointInStroke', 'scrollPathIntoView', 'drawFocusIfNeeded'
];

// 这些是属性而不是方法：未赋值时应返回 undefined，不能被方法兜底误伤。
const CANVAS_PROPERTIES = new Set([
  'canvas', 'fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'lineJoin', 'miterLimit',
  'font', 'textAlign', 'textBaseline', 'direction', 'globalAlpha', 'globalCompositeOperation',
  'shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'filter',
  'imageSmoothingEnabled', 'imageSmoothingQuality', 'lineDashOffset'
]);

// 路径/位图操作：供 tests/bench.js 统计每帧渲染开销（不参与断言，仅计数）。
const PATH_OP_METHODS = new Set([
  'beginPath', 'closePath', 'moveTo', 'lineTo', 'bezierCurveTo',
  'quadraticCurveTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect',
  'fill', 'stroke', 'clip'
]);

function create2DContext(canvas, counters) {
  // 真实追踪 2D 变换矩阵，使 getTransform 可用于验证镜像/旋转下的文字朝向。
  // 矩阵按 CSS transform 约定存为 {a,b,c,d,e,f}。
  let m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const stack = [];
  const mul = (n) => {
    const a = m.a * n.a + m.c * n.b;
    const b = m.b * n.a + m.d * n.b;
    const c = m.a * n.c + m.c * n.d;
    const d = m.b * n.c + m.d * n.d;
    const e = m.a * n.e + m.c * n.f + m.e;
    const f = m.b * n.e + m.d * n.f + m.f;
    m = { a, b, c, d, e, f };
  };
  const target = {
    canvas,
    getTransform() { return { ...m }; },
    setTransform(a, b, c, d, e, f) { m = { a, b, c, d, e, f }; },
    resetTransform() { m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; },
    translate(x, y) { mul({ a: 1, b: 0, c: 0, d: 1, e: x, f: y }); },
    scale(x, y) { mul({ a: x, b: 0, c: 0, d: y, e: 0, f: 0 }); },
    rotate(r) {
      const cos = Math.cos(r), sin = Math.sin(r);
      mul({ a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 });
    },
    save() { stack.push({ ...m }); },
    restore() { if (stack.length) m = stack.pop(); },
    createLinearGradient() {
      counters.linearGradients++;
      return { addColorStop: noop };
    },
    createRadialGradient() {
      counters.radialGradients++;
      return { addColorStop: noop };
    },
    createConicGradient() {
      counters.conicGradients++;
      return { addColorStop: noop };
    },
    createPattern() {
      return { setTransform: noop };
    },
    measureText(text) {
      return { width: String(text == null ? '' : text).length * 8 };
    },
    createImageData(w, h) {
      return { width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) };
    },
    getImageData(x, y, w, h) {
      return { width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) };
    },
    getLineDash() {
      return [];
    },
    setLineDash: noop
  };

  CANVAS_METHODS.forEach(name => {
    if (name in target) return;
    if (name === 'drawImage') {
      target[name] = function () { counters.drawImages++; };
    } else if (PATH_OP_METHODS.has(name)) {
      target[name] = function () { counters.pathOps++; };
    } else {
      target[name] = noop;
    }
  });

  return new Proxy(target, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (typeof prop === 'symbol') return undefined;
      if (CANVAS_PROPERTIES.has(prop)) return undefined;
      // 未知的小驼峰名字按方法处理（覆盖未来新增的自定义绘制助手）
      if (/^[a-z][A-Za-z0-9]*$/.test(prop)) {
        t[prop] = noop;
        return noop;
      }
      return undefined;
    },
    set(t, prop, value) {
      t[prop] = value;
      return true;
    }
  });
}

function createClassList() {
  const set = new Set();
  return {
    add(...names) { names.forEach(n => set.add(n)); },
    remove(...names) { names.forEach(n => set.delete(n)); },
    contains(name) { return set.has(name); },
    toggle(name, force) {
      if (force === undefined) force = !set.has(name);
      if (force) set.add(name); else set.delete(name);
      return force;
    },
    get length() { return set.size; }
  };
}

function createElement(tag, counters) {
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    style: {},
    dataset: {},
    classList: createClassList(),
    children: [],
    listeners: {},
    innerText: '',
    innerHTML: '',
    value: '',
    checked: false,
    width: 300,
    height: 150,
    onclick: null,
    onchange: null,
    _ctx: null,

    getContext(type) {
      if (type !== '2d') return null;
      if (!this._ctx) this._ctx = create2DContext(this, counters);
      return this._ctx;
    },
    addEventListener(type, fn) {
      (this.listeners[type] || (this.listeners[type] = [])).push(fn);
    },
    removeEventListener(type, fn) {
      const list = this.listeners[type] || [];
      const idx = list.indexOf(fn);
      if (idx >= 0) list.splice(idx, 1);
    },
    dispatch(type, event) {
      (this.listeners[type] || []).slice().forEach(fn => fn(event || {}));
    },
    getBoundingClientRect() {
      const left = this._left || 0;
      const top = this._top || 0;
      return {
        left, top,
        width: this.width,
        height: this.height,
        right: left + this.width,
        bottom: top + this.height
      };
    },
    setPointerCapture: noop,
    releasePointerCapture: noop,
    focus: noop,
    blur: noop,
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx >= 0) this.children.splice(idx, 1);
      return child;
    },
    click() {
      if (typeof this.onclick === 'function') this.onclick({ target: this });
    },
    toDataURL() {
      counters.toDataURL++;
      return 'data:image/png;base64,MOCK';
    }
  };

  // 真实 DOM 的 innerText / innerHTML / value 赋值会自动转成字符串，mock 保持一致
  ['innerText', 'innerHTML', 'value'].forEach(prop => {
    let backing = '';
    Object.defineProperty(el, prop, {
      get() { return backing; },
      set(v) { backing = v == null ? '' : String(v); },
      enumerable: true,
      configurable: true
    });
  });

  return el;
}

function makeButton(dataset, counters) {
  const btn = createElement('button', counters);
  Object.assign(btn.dataset, dataset || {});
  return btn;
}

function createDocument(counters) {
  const elements = new Map();
  const doc = {
    _elements: elements,
    addEventListener: noop,
    removeEventListener: noop,

    getElementById(id) {
      if (!elements.has(id)) {
        const el = createElement(id === 'playground' || /canvas/i.test(id) ? 'canvas' : 'div', counters);
        elements.set(id, el);
      }
      return elements.get(id);
    },

    createElement(tag) {
      return createElement(tag, counters);
    },

    querySelectorAll(selector) {
      const s = String(selector);
      if (s.indexOf('dock-item') !== -1) {
        const tools = ['pet', 'cat', 'laser', 'feather', 'fish', 'yarn', 'box', 'cattree', 'roomba', 'scratcher', 'catnip'];
        return tools.map(tool => makeButton({ tool }, counters));
      }
      if (s.indexOf('nav-zone-btn') !== -1) {
        return ['patio', 'living', 'playground'].map(zone => makeButton({ zone }, counters));
      }
      if (s.indexOf('studio-tool-btn') !== -1) {
        return ['brush', 'chin', 'churu'].map(tool => makeButton({ tool }, counters));
      }
      return [];
    },

    querySelector(selector) {
      const list = doc.querySelectorAll(selector);
      return list.length ? list[0] : null;
    }
  };
  return doc;
}

function createAudioContext() {
  const audioParam = () => ({
    value: 1,
    setValueAtTime: noop,
    linearRampToValueAtTime: noop,
    exponentialRampToValueAtTime: noop,
    cancelScheduledValues: noop
  });
  return {
    state: 'running',
    currentTime: 0,
    sampleRate: 44100,
    destination: {},
    resume: noop,
    createGain: () => ({ gain: audioParam(), connect: noop, disconnect: noop }),
    createOscillator: () => ({
      frequency: audioParam(),
      type: 'sine',
      connect: noop,
      disconnect: noop,
      start: noop,
      stop: noop
    }),
    createBiquadFilter: () => ({
      frequency: audioParam(),
      Q: audioParam(),
      connect: noop,
      disconnect: noop
    }),
    createBuffer: (c, len) => ({ getChannelData: () => new Float32Array(len) }),
    createBufferSource: () => ({
      buffer: null, loop: false, connect: noop, disconnect: noop, start: noop, stop: noop
    })
  };
}

/**
 * 构造完整浏览器 mock。
 * 返回的 rafQueue 只进不出；runOneFrame(targetFn) 由测试显式调用一次真实 loop。
 */
function createBrowserMock(options) {
  const opts = options || {};
  const counters = {
    linearGradients: 0,
    radialGradients: 0,
    conicGradients: 0,
    pathOps: 0,
    drawImages: 0,
    toDataURL: 0,
    rafRequests: 0,
    timers: 0
  };
  const rafQueue = [];
  const winListeners = {};
  const documentMock = createDocument(counters);

  const win = {
    innerWidth: opts.innerWidth || 1920,
    innerHeight: opts.innerHeight || 1080,
    devicePixelRatio: opts.devicePixelRatio === undefined ? 3 : opts.devicePixelRatio,
    document: documentMock,
    console: opts.console || console,
    setTimeout(fn) { counters.timers++; return ++counters.timers; },
    clearTimeout: noop,
    setInterval(fn) { counters.timers++; return ++counters.timers; },
    clearInterval: noop,
    requestAnimationFrame(fn) {
      counters.rafRequests++;
      rafQueue.push(fn);
      return rafQueue.length;
    },
    cancelAnimationFrame: noop,
    addEventListener(type, fn) {
      (winListeners[type] || (winListeners[type] = [])).push(fn);
    },
    removeEventListener(type, fn) {
      const list = winListeners[type] || [];
      const idx = list.indexOf(fn);
      if (idx >= 0) list.splice(idx, 1);
    },
    AudioContext: createAudioContext,
    webkitAudioContext: createAudioContext,
    localStorage: {
      data: Object.create(null),
      getItem(k) { return Object.prototype.hasOwnProperty.call(this.data, k) ? this.data[k] : null; },
      setItem(k, v) { this.data[k] = String(v); },
      removeItem(k) { delete this.data[k]; },
      clear() { this.data = Object.create(null); }
    },
    performance: { now: () => Date.now() },
    navigator: { userAgent: 'CyberMeow-Node-Mock/1.0', platform: 'NodeVM', language: 'zh-CN' },
    Image: function MockImage() {
      this.onload = null;
      this.onerror = null;
      this.src = '';
      this.width = 0;
      this.height = 0;
    }
  };
  win.window = win;
  win.self = win;

  function fire(type, event) {
    (winListeners[type] || []).slice().forEach(fn => fn(event || {}));
  }

  return {
    window: win,
    document: documentMock,
    counters,
    rafQueue,
    winListeners,
    fire,
    noop
  };
}

module.exports = {
  createBrowserMock,
  create2DContext,
  createElement,
  noop
};
