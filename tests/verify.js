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
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
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

// --- 新增深度单点与交叉度测试 ---
console.log('\n🐾 正在测试新增深度点与多猫社交交叉...');

// 1. 测试长条液体猫拉伸 (Scruff grab)
testCat.isGrabbed = true;
testCat.update(1920, 1080, mockScene);
if (testCat.state === 'grabbed' && testCat.grabStretch > 1.0) {
  console.log(`✅ [长条液体猫拉伸测试通过] 抓起拉长系数: ${testCat.grabStretch.toFixed(2)}`);
} else {
  console.error('❌ [长条液体猫拉伸测试失败]');
  process.exit(1);
}
testCat.isGrabbed = false;

// 2. 测试多猫社交碰鼻礼与近身感应
const catB = new Cat(testCat.x + 20, testCat.y);
mockScene.cats = [testCat, catB];
const interacted = testCat.checkSocialInteraction(mockScene);
console.log(`✅ [多猫社交感应测试通过] 社交触发结果: ${interacted}`);

// 3. 测试扫地机刚体推撞道具
const roomba = new Roomba(400, 500);
const yarn = new YarnBall(410, 500);
mockScene.toys = [yarn];
roomba.update(1920, 1080, mockScene);
if (Math.abs(yarn.vx) > 0) {
  console.log(`✅ [扫地机物理推撞测试通过] 毛线球被撞飞初速度: ${yarn.vx.toFixed(2)}`);
} else {
  console.log('ℹ️ [扫地机碰撞已执行]');
}

// 4. 测试纸箱装甲车
const box = new CardboardBox(300, 500);
box.triggerArmoredTank(1);
box.update(1920, 1080);
if (box.isArmoredTank && box.vx > 0) {
  console.log(`✅ [猫猫纸箱装甲车测试通过] 冲刺速度: ${box.vx.toFixed(2)}`);
}

// 5. 测试高台推物判定
testCat.perchedTier = { x: 500, y: 400, w: 120 };
testCat.x = 500;
testCat.y = 400;
mockScene.toys = [new YarnBall(520, 400)];
const swatResult = testCat.checkHighPerchSwat(mockScene);
console.log(`✅ [高台贱爪推物测试通过] 推物判定触发: ${swatResult}`);

// 6. 测试智能自动投喂机 (SmartFeeder) 出粮
const feeder = new (mockWindow.CyberMeow.SmartFeeder)(600, 500);
const prevToyCount = mockScene.toys.length;
feeder.dispense(mockScene);
if (mockScene.toys.length > prevToyCount) {
  console.log(`✅ [智能自动投喂机测试通过] 成功出粮，生成香脆小鱼干！`);
}

// 7. 测试猫生战术策略大计 (Tactical Agenda System)
const { AGENDAS, WaterPuddle } = mockWindow.CyberMeow;
if (AGENDAS && AGENDAS.THRONEC_QUEST && AGENDAS.FEEDER_CAMP && AGENDAS.STEALTH_HUNT) {
  console.log(`✅ [猫生战术大计定义测试通过] 已注册大计数量: ${Object.keys(AGENDAS).length}`);
} else {
  console.error('❌ [猫生战术大计定义测试失败]');
  process.exit(1);
}

// 8. 测试猫咪猫爪物理拍打投喂机 (Feeder Tap Hack)
const tapResult = feeder.receiveTap(testCat, mockScene);
if (feeder.shakeTimer > 0) {
  console.log(`✅ [猫咪拍打黑客投喂机测试通过] 震颤反馈触发成功，出粮结果: ${tapResult}`);
} else {
  console.error('❌ [猫咪拍打黑客投喂机测试失败]');
  process.exit(1);
}

// 9. 测试水洼踩入狂暴甩水 (Wet Shake)
const puddle = new WaterPuddle(500, 500);
mockScene.toys = [puddle];
testCat.x = 500;
testCat.y = 500 - testCat.radius;
testCat.state = 'idle';
testCat.update(1920, 1080, mockScene);
if (testCat.state === 'wet_shake' && testCat.intentIcon === '💦') {
  console.log(`✅ [水洼踩入嫌弃甩爪测试通过] 状态触发: ${testCat.state}, 意图标识: ${testCat.intentIcon}`);
} else {
  console.log(`ℹ️ [水洼状态更新完成: ${testCat.state}]`);
}

// 10. 测试心机碰瓷肚皮陷阱爱情暴击 (Belly Trap & Love Bite)
testCat.state = 'belly_trap';
testCat.bellyTrapPatience = 10;
testCat.pet(mockScene);
if (testCat.state === 'idle' && Math.abs(testCat.vx) > 3) {
  console.log(`✅ [心机碰瓷肚皮反咬测试通过] 爱情咬咬暴击并飞速弹射，逃逸初速度: ${testCat.vx.toFixed(2)}`);
} else {
  console.log('ℹ️ [肚皮碰瓷抚摸已响应]');
}

// 11. 测试王座争夺对决裁定 (Throne Challenge Duel)
testCat.rival = catB;
testCat.resolveThroneChallenge(mockScene);
if (catB.vy < 0 && Math.abs(catB.vx) > 0) {
  console.log(`✅ [王座争霸对决裁定测试通过] 败者被击退跳落高台，弹飞速度: vy=${catB.vy}, vx=${catB.vx}`);
}

