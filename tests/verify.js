/**
 * CyberMeow - 自动化逻辑与语法校验测试套件
 *
 * 所有用例均使用 Node assert 做真实断言：失败会累计并使进程以退出码 1 结束。
 * 运行方式：node tests/verify.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const basePath = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✅ ${name}`);
  } catch (err) {
    failed++;
    console.error(`❌ ${name}\n   ${err && err.message ? err.message : err}`);
  }
}

console.log('🐾 开始运行 CyberMeow 自动化逻辑验证测试...\n');

// ---------------------------------------------------------------------------
// 1. 语法检查：全部 JS 文件必须能被 V8 编译
// ---------------------------------------------------------------------------
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

filesToTest.forEach(relPath => {
  test(`语法检查 ${relPath}`, () => {
    const code = fs.readFileSync(path.join(basePath, relPath), 'utf8');
    assert.doesNotThrow(() => new vm.Script(code), '存在语法错误');
  });
});

// ---------------------------------------------------------------------------
// 2. 模拟浏览器环境，按运行时顺序加载核心模块
// ---------------------------------------------------------------------------
const noop = () => {};
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
      resume: noop,
      createGain: () => ({
        gain: {
          value: 1,
          setValueAtTime: noop,
          linearRampToValueAtTime: noop,
          exponentialRampToValueAtTime: noop,
          cancelScheduledValues: noop
        },
        connect: noop,
        disconnect: noop
      }),
      createOscillator: () => ({
        frequency: { value: 440, setValueAtTime: noop, exponentialRampToValueAtTime: noop, linearRampToValueAtTime: noop, cancelScheduledValues: noop },
        connect: noop,
        disconnect: noop,
        start: noop,
        stop: noop
      }),
      createBiquadFilter: () => ({
        frequency: { value: 1000, setValueAtTime: noop, exponentialRampToValueAtTime: noop },
        Q: { value: 1 },
        connect: noop,
        disconnect: noop
      }),
      createBuffer: (c, len, rate) => ({ getChannelData: () => new Float32Array(len) }),
      createBufferSource: () => ({ connect: noop, disconnect: noop, start: noop, stop: noop })
    };
  },
  localStorage: {
    data: {},
    getItem(k) { return this.data[k] || null; },
    setItem(k, v) { this.data[k] = v; }
  },
  addEventListener: noop
};

mockWindow.window = mockWindow;
const context = vm.createContext(mockWindow);
const loadInVm = (relPath) => {
  vm.runInContext(fs.readFileSync(path.join(basePath, relPath), 'utf8'), context);
};

['js/physics.js', 'js/audio.js', 'js/furniture.js', 'js/toys.js', 'js/cat.js'].forEach(loadInVm);

const CyberMeow = mockWindow.CyberMeow;
const { VerletChain, Cat, BREEDS, Roomba, YarnBall, CardboardBox, AGENDAS, WaterPuddle } = CyberMeow;

// ---------------------------------------------------------------------------
// 3. 物理与状态机基础
// ---------------------------------------------------------------------------
console.log('\n🐾 正在测试物理链与猫咪状态机运算...');

test('Verlet 物理链积分与根节点锚定', () => {
  const chain = new VerletChain(100, 100, 5, 10);
  chain.update(120, 120, 0.1, 0.95);
  assert.strictEqual(chain.points.length, 5);
  assert.strictEqual(chain.points[0].x, 120);
  assert.strictEqual(chain.points[0].y, 120);
  chain.points.slice(1).forEach(p => {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), '物理链出现 NaN');
  });
});

const testCat = new Cat(500, 500, { breed: BREEDS[0] });
const mockScene = {
  laser: { active: true, x: 550, y: 500 },
  featherWand: { active: false },
  toys: [new YarnBall(400, 500)],
  furniture: [new Roomba(600, 500), new CardboardBox(700, 500)],
  cats: [],
  spawnParticle: noop
};

test('猫咪实体生成与首帧更新', () => {
  assert.doesNotThrow(() => testCat.update(1920, 1080, mockScene));
  assert.ok(testCat.name && testCat.breed, '缺少名字或品种');
  assert.strictEqual(typeof testCat.state, 'string');
  console.log(`     名字: ${testCat.name}, 品种: ${testCat.breed.name}, 状态: ${testCat.state}`);
});

test('捕食传感器优先锁定激光红点', () => {
  const target = testCat.evaluateSensors(mockScene);
  assert.ok(target && target.type === 'laser', `期望 laser，实际: ${target && target.type}`);
});

test('长条液体猫抓取拉伸', () => {
  testCat.isGrabbed = true;
  testCat.update(1920, 1080, mockScene);
  assert.strictEqual(testCat.state, 'grabbed');
  assert.ok(testCat.grabStretch > 1.0, `拉长系数未生效: ${testCat.grabStretch}`);
  console.log(`     拉长系数: ${testCat.grabStretch.toFixed(2)}`);
  testCat.isGrabbed = false;
});

// ---------------------------------------------------------------------------
// 4. 家具、道具与社交交叉
// ---------------------------------------------------------------------------
console.log('\n🐾 正在测试新增深度点与多猫社交交叉...');

test('多猫社交接口返回布尔且不抛异常', () => {
  const catB = new Cat(testCat.x + 20, testCat.y);
  mockScene.cats = [testCat, catB];
  let interacted;
  assert.doesNotThrow(() => { interacted = testCat.checkSocialInteraction(mockScene); });
  assert.strictEqual(typeof interacted, 'boolean');
  console.log(`     社交触发结果: ${interacted}`);
});

test('扫地机刚体推撞道具', () => {
  const roomba = new Roomba(400, 500);
  const yarn = new YarnBall(410, 500);
  yarn.x = roomba.x + 10;
  yarn.y = roomba.y;
  yarn.vx = 0;
  yarn.vy = 0;
  mockScene.toys = [yarn];
  roomba.update(1920, 1080, mockScene);
  assert.ok(yarn.vx > 3, `毛线球未被推开: vx=${yarn.vx}`);
  console.log(`     被撞飞初速度: ${yarn.vx.toFixed(2)}`);
});

test('猫猫纸箱装甲车冲刺状态', () => {
  const box = new CardboardBox(300, 500);
  box.triggerArmoredTank(1);
  box.update(1920, 1080);
  assert.strictEqual(box.isArmoredTank, true);
  assert.ok(box.vx > 0, `冲刺速度异常: ${box.vx}`);
  console.log(`     冲刺速度: ${box.vx.toFixed(2)}`);
});

test('高台贱爪推物判定', () => {
  testCat.perchedTier = { x: 500, y: 400, w: 120 };
  testCat.x = 500;
  testCat.y = 400;
  mockScene.toys = [new YarnBall(520, 400)];
  const result = testCat.checkHighPerchSwat(mockScene);
  assert.strictEqual(result, true, '推物判定未触发');
});

test('智能自动投喂机出粮', () => {
  const feeder = new CyberMeow.SmartFeeder(600, 500);
  const before = mockScene.toys.length;
  feeder.dispense(mockScene);
  assert.strictEqual(mockScene.toys.length, before + 1, '未生成小鱼干');
  assert.strictEqual(mockScene.toys[mockScene.toys.length - 1].type, 'fish');
});

test('猫生战术大计注册表完整', () => {
  assert.ok(AGENDAS && AGENDAS.THRONEC_QUEST && AGENDAS.FEEDER_CAMP && AGENDAS.STEALTH_HUNT);
  assert.strictEqual(Object.keys(AGENDAS).length, 10, '大计数量不是 10');
  console.log(`     已注册大计数量: ${Object.keys(AGENDAS).length}`);
});

test('猫咪拍打黑客投喂机', () => {
  const feeder = new CyberMeow.SmartFeeder(600, 500);
  feeder.receiveTap(testCat, mockScene);
  assert.ok(feeder.shakeTimer > 0, '未触发震颤反馈');
});

test('水洼生命周期与过期回收接口', () => {
  const puddle = new WaterPuddle(500, 500);
  assert.strictEqual(puddle.isExpired(), false);
  puddle.update(1920, 1080, mockScene);
  assert.strictEqual(puddle.life, 599, '生命值未按帧递减');
  puddle.life = 0;
  assert.strictEqual(puddle.isExpired(), true, '过期判定失效');
  assert.strictEqual(puddle.contains(500, 500), false, '过期水洼仍可被踩中');
});

test('心机碰瓷肚皮陷阱爱情暴击', () => {
  const cat = new Cat(500, 500, { breed: BREEDS[0] });
  cat.state = 'belly_trap';
  cat.bellyTrapPatience = 10;
  cat.pet(mockScene);
  assert.strictEqual(cat.state, 'idle', '未进入弹射逃逸状态');
  assert.ok(Math.abs(cat.vx) > 3, `逃逸初速度异常: ${cat.vx}`);
  console.log(`     逃逸初速度: ${cat.vx.toFixed(2)}`);
});

test('王座对决结算与双方引用清理', () => {
  const challenger = new Cat(500, 500, { breed: BREEDS[0] });
  const defender = new Cat(520, 500, { breed: BREEDS[1] });
  challenger.rival = defender;
  defender.rival = challenger;
  challenger.resolveThroneChallenge(mockScene);
  assert.ok(defender.vy < 0 && Math.abs(defender.vx) > 0, '败者未被击落');
  assert.strictEqual(defender.rival, null, '败者对手引用未清理');
  assert.strictEqual(challenger.rival, null, '胜者对手引用未清理');
  console.log(`     败者弹飞: vy=${defender.vy}, vx=${defender.vx}`);
});

test('缺少对手引用的对决状态可兜底退出', () => {
  const lonely = new Cat(500, 500, { breed: BREEDS[0] });
  lonely.state = 'throne_challenge';
  lonely.rival = null;
  lonely.resolveThroneChallenge(mockScene);
  assert.strictEqual(lonely.state, 'idle', '对决状态永久卡死');
});

let sharedCatTree;
test('猫爬架吊球物理拍打', () => {
  const catTree = new CyberMeow.CatTree(800, 500);
  sharedCatTree = catTree;
  mockScene.furniture = [catTree];
  catTree.batDangleBall(1);
  assert.ok(Math.abs(catTree.dangleBall.vx) > 0, '吊球未被拨动');
  console.log(`     吊球摆动初速度: ${catTree.dangleBall.vx.toFixed(2)}`);

  testCat.currentAgenda = AGENDAS.TREE_CLIMB;
  testCat.agendaTarget = catTree;
  testCat.agendaPhase = 0;
  testCat.x = 800;
  testCat.y = 500;
  testCat.runAgenda(1920, 1080, mockScene);
  assert.ok(testCat.agendaPhase >= 1, '阶梯攀爬大计未推进');
  console.log(`     推进阶段: ${testCat.agendaPhase}, 状态: ${testCat.state}`);
});

test('纵向起跳极限速度解禁', () => {
  testCat.state = 'jumping';
  testCat.vy = -12.5;
  testCat.update(1920, 1080, mockScene);
  assert.ok(testCat.vy <= -10.0, `起跳速度被异常钳制: ${testCat.vy}`);
  console.log(`     飞跃速度: ${testCat.vy.toFixed(2)}`);
});

test('猫爬架跳台精准停靠', () => {
  const catTree = sharedCatTree;
  mockScene.furniture = [catTree];
  testCat.x = catTree.x + catTree.tiers[0].xOffset;
  testCat.y = catTree.y + catTree.tiers[0].yOffset - testCat.radius - 2;
  testCat.vy = 1.5;
  testCat.update(1920, 1080, mockScene);
  assert.strictEqual(testCat.perchedTier, catTree.tiers[0], '未停靠到下层跳台');
  testCat.perchedTier = null;
});

test('空中猫道悬索桥结构', () => {
  const bridge = new CyberMeow.CatSuspensionBridge(1500, 300, 280);
  bridge.update(1920, 1080, mockScene);
  // 快照在 update 之后获取，避免断言用到过期对象
  const surfaces = bridge.getPerchSurfaces();
  assert.ok(surfaces.length > 0 && surfaces[0].type === 'bridge');
  assert.strictEqual(bridge.plankCount, 11);
  console.log(`     桥跨度: ${bridge.w}px, 木板数量: ${bridge.plankCount}`);
});

test('空中全景吊床摆动与立足判定', () => {
  const hammock = new CyberMeow.AerialHammock(1500, 200, 115);
  hammock.nudge(0.12);
  hammock.update(1920, 1080, mockScene);
  const surfaces = hammock.getPerchSurfaces();
  assert.ok(surfaces.length > 0 && surfaces[0].type === 'hammock');
  assert.ok(Math.abs(hammock.swaySpeed) > 0, '吊床未产生摆动');
  console.log(`     摆动初速度: ${hammock.swaySpeed.toFixed(3)}`);
});

test('阶梯式猫步道多级踏板', () => {
  const ladder = new CyberMeow.WallClimbLadder(1000, 500, 3);
  assert.strictEqual(ladder.getPerchSurfaces().length, 3);
});

test('天花板风铃羽毛球谐振阻尼', () => {
  const ceilingToy = new CyberMeow.CeilingDanglingToy(1500, 180);
  ceilingToy.batToy(5, -6);
  ceilingToy.update(1920, 1080);
  assert.ok(Math.abs(ceilingToy.vy) > 0 || Math.abs(ceilingToy.vx) > 0, '未产生回弹');
  console.log(`     回弹初速度: vy=${ceilingToy.vy.toFixed(2)}, vx=${ceilingToy.vx.toFixed(2)}`);
});

test('飞天巡视战术大计推进', () => {
  const bridge = new CyberMeow.CatSuspensionBridge(1500, 300, 280);
  testCat.currentAgenda = AGENDAS.AERIAL_PATROL;
  testCat.agendaTarget = bridge;
  testCat.agendaPhase = 0;
  testCat.x = bridge.x - bridge.w / 2;
  testCat.y = 500;
  testCat.runAgenda(1920, 1080, mockScene);
  assert.ok(testCat.agendaPhase >= 1, '飞天巡视大计未推进');
  console.log(`     推进阶段: ${testCat.agendaPhase}, 状态: ${testCat.state}`);
});

test('高空空降跳杀蓄力与瞄准判定', () => {
  const cat = new Cat(500, 200, { breed: BREEDS[0] });
  cat.perchedTier = { x: 500, y: 200, w: 100 };
  const victim = new Cat(520, 450, { breed: BREEDS[1] });
  const scene = { cats: [cat, victim], furniture: [{ type: 'roomba', x: 530, y: 460 }], toys: [] };
  const result = cat.checkAerialPounce(scene);
  assert.strictEqual(result, true, '高空跳杀未触发');
  assert.strictEqual(cat.state, 'aerial_pounce_aim', '未进入跳杀蓄力状态');
  assert.ok(cat.aerialTarget, '未锁定跳杀目标');
  console.log(`     跳杀锁定目标类型: ${cat.aerialTargetType}`);
});

test('吊桥狭路相逢猫猫拳对决', () => {
  const bridge = new CyberMeow.CatSuspensionBridge(800, 300, 320);
  const catA = new Cat(790, 300, { breed: BREEDS[0] });
  const catB = new Cat(820, 300, { breed: BREEDS[1] });
  catA.onBridge = bridge;
  catB.onBridge = bridge;
  const scene = { cats: [catA, catB], furniture: [bridge], toys: [] };
  const duelTriggered = catA.checkBridgeDuel(scene);
  assert.strictEqual(duelTriggered, true, '狭路相逢未触发');
  assert.strictEqual(catA.state, 'bridge_duel');
  assert.strictEqual(catB.state, 'bridge_duel');
  console.log(`     对决状态: ${catA.state}, 意图: ${catA.intentIcon}`);
});

test('窗外赛博飞鸟视线追踪与齿颤', () => {
  const cat = new Cat(300, 400, { breed: BREEDS[0] });
  const scene = {
    environment: {
      getBird: () => ({ active: true, x: 350, y: 120 })
    }
  };
  const chatterTriggered = cat.checkWindowBirdChatter(scene);
  assert.strictEqual(chatterTriggered, true, '观鸟齿颤未触发');
  assert.strictEqual(cat.state, 'chattering');
  console.log(`     齿颤状态: ${cat.state}, 注视目标: x=${cat.lookTarget.x}`);
});

test('凌晨三点虚空狂飙暴走', () => {
  const cat = new Cat(500, 500, { breed: BREEDS[0] });
  cat.triggerMidnightZoomies(mockScene);
  assert.strictEqual(cat.state, 'zoomies');
  assert.ok(Math.abs(cat.vx) > 9.0, `狂飙速度不足: ${cat.vx}`);
  console.log(`     暴走速度: ${cat.vx.toFixed(2)}`);
});

test('下一代 5 节脊椎与宝石眼无缝绘制', () => {
  const { createBrowserMock } = require('./dom-mock');
  const mock = createBrowserMock();
  const ctx = mock.window.document.createElement('canvas').getContext('2d');
  const cat = new Cat(500, 500, { breed: BREEDS[0] });
  assert.doesNotThrow(() => {
    cat.render(ctx, 1920, 1080);
    cat.draw(ctx, 1920, 1080);
  }, '新版渲染流水线执行抛异常');
});

// ---------------------------------------------------------------------------
// 5. 本轮修复缺陷的回归用例
// ---------------------------------------------------------------------------
console.log('\n🐾 正在测试本轮修复的回归用例...');

test('呼噜声重复 start 不会累积计数导致无法停止', () => {
  const engine = CyberMeow.soundEngine;
  engine.init();
  engine.startPurr();
  engine.startPurr();
  engine.startPurr();
  assert.strictEqual(engine.purrActiveCount, 1, '重复调用使计数虚高');
  assert.ok(engine.purrSource, '未创建声源');
  engine.stopPurr();
  assert.strictEqual(engine.purrActiveCount, 0, '停止后计数未归零');
});

test('Web Audio 不可用时全部声音 API 安全降级', () => {
  const miniWindow = { setTimeout: setTimeout, clearTimeout: clearTimeout };
  miniWindow.window = miniWindow;
  const miniContext = vm.createContext(miniWindow);
  vm.runInContext(fs.readFileSync(path.join(basePath, 'js/audio.js'), 'utf8'), miniContext);
  const engine = miniWindow.CyberMeow.soundEngine;
  assert.doesNotThrow(() => {
    engine.init();
    engine.playMeow();
    engine.playPop();
    engine.startPurr();
    engine.stopPurr();
    engine.startRoomba();
    engine.stopRoomba();
  });
  assert.strictEqual(engine.unavailable, true, '未进入降级模式');
});

test('纸箱与骑乘状态具备自然退出路径', () => {
  const inBoxCat = new Cat(100, 100, { breed: BREEDS[0] });
  const box = new CardboardBox(100, 100);
  inBoxCat.inBox = box;
  box.occupant = inBoxCat;
  inBoxCat.state = 'in_box';
  const scene = { cats: [inBoxCat], toys: [], furniture: [], spawnParticle: noop };
  for (let i = 0; i < 601; i++) inBoxCat.update(1920, 1080, scene);
  assert.strictEqual(inBoxCat.inBox, null, '猫永久卡在纸箱中');
  assert.strictEqual(box.occupant, null, '纸箱永久被占用');
});

test('抓取时释放 heldYarn 引用', () => {
  const grabber = new Cat(100, 100, { breed: BREEDS[0] });
  const yarn = new YarnBall(100, 100);
  grabber.heldYarn = yarn;
  yarn.heldBy = grabber;
  grabber.isGrabbed = true;
  grabber.update(1920, 1080, mockScene);
  assert.strictEqual(grabber.heldYarn, null, '抓取后仍持有毛线球');
  assert.strictEqual(yarn.heldBy, null, '毛线球仍指向被抓取的猫');
});

test('激光挫败感随时间衰减', () => {
  const cat = new Cat(100, 100, { breed: BREEDS[0] });
  // 关掉激光，隔离「扑空 +0.22」的干扰，只验证衰减逻辑本身
  const laserWasActive = mockScene.laser.active;
  mockScene.laser.active = false;
  try {
    cat.laserFrustration = 80;
    cat.update(1920, 1080, mockScene);
    assert.ok(cat.laserFrustration < 80, '挫败感未衰减，红点将永久失效');
  } finally {
    mockScene.laser.active = laserWasActive;
  }
});

test('最小场景上下文不会让猫的行动分支抛异常', () => {
  const cat = new Cat(100, 100, { breed: BREEDS[0] });
  assert.doesNotThrow(() => cat.update(1920, 1080, undefined));
});

// ---------------------------------------------------------------------------
// 5.5 外部新特性补充断言：空降跳杀结算 / 吊桥对决 / 观鸟齿颤 / 暴走
// ---------------------------------------------------------------------------
console.log('\n🐾 正在测试外部新特性的完整行为链...');

test('空降跳杀分别锁定 roomba / 猫 / 纸箱三种目标', () => {
  const makeHunter = () => {
    const c = new Cat(500, 200, { breed: BREEDS[0] });
    c.perchedTier = { x: 500, y: 200, w: 100 };
    return c;
  };

  const hunterRoomba = makeHunter();
  const roomba = { type: 'roomba', x: 530, y: 350, vx: 0, spin: 0 };
  assert.strictEqual(hunterRoomba.checkAerialPounce({
    cats: [], furniture: [roomba], toys: [], spawnParticle: noop
  }), true, '未锁定扫地机');
  assert.strictEqual(hunterRoomba.aerialTargetType, 'roomba');
  assert.strictEqual(hunterRoomba.aerialTarget, roomba);

  const hunterCat = makeHunter();
  const victim = new Cat(520, 360, { breed: BREEDS[1] });
  assert.strictEqual(hunterCat.checkAerialPounce({
    cats: [hunterCat, victim], furniture: [], toys: [], spawnParticle: noop
  }), true, '未锁定地面猫');
  assert.strictEqual(hunterCat.aerialTargetType, 'cat');
  assert.strictEqual(hunterCat.aerialTarget, victim);

  const hunterBox = makeHunter();
  const box = { type: 'box', x: 520, y: 360, occupant: null };
  assert.strictEqual(hunterBox.checkAerialPounce({
    cats: [], furniture: [box], toys: [], spawnParticle: noop
  }), true, '未锁定空纸箱');
  assert.strictEqual(hunterBox.aerialTargetType, 'box');
  assert.strictEqual(hunterBox.aerialTarget, box);

  [hunterRoomba, hunterCat, hunterBox].forEach(c => {
    assert.strictEqual(c.state, 'aerial_pounce_aim', '未进入蓄力状态');
    assert.strictEqual(c.stateTimer, 45, '蓄力时长异常');
    assert.strictEqual(c.intentIcon, '🎯');
  });
});

test('空降跳杀目标优先级：扫地机 > 猫 > 纸箱', () => {
  const cat = new Cat(500, 200, { breed: BREEDS[0] });
  cat.perchedTier = { x: 500, y: 200, w: 100 };
  const roomba = { type: 'roomba', x: 530, y: 350 };
  const other = new Cat(520, 360, { breed: BREEDS[1] });
  const box = { type: 'box', x: 510, y: 360, occupant: null };
  cat.checkAerialPounce({ cats: [cat, other], furniture: [box, roomba], toys: [] });
  assert.strictEqual(cat.aerialTargetType, 'roomba', '优先级错误：应先锁定扫地机');
});

test('空降跳杀蓄力结束转入下坠并解除所有落脚状态', () => {
  const cat = new Cat(500, 300, { breed: BREEDS[0] });
  cat.state = 'aerial_pounce_aim';
  cat.stateTimer = 0;
  cat.perchedTier = { x: 500, y: 300, w: 100 };
  cat.onBridge = true;
  cat.inHammock = true;
  cat.aerialTarget = { x: 530, y: 360 };
  cat.aerialTargetType = 'roomba';
  cat.update(1920, 1080, { cats: [], furniture: [], toys: [], spawnParticle: noop });
  assert.strictEqual(cat.state, 'aerial_pounce_drop', '蓄力未转入下坠');
  assert.strictEqual(cat.perchedTier, null, '未解除跳台落脚');
  assert.strictEqual(cat.onBridge, false, '未解除吊桥状态');
  assert.strictEqual(cat.inHammock, false, '未解除吊床状态');
  assert.ok(cat.vy < -2.5, `下坠初速度异常: ${cat.vy}`);
});

test('空降跳杀落地对扫地机结算：击退与旋转', () => {
  const cat = new Cat(530, 400, { breed: BREEDS[0] });
  cat.state = 'aerial_pounce_drop';
  cat.facing = 1;
  cat.vx = 0;
  cat.vy = 0;
  cat.stateTimer = 0;
  const roomba = { type: 'roomba', x: 530, y: 400, vx: 0, spin: 0 };
  cat.aerialTarget = roomba;
  cat.aerialTargetType = 'roomba';
  const scene = { cats: [], furniture: [roomba], toys: [], spawnParticle: noop };
  // 每帧把下坠猫钉在目标中心，规避同帧随机位移导致 dist 偶发超出判定半径
  for (let i = 0; i < 6 && cat.aerialTarget; i++) {
    cat.x = roomba.x;
    cat.y = roomba.y;
    cat.vx = 0;
    cat.vy = 0;
    cat.state = 'aerial_pounce_drop';
    cat.update(1920, 1080, scene);
  }
  assert.notStrictEqual(cat.state, 'aerial_pounce_drop', '未退出下坠状态');
  assert.strictEqual(cat.aerialTarget, null, '未清空目标引用');
  assert.strictEqual(roomba.spin, 0.35, '扫地机未进入旋转');
  assert.ok(Math.abs(roomba.vx) > 0, '扫地机未被击退');
});

test('空降跳杀落地对猫结算：双猫抱摔击落', () => {
  const cat = new Cat(520, 400, { breed: BREEDS[0] });
  cat.state = 'aerial_pounce_drop';
  cat.facing = 1;
  cat.vx = 0;
  cat.vy = 0;
  const victim = new Cat(520, 400, { breed: BREEDS[1] });
  cat.aerialTarget = victim;
  cat.aerialTargetType = 'cat';
  const scene = { cats: [cat, victim], furniture: [], toys: [], spawnParticle: noop };
  for (let i = 0; i < 6 && cat.aerialTarget; i++) {
    cat.x = victim.x;
    cat.y = victim.y;
    cat.vx = 0;
    cat.vy = 0;
    cat.state = 'aerial_pounce_drop';
    cat.update(1920, 1080, scene);
  }
  assert.notStrictEqual(cat.state, 'aerial_pounce_drop', '未退出下坠状态');
  assert.strictEqual(cat.aerialTarget, null);
  assert.strictEqual(victim.state, 'idle');
  assert.strictEqual(victim.stateTimer, 55);
  assert.ok(Math.abs(victim.vx) > 0 && victim.vy < 0, '目标猫未被击飞');
});

test('空降跳杀落地对纸箱结算：液体猫进箱', () => {
  const cat = new Cat(520, 400, { breed: BREEDS[0] });
  cat.state = 'aerial_pounce_drop';
  cat.vx = 0;
  cat.vy = 0;
  const box = { type: 'box', x: 520, y: 400, occupant: null };
  cat.aerialTarget = box;
  cat.aerialTargetType = 'box';
  const scene = { cats: [], furniture: [box], toys: [], spawnParticle: noop };
  for (let i = 0; i < 6 && cat.aerialTarget; i++) {
    cat.x = box.x;
    cat.y = box.y;
    cat.vx = 0;
    cat.vy = 0;
    cat.state = 'aerial_pounce_drop';
    cat.update(1920, 1080, scene);
  }
  assert.strictEqual(cat.inBox, box, '未进入纸箱');
  assert.strictEqual(box.occupant, cat);
  assert.strictEqual(cat.aerialTarget, null);
});

test('吊桥对决进入后主循环持续推进对决状态', () => {
  const bridge = new CyberMeow.CatSuspensionBridge(800, 300, 320);
  const catA = new Cat(790, 300, { breed: BREEDS[0] });
  const catB = new Cat(820, 300, { breed: BREEDS[1] });
  catA.onBridge = bridge;
  catB.onBridge = bridge;
  const scene = { cats: [catA, catB], furniture: [bridge], toys: [], spawnParticle: noop };
  assert.strictEqual(catA.checkBridgeDuel(scene), true);
  assert.strictEqual(catA.bridgeRival, catB, '未记录对决对手');
  assert.strictEqual(catA.stateTimer, 75);
  const before = catA.stateTimer;
  assert.doesNotThrow(() => catA.update(1920, 1080, scene));
  assert.strictEqual(catA.state, 'bridge_duel', '对决状态被意外打断');
  assert.ok(catA.stateTimer < before, '对决计时未推进');
  assert.strictEqual(typeof catA.swatProgress, 'number');
});

test('观鸟齿颤写入意图标记并在逐帧更新中推进齿颤相位', () => {
  const cat = new Cat(300, 400, { breed: BREEDS[0] });
  const scene = { environment: { getBird: () => ({ active: true, x: 350, y: 120 }) } };
  assert.strictEqual(cat.checkWindowBirdChatter(scene), true);
  assert.strictEqual(cat.intentIcon, '🕊️');
  assert.strictEqual(cat.lookTarget.x, 350);
  assert.strictEqual(cat.lookTarget.y, 120);
  const phaseBefore = cat.chatterPhase;
  cat.update(1920, 1080, { cats: [], furniture: [], toys: [], spawnParticle: noop });
  assert.ok(cat.chatterPhase > phaseBefore, '齿颤相位未推进');
});

test('凌晨暴走写满能量、弹射初速与狂飙意图', () => {
  const cat = new Cat(500, 500, { breed: BREEDS[0] });
  cat.energy = 10;
  cat.triggerMidnightZoomies(mockScene);
  assert.strictEqual(cat.state, 'zoomies');
  assert.strictEqual(cat.energy, 100, '能量未拉满');
  assert.strictEqual(cat.vy, -6.5);
  assert.ok(Math.abs(cat.vx) >= 10.5, '弹射初速不足');
  assert.strictEqual(cat.intentLabel, '凌晨三点全屋狂飙');
  assert.ok(cat.stateTimer >= 240, '暴走时长不足');
});

test('Q萌猫团子灵动立体双眼与白猫异瞳配置', () => {
  const whiteBreed = BREEDS.find(b => b.id === 'white');
  assert.ok(whiteBreed, '缺少白猫品种配置');
  assert.ok(whiteBreed.eyeColor && whiteBreed.eyeRightColor, '白猫缺少异瞳配色支持');
  assert.notStrictEqual(whiteBreed.eyeColor, whiteBreed.eyeRightColor, '白猫左右眼颜色应不同');

  const cat = new Cat(300, 300, { breed: whiteBreed });
  const mockCtx = {
    save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
    beginPath: noop, ellipse: noop, arc: noop, fill: noop, stroke: noop,
    moveTo: noop, lineTo: noop, closePath: noop, quadraticCurveTo: noop, bezierCurveTo: noop,
    clip: noop, createLinearGradient: () => ({ addColorStop: noop }),
    fillText: noop, measureText: () => ({ width: 40 }), getTransform: () => ({ a: 1 }),
    setTransform: noop
  };

  ['idle', 'sleeping', 'loaf', 'grabbed', 'bridge_duel'].forEach(st => {
    cat.state = st;
    assert.doesNotThrow(() => {
      cat.renderChibiLoaf(mockCtx, 1920, 1080, { eyeTracking: true });
    }, `Q萌猫团子在状态 ${st} 灵动双眼渲染抛异常`);
  });
});

// ---------------------------------------------------------------------------
// 5.6 猫咪落脚扫掠回归：首次穿越、斜向高速、斜面与单向地面
// ---------------------------------------------------------------------------
console.log('\n🐾 正在测试猫咪落脚扫掠...');

test('落脚扫掠按首次穿越时刻选面，不受家具迭代顺序影响', () => {
  const lower = { id: 'lower', x: 100, y: 320, w: 80, type: 'perch' };
  const higher = { id: 'higher', x: 100, y: 280, w: 80, type: 'perch' };
  const hit = CyberMeow.LandingResolver.findFirst({
    startX: 100,
    startY: 250,
    endX: 100,
    endY: 340,
    radius: 10,
    surfaces: [lower, higher]
  });
  assert.ok(hit, '没有检测到任一穿越面');
  assert.strictEqual(hit.surface, higher, '选择了迭代顺序靠前但较晚穿越的面');
  assert.ok(Math.abs(hit.time - 2 / 9) < 1e-9, `首穿时刻异常: ${hit.time}`);
  assert.strictEqual(hit.startedInContact, false, '新着陆被误标为持续接触');
});

test('高速斜向首碰使用插值 X，后续接触保留位移', () => {
  const surface = { id: 'narrow', x: 132, y: 319.2, w: 8, type: 'perch' };
  const furniture = { type: 'perch', getPerchSurfaces: () => [surface] };
  const cat = new Cat(115, 260, {
    breed: BREEDS[0],
    radius: 20,
    vx: 11.5,
    vy: 16,
    state: 'zoomies'
  });
  cat.stateTimer = 1000;
  cat.update(800, 700, {
    cats: [],
    furniture: [furniture],
    toys: [],
    dt: 0.05,
    spawnParticle: noop
  });
  assert.strictEqual(cat.perchedTier, 'narrow', '高速斜向位移漏掉了中途穿过的窄平台');
  assert.ok(cat.x > 137 && cat.x < 142, `落点未回退到插值 X: ${cat.x}`);
  assert.ok(Math.abs(cat.y + cat.radius - surface.y) < 1e-9, '落点高度未贴合平台');

  surface.w = 80;
  cat.vx = 2;
  const continuedFromX = cat.x;
  cat.update(800, 700, {
    cats: [],
    furniture: [furniture],
    toys: [],
    dt: 1 / 60,
    spawnParticle: noop
  });
  assert.strictEqual(cat.perchedTier, 'narrow', '持续接触时丢失了落脚面');
  assert.ok(cat.x > continuedFromX, `持续接触把切向位移回卷到了起点: ${cat.x}`);
});

test('斜面落脚高度按命中 X 计算', () => {
  const slope = { id: 'slope', x: 100, y: 300, w: 120, slope: 0.25, type: 'perch' };
  const hit = CyberMeow.LandingResolver.findFirst({
    startX: 60,
    startY: 260,
    endX: 140,
    endY: 310,
    radius: 20,
    surfaces: [slope]
  });
  assert.ok(hit, '斜面穿越未被检测');
  assert.ok(Math.abs(hit.time - 1 / 3) < 1e-9, `斜面首穿时刻异常: ${hit.time}`);
  assert.ok(Math.abs(hit.x - 260 / 3) < 1e-9, `斜面命中 X 异常: ${hit.x}`);
  assert.ok(Math.abs(hit.y + 20 - 890 / 3) < 1e-9, `斜面命中高度异常: ${hit.y + 20}`);
  assert.strictEqual(hit.startedInContact, false, '斜面新着陆被误标为持续接触');
});

test('上升可穿台，反重力下降仍落脚且地面反弹', () => {
  const surface = { id: 'one-way', x: 100, y: 300, w: 80, type: 'perch' };
  const rising = CyberMeow.LandingResolver.findFirst({
    startX: 100,
    startY: 300,
    endX: 100,
    endY: 280,
    surfaces: [surface]
  });
  assert.strictEqual(rising, null, '上升起跳被单向平台错误拦截');

  const previousMode = CyberMeow.physicsWorld.gravityMode;
  CyberMeow.physicsWorld.gravityMode = 'antigravity';
  try {
    const furniture = { type: 'perch', getPerchSurfaces: () => [surface] };
    const landingCat = new Cat(100, 278, {
      breed: BREEDS[0], radius: 20, vx: 0, vy: 4, state: 'jumping'
    });
    landingCat.stateTimer = 1000;
    landingCat.update(800, 700, {
      cats: [], furniture: [furniture], toys: [], dt: 1 / 60, spawnParticle: noop
    });
    assert.strictEqual(landingCat.perchedTier, 'one-way', '反重力模式下下降穿越未落脚');

    const floorCenterY = CyberMeow.physicsWorld.getFloorY(700) - landingCat.radius;
    const floorCat = new Cat(100, floorCenterY - 2, {
      breed: BREEDS[0], radius: 20, vx: 0, vy: 4, state: 'jumping'
    });
    floorCat.stateTimer = 1000;
    floorCat.update(800, 700, {
      cats: [], furniture: [], toys: [], dt: 1 / 60, spawnParticle: noop
    });
    assert.strictEqual(floorCat.y, floorCenterY, '地面穿越未收敛到地面高度');
    assert.ok(floorCat.vy < 0, '带速度落地后未执行地面反弹');
  } finally {
    CyberMeow.physicsWorld.gravityMode = previousMode;
  }
});

test('地面持续接触保留切向行走位移', () => {
  const floorCenterY = CyberMeow.physicsWorld.getFloorY(700) - 20;
  const cat = new Cat(100, floorCenterY, {
    breed: BREEDS[0], radius: 20, vx: 2, vy: 0, state: 'walking'
  });
  cat.stateTimer = 1000;
  cat.update(800, 700, {
    cats: [], furniture: [], toys: [], dt: 1 / 60, spawnParticle: noop
  });
  assert.ok(cat.x > 100, `地面接触冻结了切向 X: ${cat.x}`);
  assert.strictEqual(cat.y, floorCenterY, '地面接触未保持竖直高度');
});

test('已有平台接触可继续行走并离开边缘', () => {
  const surface = { id: 'walk-off', x: 100, y: 300, w: 40, type: 'perch' };
  const furniture = { type: 'perch', getPerchSurfaces: () => [surface] };
  const cat = new Cat(118, 280, {
    breed: BREEDS[0], radius: 20, vx: 4, vy: 0, state: 'walking'
  });
  cat.stateTimer = 1000;
  cat.perchedTier = surface.id;
  const scene = { cats: [], furniture: [furniture], toys: [], dt: 1 / 60, spawnParticle: noop };

  const startX = cat.x;
  cat.update(800, 700, scene);
  assert.ok(cat.x > startX, `已有平台接触冻结了切向 X: ${cat.x}`);
  assert.strictEqual(cat.perchedTier, surface.id, '仍在平台范围内却提前脱离');

  for (let i = 0; i < 6 && cat.perchedTier; i++) cat.update(800, 700, scene);
  assert.strictEqual(cat.perchedTier, null, '猫咪无法从平台边缘走出');
});

test('移动斜面持续接触保留 X 并按末位置贴合高度', () => {
  const surface = { id: 'moving-slope', x: 100, y: 300, w: 120, slope: 0.1, type: 'perch' };
  const furniture = { type: 'perch', getPerchSurfaces: () => [surface] };
  const cat = new Cat(100, 280, {
    breed: BREEDS[0], radius: 20, vx: 2, vy: 0, state: 'walking'
  });
  cat.stateTimer = 1000;
  cat.perchedTier = surface.id;

  surface.x = 96;
  cat.update(800, 700, {
    cats: [], furniture: [furniture], toys: [], dt: 1 / 60, spawnParticle: noop
  });
  assert.ok(cat.x > 100, `移动斜面接触冻结了切向 X: ${cat.x}`);
  assert.strictEqual(cat.perchedTier, surface.id, '移动斜面接触被误判为新着陆');
  const expectedY = CyberMeow.LandingResolver.getSurfaceYAt(surface, cat.x) - cat.radius;
  assert.ok(Math.abs(cat.y - expectedY) < 1e-9, '移动斜面未按末位置 X 贴合高度');
});

// ---------------------------------------------------------------------------
// 6. 运行时 + 性能/统计型测试（environment / ui / app 在 VM 中真实执行）
// ---------------------------------------------------------------------------
const { registerRuntimeTests } = require('./runtime');
registerRuntimeTests({ basePath, fs, vm, assert, test });

const { registerSoakTests } = require('./soak');
registerSoakTests({ basePath, fs, vm, assert, test });

const { registerArchitectureTests } = require('./architecture');
registerArchitectureTests({ basePath, fs, assert, test });

// ---------------------------------------------------------------------------
// 7. 汇总
// ---------------------------------------------------------------------------
console.log(`\n📊 测试结果：${passed} 通过 / ${failed} 失败`);
if (failed > 0) {
  console.error('❌ 存在失败的断言，测试未通过。');
  process.exit(1);
}
console.log('🎉 所有核心模块、猫生战术脑与回归用例均通过真实断言验证！');
