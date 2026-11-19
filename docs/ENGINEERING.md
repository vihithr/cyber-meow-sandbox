# CyberMeow 工程说明

## 1. 项目定位与运行环境

CyberMeow 是一个零外部依赖的桌面猫咪物理沙盒，使用原生 HTML5 Canvas 2D 与 Web Audio API 实现，没有构建步骤、没有 npm 依赖、没有外部图片与音频资源。

启动方式有三种：直接双击 `index.html`、运行 `start.bat`、或执行 `python server.py` 启动本地 HTTP 服务（监听 8088 端口，支持局域网访问）。自动化测试入口是 `node tests/verify.js`。

## 2. 模块划分与数据流

所有 JavaScript 文件都包裹在 `(function(window){ ... })(window)` 中，通过全局命名空间 `window.CyberMeow` 导出类与单例。`index.html` 按以下顺序加载脚本，顺序本身构成依赖关系：

| 顺序 | 文件 | 职责 | 对外主要导出 |
|---|---|---|---|
| 1 | `js/physics.js` | 向量数学、Verlet 链、重力常量 | `MathUtils`、`VerletChain`、`physicsWorld` |
| 2 | `js/audio.js` | 纯程序化声音合成 | `soundEngine` 单例 |
| 3 | `js/furniture.js` | 家具、建筑与投喂机 | `WallPerch`、`CatTree`、`Roomba`、`SmartFeeder` 等 |
| 4 | `js/toys.js` | 毛线球、鱼干、纸箱、水洼 | `YarnBall`、`FishTreat`、`WaterMug`、`WaterPuddle` 等 |
| 5 | `js/cat.js` | 猫咪智能体、行为树、社交、绘制 | `Cat`、`BREEDS`、`PERSONALITIES`、`AGENDAS` |
| 6 | `js/environment.js` | 主题、天气、粒子与背景绘制 | `environment` 单例 |
| 7 | `js/ui.js` | 身份证、快照、挑战、侍奉台 | `uiManager` 单例 |
| 8 | `js/app.js` | 主循环、相机、输入、存档 | `CyberMeowApp`，在 `DOMContentLoaded` 时启动 |

数据交换的核心对象是 `sceneContext`（即 `CyberMeowApp` 实例），它提供 `cats`、`toys`、`furniture`、`mouse`、`laser`、`spawnParticle()` 等字段。家具和道具通过 `update(width, height, sceneContext)` 读取场景状态，并可反向修改 `sceneContext.toys`（投喂机出粮、水杯打翻产生水洼）。猫通过 `evaluateSensors(sceneContext)` 选择目标，通过 `runStateMachine` 与 `runAgenda` 推进行为。

主循环 `CyberMeowApp.loop()` 的顺序为：相机插值与清屏 → 环境背景 → 阳光 → 家具 → 道具 → 猫咪 → 逗猫棒/激光 → 粒子 → 挑战目标。世界采用相机变换绘制：`ctx.scale(zoom); ctx.translate(-cameraX, 0)`，因此所有对象的坐标都是世界坐标，输入事件需经 `getWorldPos()` 反向换算。

“喵视角”彩蛋：按 `C` 键在自由镜头与跟随镜头之间切换，跟随目标优先选离鼠标最近的猫；右键/中键拖拽平移或使用分区导航按钮会退出跟随。该状态只影响 `targetCameraX`，不改动任何实体逻辑。

## 3. 关键设计约束

1. **零依赖**：不得引入 npm 包或外部资源文件。这也意味着不能直接用 bitECS 等第三方 ECS 库；性能必须靠渲染组织与数据结构优化解决。
2. **即开即玩**：`file://` 双击打开必须可用，因此脚本使用传统 `<script>` 标签而非 ES Module（ESM 在 `file://` 下受 CORS 限制）。
3. **状态机优先**：猫的行为由 `state` 与 `currentAgenda` 双轴驱动，实体之间存在图状交叉引用（`rival`、`inBox`、`ridingObj`、`perchedTier`、`heldYarn`、`agendaTarget`）。任何结构性重构都必须保持这些引用的成对清理，否则会出现永久卡死。
4. **真实断言**：`tests/verify.js` 使用 Node `assert`，失败会使进程以退出码 1 结束。禁止用“打印成功日志”代替断言。

## 4. 已实施的性能优化

按收益从高到低列出：

| 优化项 | 位置 | 原理 |
|---|---|---|
| 视口裁剪 | `app.js` 主循环 | 世界宽 3000px，通常只显示约 1900px；仅绘制可见对象，减少绘制调用 |
| 静态层离屏缓存 | `app.js` / `environment.js` | 背景与静态家具只在主题/尺寸/内容变化时重绘，其余帧复用离屏画布 |
| 渐变缓存 | `environment.js`、`furniture.js` 的 `Sunbeam` | `createLinearGradient`/`createRadialGradient` 不在每帧创建 |
| 落脚面对象复用 | `furniture.js` 各家具的 `getPerchSurfaces()` | 每只猫每帧原本会为每个家具分配一组新对象；改为复用同一数组并原地更新字段 |
| 阴影状态外提 | `environment.js` | 萤火虫 `shadowBlur` 从逐粒子设置改为按天气设置一次 |
| 画布尺寸稳定 | `ui.js` 侍奉台 | 写 `canvas.width/height` 会清空缓冲并重置上下文，不再每帧执行 |
| 实体上限与过期回收 | `app.js`、`toys.js` | 玩具 80、家具 60、猫 40、粒子 240 上限；过期水洼从数组移除 |
| 高 DPI 适配 | `app.js` | 后备缓冲按 `devicePixelRatio`（上限 2）设置，避免模糊且控制填充率 |
| 时间步改造 | `cat.js`、`app.js` | 主循环计算 `dt`（秒，上限 0.05s）传给猫的状态机，按帧递减的关键计时改为 dt 驱动；测试走名义帧回退分支 |

