# 讲题工作台回退、降级与异常处理专项审计

2026-11-18 · 审计基线 `cea5ea3bb6dd1dc25a6d9d7e8467b202d81c9873` · 基线 `package.json` 版本 `0.17.2`。文件名用于标识本轮工作，源码行号固定在审计基线。稳定版、错题本 Beta 版使用同一套源码，构建开关不同。

## 1. 全景统计与分布

| 判定 | 数量 | 占比 |
| :--- | ---: | ---: |
| 已归类的语义回退策略 | 94 | 100% |
| 过度防御 | 16 | 17.02% |
| 合理防御 | 78 | 82.98% |

优先处理四条会影响外部请求或正式内容的链路。连接删除后会静默切换服务商。原题证据可能归到另一份试卷。协议畸形响应会被当作可修正的内容错误并继续发请求。语文生成可把候选状态为 `insufficient_material` 的任务记为完成。

### 检索范围与计数

- 应用范围为 Git 跟踪的 `src/core` 50 文件、`src/desktop` 32 文件、`src/ui` 65 文件。工具范围为 `scripts` 31 文件、`.github/workflows/ci.yml`、`vite.config.ts`、根入口配置，以及独立的 `designs/lesson-desk-film` 10 个代码或样式文件。校验用例用于核对预期，`tests` 和固定夹具不纳入生产语义点统计。Git 未跟踪的设计草稿、QA 私有数据、依赖、构建产物和二进制资源排除。
- 应用层候选逐模块筛选，重点追到主进程 IPC、模型请求、存储、任务合并、复核和导出等实际入口。表中归类的是触发条件、替代行为及错误传播相同的策略。跨字段的同类初始化合并计数。同一段代码中行为不同的分支分别计数，例如限流重试与服务端错误重发。常规布尔条件、短路渲染、循环哨兵、纯语法分组与数据夹具值不单列。
- 按下列模式可复核宽检索。第一条命中应用 `650` 行，脚本 `92` 行，宣传片源码和样式 `101` 行。原始命中会包含条件表达式等噪声。另检查了隐式替代路径，例如首项或最新版本选取、基于源角色的重绑定、旧数据迁移、恢复快照、状态推导以及经 `finally` 的错误传播。跟踪的 Python 文件在宣传片验证工具中，未发现所列宽泛 Python `except`、`getattr` 或 `or ""` 容错写法。

```powershell
$base = 'cea5ea3bb6dd1dc25a6d9d7e8467b202d81c9873'
$pattern = 'fallback|degrad|default_|conclude|except[[:space:]]+(Exception|BaseException)|getattr\(|[[:space:]]or[[:space:]]|\bcatch\b|allSettled|retry|retries|\?\?|\|\||\.default\(|\.safeParse\(|existsSync|Promise\.race|AbortSignal|fail.?closed'
git grep -n -I -i -E $pattern $base -- src scripts .github vite.config.ts designs/lesson-desk-film
git grep -n -I -E 'finally|\.then\(|\.at\(-1\)|\[0\]|return (null|undefined|false|\[\])|recover|resume|coverage|stopReason|var\(' $base -- src scripts .github vite.config.ts designs/lesson-desk-film
```

本报告的发现来自静态读码及调用链核对。文中的触发用例是可复核的输入和预期后果。未用真实账户调用模型、实测计费、打开桌面应用或运行 QA 脚本。

## 2. 评估清单

「直接报错」包括停止依赖失效前提的步骤、拒绝提交未经证实的状态，以及在对应入口返回可识别的错误。已核实的数据或已经保存的独立成果仍可保留。

