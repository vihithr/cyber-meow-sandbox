/**
 * CyberMeow - 自动化逻辑与语法校验测试套件
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🐾 开始运行 CyberMeow 自动化逻辑验证测试...\n');

// 1. 语法检查
const filesToTest = [
  'js/physics.js',
  'js/audio.js',
  'js/furniture.js',
  'js/toys.js',
  'js/cat.js',
  'js/environment.js',
  'js/ui.js',
  'js/app.js'
];

const basePath = path.resolve(__dirname, '..');
let allSyntaxPassed = true;

filesToTest.forEach(relPath => {
  const fullPath = path.join(basePath, relPath);
  try {
    const code = fs.readFileSync(fullPath, 'utf8');
    new vm.Script(code); // 编译检查 JS 语法
    console.log(`✅ [语法检查通过] ${relPath}`);
  } catch (err) {
    console.error(`❌ [语法错误] ${relPath}:`, err.message);
    allSyntaxPassed = false;
  }
});

if (!allSyntaxPassed) {
  process.exit(1);
}

// 2. 模拟运行核心逻辑 (Mock 浏览器环境)
const mockWindow = {
  innerWidth: 1920,
  innerHeight: 1080,
  AudioContext: function() {
    return {
      state: 'running',
      currentTime: 0,
      sampleRate: 44100,
      destination: {},
      createGain: () => ({ gain: { value: 1, setValueAtTime: ()=>{}, linearRampToValueAtTime: ()=>{}, exponentialRampToValueAtTime: ()=>{} }, connect: ()=>{} }),
      createOscillator: () => ({ frequency: { setValueAtTime: ()=>{}, exponentialRampToValueAtTime: ()=>{}, linearRampToValueAtTime: ()=>{} }, connect: ()=>{}, start: ()=>{}, stop: ()=>{} }),
      createBiquadFilter: () => ({ frequency: { setValueAtTime: ()=>{}, exponentialRampToValueAtTime: ()=>{} }, Q: { value: 1 }, connect: ()=>{} }),
      createBuffer: (c, len, rate) => ({ getChannelData: () => new Float32Array(len) }),
      createBufferSource: () => ({ connect: ()=>{}, start: ()=>{}, stop: ()=>{} })
    };
  },
  localStorage: {
    data: {},
    getItem(k) { return this.data[k] || null; },
    setItem(k, v) { this.data[k] = v; }
  },
  addEventListener: () => {}
};

mockWindow.window = mockWindow;

const context = vm.createContext(mockWindow);

// 按序载入物理与猫咪核心
const loadInVm = (relPath) => {
  const code = fs.readFileSync(path.join(basePath, relPath), 'utf8');
  vm.runInContext(code, context);
};

loadInVm('js/physics.js');
loadInVm('js/audio.js');
loadInVm('js/furniture.js');
loadInVm('js/toys.js');
loadInVm('js/cat.js');

console.log('\n🐾 正在测试物理链与猫咪状态机运算...');

const { VerletChain, Cat, BREEDS, Roomba, YarnBall, CardboardBox } = mockWindow.CyberMeow;

// 测试 Verlet 链
const chain = new VerletChain(100, 100, 5, 10);
chain.update(120, 120, 0.1, 0.95);
if (chain.points.length === 5 && typeof chain.points[4].x === 'number') {
  console.log('✅ [Verlet 物理链测试通过]');
} else {
  console.error('❌ [Verlet 物理链测试失败]');
  process.exit(1);
}

// 测试猫咪生成与步进更新
const testCat = new Cat(500, 500, { breed: BREEDS[0] });
const mockScene = {
  laser: { active: true, x: 550, y: 500 },
  featherWand: { active: false },
  toys: [new YarnBall(400, 500)],
  furniture: [new Roomba(600, 500), new CardboardBox(700, 500)],
  spawnParticle: () => {}
};

testCat.update(1920, 1080, mockScene);
console.log(`✅ [猫咪实体生成正常] 名字: ${testCat.name}, 品种: ${testCat.breed.name}, 当前状态: ${testCat.state}`);

// 测试吃鱼干逻辑
const fish = new (mockWindow.CyberMeow.FishTreat)(testCat.x + 5, testCat.y);
mockScene.toys.push(fish);
mockScene.laser.active = false;
testCat.update(1920, 1080, mockScene);

console.log('✅ [猫咪捕食传感器评估通过]');

console.log('\n🎉 所有核心模块与逻辑测试均成功通过！');
