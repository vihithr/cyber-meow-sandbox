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
| 静态层视口切片缓存 | `app.js` / `environment.js` | 仅缓存当前可见视口切片，相机平移时重建/滚动复用；每帧 blit 从 2 次降为 1 次，显存进一步下降 |
| 渐变缓存 | `environment.js`、`furniture.js` 的 `Sunbeam` | `createLinearGradient`/`createRadialGradient` 不在每帧创建 |
| 落脚面对象复用 | `furniture.js` 各家具的 `getPerchSurfaces()` | 每只猫每帧原本会为每个家具分配一组新对象；改为复用同一数组并原地更新字段 |
| 阴影状态外提 | `environment.js` | 萤火虫 `shadowBlur` 从逐粒子设置改为按天气设置一次 |
| 画布尺寸稳定 | `ui.js` 侍奉台 | 写 `canvas.width/height` 会清空缓冲并重置上下文，不再每帧执行 |
| 实体上限与过期回收 | `app.js`、`toys.js` | 玩具 80、家具 60、猫 40、粒子 240 上限；过期水洼从数组移除 |
| 高 DPI 适配 | `app.js` | 后备缓冲按 `devicePixelRatio`（上限 2）设置，避免模糊且控制填充率 |
| 时间步改造 | `cat.js`、`app.js` | 主循环计算 `dt`（秒，上限 0.05s）传给猫的状态机，按帧递减的关键计时改为 dt 驱动；测试走名义帧回退分支 |
| 自适应画质 | `app.js`、`cat.js`、`environment.js` | 帧间隔 EMA 连续超阈值时降级：DPR 上限 2→1.25→1，跳过猫咪微毛发纹理与部分渐变、关闭发光阴影；持续流畅后自动回升。`Q` 键可手动循环 |
| 猫咪渲染资源缓存 | `cat.js` | 实例级渐变 Map 缓存宝石眼/眼睑/耳/脸/鼻/躯干/肚皮/围脖等 9 类渐变；路径合并（胡须 6→1、虎斑 4→2、肢体链填充合并） |
| 视觉体型校正 | `cat.js` 的 `CAT_VISUAL_SCALE_DENOM` | 渲染设计坐标系身长约 96px，而物理半径仅 22~26px；旧分母 24 让猫看起来约为碰撞体 3 倍大。改为 34 后视觉体长约为碰撞直径的 2 倍，同时降低填充率。改这一个常量即可整体调大小 |

## 5. 健壮性修复摘要

- **状态机死锁**：王座对决补双向 `rival` 引用与空引用兜底；进箱/骑乘增加 600 帧自然退出；抓取时释放 `heldYarn`；大计超时统一清理衍生引用。
- **数值安全**：扫地机目标重合时避免 `0/0`；弹道计算处理非正重力；存档中 0 值正确恢复。
- **异步竞态**：猫咪的延迟 `setTimeout` 回调增加抓取/状态/对象有效性校验。
- **音频**：`AudioContext` 不可用时安装完整 API 形状的空实现；呼噜声启停幂等；扫地机停止—重启竞态消除；音频节点在结束时断链释放。
- **UI**：挑战时长统一为 45 秒并恢复进入前的工具；挑战目标按相机与缩放换算到世界坐标；定时器跨会话清理；DOM 空引用与 `toDataURL` 异常保护。
- **新特性交互修复**：Roomba 的 `spin` 字段从“只写不读”变为带衰减的真实旋转，被跳杀踢飞后的速度自动回落巡航值；`rider` 失效清理增加场景在场校验；桥面下沉尾数归零并清理失效 `occupant`；纸箱被推动时同步箱内猫坐标并校验占用关系。
- **新特性状态机修复**：吊桥对决从死代码变为可触发（`onBridge` 在桥面落脚时同步）；对决结算改为单次判定、双方对称清理，杜绝败者状态残留与双判；空降进箱先释放原占用者；空降目标在场校验按类型区分集合（roomba 在 furniture，猫在 cats，纸箱在 furniture/toys）。
- **音频外部改动加固**：补 `startLofiBGM` 的 `_disposed` 早退（避免 dispose 后定时器泄漏）；噪声缓冲循环改用 `data.length`（静默模式下不再空转写入）。
- **指针边界坐标**：`getWorldPos` 改用 `??` 读取 `clientX/clientY`，`0` 不再被当作缺失值回退到不存在的 `touches`。此前点击画布顶边／左边会把 `NaN` 带入世界坐标，经毛线球持有链污染道具位置，使道具在 Canvas 上静默消失。该问题由 3000 帧压力仿真复现并加入回归断言。
- **视觉体型**：`CAT_VISUAL_SCALE_DENOM` 从 24 经 34 调整到 44，使设计稿约 96px 的身长在缩放后接近 44～52px 的碰撞直径；物理半径、交互判定与存档不受影响。

