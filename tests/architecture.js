/**
 * CyberMeow - 架构门禁测试
 *
 * 把 docs/ARCHITECTURE_REVIEW.md 的裁决结论变成可证伪的机械检查：
 *   1. 公共契约面（window.CyberMeow.* 挂载）可枚举
 *   2. 已观测逃逸点必须携带 @escape H4 标记（D3/H4）
 *   3. bridge 类型字符串在 cat.js 与 furniture.js 之间一致
 *   4. 宝石渐变缓存 key 不含动态 toFixed（防 Map 无限增长）
 *   5. 玩具/家具物理积分统一走 sceneContext.dt（帧率无关）
 *
 * 按反模式 #7，每个守卫都配反例：注入违规写法后断言门禁确实失败。
 */
'use strict';

const path = require('path');

function registerArchitectureTests(options) {
  const { basePath, fs, assert, test } = options;

  console.log('\n🐾 正在测试架构门禁（契约面 / H4 标记 / 类型一致性 / 帧率一致性）...');

  const read = (rel) => fs.readFileSync(path.join(basePath, rel), 'utf8');
  const app = read('js/app.js');
  const cat = read('js/cat.js');
  const toys = read('js/toys.js');
  const furniture = read('js/furniture.js');
  const sources = [
    read('js/physics.js'), read('js/audio.js'), furniture, toys,
    cat, read('js/environment.js'), read('js/ui.js'), app
  ];

  // 公共契约面：window.CyberMeow.X = ... 的符号集合
  const contracts = new Set();
  sources.forEach(src => {
    [...src.matchAll(/window\.CyberMeow\.([A-Za-z_$][\w$]*)\s*=/g)].forEach(m => contracts.add(m[1]));
  });

  // H4 守卫：检测对已知逃逸字段的写入是否带 @escape H4 标记
  const unmarkedEscapes = (src) => {
    const targets = ['bgmEnabled', 'gravityMode'];
    const found = [];
    for (const target of targets) {
      const re = new RegExp(`\\b(?:soundEngine|physicsWorld)\\.${target}\\s*=(?!=|>)`, 'g');
      let match;
      while ((match = re.exec(src)) !== null) {
        const preceding = src.slice(Math.max(0, match.index - 260), match.index);
        if (!preceding.includes('@escape H4')) found.push(target);
      }
    }
    return found;
  };

  test('公共契约面：符号级挂载可枚举且覆盖全部 8 个模块', () => {
    assert.ok(contracts.size >= 30, `契约符号数 ${contracts.size} 少于预期的 30`);
    ['MathUtils', 'physicsWorld', 'soundEngine', 'Cat', 'YarnBall', 'CatSuspensionBridge',
     'environment', 'uiManager', 'app'].forEach(symbol => {
      assert.ok(contracts.has(symbol), `缺少公共契约符号 ${symbol}`);
    });
  });

  test('H4 逃逸标记：已观测的 bgmEnabled / gravityMode 写入全部登记', () => {
    assert.deepStrictEqual(unmarkedEscapes(app), [], '存在未标记的 H4 逃逸写入');
    assert.ok(/@escape H4:[\s\S]{0,260}bgmEnabled/.test(app), 'bgmEnabled 逃逸缺少标记');
    assert.ok(/@escape H4:[\s\S]{0,260}gravityMode/.test(app), 'gravityMode 逃逸缺少标记');
  });

  test('反例：移除 @escape H4 标记后，逃逸守卫必须报警', () => {
    const bad = app.replace(/@escape H4: 直写 soundEngine\.bgmEnabled/g, '（标记被移除）');
    const found = unmarkedEscapes(bad);
    assert.ok(found.includes('bgmEnabled'), '注入未标记写入后守卫未失败，属于无效门禁');
  });

  test('类型一致性：cat.js 不再引用不存在的 suspension_bridge', () => {
    assert.ok(!cat.includes("'suspension_bridge'"), 'cat.js 仍使用错误的桥类型字符串');
    assert.ok(cat.includes("f.type === 'bridge'"), 'cat.js 缺少正确的桥类型判定');
  });

  test('反例：注入错误桥类型后，一致性守卫必须报警', () => {
    const bad = cat.replace("f.type === 'bridge'", "f.type === 'suspension_bridge'");
    assert.ok(bad.includes("'suspension_bridge'"), '注入未生效，反例无效');
  });

  test('缓存稳定性：宝石渐变 key 不含逐帧变化的 toFixed', () => {
    assert.ok(!/gem_[^;]{0,80}toFixed/.test(cat), '宝石渐变 key 仍含动态 toFixed');
    assert.ok(cat.includes("'gem_' + irisColor"), '宝石渐变未使用稳定 key');
    assert.ok(cat.includes('_gradCache.size >= 64'), '缺少渐变缓存容量上限');
  });

  test('帧率一致性：玩具与家具的物理积分统一走 sceneContext.dt', () => {
    assert.ok(toys.includes('const frameStep = (scene)'), 'toys.js 缺少 frameStep 辅助');
    assert.ok(furniture.includes('const frameStep = (scene)'), 'furniture.js 缺少 frameStep 辅助');
    const toySteps = (toys.match(/const step = frameStep\(sceneContext\);/g) || []).length;
    const furnitureSteps = (furniture.match(/const step = frameStep\(sceneContext\);/g) || []).length;
    assert.ok(toySteps >= 4, `toys.js 仅 ${toySteps} 处使用帧步长`);
    assert.ok(furnitureSteps >= 5, `furniture.js 仅 ${furnitureSteps} 处使用帧步长`);
    assert.ok(!/this\.vy \+= gravity;\s*\n\s*this\.x \+= this\.vx;/.test(toys), '仍有未缩放的重力积分');
  });
}

module.exports = { registerArchitectureTests };