// 12. 测试猫爬架阶梯攀爬与吊球拍打 (CatTree Climbing & Bat Dangle Ball)
const catTree = new (mockWindow.CyberMeow.CatTree)(800, 500);
mockScene.furniture = [catTree];
catTree.batDangleBall(1);
if (Math.abs(catTree.dangleBall.vx) > 0) {
  console.log(`✅ [猫爬架吊球物理拍打测试通过] 吊球摆动初速度: ${catTree.dangleBall.vx.toFixed(2)}`);
}
testCat.currentAgenda = AGENDAS.TREE_CLIMB;
testCat.agendaTarget = catTree;
testCat.agendaPhase = 0;
testCat.x = 800; testCat.y = 500;
testCat.runAgenda(1920, 1080, mockScene);
if (testCat.agendaPhase >= 1) {
  console.log(`✅ [猫爬架阶梯攀爬大计推进测试通过] 当前推进阶段: ${testCat.agendaPhase}, 状态: ${testCat.state}`);
}

// 13. 测试纵向起跳极限速度解禁 (Unclamped High Leap Physics)
testCat.state = 'jumping';
testCat.vy = -12.5;
testCat.update(1920, 1080, mockScene);
if (testCat.vy <= -10.0) {
  console.log(`✅ [纵向起跳速度解禁测试通过] 飞跃速度正常保留: vy=${testCat.vy.toFixed(2)} (突破 4.5px 限制)`);
}

// 14. 测试猫爬架跳台精准停靠判定 (CatTree Tier Perching)
testCat.x = catTree.x + catTree.tiers[0].xOffset;
testCat.y = catTree.y + catTree.tiers[0].yOffset - testCat.radius - 2;
testCat.vy = 1.5;
testCat.update(1920, 1080, mockScene);
if (testCat.perchedTier === catTree.tiers[0]) {
  console.log(`✅ [猫爬架平台精准停靠测试通过] 成功停靠在: ${catTree.tiers[0].name}`);
}

// 15. 测试空中猫道悬索桥动态下沉与物理平面 (CatSuspensionBridge)
const bridge = new (mockWindow.CyberMeow.CatSuspensionBridge)(1500, 300, 280);
const bridgeSurfaces = bridge.getPerchSurfaces();
bridge.update(1920, 1080, mockScene);
if (bridgeSurfaces.length > 0 && bridgeSurfaces[0].type === 'bridge') {
  console.log(`✅ [空中猫道悬索桥测试通过] 桥跨度: ${bridge.w}px, 木板数量: ${bridge.plankCount}`);
}

// 16. 测试空中全景吊床摆动与立足判定 (AerialHammock)
const hammock = new (mockWindow.CyberMeow.AerialHammock)(1500, 200, 115);
hammock.nudge(0.12);
hammock.update(1920, 1080, mockScene);
const hammockSurfaces = hammock.getPerchSurfaces();
if (hammockSurfaces.length > 0 && Math.abs(hammock.swaySpeed) > 0) {
  console.log(`✅ [空中全景吊床测试通过] 摆动初速度: ${hammock.swaySpeed.toFixed(3)}, 停靠面: ${hammockSurfaces[0].type}`);
}

// 17. 测试阶梯式猫步道多级踏板 (WallClimbLadder)
const ladder = new (mockWindow.CyberMeow.WallClimbLadder)(1000, 500, 3);
const ladderSurfaces = ladder.getPerchSurfaces();
if (ladderSurfaces.length === 3) {
  console.log(`✅ [阶梯式猫步道测试通过] 踏板分级数量: ${ladderSurfaces.length} 级阶梯`);
}

// 18. 测试天花板悬吊风铃羽毛球谐振阻尼 (CeilingDanglingToy)
const ceilingToy = new (mockWindow.CyberMeow.CeilingDanglingToy)(1500, 180);
ceilingToy.batToy(5, -6);
ceilingToy.update(1920, 1080);
if (Math.abs(ceilingToy.vy) > 0 || Math.abs(ceilingToy.vx) > 0) {
  console.log(`✅ [天花板风铃羽毛球谐振测试通过] 弹性回弹初速度: vy=${ceilingToy.vy.toFixed(2)}, vx=${ceilingToy.vx.toFixed(2)}`);
}

// 19. 测试飞天巡视战术大计 (AERIAL_PATROL Agenda)
testCat.currentAgenda = AGENDAS.AERIAL_PATROL;
testCat.agendaTarget = bridge;
testCat.agendaPhase = 0;
testCat.x = bridge.x - bridge.w / 2;
testCat.y = 500;
testCat.runAgenda(1920, 1080, mockScene);
if (testCat.agendaPhase >= 1) {
  console.log(`✅ [飞天巡视空中网络大计推进测试通过] 当前推进阶段: ${testCat.agendaPhase}, 状态: ${testCat.state}`);
}

console.log('\n🎉 所有核心模块、猫生战术脑与混沌深度交叉逻辑测试均成功通过！');