| 模块/子系统 | 回退点名称 | 源码位置 | 判定结果 | 改造动作 |
| :--- | :--- | :--- | :--- | :--- |
| API 协议 | O01 畸形协议响应进入模型内容失败 | `src/desktop/ai-providers.ts:57–66` | 过度防御 | 直接报错 |
| API 重试 | O02 所有 5xx 自动重发生成 POST | `src/desktop/ai.ts:43–48` | 过度防御 | 直接报错 |
| 连接设置 | O03 删除活动连接后自动启用首项 | `src/desktop/settings-store.ts:61`，`src/ui/ConnectionSettings.tsx:44` | 过度防御 | 直接报错 |
| 连接设置 | O04 未知配置版本降作旧版 | `src/desktop/settings-store.ts:19–24` | 过度防御 | 直接报错 |
| 生成快照 | O05 吞并后台进度保存失败 | `src/desktop/chemistry.ts:75`，`src/desktop/chinese.ts:82`，`src/core/task-pool.ts:9–11` | 过度防御 | 直接报错 |
| 英语听力 | O06 多份听力原文按全局首个 Text 1 补写 | `src/core/source-references.ts:3` | 过度防御 | 直接报错 |
| 英语写作 | O07 多份答案按首个同类写作标题覆盖 | `src/core/source-references.ts:4` | 过度防御 | 直接报错 |
| 英语补齐 | O08 失效的显式试卷来源重新推断 | `src/core/organization-coverage.ts:57–63` | 过度防御 | 直接报错 |
| 英语与化学整理 | O09 结构结果失败时复用旧卷遮住本次零产出 | `src/desktop/organization.ts:37–48,69–74` | 过度防御 | 直接报错 |
| 语文整理 | O10 整理失败后活动课件保留未重新验证的旧组状态 | `src/desktop/chinese.ts:24–28,41–45`，`src/core/chinese.ts:25` | 过度防御 | 直接报错 |
| 语文生成 | O11 不足材料候选也记成任务完成 | `src/desktop/chinese.ts:94–99` | 过度防御 | 直接报错 |
| 题图 | O12 Word 题图扫描缺预览时按无图通过 | `src/desktop/chemistry-figures.ts:59–61` | 过度防御 | 直接报错 |
| 语文校对 | O13 原卷无文字或仍待 OCR 时可判完整校对 | `src/desktop/chinese.ts:101–107` | 过度防御 | 直接报错 |
| 构建渠道 | O14 直接构建时未知渠道按 stable | `scripts/build-desktop.mjs:2`，`vite.config.ts:2` | 过度防御 | 直接报错 |
| QA 汇总 | O15 中文专测把历史英语结果纳入本轮 PASS | `scripts/preparation-ux-qa.mjs:96` | 过度防御 | 直接报错 |
| 项目恢复 | O16 迟到的化学通知失败消息携带旧项目快照 | `src/desktop/main.ts:214`，`src/ui/main.tsx:52` | 过度防御 | 直接报错 |
| AI 配置 | R01 缺密钥、错误的服务商/地址/模型拒绝请求 | `src/core/ai-settings.ts:11–22`，`src/desktop/ai.ts:24–25` | 合理防御 | 保持现状 |
| AI 网络 | R02 fetch 失败、超时、禁止重定向时闭包 | `src/desktop/ai.ts:31–41` | 合理防御 | 保持现状 |
| AI 重试 | R03 429 按上限退避重试 | `src/desktop/ai.ts:44–47` | 合理防御 | 保持现状 |
| AI HTTP | R04 错误体异常停止，明确超限分类为内容失败 | `src/desktop/ai.ts:49–55` | 合理防御 | 保持现状 |
| AI HTTP | R05 响应体读不到或相应 JSON 坏掉时暂停 | `src/desktop/ai.ts:57–61` | 合理防御 | 保持现状 |
| AI 内容 | R06 代码围栏兼容及空内容、结构错误拒绝 | `src/desktop/ai.ts:64–78` | 合理防御 | 保持现状 |
| AI 内容 | R07 明确模型拒答、截断或无可用正文时单项失败 | `src/desktop/ai-providers.ts:49–70` | 合理防御 | 保持现状 |
| AI 协议 | R08 OpenAI 严格 schema 的 nullable 适配与本地校验 | `src/desktop/openai-schema.ts:4–49`，`src/desktop/ai.ts:75` | 合理防御 | 保持现状 |
| AI 协议 | R09 显式协议路由、拒绝畸形 Claude 图片 | `src/desktop/ai-providers.ts:6–32` | 合理防御 | 保持现状 |
| AI 诊断 | R10 请求预览省略图片、诊断写失败保留原错误 | `src/desktop/ai-providers.ts:37–42`，`src/desktop/diagnostics.ts:7–19` | 合理防御 | 保持现状 |
| 整理诊断 | R11 原输出验证失败写诊断并重抛 | `src/desktop/ai.ts:79,96`，`src/desktop/chinese.ts:72`，`src/desktop/chemistry.ts:42` | 合理防御 | 保持现状 |
| 英语生成 | R12 单题验证失败保留独立成功项 | `src/desktop/ai.ts:104–118` | 合理防御 | 保持现状 |
| 英语生成 | R13 有类型的解析内容错误单题修正一次 | `src/desktop/generation-service.ts:20–31` | 合理防御 | 保持现状 |
| 英语生成 | R14 实际同源练习蓝图复用、缺失重新生成 | `src/desktop/generation-service.ts:34–36` | 合理防御 | 保持现状 |
| 英语生成 | R15 独立练习分类包装，内容失败重做一次 | `src/desktop/exercises.ts:15–18`，`src/desktop/generation-service.ts:37–44` | 合理防御 | 保持现状 |
| 英语生成 | R16 教学模块内容失败带候选修正一次 | `src/desktop/teaching-parts.ts:34–44` | 合理防御 | 保持现状 |
| 英语专项 | R17 重用可在原题确认的段首，仍缺失则停止 | `src/desktop/generation-service.ts:47–53`，`src/desktop/special.ts:5` | 合理防御 | 保持现状 |
| 英语专项 | R18 缺引用、缺参考答案、缺项保持待核实 | `src/desktop/special.ts:8–12` | 合理防御 | 保持现状 |
| 英语证据 | R19 证据格式归一化后回原文，引用失败抛错 | `src/core/evidence.ts:27–37`，`src/core/learning.ts:30–33`，`src/core/proofread.ts:162` | 合理防御 | 保持现状 |
| 化学题图 | R20 无效裁剪坐标修正一次 | `src/desktop/chemistry-figures.ts:19–29` | 合理防御 | 保持现状 |
| 化学题图 | R21 已确认识别单元避免二次付费，清理 PDF | `src/desktop/chemistry-figures.ts:43–58` | 合理防御 | 保持现状 |
| 化学题图 | R22 自动关联已检测的同原卷图片，孤图待核 | `src/core/chemistry-figure-links.ts:6–26` | 合理防御 | 保持现状 |
| 化学生成 | R23 候选待核需标失败，继续/暂停依错误分类 | `src/desktop/chemistry.ts:83–95` | 合理防御 | 保持现状 |
| 语文生成 | R24 内容失败隔离，服务/未知异常停派 | `src/desktop/chinese.ts:95–98` | 合理防御 | 保持现状 |
| 生成并发 | R25 保存和进度有序，首错停派，等待在途 | `src/core/task-pool.ts:2–12`，`src/desktop/parallel-generation.ts:44–68` | 合理防御 | 保持现状 |
| 生成并发 | R26 仅合入当前任务的新增或专属结果 | `src/desktop/parallel-generation.ts:13–35` | 合理防御 | 保持现状 |
| 生成并发 | R27 单项内容错误可继续，未知错误设暂停理由 | `src/desktop/parallel-generation.ts:65–72`，`src/core/generation.ts:63–69` | 合理防御 | 保持现状 |
| 生成恢复 | R28 以内容分任务存档，续跑只挑未完成项 | `src/core/generation.ts:7–24`，`src/desktop/parallel-generation.ts:39–47` | 合理防御 | 保持现状 |
| 生成恢复 | R29 旧来源改变/撤回核对时拒绝续跑 | `src/core/generation.ts:58`，`src/desktop/chinese.ts:80`，`src/desktop/chemistry.ts:63` | 合理防御 | 保持现状 |
| 英语与化学整理 | R30 可修复整卷内容错误改做明确范围分段 | `src/desktop/organization.ts:39–45,51–64` | 合理防御 | 保持现状 |
| 英语与化学整理 | R31 本次新增成果只合入缺题，明示遗漏 | `src/desktop/organization.ts:10–32,47–72` | 合理防御 | 保持现状 |
| 语文整理 | R32 复用段落原文和范围完全匹配的组 | `src/core/chinese-organization.ts:34–38`，`src/desktop/chinese.ts:22–23` | 合理防御 | 保持现状 |
| 语文整理 | R33 分段内容错误限一次重试，服务故障停止请求 | `src/desktop/chinese.ts:33–40` | 合理防御 | 保持现状 |
| 题目范围 | R34 无法识别章节边界时保留完整材料范围 | `src/core/chinese-organization.ts:17–29`，`src/core/organization-coverage.ts:35–46` | 合理防御 | 保持现状 |
| 来源 | R35 缺旧 sourceId 时唯一来源或唯一原句兼容 | `src/desktop/ai.ts:89–92`，`src/core/organization-coverage.ts:60–63` | 合理防御 | 保持现状 |
| 来源 | R36 原题差异写入审阅报告，候选保留且初始未确认 | `src/core/source-fidelity.ts:56–65`，`src/desktop/ai.ts:96`，`src/desktop/chinese.ts:66–71`，`src/desktop/chemistry.ts:32–41` | 合理防御 | 保持现状 |
| 来源 | R37 非业务内容剔除，定位原句失败报告来源缺失 | `src/core/source-fidelity.ts:33–53,70–75`，`src/core/source-references.ts:5` | 合理防御 | 保持现状 |
| PDF/Word 提取 | R38 低文字密度进 OCR，Word 图片留原件提示 | `src/desktop/documents.ts:22–25,39–44`，`src/core/pdf-reading-lines.ts:3–18` | 合理防御 | 保持现状 |
| OCR | R39 缺页号参数表示显式全部待处理，页码上限校验 | `src/core/manual-ocr.ts:4–26`，`src/desktop/ocr.ts:5`，`src/ui/ManualOcr.tsx:6–8` | 合理防御 | 保持现状 |
| OCR | R40 识别无效保留旧文字，识别结果标待复核并保留历史 | `src/core/manual-ocr.ts:29–40` | 合理防御 | 保持现状 |
| OCR | R41 旧预警恢复待核，已验证文字变化后取消确认 | `src/core/source-fidelity.ts:21–31` | 合理防御 | 保持现状 |
| OCR | R42 页面批量原子比对和恢复原页历史 | `src/core/ocr-review.ts:13–52` | 合理防御 | 保持现状 |
| 校对 | R43 明确材料超限时有限细分，单项仍超限报错 | `src/desktop/proofread.ts:30–39`，`src/core/proofread-chunks.ts:27–38` | 合理防御 | 保持现状 |
| 校对 | R44 分片或部分报告降作 partial 并带局限 | `src/desktop/proofread.ts:48–63` | 合理防御 | 保持现状 |
| 校对 | R45 化学无绑定原卷文字、图像未覆盖时标 partial | `src/desktop/chemistry-review.ts:18–32` | 合理防御 | 保持现状 |
| 校对 | R46 语文检出图片或缺原来源时明确文字校对边界 | `src/desktop/chinese.ts:105–107` | 合理防御 | 保持现状 |
| 校对 | R47 复核失败保留已保存修改并标明失败/取消 | `src/desktop/main.ts:149–162` | 合理防御 | 保持现状 |
| 校对 | R48 自动修正无法验证变更时阻断整批，新增缺答案标待处理 | `src/core/correction.ts:56–120` | 合理防御 | 保持现状 |
| 校对 | R49 批量核对跳过不符合条件的题并显示原因 | `src/core/review.ts:5–23`，`src/core/chinese-review.ts:25–39`，`src/core/chemistry-workflow.ts:4–16` | 合理防御 | 保持现状 |
| 配置/导入 | R50 缺存储文件是首次使用，损坏或权限问题冒泡 | `src/desktop/settings-store.ts:18`，`src/desktop/notebook.ts:10`，`src/desktop/prompt-store.ts:33` | 合理防御 | 保持现状 |
| 配置 | R51 显式旧连接保留密钥，同端点允许留空保持之前密钥 | `src/desktop/settings-store.ts:26–29,44–58`，`src/desktop/main.ts:50–53` | 合理防御 | 保持现状 |
| 配置 | R52 连接预设、空名称、自动生成数量缺省 | `src/core/ai-settings.ts:24–27`，`src/core/generation-counts.ts:4–8`，`src/desktop/settings-store.ts:53–54` | 合理防御 | 保持现状 |
| 配置 | R53 提示词无 override 使用现有模板，旧 ID 按模板迁移 | `src/desktop/prompt-store.ts:12–37` | 合理防御 | 保持现状 |
| 持久化 | R54 短时文件锁下有限重试同一次原子替换 | `src/desktop/atomic-rename.ts:7–14` | 合理防御 | 保持现状 |
| 持久化 | R55 独立设置/错题本请求失败后队列可接着收新请求 | `src/desktop/settings-store.ts:31–41`，`src/desktop/notebook.ts:11` | 合理防御 | 保持现状 |
| 持久化 | R56 单损坏课件在只读列表中标出可定位的错误 | `src/desktop/store.ts:22–33` | 合理防御 | 保持现状 |
| 持久化 | R57 中断恢复时 running → pending/interrupted | `src/desktop/store.ts:16–21,43–46` | 合理防御 | 保持现状 |
| 持久化 | R58 导入/迁移临时目录失败清理并抛出 | `src/desktop/store.ts:49–61`，`src/desktop/data-home.ts:10–16` | 合理防御 | 保持现状 |
| 持久化 | R59 首次启动按已知目录迁移，显式隔离用户目录跳过 | `src/desktop/main.ts:43–47`，`src/desktop/data-home.ts:5–16` | 合理防御 | 保持现状 |
| 持久化 | R60 首次启动示例和显式浏览器预览 | `src/desktop/main.ts:76–79`，`src/ui/main.tsx:49–53,69`，`src/ui/api.ts:9–10` | 合理防御 | 保持现状 |
| 持久化 | R61 老格式缺可选展示字段、任务集合、复测记录 | `src/core/model.ts:14–20`，`src/core/chemistry.ts:11–18`，`src/core/chinese.ts:11–17`，`src/core/notebook.ts:8–11` | 合理防御 | 保持现状 |
| 课件 | R62 列表/呈现优先用有效的同源历史，草稿不可导出 | `src/core/lesson-deck.ts:25–50`，`src/core/chinese-lesson-selection.ts:6–27`，`src/core/chemistry-workflow.ts:31–33` | 合理防御 | 保持现状 |
| 课件 | R63 未选内容默认按可用模块，显式无效范围返回原因 | `src/core/lesson-deck.ts:52–97`，`src/core/chinese-lesson-selection.ts:28–55`，`src/core/chemistry-workflow.ts:34–43` | 合理防御 | 保持现状 |
| 课件 | R64 老讲义完成字段/练习字段兼容及未生成占位文案 | `src/desktop/teaching-parts.ts:14–19`，`src/core/logic.ts:5,58–66`，`src/ui/LearningPanel.tsx:7–12` | 合理防御 | 保持现状 |
| 课件 | R65 词义回忆在挖空不可靠时显示词条原文形态 | `src/core/learning.ts:19–24` | 合理防御 | 保持现状 |
| 错题本 | R66 原题消失时保留已有快照，采用源变化须明示选择 | `src/desktop/notebook-handlers.ts:13–17`，`src/core/notebook-source.ts:9–26`，`src/ui/NotebookEditor.tsx:13` | 合理防御 | 保持现状 |
| 错题本 | R67 教师版用历史字段兼容，学生版必须明确确认 | `src/core/notebook.ts:14–19` | 合理防御 | 保持现状 |
| 模板 | R68 库从未创建显示内置项，指定模板无效时拒绝切换 | `src/desktop/ppt-templates.ts:130–153`，`src/desktop/export.ts:13–20` | 合理防御 | 保持现状 |
| 模板 | R69 加载版式按母版继承，缺布局可推导矩形，强制边界检查 | `src/desktop/ppt-templates.ts:53–65,107–125` | 合理防御 | 保持现状 |
| 模板 | R70 缺字形或色彩对比不足，用通用字体/高对比色 | `src/desktop/ppt-templates.ts:111–127` | 合理防御 | 保持现状 |
| 导出 | R71 同一公式绘制 SVG 与可用 PNG 预览，错误阻断导出 | `src/desktop/ppt-formula-preview.ts:6–21`，`src/desktop/export.ts`，`src/desktop/notebook-output.ts:7–8` | 合理防御 | 保持现状 |
| UI 边界 | R72 用户取消、重复取消、空白标题和无前端桥接 | `src/desktop/main.ts:83–96,108–113,235,245–266`，`src/ui/api.ts:9–10` | 合理防御 | 保持现状 |
| UI 边界 | R73 明确显示 UI 请求/编辑/启动失败 | `src/ui/main.tsx:48–61,79`，`src/ui/ChemistryWorkspace.tsx:33`，`src/ui/ChineseWorkspace.tsx:33`，`src/ui/ConnectionSettings.tsx:12,18`，`src/ui/PromptSettings.tsx:9–11`，`src/ui/Notebook.tsx:15`，`src/ui/NotebookManager.tsx:19`，`src/ui/NotebookEditor.tsx:13–14`，`src/ui/PptTemplatePicker.tsx:13,21` | 合理防御 | 保持现状 |
| UI 状态 | R74 课件预排、任务恢复状态、公式和原页加载不可用时明示 | `src/ui/LessonSetup.tsx:11`，`src/ui/ChineseLessonSetup.tsx:10`，`src/ui/ChemistryLessonSetup.tsx:7`，`src/ui/preparation-state.ts:11–25`，`src/ui/TaskProgressLabel.tsx:5–8`，`src/ui/MathText.tsx:4`，`src/ui/ocr-page-preview.ts:18–61`，`src/ui/OcrReview.tsx:30–70` | 合理防御 | 保持现状 |
| UI 通知 | R75 通知不支持或发送失败时仍可查应用内结果 | `src/desktop/main.ts:59–69,207–216` | 合理防御 | 保持现状 |
| 工具链 | R76 明确选择发行渠道，缺参数默认稳定，失败退出；QA 测试清理/截图失败保护原错误 | `scripts/build-channel.mjs:6–14`，`scripts/package-release.mjs:5–8`，`scripts/verify-release.mjs:7–23`，`scripts/chemistry-ui-qa.mjs:24`，`scripts/chinese-shared-workflow-qa.mjs:59`，`.github/workflows/ci.yml` | 合理防御 | 保持现状 |
| 线下预算工具 | R77 缺用量保留成本预留并暂停，未结预留阻断恢复 | `scripts/live-budget-guard.cjs:3–5`，`scripts/live-openai-budget.cjs:16–37` | 合理防御 | 保持现状 |
| 宣传片工具 | R78 预览和编辑辅助失败后保留原媒体路径、默认播放参数或按钮状态 | `designs/lesson-desk-film/animations-v3.jsx:286–338,363–396,854–876,1310`，`designs/lesson-desk-film/tweaks-panel.jsx:357–363,617–619,708–718`，`designs/lesson-desk-film/watch.html:2` | 合理防御 | 保持现状 |