## 5.5 基于架构评审的后续优化（2026-11-20）

架构评审报告（`docs/ARCHITECTURE_REVIEW.md`）指出的问题中，以下四项已实施，语义轴决策见 `docs/ADR-001-semantic-axis.md`：

- **吊桥可达性**：`CatSuspensionBridge.type` 实际为 `bridge`，但 `cat.js` 用 `suspension_bridge` 判定，导致 `onBridge` 恒为 false、吊桥对决与空降目标分支不可达。统一为 `bridge` 后，这些行为在真实运行中可被触发。
- **渐变缓存泄漏**：远眼宝石渐变 key 含 `rx.toFixed(2)`，而 `rx` 随头部转动逐帧变化，长时间会话会让 `_gradCache` 单调增长。改为固定基准半径建渐变、绘制时用 scale 适配，key 仅依赖虹膜色；另设 64 条容量上限作防御。
- **帧率一致性**：`toys.js` 与 `furniture.js` 的物理积分改用 `sceneContext.dt` 推导的帧步长，阻尼按 `Math.pow(阻尼, step)` 缩放；60fps 时行为与原先一致，其他刷新率下物理演化速度不再随帧率漂移。未传 `sceneContext` 的旧调用退化为 step=1。
- **逃逸可审计**：`app.js` 中直写 `soundEngine.bgmEnabled` 与 `physicsWorld.gravityMode` 两处补 `@escape H4` 标记，落实 H3/H4/D3 裁决；不封死字段、不改变运行时行为。
- **画质手动锁定**：按 `Q` 后设 `_qualityLocked`，`_updateRenderQuality` 早退，自适应不再在帧率回升时把 low 偷偷切回 high。默认仍自动；只有按过 `Q` 才锁定，使"切 low 做性能对照"成为可靠测量手段。

## 6. 测试体系

测试入口为 `node tests/verify.js`，共 **94 项断言**，失败以退出码 1 结束。文件构成：

- `tests/verify.js`：语法编译、核心逻辑、外部新特性行为链断言。
- `tests/dom-mock.js`：最小浏览器 API 桩。canvas 2D 上下文用 Proxy 兜底，`requestAnimationFrame` 只登记回调、不自动执行，因此 `app.init()` 的主循环不会在测试中跑飞，可由测试手动推进单帧；另提供 `pathOps`/`drawImages` 计数器供基准使用。
- `tests/runtime.js`：在独立 VM 中按依赖顺序真实加载全部 8 个模块并触发 `DOMContentLoaded`，覆盖 `environment.js`、`ui.js`、`app.js` 的运行时行为、环境渐变缓存、天气上限、红点目标边界、护照/快照交互、实体上限、DPR、视口裁剪与离屏缓存失效条件、存档往返、喵视角、自适应画质与手动 Q 切换。
- `tests/bench.js`：可复现性能基准（`node tests/bench.js`，可用 `BENCH_FRAMES` 覆盖帧数）。输出每帧渐变创建数、路径操作数、drawImage 次数与 JS 耗时，high/low 两档对比，不设阈值断言。
- `tests/soak.js`：压力与鲁棒性断言。从源码提取全部 22 个状态逐一渲染，并用绘制参数守卫把 Canvas 静默吞掉的 NaN 变成失败；以可控 rAF 时钟推进 3000 帧随机工具切换／点击／天气切换仿真，检查坐标、速度、生理值、实体上限与 rAF 队列；另含异常 dt、画布边界 0 坐标与视觉体型的回归用例。
- `tests/architecture.js`：架构门禁。机械检查公共契约面可枚举、已观测逃逸点的 `@escape H4` 标记、bridge 类型字符串一致、渐变 key 无动态 `toFixed`、物理积分统一走 `sceneContext.dt`；每个守卫附反例注入，确认违规写法会被门禁拒绝（反模式 #7）。