## 5. 健壮性修复摘要

- **状态机死锁**：王座对决补双向 `rival` 引用与空引用兜底；进箱/骑乘增加 600 帧自然退出；抓取时释放 `heldYarn`；大计超时统一清理衍生引用。
- **数值安全**：扫地机目标重合时避免 `0/0`；弹道计算处理非正重力；存档中 0 值正确恢复。
- **异步竞态**：猫咪的延迟 `setTimeout` 回调增加抓取/状态/对象有效性校验。
- **音频**：`AudioContext` 不可用时安装完整 API 形状的空实现；呼噜声启停幂等；扫地机停止—重启竞态消除；音频节点在结束时断链释放。
- **UI**：挑战时长统一为 45 秒并恢复进入前的工具；挑战目标按相机与缩放换算到世界坐标；定时器跨会话清理；DOM 空引用与 `toDataURL` 异常保护。

## 6. 测试体系

测试入口为 `node tests/verify.js`，共 **62 项断言**，失败以退出码 1 结束。文件构成：

- `tests/verify.js`：语法编译与核心逻辑断言（37 项）。
- `tests/dom-mock.js`：最小浏览器 API 桩。canvas 2D 上下文用 Proxy 兜底，`requestAnimationFrame` 只登记回调、不自动执行，因此 `app.init()` 的主循环不会在测试中跑飞，可由测试手动推进单帧。
- `tests/runtime.js`：在独立 VM 中按依赖顺序真实加载全部 8 个模块并触发 `DOMContentLoaded`，新增 23 项断言，覆盖 `environment.js`、`ui.js`、`app.js` 的运行时行为、环境渐变缓存、天气上限、红点目标边界、护照/快照交互、实体上限、DPR、视口裁剪与离屏缓存失效条件。

另有存档往返测试（名字、装扮、`hunger`/`affection` 的 0 值恢复）与喵视角测试（按 C 切换、镜头跟随目标猫、再按退出）。

已知覆盖缺口：Canvas mock 只验证调用是否发生与参数边界，不做像素级比对；静态层 `drawImage` 的源矩形正确性需人工目视验证；未覆盖真实 CSS 布局与完整手势序列、Web Audio 实际发声；没有帧耗时阈值基准（避免 CI 抖动造成假失败）。

## 7. 关于 ECS 的评估结论

该场景的实体规模为猫 ≤ 40、道具 ≤ 80、粒子 ≤ 240，远未达到 ECS（SoA/TypedArray 布局）产生显著收益的量级。当前瓶颈来自绘制 API 的调用方式（每帧创建渐变、切换阴影状态、重设画布尺寸）与无节制的全场景遍历，这些都已通过渲染组织优化解决，无需引入依赖。

强引用行为体（猫的 `rival`/`inBox`/`ridingObj` 等图状关系、10 大行为树、多阶段状态机）改用组件化表达会重写 `cat.js` 的大半，回归风险高且收益无法量化。`experiments/` 目录保存了独立的 SoA/OOP 基准原型与实测结论，供后续重新评估时参考；该实验不参与主项目运行。

`experiments/` 下的独立基准（Node v24.15.0，`node --expose-gc experiments/bench.js`）用 TypedArray 实现 SoA32/SoA64 原型，与等价 OOP 实现在 40～2000 实体规模下对比，两轮独立运行的 checksum 全部一致。实测结论：

- 40 实体（猫上限）：SoA32 相对 OOP 为 0.79× / 1.14×，纯噪声。
- 360 实体（三类实体合计上限）：1.25× / 1.33×，每帧仅省 0.073～0.096 ms，占 16.7 ms 帧预算的 0.4～0.6%。
- 2000 实体：1.04× / 1.02×，规模增大后倍率反而下降。

耗时 95% 以上来自 O(n²) 范围查询，ECS 不改变复杂度；迁移 `cat.js` 的强引用状态机需重写大半代码与测试。建议门槛为「稳定 >1.5× 且绝对节省 >1 ms/帧」，所有规模均未达到。

重新评估 ECS 的合适时机：实体数持续超过 2000 且每帧做相同数学运算、需要批量序列化快照、或要向 Worker/WASM 迁移时。若瓶颈是范围查询，应优先做空间哈希/网格，收益量级远大于数据布局调整。

## 8. 已知限制与后续方向

1. **离屏层显存**：背景层与静态家具层按整个世界（3000px）渲染，但固定以 1x 而非设备 DPR 烘焙，DPR=2 时两层合计由约 100MB 降至约 26MB。背景是渐变/木纹、家具是简单图形，放大后视觉损失很小；猫咪等动态主体仍在主画布按完整 DPR 绘制。若仍需进一步压缩，可改为按视口切片缓存。
2. **z-order 差异**：烘焙的静态家具先于动态家具绘制，与原数组顺序略有差异；默认场景几乎不重叠，视觉上不可察觉。
3. **音乐恢复**：页面从后台切回时按隐藏前的状态恢复呼噜/扫地机/Lofi，若上层游戏状态在后台被外部改变，声音状态可能不同步。
4. **BufferSource 释放**：`playScratch`、`playHiss`、`playWaterSplash` 依赖 buffer 自然播放结束触发 `ended` 事件来断链，未显式调用 `stop()`。
5. **dt 覆盖范围**：目前只有猫的状态机消费 `dt`，家具与道具仍按帧更新；彻底帧率解耦需要把 `dt` 传入所有 `update()` 并逐模块改造。
6. **音频实例生命周期**：`dispose()` 会关闭 AudioContext，实例不可复用；需要重新 `new SoundEngine()`。