## 3. 过度防御逐项分析

所引片段取自审计基线。建议中的新错误类用于说明要保留的故障语义。

### O01　畸形响应被当成可修正内容

**位置** `src/desktop/ai-providers.ts:57–66`。触发条件为 HTTP 2xx 且 JSON 可解析，但 Claude 缺失 `stop_reason`，或 Chat Completions 缺 `choices[0].finish_reason`。例如误把网关另一套协议的成功对象当作指定协议响应。

```ts
if (data.stop_reason !== 'end_turn') throw new GenerationContentError('Claude输出未完整结束，本次结果未保存，请重试');
// …另一协议分支…
if (data.choices?.[0]?.finish_reason !== 'stop') throw new GenerationContentError(data.choices?.[0]?.finish_reason === 'length' ? '生成内容达到输出长度上限，请缩小题组后重试' : 'AI输出未完整结束，请重试');
```

**后果** `generation-service.ts:20–31` 把这类失败当单题修正，再发一次。并行调度仍会派发其他任务。用户会收到重试提示，实际前置问题可能是 API 协议或网关配置不对。

**改造** 优先验证响应形状和结束状态。对字段缺失、类型错误、未知协议形状抛 `ServiceStopError`，提示“当前连接响应不符合所选 API 协议，生成已暂停。请在连接设置核对服务商和基础地址。”已识别的截断、拒答和内容结构不符保留 `GenerationContentError`。离线回归可让不同协议返回 HTTP 200 加 `{}`，检查请求次数和后续任务是否停止派发。