最终实测（Node v24.15.0，300 帧，1920×1080，DPR=2）：

| 指标 | high | low |
|---|---|---|
| 渐变创建数/帧 | 4.0 | 0.0 |
| 路径操作数/帧 | ≈1555 | ≈1410 |
| drawImage/帧 | 1 | 1 |
| JS 耗时/帧 | ≈364 µs | ≈259 µs |

相对专家团入场前的 28 次渐变 / 684 次路径 / 2 次 blit：渐变创建下降约 86%，blit 减半。路径数上升来自外部新增的 5 节腰椎等细节，但其中多数已被合并到更少的 fill/stroke 调用。

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

1. **离屏层显存**：离屏层已改为视口切片缓存并固定 1x 烘焙，显存占用较世界级缓存进一步下降；每帧 blit 为 1 次。大幅相机位移会触发切片重建，属预期行为。
2. **渐变缓存的语义依赖**：猫咪渲染的渐变复用依赖 Canvas 渐变随当前变换矩阵（CTM）变换的标准语义，并通过 `ctx.translate` 补偿动态锚点；主流浏览器成立，若发现视觉偏移应优先检查这些补偿。腿部渐变因 IK 每帧改变跨度而未缓存，是高画质下唯一残留的渐变热点。
3. **自适应画质与新增细节**：外部新增的“5 节腰椎 + 宝石眼 + 微毛发”显著提高了单帧路径数；自适应画质是通用兜底，但自动降级需要约 20 帧判定时间；若首要目标是极限流畅，可直接按 `Q` 切到“流畅”档。降档只跳过微细节，不改行为与可辨识度。
4. **z-order 差异**：烘焙的静态家具先于动态家具绘制，与原数组顺序略有差异；默认场景几乎不重叠，视觉上不可察觉。
5. **音乐恢复**：页面从后台切回时按隐藏前的状态恢复呼噜/扫地机/Lofi，若上层游戏状态在后台被外部改变，声音状态可能不同步。
6. **BufferSource 释放**：`playScratch`、`playHiss`、`playWaterSplash` 依赖 buffer 自然播放结束触发 `ended` 事件来断链，未显式调用 `stop()`。
7. **dt 覆盖范围**：目前只有猫的状态机消费 `dt`，家具与道具仍按帧更新；彻底帧率解耦需要把 `dt` 传入所有 `update()` 并逐模块改造。
8. **音频实例生命周期**：`dispose()` 会关闭 AudioContext，实例不可复用；需要重新 `new SoundEngine()`。
9. **平台验证**：本轮所有性能数字来自 Node + DOM mock，真实浏览器光栅化表现需人工目视确认；建议优先用 `Q` 键切“流畅”档验证瓶颈归属。
10. **关于 ECS / 实例化渲染**：ECS 是数据布局，实例化渲染是 GPU 批量绘制 API，二者不同。本项目使用 Canvas 2D，没有实例化 API；猫是每只姿态/表情各异的程序化矢量图形，没有可复用静态 mesh；当前瓶颈是光栅化而非 draw call 提交；已有 SoA/OOP 基准显示 ≤360 实体下数据布局收益在噪声内。因此不迁移 ECS，也不改 WebGL。