### O02　5xx 的生成 POST 自动重发

**位置** `src/desktop/ai.ts:43–48`。接口或代理返回任一 `5xx` 时，同一请求体按一秒、两秒退避，最多总计三次。调用没有请求幂等键，错误体在分支之前也未用于判断请求是否已执行。

```ts
if ((r.status === 429 || r.status >= 500) && attempt < 2) {
    onRetry(`服务暂不可用，正在重试 ${attempt + 1}/2`);
    await new Promise<void>((resolve, reject) => { const t = setTimeout(resolve, 1000 * 2 ** attempt); signal.addEventListener('abort', () => { clearTimeout(t); reject(Error('已取消')); }, { once: true }); });
    continue;
}
```

**后果** 上游已收到请求但网关返回 502/504 时，第二次请求可能重复生成或计费。该风险来自调用链，基线审计未实际验证云端计费。限流例外另见 R03。

**改造** 无法确认执行状态的 `5xx` 抛 `ServiceStopError`，提示“服务端返回 HTTP 504，无法确认请求是否已执行或计费。已暂停后续内容，请检查服务状态后手动继续。”如将来能证明具体响应不执行或服务端明确支持该请求的幂等重试，可为该协议恢复有限重试。回归验证 502/504 只发送一次。

### O03　删除活动连接时自动启用剩余首项

**位置** `src/desktop/settings-store.ts:61`、`src/ui/ConnectionSettings.tsx:44`。当前连接被删且仍有其他连接时，第一项立即变成活动连接。UI 确认仅提删除所选连接及其密钥，成功反馈仅提删除。

```ts
remove(id:string){return this.mutate(book=>{if(!book.profiles.some(p=>p.id===id))throw Error('连接已不存在');book.profiles=book.profiles.filter(p=>p.id!==id);if(book.activeId===id)book.activeId=book.profiles[0]?.id||'';});}
```

**后果** 下一次生成调用 `credentials()` 读取新的活动服务商、模型和 Key。删除动作自身不发请求，后续正常生成可把试卷或 OCR 原页送到用户没有显式选择的新端点。基线的 `tests/settings-store.test.ts:16` 固定了自动切换行为，改造时应更新此契约。

**改造** 删除当前连接后清空 `activeId`，保留其它记录，直到用户明确执行「使用此连接」。生成入口抛 `ServiceStopError`，提示“当前没有启用的连接，请在连接设置选择并启用连接。”同步调整配置簿 schema，允许有记录但无活动项，并让 UI 显示这一状态。

### O04　未知连接配置版本按旧版读取

**位置** `src/desktop/settings-store.ts:19–24`。根对象的 `version` 非 `1` 时直接交给旧单连接解析。

```ts
if(raw.version===1)return bookSchema.parse(raw);
// Legacy configuration is migrated in memory; the original file remains
// intact until an explicit successful save.
const connection=connectionSettings(raw),id='legacy';
const encryptedKey=z.string().optional().parse(raw.encryptedKey);
return {version:1,activeId:id,profiles:[{...connection,id,name:providerPresets[connection.provider].label,encryptedKey}],...generationCounts(raw)};
```

**后果** 未知版本若碰巧保留旧字段，会被读成单连接，显式保存时还可以覆盖原文件。缺通用字段时会报告“服务商无效”等非版本错误，无法指出升级或降级期间的真实原因。

**改造** 对已标版本先严格验证，只迁移经旧格式 schema 识别的无版本对象。遇到未知版抛 `UnsupportedSettingsVersionError` 或有明确码的 `ServiceStopError`，提示“此连接文件版本不受当前程序支持，请用支持该版本的程序打开。文件已保留。”

### O05　后台进度保存的首错未及时传播

**位置** `src/desktop/chemistry.ts:75`、`src/desktop/chinese.ts:82`、`src/core/task-pool.ts:9–11`。重试等待或内容复核阶段调用 `status`。若文件只读、磁盘空间不足或原子替换失败，进度快照写入拒绝。

```ts
const status=(message:string)=>{task.phase=phaseFor(message);void save(next,message).catch(()=>{});};
```

```ts
return (value:T,message='')=>{const snapshot=structuredClone(value);tail=tail.then(()=>save(snapshot,message));return tail;};
```

**后果** 接下来的网络阶段可能已经发出。后续有等待的检查点会收到拒绝，整次操作最终仍失败。进度写本意是让用户看状态，进入同一保存队列后却使后续成果不能提交，且报错晚于首次故障。

**改造** 阶段消息只发 UI，保留对任务开始和结果落盘的等待。确需持续持久化状态时，让检查点的拒绝进入调度停止并附 `cause`，例如 `ProjectCheckpointError`，提示“课件写入失败，已停止发出后续请求。请检查存储目录和可用空间。”测试应断言进度发布失败和持久化失败的传播边界不同。

### O06　听力材料按全局第一个 Text 1 关联

**位置** `src/core/source-references.ts:3`，入口 `src/desktop/ai.ts:96`。若有多卷答案或独立听力来源，或在同一份答案里有多个听力篇目，函数把全部 `answer/listening` 合并，取第一处 `Text 1` 后所有块。

```ts
const answer=p.sources.filter(s=>s.role==='answer'||s.role==='listening').flatMap(s=>s.blocks);
// …
const texts=answer.slice(listeningStart).filter(b=>!footer(b.text));
// …对满足筛选的听力篇目…
a.paragraphs=texts.map(b=>({...b}));
```

**后果** 单个听力篇目可能被混入其它卷原文。多个空篇目会拿到相同文本，存在后续举证、讲解和课件展示引用错误的路径。该回退在 `protectEnglish` 完成后运行，新增文本没有再按当前篇目绑定来源。

**改造** 仅使用明确来源及可定位的篇目边界补写。跨源或同源多解时抛 `GenerationContentError` 子类 `SourceBindingError`，提示“听力原文有多个候选，无法确定与当前篇目对应的材料，请选择来源并核对。”避免对确定的同一歧义自动反复请求，可在模型调用前进行确定性检测。

### O07　写作答案按全局首个标题覆盖

**位置** `src/core/source-references.ts:4`。当前项目恰有一项写作或续写，但上传了多份同类答案，甚至将含类似标题的听力源也纳入匹配。

```ts
const section=answer.findIndex(b=>type==='writing'?/第一节.*应用文/.test(b.text):/第二节.*读后续写/.test(b.text));
// …
targets[0].answer='参考范文（来自上传答案，非唯一答案）\n'+text;
```

**后果** `targets.length===1` 仅排除目标重复，无法证明答案唯一。`findIndex` 取最早的文本块，可能覆盖原模型所保留的正确答案并改写题干尾部。“来自上传答案”只说明文字来源，不能证明它对应当前题。

**改造** 按纸卷和答案的明确绑定，加来源内唯一节与边界验证。已有答案保持原样，绑定歧义返回 `SourceBindingError`，提示“第 X 题检测到多份参考范文，请选择对应答案来源。参考答案尚未替换。”应覆盖两个答案交换上传顺序用例。

### O08　失效的显式 `sourceId` 被自动重新推断

**位置** `src/core/organization-coverage.ts:57–63`。项目曾记录题目来源，但关联来源已不属于当前 `paper`，代码继续按唯一纸卷或题干文字匹配旧卷。

```ts
const sources=p.sources.filter(s=>s.role==='paper');
if(q.sourceId&&sources.some(s=>s.id===q.sourceId))return q.sourceId;
if(sources.length===1)return sources[0].id;
```

**后果** `missingOrganizationTargets()` 接受推断值参与覆盖决策。只保留一份新纸卷时，旧题即使与新卷无关也可能被认为已覆盖，使应补的同号新题不再运行。缺省字段的旧数据兼容为 R35。

**改造** 有 ID 但不匹配时返回如 `invalidSourceId` 的显式诊断，写入整理缺失，并阻断使用该绑定。直接使用题目的请求抛 `SourceBindingError`，提示“第 X 题原试卷来源已不存在，请重新指定整理来源。”没有字段时才用可验证的旧版兼容。

### O09　重整第一次失败后以旧课件判定本次完成

**位置** `src/desktop/organization.ts:37–48,69–74`。普通全卷重整遇到 `GenerationContentError`，存在能识别的题号范围，且当前旧课件恰好覆盖这些目标。`next` 初始就是旧课件，异常在这里没有保存到 `failures`。

```ts
let next=structuredClone(p),stopped=false;
// …
try{next=await request(p);}catch(error){
 if(signal.aborted||error instanceof ServiceStopError||!(error instanceof GenerationContentError)||!scopes.length)throw error;
 status('整卷返回不完整，改为分段整理');
}
// …
let missing=missingOrganizationTargets(next,scope.targets);
if(!missing.length)continue;
```

**后果** 不发分段请求，`remaining` 和 `failures` 也都为空。后续状态会是“整理完成”，主入口保存旧课件。真实流程可以构造旧题完整、整卷响应校验失败两条件触发。

**改造** 以这个操作实际获得且验证通过的新数据决定本次是否完成。若普通重整没有新增验证结果，重抛首个 `GenerationContentError` 或其带 `cause` 的包装，提示“本次整卷整理未产生可用结果，原课件仍可使用。请查看诊断后重试。”显式「补齐」依据旧卷计算缺题仍有效。

### O10　语文失败篇目沿用旧的确认状态

**位置** `src/desktop/chinese.ts:24–28,41–45`、`src/core/chinese.ts:25`。语文整理由已受改动的原卷文本开跑，旧组没有通过 `reusableChineseGroups()` 的原文一致性检查。该篇整理失败后 `retainPrevious()` 只按题号范围和同 source ID 选择旧组。

```ts
const retainPrevious=()=>{
 const previous=(p.chinese?.groups||[]).filter(g=>!groups.some(saved=>saved.id===g.id)&&g.questions.length&&g.questions.every(q=>section.numbers.includes(q.number.match(/^\d+/)?.[0]||q.number))&&g.materials.some(m=>m.sourceId===section.source.id));
 groups.push(...structuredClone(previous));
};
```

**后果** 有明确“待补齐”报告，旧组也确实有价值。风险是旧题和讲义的 `confirmed` 与原指纹仍有效，导出选择的检查只用当前组数据重算，不比较已变化的原卷块。旧稿据此可作为本次活动内容继续输出。

**改造** 失败篇目可进入历史或以待重验状态留在活动课件。材料块身份或内容已有变化时阻断使用该篇，报 `SourceBindingError`，提示“《X》对应原卷已改动，本次整理未通过。旧讲义已保留，重新核对来源后方可导出。”完整原文匹配仍允许复用。

### O11　语文待核实或材料不足仍被记为任务完成

**位置** `src/desktop/chinese.ts:94–99`。返回合法非空正文块，但 `result.status` 为 `insufficient_material` 或 `needs_review`。本地还会在缺答案时主动将 `ok` 改成 `needs_review`。

```ts
if(t.module==='analysis'&&qs.some(q=>!q.answer.trim())&&result.status==='ok'){
 result.status='needs_review';result.notices.push('缺少参考答案，AI建议须经教师核实');
}
// …追加 confirmed:false 的版本后…
t.state='complete';
```

**后果** 批次可能显示全部已保存，并排除在续跑范围外，导出仍会因 `chineseAvailable` 拒绝。系统还能显示候选及待核文案，假状态具体在任务完成计数和恢复边界。化学流程已对非 `ok` 时的任务状态做区分。

**改造** 区分“成功存档候选”和“生成可进入下一环节”。对材料不足/内容未通过使用 `GenerationContentError` 的单项失败语义，状态留作可重试，提示“《X》材料不足，当前讲义待核实。候选已保留，请补齐材料后继续未完成项。”普通 `ok` 但未经教师确认仍可记生成已完成。

### O12　旧 Word 缺预览按没有图片处理

**位置** `src/desktop/chemistry-figures.ts:59–61`，`previewHtml` 在 `src/core/model.ts:17` 允许缺省。输入课件引用 `.docx`，但旧数据或导入数据没有保留提取预览。

```ts
}else if(source.kind==='docx'){
 const images=wordFigureInputs(source.previewHtml||'');
 for(const [index,{data,contexts}] of images.entries()){
```

**后果** 实际 Word 可能含题图。代码不会读取原档或提示未扫，空列表之后正常进入化学试卷整理。没有图片和没有图像输入两种状态无法区分。

**改造** 从现存附件按正常 Word 提取路径重建预览，读取失败或附件不可用时抛 `GenerationContentError` 子类 `SourceImageError`，提示“《X》的 Word 题图无法读取，请重新导入原文件后整理。”真实成功解析且无图片时才按零图片继续。

### O13　语文校对有来源条目就可能判完整

**位置** `src/desktop/chinese.ts:101–107`。来源数组非空，但仅有答案文件、纸卷正文为空、或源文件含待 OCR/待复核页。用户仍可从已有材料组发起文字校对。

```ts
if(!p.sources.length||d.groups.some(g=>g.materials.some(m=>m.image))){
 result.coverage='partial';result.limitations.push('原页图像未在本次文字校对中核验，仍需教师对照原件。');
}
```

**后果** 若模型回填全部题目 ID 且 `coverage='complete'`，此入口只做题号穷尽验证，不验证可用原卷覆盖。可能存下声称对照完原卷的报告。英语入口有可用原材料和待 OCR 检查，化学入口还检查纸卷绑定并降为 partial。

**改造** 待 OCR/待核实以及无可比对原卷文字时，在调用前抛 `GenerationContentError`，提示“语文校对需要可对照的试卷原文。请完成原页识别和核对后重试。”已具备部分可核对绑定时，才允许明确 `partial` 并列出缺失范围。

### O14　直接构建忽略环境里的错误发行渠道

**位置** `scripts/build-desktop.mjs:2`、`vite.config.ts:2`。直接运行这两个入口时例如 `LESSON_DESK_CHANNEL=betaa`，比较表达式为 false，输出 stable 目录。

```ts
const beta=process.env.LESSON_DESK_CHANNEL==='beta',directory=beta?'dist-desktop-beta':'dist-desktop';
```

**后果** 可用产物成功构建，但缺少错题本，可能覆盖同目录正常稳定构建。`npm run build:beta` 经已校验的 `build-channel.mjs`，该常规包装路径已拒绝无效渠道。

**改造** 共用一个只接受未指定、`stable`、`beta` 的校验方法。显式非法值抛 `RangeError`，提示“无效的 LESSON_DESK_CHANNEL，支持 stable 或 beta。”在入口写产物前失败。

### O15　部分 QA 继承未验证旧记录并写全局 PASS

**位置** `scripts/preparation-ux-qa.mjs:96`。传 `--chinese-only` 时会从历史 `qa-results.json` 复制英语结果，但不校验旧报告 `result`、对应版本或英语检查条目是否齐全。

```js
if(process.argv.includes('--chinese-only')){
 const previous=JSON.parse(await fs.readFile(path.join(out,'qa-results.json'),'utf8'));
 results.push(...previous.results.filter(r=>r.subject==='english'));
}else{await englishChecks();}
await chineseChecks();
```

**后果** 中文检查当前成功即可输出公共 `result:'PASS'`。前一次英语不完整、来自旧构建或失败也可被本轮继承，构成 QA 报告的假验证范围。这里只检查合成 IPC 路径，即使正常通过也不能算真实模型验证。

**改造** 中文模式只发布明确 scope 的中文报告。若聚合为全套，必须核验旧项的来源、构建标识、通过结果和全部检查覆盖，否则抛 `Error('英语验证记录不可用于本轮合并，请执行完整 QA')` 并输出非成功状态。

### O16　化学通知补救可把陈旧状态推回工作区

**位置** `src/desktop/main.ts:214`、`src/ui/main.tsx:52`。后台通知异步触发 `failed`，此时用户可能已修改课件或打开了另一项目。

```ts
n.on('failed',()=>progress(result,'结果已保存；系统通知发送失败，请在应用中查看。'));n.show();
```

```ts
return window.desk.onProgress(({ project, message }) => { if(project)setP(project); setMsg(message); });
```

**后果** `progress(result,…)` 的 `result` 是这次旧生成结束时的快照。前端未对项目 ID 或版本做比对，会用快照更新活动项目。通知报错本身只应影响状态提示，回退可能导致假项目状态覆盖最新 UI。主进程没有在此直接改磁盘。

**改造** 在通知发送边界单独报告通知投递错误，如通过仅含 `message` 的事件提示“结果已保存。系统通知发送失败，可在应用内查看。”不用把非关键通知异常升级成整个生成失败。可用合成 `Notification` 的迟到 `failed` 事件验证更换项目后工作区保持当前项目。

## 4. 合理防御保留理由

| 条目 | 触发条件、替代行为与保留理由 |
| :--- | :--- |
| R01 | 缺 key、服务商不在枚举、模型名为空或地址无效时，在网络调用前拒绝。配置失败保持明确，端点不变。 |
| R02 | 连接断开、超时或被拒绝的重定向使调用停在当前账号，提示可能计费，由用户检查后继续。 |
| R03 | HTTP 429 有限退避；超过上限后仍由 HTTP 失败流程暂停。可按服务有证据提供的 `Retry-After` 优化。 |
| R04–R05 | HTTP 错误体异常或成功体非法 JSON 暂停。只有显式的容量问题进入分片或内容级失败，避免按泛化错误猜测请求结果。 |
| R06–R09 | 允许完整 JSON 围栏和协议明确要求的 nullable 适配。截断、拒答或坏格式不会提交为可用内容。图片编码和供应商请求路由显式验证。 |
| R10–R11 | 诊断文件写入失败时继续传播原故障，诊断编号或写入失败提示可见。预览省略原图；诊断包含失败候选的文字，取证时应继续使用本地数据边界。 |
| R12–R13 | 独立题目的坏字段不连带丢弃通过校验的兄弟题。仅已分类内容错误获得一次反馈修复，服务和未知错误停派。 |
| R14–R17 | 旧蓝图和段首句都有同源检查。新练习、讲义仍需经过结构和独立复核。内容失败可带反馈有界重做，缺关键段首直接阻断。 |
| R18–R19 | 依据不足留下显式待核。归一化只用于找到原文，最终证据仍是原文片段；无法绑定的证据抛错。 |
| R20–R22 | 坐标非法只重答一次。已保存图像页跳过重复调用；来源内自动绑定找到已识别图片，未绑定图片继续出现在待核说明。 |
| R23–R24 | 内容错误可留在单任务，服务和未知错误停止后续派发。候选状态是否算完成分别受 O11 调整。 |
| R25–R27 | 调度等待在途任务结束，结果按任务所有权合入。持久化依顺序写入，故障中断本队列；服务/内部错误保留暂停原因。可选输入或真正缺失的 task outcome 与执行器契约的回归应分别检查。 |
| R28–R29 | 未完成的历史任务可以续跑，已有有效结果避免重复付费。课件材料、题号关联或核对状态发生变化时要求重新选择。 |
| R30–R31 | 已知全卷内容失败时按检测的资料范围重试。有效新增题独立合入，未完成范围仍显示。O09 另处理本轮没有新成果的情形。 |
| R32–R34 | 原文内容与范围均匹配的语文组可复用。识别不到可靠章节就保留上下文；可识别缺题才分段修复，服务或内部错误不盲目重发。 |
| R35–R37 | 合法旧项目缺 `sourceId` 时，只在可唯一归属的情况下兼容。保真差异记录并以初始未确认候选供教师校订；引用无法定位时给出差异，不捏造确定来源。 |
| R38–R39 | PDF 文字层不足时标记需 OCR，阅读顺序和 DOCX 图片提示让用户核对。原页重识别只在用户明确操作后展开范围。 |
| R40–R42 | 未识别出文字且不是模型报告空白的页面保留原文。成功转录也进入待核，历史、旧警告与批量比对保证可以回查，过时核对状态撤销。 |
| R43–R44 | 确认是容量问题才细分，极端结构仍报错。分片时明确 partial 和文本范围，避免把段落校验当作整卷结论。 |
| R45–R46 | 文字校对未读图片或无法验证原卷时保留局限。原件待核与来源有效性仍需补上 O13 的前置检查。 |
| R47–R49 | 再次校对失败保留已持久化的自动修改，给出失败原因和撤销能力。自动修正保留引用约束，批量确认逐题显示跳过原因。 |
| R50–R53 | 只有文件不存在才初始化或回到内置默认。既有 key 只在同一服务商、同一地址条件下保留，版本不兼容边界见 O04。名称、常用数量、无自定义模板等有明确产品默认。 |
| R54–R55 | 短暂文件锁只重试相同原子替换。设置或错题本的单次写入失败仍返回原拒绝，后续独立操作可以提交。 |
| R56–R58 | 损坏项目在只读清单中保留位置和错误；程序中断后运行状态转为可恢复。导入/迁移先写临时目录，失败清理后抛错。清理也失败时可补多错误传播，仍应保留清理动作。 |
| R59–R61 | 首次启动复制已知旧配置，显式隔离目录保持隔离。样例有明确入口和标识；缺可选字段时按历史 schema 的空、false 或已知旧含义加载。 |
| R62–R65 | 编排只默认选择通过现有效性检查的内容。失效项目给出原因。历史版本、旧模块字段和词义回忆降级属于明确可用的读取和呈现行为。 |
| R66–R67 | 已收录内容保留原快照，无法定位来源时报告原因。教师版兼容既有快照，学生版必须显式审核材料和题面。 |
| R68–R71 | 模板库未建立时可使用内置资源。PowerPoint 继承与合法空白版式支持默认几何，仍要校验边界和指定资源。字体替代、对比度保护和等义公式预览兼容不同阅读环境，关键公式错误拦截导出。 |
| R72–R74 | 取消、空标题、应用桥不存在和资源缺失进入明确的 UI 行为。加载超时或卸载时尽力终止预览 worker，留退出与重试通道；其他页面编辑、任务布置和公式错误均显示原因。 |
| R75 | 系统通知失败后用户可在应用中看已保存结果。通知降级本身应保留，附旧快照的路径另见 O16。 |
| R76 | 包装入口已校验渠道，构建子进程和产物核验失败使流程以非零状态结束。QA 截图、错误记录和关闭窗口避免辅助失败遮挡测试断言。O15 限于历史结果聚合。 |
| R77 | 线下预算脚本的未知用量、超边界请求和未结保留量均暂停，未知成本继续计入上限。不据此推定真实云端账单。 |
| R78 | 宣传片工具的播放位置和微调 UI 为外围辅助。预览获取失败时仍可使用已有媒体路径或下载入口，参数缺省只影响开发预览。 |

### 核对边界

2026-11-16 的[旧审计](audits/2026-11-16-fallback-audit.md)回报过生成调度对未知错误继续派发。当前基线核查到并行、语文和顺序执行路径已经收紧，已归入 R13、R24、R27、R33。旧审计还指出特定解析失败可回退到全卷文字。当前 `protectEnglish`、`protectChemistry` 在没有命中明确题号时会生成来源差异条目，问题集中到了本报告分列的关联与覆盖判断。

在本次静态范围内，没有发现请求服务失败时自动调用本地模型、回填内置教学示例或构造伪造探针报告的生产分支。数据库锁容错、子进程 RPC → SIGTERM → SIGKILL、只读文件系统内联注入属于用户所给分类示例，本仓库没有对应同类生产路径。需要真实网络、计费回执、真实数据和安装环境才能验证的后果均作为静态推断描述。

## 5. 本版改动对照

以下为实现差异的静态复核。第 1–4 节保留原基线、原始分类与建议，测试和构建结果由交付验证单独记录。

| 条目 | 本版实现及覆盖边界 |
| :--- | :--- |
| O01 | Claude 和 Chat Completions 缺协议字段或结束状态不可识别时抛 `ServiceStopError`。明确的拒答与截断仍是内容级。 |
| O02 | HTTP 5xx 立即暂停并提示手动继续，只保留 HTTP 429 的有界退避。 |
| O03 | 删除活动连接把 `activeId` 置空。剩余连接保留，获取生成凭据时提示选用已保存的连接或保存新密钥。 |
| O04 | 对象结构异常与未知的显式版本都直接拒绝。无版本旧连接仍可按旧字段兼容。 |
| O05 | 语文、化学的重试/复核阶段消息走 UI 进度，开始和结果检查点仍等待落盘。阶段消息写盘静默拒绝的路径已移除。 |
| O06 | 听力候选按文档分段，`Text 10` 等不触发 `Text 1` 结束规则。多卷、多目标或多候选进入保真报告，原文不被自动覆盖。分段整理继承整个项目的多卷标记。 |
| O07 | 只扫描答案文档，按同一文件的写作节取范文。多卷、多目标或多候选报告待核并保留原答案。单卷仍可用唯一的答案段落。 |
| O08 | 英语题有显式但失效的来源时不计入覆盖。新生成和批量核对检查失效来源，备课材料区提供手动重选试卷来源。旧任务续跑会在发出请求前重新检查题目与试卷来源。变更来源会撤回原核对状态。 |
| O09 | 普通全卷整理失败且分段没有新增题时重抛原错误。有新增题且复用旧卷时会记录整卷失败。显式补齐的范围保持原语义。 |
| O10 | 旧文本和历史保留，活动旧组的题目与讲义确认撤回，关联任务清除。来源待核状态会拦截编排、直接出片与生成；教师可以对照原卷确认该组。 |
| O11 | 模型明确给出 `insufficient_material` 的有效候选保存后标失败，可继续未完成项。存在可核对候选的 `needs_review` 仍可完成保存并等待教师处理，导出要求维持原确认规则。旧任务没有精确指向本次候选的版本 ID，历史完成记录保留原值；教师可选定范围再次生成。 |
| O12 | Word 缺失或仅含空白的 `previewHtml` 时明确报错，提示重导原文件。 |
| O13 | 待 OCR、待核页或没有可用纸卷正文，在请求前报错。逐组检查来源与非空原文块，待核组或关联不完整的组使报告降为 `partial`。 |
| O14 | 桌面打包子入口与 Vite 都验证渠道，未指定才默认 stable，未知值直接报错。 |
| O15 | 中文专测单独写 `qa-results-chinese.json`，列出本轮科目并仅运行中文；全量模式则写原文件。 |
| O16 | 化学通知失败与同步异常都发送仅含消息的事件，旧课件数据不再经该回调回到当前工作区。 |
