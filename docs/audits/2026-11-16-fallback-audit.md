# 核心与桌面层回退、异常捕获专项审计

审计日期：2026-11-16。基线 HEAD：6b92b9a28462502cebe7ebb4ac9256ca3734ba29；包版本：0.17.0-beta.11。

本报告为并行任务中的独立只读审计。范围为 src/core、src/desktop 共 74 个源文件。对 fallback、degrade/degradation、default_、conclude、catch、retry、??、||、Zod default/safeParse 进行检索，沿调用者检查行为。排除 UI、构建与打包脚本、依赖包、示例内容本身；示例是否被真实业务自动用作失败兜底仍在审计范围。没有修改产品源码，没有运行全套测试，没有调用真实 AI、用户账户或线上接口。

行号对应上述基线与首次读取时的源文件；主代理可能随后修复，不能把本报告当作修复后的验收结果。开始时已有未跟踪 designs/；审计过程中出现的 tests/prompt-catalog.test.ts、tests/settings-store.test.ts 为其它工作流的改动，本任务未触碰。

## 1. 全景统计与口径

按“触发条件 → 替代行为 → 错误传播”这一语义策略计数。同一策略的多个字段默认、同一函数的重复引用合为一项；相同策略在不同调度器独立实现则分别计数。此数字不是关键字命中次数，也不是“每个 || 都是回退”的统计。

| 判定 | 数量 | 占比 |
| :--- | ---: | ---: |
| 已评估语义回退策略 | 60 | 100% |
| 过度防御 O01–O08 | 8 | 13.33% |
| 合理防御 R01–R52 | 52 | 86.67% |

主要问题集中于把未知内部错误降格为单项内容失败、对未知错误再次付费调用 AI，以及原题来源匹配失败后扩大校验范围。没有发现 API 失效后自动改用另一服务商、模型或本地模板的代码；没有发现 AI 失败后自动用 demo 题目或固定答案伪装成功的代码。API、模板、错题本读取对于损坏文件通常会明确抛错，不能因为存在 catch 就判成吞错。

此外确认一项独立提示词拼装缺陷 P01：动态范围约束被删除；不混入上述回退统计。信任执行器正常返回即完成的契约风险另列 H01，合成 no-op 可以触发，但尚无正规产品执行路径无产出正常返回的证据，不计作已确认过度防御。

## 2. 评估清单

表中“直接报错”是停止未知故障、保留已完成内容；可以识别的模型内容错误仍允许单项失败或有界修正。不是要求任何题目失败都中断整卷。

| ID | 模块/子系统 | 回退点名称及源码位置 | 触发 → 当前行为 | 判定 | 改造动作/保留理由 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| O01 | 英语并行调度 | src/desktop/parallel-generation.ts:64 | 任意 execute 异常 → failed；仅 ServiceStopError 停派 | 过度防御 | 未知错误直接报错；仅内容错误可继续 |
| O02 | 旧顺序调度 | src/core/generation.ts:62 | 任意 execute 异常 → 本项失败，后续继续 | 过度防御 | 同 O01；该入口当前未由 main 调用，仍导出并受测试覆盖 |
| O03 | 语文生成 | src/desktop/chinese.ts:94 | 未知异常 → failed，继续其他项 | 过度防御 | 内容错误以外直接报错 |
| O04 | 英语解析执行器 | src/desktop/generation-service.ts:21、30 | 任意非服务异常 → 标校验失败并再次请求 AI | 过度防御 | 未知错误不重试，保留类型与 cause |
| O05 | 英语单题解析 | src/desktop/ai.ts:117 | 单题处理任意异常 → failed 字符串 | 过度防御 | 仅 GenerationContentError/EvidenceValidationError/ZodError 进入内容失败 |
| O06 | 语文整理 | src/desktop/chinese.ts:38 | 任意非服务异常 → 重试该篇，失败后保留旧篇继续 | 过度防御 | 未知错误停止本次整理，保留原课件 |
| O07 | 通用补齐整理 | src/desktop/organization.ts:59 | 任意异常 → failure 字符串；非 ServiceStopError 继续重试/下一段 | 过度防御 | 仅已分类内容错误可补齐，其余抛出 |
| O08 | 原题来源校验 | src/core/source-fidelity.ts:55 | 题号未匹配 → 返回全卷文字 | 过度防御 | 严格来源校验拒绝该回退；显式报告无法绑定题号 |
| R01 | API 配置 | src/core/ai-settings.ts:12–21；src/desktop/ai.ts:24 | 缺 key/无效 provider、model、URL → ServiceStopError | 合理防御 | 保持现状；失败闭包，不换服务商 |
| R02 | API 网络 | src/desktop/ai.ts:38 | fetch/超时/跳转异常 → 暂停并提示可能计费 | 合理防御 | 保持现状；不自动重发不确定请求 |
| R03 | API 临时响应 | src/desktop/ai.ts:44–47 | 429/5xx → 最多两次有界退避 | 合理防御 | 保留；可响应 Retry-After，勿无限重试 |
| R04 | HTTP 错误解析 | src/desktop/ai.ts:49–55 | 错误体坏 JSON → 停止；明确上下文错误 → 内容失败 | 合理防御 | 保留错误分类；建议给新错误加 cause |
| R05 | API 成功体解析 | src/desktop/ai.ts:57–61 | JSON/读取超时 → ServiceStopError | 合理防御 | 保持现状，未伪造内容 |
| R06 | AI 内容解析 | src/desktop/ai.ts:64–78 | 空内容/坏 JSON/坏 schema → GenerationContentError | 合理防御 | 保留；代码围栏解包是输出兼容 |
| R07 | 响应协议 | src/desktop/ai-providers.ts:56–75 | 响应缺字段、拒答/截断 → 受类型约束报错 | 合理防御 | 保留，无协议猜测或模型切换 |
| R08 | OpenAI schema | src/desktop/openai-schema.ts:4、28 | optional 的 wire null → 恢复 optional；未知 ref 保留原值交 Zod | 合理防御 | 保留；不补造必填字段 |
| R09 | 诊断保留 | src/desktop/diagnostics.ts:12–19 | 诊断写失败 → 附加提示并继续抛原 Error | 合理防御 | 保留；原故障仍传播 |
| R10 | 整理错误证据 | src/desktop/ai.ts:96；chemistry.ts:35；chinese.ts:71 | 整理校验失败 → 写诊断后重抛 | 合理防御 | 保留，未返回默认课件 |
| R11 | 独立练习错误包装 | src/desktop/exercises.ts:15 | 内容失败 → 带 cause 的同类错误；未知错误重抛 | 合理防御 | 保留，是可参考的分类实现 |
| R12 | 练习内容修正 | src/desktop/generation-service.ts:43 | 内容/Zod 错误 → 最多一次附反馈重试 | 合理防御 | 保留；服务和未知错误不重试 |
| R13 | 教学模块修正 | src/desktop/teaching-parts.ts:42 | 内容/Zod 错误 → 最多一次修正；取消/服务故障抛出 | 合理防御 | 保留；候选与来源仍验证 |
| R14 | 教学引用错误 | src/core/learning.ts:30、33 | EvidenceValidationError → 带 cause 的内容错误 | 合理防御 | 保留；未知错误重抛 |
| R15 | 化学生成隔离 | src/desktop/chemistry.ts:70–78 | 内容错误 → 单项失败；服务/未知错误 → stopped | 合理防御 | 保留，未知错误不继续派发 |
| R16 | 化学/语文进度保存 | chemistry.ts:62；chinese.ts:81；src/core/task-pool.ts:10 | status 回调无法 await → catch 空；失败毒化持久化队列 | 合理防御 | 最终 await 会重抛，不是伪保存；可移除非关键磁盘进度写 |
| R17 | 通用整卷到分段 | src/desktop/organization.ts:41–44 | GenerationContentError 且有可识别 scope → 分段补齐 | 合理防御 | 保留；服务/未知错误在此会抛出 |
| R18 | 整理部分成果 | src/desktop/organization.ts:69–74 | 仍缺题/服务中断 → 明确 organizationIssues；零题抛错 | 合理防御 | 保留；不声称整卷完整 |
| R19 | 语文整理复用/保留 | src/desktop/chinese.ts:21–27、40–44 | 已有一致材料/某篇内容失败 → 保留旧篇并列待补齐 | 合理防御 | 保留用户已改内容；O06 单独收窄错误边界 |
| R20 | 校对上下文适配 | src/desktop/proofread.ts:28–35 | 明确上下文拒绝且 >8000 字符 → 细分重试 | 合理防御 | 保留；不按任意异常细分 |
| R21 | 长校对材料 | src/core/proofread-chunks.ts:8–38 | 超限 → 保序拆分；单文本分片 → fragmented | 合理防御 | 保留；无法安全拆分明确报错，不截断原文 |
| R22 | 校对范围聚合 | src/desktop/proofread.ts:45–54 | 分片/任一 partial → 总体 partial，并保留 limitations | 合理防御 | 保留；不是全 False 假报告 |
| R23 | 对照原卷覆盖 | src/desktop/chemistry-review.ts:22–34；chinese.ts:106–109 | 无原卷/图片未核 → partial 与理由 | 合理防御 | 保留文字校对边界 |
| R24 | 自动修改后复核 | src/desktop/main.ts:169 | 再次校对失败 → 保留已保存修改，标 failed/cancelled 与错误 | 合理防御 | 保留；不会假称再次校对通过 |
| R25 | 配置初始值 | src/desktop/main.ts:53–57 | settings.json ENOENT → defaultSettings；其它错误重抛 | 合理防御 | 保留首次启动默认；坏文件不重置 |
| R26 | 系统通知 | src/desktop/main.ts:65–74、226 | 通知不支持/失败 → 应用内显示已保存结果与通知失败 | 合理防御 | 保留外围展示隔离 |
| R27 | 新安装示例 | src/desktop/main.ts:81–84 | 项目目录不存在且空 → 创建明确 example 项目 | 合理防御 | 保留；不是 AI 失败后回填示例 |
| R28 | 对话框/名称 | src/desktop/main.ts:89、111、258–277 | 用户取消 → null/false；空标题 → 未命名课件 | 合理防御 | 保留，属于显式取消/非关键展示默认 |
| R29 | 凭据保留 | src/desktop/main.ts:246–252 | 未输入新 key 且同 provider/baseUrl → 保留原加密 key | 合理防御 | 保留；换连接不沿用旧密钥，加密不可用会报错 |
| R30 | 项目列表隔离 | src/desktop/store.ts:27 | 单课件损坏 → 列出“无法读取”及 error | 合理防御 | 保留；不覆盖原文件或伪造空课件 |
| R31 | 进程中断恢复 | src/desktop/store.ts:16–20、39 | 保存状态 running → interrupted/pending | 合理防御 | 保留；不标 complete，不丢历史 |
| R32 | 项目包清理 | src/desktop/store.ts:57–60 | 导入写失败 → 清 staging 后重抛 | 合理防御 | 保留；可防 cleanup 异常遮盖原异常 |
| R33 | 错题本首次读取 | src/desktop/notebook.ts:9 | ENOENT → []；JSON/schema/权限错误重抛 | 合理防御 | 保留，不吞损坏数据 |
| R34 | 错题本备份/队列 | src/desktop/notebook.ts:10 | 备份 ENOENT/EEXIST 跳过；失败项 reject，但队列可继续 | 合理防御 | 保留；queue.catch 不改变返回 task 的拒绝 |
| R35 | 提示词持久化 | src/desktop/prompt-store.ts:30 | ENOENT → 内置模板；旧 template id → 可识别迁移 | 合理防御 | 保留；损坏 JSON/schema 抛错 |
| R36 | 提示词默认覆盖 | src/desktop/prompt-store.ts:13–23 | 无 override → 内置/当前指令；未注册 → other-id | 合理防御 | 默认本身合理，P01 为组装缺陷另修 |
| R37 | 模板首次列表 | src/desktop/ppt-templates.ts:132 | 模板目录 ENOENT → 内置模板 | 合理防御 | 保留；选定自定义模板损坏仍报错 |
| R38 | 模板解析异常 | src/desktop/ppt-templates.ts:35、40 | 压缩包/XML/编码问题 → 带上下文错误 | 合理防御 | 保留；解码包装可加 cause |
| R39 | 模板关系/几何 | src/desktop/ppt-templates.ts:56–64、120–123 | 布局占位缺属性 → 母版几何；无框 → 有效默认矩形 | 合理防御 | 保留 PowerPoint 继承/空白版式语义，随后验证尺寸 |
| R40 | 模板主题适配 | src/desktop/ppt-templates.ts:109–125 | 主题字体缺值/对比不足 → 系统字体/正文颜色 | 合理防御 | 保留非内容展示适配，关键背景/文字色仍需有效 |
| R41 | 默认导出模板 | src/desktop/export.ts:13、19；main.ts:265 | 旧布尔导出参数/未指定模板 → paper；自定义资源缺失报错 | 合理防御 | 保留旧 API 兼容，不偷偷替换指定模板 |
| R42 | 公式预览 | src/desktop/ppt-formula-preview.ts:13–21 | 无 SVG 则无需转换；有 SVG → 同公式 PNG 预览 | 合理防御 | 保留兼容；资源缺失直接停止，不造空图 |
| R43 | PDF/Word 提取 | src/desktop/documents.ts:22–24、43–45 | PDF 文字不足 → 待 OCR；Word 图片 → 明确原件提示 | 合理防御 | 保留并要求核对，不把“未识别”写成答案 |
| R44 | OCR 旧状态兼容 | src/core/source-fidelity.ts:21–30；manual-ocr.ts:34–35 | 旧 warning/缺数组 → 恢复待核状态；原文改动撤销核对 | 合理防御 | 保留，默认未核实而非默认通过 |
| R45 | 原题文字偏差 | src/core/source-fidelity.ts:57–65 | SourceFidelityError 且给 report → 保留候选并写明差异 | 合理防御 | 保留可编辑待核草稿，整理题 confirmed=false；无 report 直接抛错 |
| R46 | 单来源关联迁移 | src/desktop/ai.ts:89；src/core/organization-coverage.ts:59–66 | 无 sourceId → 唯一 paper 或唯一逐字 stem 来源 | 合理防御 | 保留；多义关联返回 undefined，不用时间戳猜测 |
| R47 | 教学字段兼容 | src/desktop/teaching-parts.ts:14–18；src/core/lesson-deck.ts:29、46 | 同源版本缺 completedModules → 旧完整版本；新模块为空容器初始化 | 合理防御 | 保留格式迁移，不能将新格式空模块标已完成 |
| R48 | 有效旧结果复用 | src/core/logic.ts:5；generation-service.ts:35、48–51；generation.ts:40–45 | 同源/未 stale → 复用练习蓝图、段首或已生成结果 | 合理防御 | 保留明确指纹与原文包含检查，不跨来源猜测 |
| R49 | 基础数据默认 | src/core/model.ts:13–14；chinese.ts:11–16；chemistry.ts:11–18；notebook.ts:8、11 | 缺可选历史字段 → 空值/false/旧模式默认 | 合理防御 | 保留兼容；教学/导出入口仍检查内容与确认状态 |
| R50 | 数量与展示默认 | src/core/generation-counts.ts:4–7；lesson-deck.ts:100–113；task-timing.ts:4；learning.ts:20–23 | 数量0 → 自动限量；无展示字段 → 跳过；不能挖空 → 词义回忆 | 合理防御 | 保留明确产品语义，不补造知识；phase 仅展示 |
| R51 | 安全停止与快照 | src/core/task-pool.ts:2–11 | 任一抛错 → 停派、等待在途后抛原错误；保存队列失败 → 后续拒绝 | 合理防御 | 保留，避免孤儿任务及旧快照覆盖 |
| R52 | 只选可用内容/批量核对 | src/core/lesson-deck.ts:51–97；chemistry-workflow.ts:4、34；chinese-review.ts:25；notebook-source.ts:5–15；notebook.ts:14–19 | 不可用模块不默认勾选；有问题的核对项跳过并返回理由；旧快照/空外围文本可显示 | 合理防御 | 保留，导出显式无效选择会拒绝；不会默认学生版已核对 |

普通的正则无匹配返回 []、数组结束位置 ?? length、findIndex ?? -1 后立即验证、段落结束编号缺失取起始编号、空 modules 表示未选中、对象可选集合初始化，不再拆成独立回退策略。它们没有异常吞并或替代业务分支。未发现 Python except、getattr 或 default_ 命名的相关业务实现。

## 3. 过度防御点详细分析

### O01：未知异常被并行调度器降格为单项失败

位置：src/desktop/parallel-generation.ts:64。触发：执行器的 TypeError、ReferenceError、持久化之外的内部关联错误等。当前仅 ServiceStopError 设置 stopReason，其它所有异常都转换为 failed 字符串，继续派发下一项。任务失败在 UI 可见，问题不是“完全静默”，而是错误类型和中断语义被弱化。

~~~ts
catch(error) {
  t.state=signal.aborted?'pending':'failed';
  t.error=error instanceof Error?error.message:String(error);
  if(error instanceof ServiceStopError)p.job.stopReason=t.error;
}
~~~

影响：内部不变量已破坏时仍继续调用 AI；已知程序错误可能重复发生并增加费用。内存合成复现：4 项任务，第 1 项抛 TypeError，实际 started=4、其余 3 项 complete、stopReason=null。

方案：取消单独处理；GenerationContentError、经过规范化的 EvidenceValidationError/ZodError 可标单项失败继续；ServiceStopError 暂停；其余设 fatal、停止派发、等待在途并保存已完成成果，随后抛原错误或带 cause 的 GenerationInvariantError。提示：“生成内部状态异常，已停止后续任务；已完成内容保留。请查看本地诊断，勿直接重复生成。”不能在任务池尚有在途结果时直接退出并丢失它们。

### O02：旧顺序调度器对未知异常继续执行

位置：src/core/generation.ts:62。触发与 O01 相同。

~~~ts
catch(error) {
  current.state='failed';
  current.error=error instanceof Error?error.message:String(error);
  if(error instanceof ServiceStopError) {
    p.job.stopReason=current.error; await checkpoint(); break;
  }
}
~~~

影响：非 ServiceStopError 继续后续内容；源异常类型、cause 未进入失败模型。目前 main 使用 runParallelGeneration，本函数仍导出，属于旧路径风险，不能声称线上用户已触发。建议与 O01 共用错误分类器；未知错误 checkpoint 后抛原异常，提示“内部生成错误，后续内容已暂停；已保存结果保留”。

### O03：语文生成未区分内容问题与程序故障

位置：src/desktop/chinese.ts:94。

~~~ts
catch(error) {
  if(error instanceof ServiceStopError)stopped=true;
  t.state=signal.aborted?'pending':'failed';
  t.error=error instanceof Error?error.message:String(error);
}
~~~

触发：模块输入构造、关联查找、版本追加或校验器发生任意未知异常。当前只把服务错误视作全局故障。影响：错误的共享语文数据状态可能被后续任务继续使用。

方案：先把 validateChineseResult、练习复核拒绝等可预期错误统一为 GenerationContentError；其余设置 stopped 并保留原异常，持久化/等在途完成后抛出。参考化学路径对未知错误停止派发的现有实现。建议 GenerationInvariantError，提示“语文材料或任务状态异常，已停止后续生成；已有讲评保留”。不能先收窄 catch 却让所有现有普通 Error 内容校验都变成致命错误。

### O04：英语解析把任意错误当作可由 AI 修复的校验问题

位置：src/desktop/generation-service.ts:21–30。

~~~ts
catch(error) {
  if(signal.aborted||error instanceof ServiceStopError)throw error;
  next=structuredClone(p);
  for(const b of batch) {
    const failed=next.job.tasks!.find(x=>x.id===b.id)!;
    failed.state='failed';
    failed.error=error instanceof Error?error.message:String(error);
  }
}
// 随后对 failed 项无条件再次 generateGroup(...)
~~~

触发：generateGroup 中除取消/服务错误外的任何异常。替代行为：把整批标为“校验失败”，再次请求 AI；再次失败时也只有服务错误停派。

影响：程序错误无法靠重写模型回答解决；错误状态会被当作内容反馈发送，增加请求且降低诊断准确性。方案：只修复 GenerationContentError、明确输出边界的 ZodError/EvidenceValidationError；TypeError/ReferenceError 等原样传播。将“AI 返回未知/重复题号”“遗漏解析”等已知失败改为 GenerationContentError。提示分别为“本题解析内容未通过校验，正在修正（1/1）”和“解析内部状态异常，已暂停后续任务”。保留 cause 和诊断编号，不将堆栈/敏感本地信息作为用户资料送模型。

### O05：单题解析 catch 吞并内部异常

位置：src/desktop/ai.ts:117。

~~~ts
catch(error) {
  if(!t)throw Error('第'+q.number+'题解析失败：'+String(error));
  t.state='failed';
  t.error='第'+q.number+'题：'+String(error);
  next.job.errors[t.id]=t.error;
}
~~~

触发：字段校验、证据解析、目标查找、schema 解析、版本追加中的任何异常。回退：有 task 时一律存为 failed；没有 task 时用普通 Error 包装。影响：TypeError 和模型内容不合格无法区分，O04 会进一步重试。

方案：预期缺字段/漏题/引用无效转为 GenerationContentError；仅捕获这些内容错误记录单题失败。未知错误应原样抛出，保留 cause；缺失目标题目/任务映射应 GenerationInvariantError，提示“第 N 题内部关联已变化，未保存本项，后续任务已暂停”。单个坏模型答案不得因此丢弃其它已合法完成题目的版本，仍需保留逐题隔离。

### O06：语文整理对未知错误重试并返回部分旧数据

位置：src/desktop/chinese.ts:38、40–44。

~~~ts
catch(e) {
  error=e;
  if(signal.aborted)throw Error('整理已取消，原课件与已生成讲评保留');
  if(e instanceof ServiceStopError){stopped=true;break;}
  if(attempt===0)onStatus('整理不完整，正在单独重试这一篇…');
}
if(error){issues.push(String(error));retainPrevious();continue;}
~~~

触发：任意非服务/非取消异常；回退：以“遗漏/不完整”理由重试，耗尽后继续其它篇，并把旧材料混入明确带 issues 的结果。保留旧材料本身合理，未知错误走这一分支不合理。

方案：遗漏题、越界题、坏关联等改为 GenerationContentError；只对该类型有界重试。未知错误立即停止整理并抛原异常，不覆盖原课件。建议 OrganizationInvariantError，提示“语文整理内部状态异常，本次结果未替换原课件；请查看诊断记录”。ServiceStopError 可保留当前已明确显示的未整理报告，不继续发送新请求。

### O07：通用分段补齐的后半段放宽错误分类

位置：src/desktop/organization.ts:59–64。整卷入口的 catch 已有正确分类，补齐循环却重新捕获全部错误。

~~~ts
catch(error) {
  if(signal.aborted)throw error;
  failure=error instanceof Error?error.message:String(error);
  if(error instanceof ServiceStopError){stopped=true;break;}
}
~~~

触发：request(part,missing)、mergeMissing 或完整性核对中的未知故障。当前下一 attempt/下一 scope 继续执行。影响：程序故障被记录成“这一段尚未补齐”，错误任务可能浪费额外 AI 请求，merge 部分状态可能进入结果。

方案：ServiceStopError 停止；GenerationContentError 可继续/重试；未知错误必须重抛并保留原课件。mergeMissing 的内部映射不变量错误应 OrganizationInvariantError；提示“补齐结果与当前课件关联异常，本次整理未替换原课件”。普通重复/不属于目标的 AI 行仍可按现有过滤规则忽略，避免把合法分段候选全部丢弃。

### O08：题号绑定失败扩大为全卷文本

位置：src/core/source-fidelity.ts:55；调用于 protectEnglish:72、protectChinese:99。

~~~ts
export function questionSource(sources:Source[],number:string) {
  return numberedSource(sources,number)??sourceText(sources);
}
~~~

触发：原材料未找到 requested number 的明确题号。回退：整份 paper 文本作为该题来源。影响：来自别题、甚至同一课件其它 paper 的文字可满足逐字匹配，使“词句在卷中出现”被当成“该题来源已验证”。返回的数据是真实原文，并非伪造；失真的是绑定强度。合成复现：仅有“1. Original first question”，查询 99 得到第 1 题全文。进一步直接调用实际 protectEnglish/protectChinese，候选题号 99、stem 为第 1 题正文，二者均返回 issues=[]，确认会漏报题号来源错误；语文题仍 confirmed=false，因此未证明可绕过教师核对。

方案：严格来源校验须先限定 q.sourceId，再找题号；未命中抛 SourceBindingError（可继承 GenerationContentError），或记录明确的不可绑定 SourceFidelityIssue 并保持未确认。提示：“第 99 题无法在来源 paper 中定位题号，未验证本题原文；请核对题号、来源或 OCR。”对于非标准题号的旧卷，可提供明确的人工绑定模式，但不能默认返回全卷并沿用已定位的语义。当前整理默认 confirmed=false，可降低误用风险，不能证明来源校验正确。多来源同号的首项命中也应一并修正；那是同一来源收窄问题，而不是多计一条回退。

## 4. 合理防御保留说明

R01–R15、R17、R20–R24 的主要特征是错误显式可见、停止条件明确、仅对可解决的内容错误做有界修正。R25、R33、R35、R37 只对“文件不存在”启用首次启动默认，文件损坏/权限失败仍抛错。R30 把坏课件列为坏课件，不返回空项目；R34 的 catch 用于让下一次编辑仍可排队，原 task 仍拒绝，不能误删。

R16 尤其不能凭 catch(()=>{}) 就判定磁盘错误被永远吞掉：serialSnapshots 的 tail=tail.then(save) 没有恢复失败链，后续 await checkpoint 会收到原保存错误。更清晰的改法是把进度 phase 只发内存事件，开始/结果/结束快照仍 await 磁盘写入，减少 I/O 与失败传播延迟。

R45 不会直接把差异当验证通过：差异显式写 sourceFidelityIssues，整理题默认未确认，教师可以修正后确认。应保留草稿与原材料，不能把所有真实 OCR 差异一律变成无法编辑的中断。R43 的 Word 图片说明不能代替原图逐题核验，但当前说明是明确占位提醒，不是模型答案。R49 的 false、空数组和空字符串主要表示未配置/未确认，实际可用性由生成和导出入口验证。

受审范围没有进程信号递进清理、只读数据库锁快照或只读文件系统转内联写的实现，不虚构相应合理条目。

## 5. 提示词与速度问题

### P01：注册模板后追加的动态约束被静默丢弃（已复现，优先修复）

位置：src/desktop/prompt-store.ts:17–23。

~~~ts
const prefix=registered?prompt.slice(0,prompt.indexOf(registered.instruction)):'';
const instruction=registered?.instruction??prompt.slice(0,at);
const suffix=prompt.slice(at);
return {prompt:prefix+(custom?.instruction??instruction)+suffix};
~~~

当 prompt 为“注册指令 + 动态约束 + 输入标记 + 数据”，instruction 固定取注册指令，suffix 从输入标记开始，中间约束消失。实际调用包括 chinese.ts:62 的当前片段题号、范围和重试修正说明，chinese.ts:87 的 evidence 约束，以及 proofread.ts:25 的分段校对说明（校对 JSON.segment 另有重复副本，所以不能说分段范围完全无约束）。

本地内存执行 PromptBook.compose 后，附加的“必须完整覆盖题号：12、13”检测结果 retained=false。没有 override 也会触发。建议显式以 taskId、instruction、dynamicConstraints、payload 分开传入；若短期保留现有接口，至少将注册指令之后至 marker 的动态部分单独拼回，且自定义模板替换不能删掉动态来源/范围/校验规则。应补无 override、有 override、重试反馈三种针对性测试。这是组装缺陷，不是模型能力不足。

### 可实施的速度改进

1. 先修 P01 和 O04/O06/O07。范围约束丢失与未知错误误重试会增加无效生成，修复可同时减少失败和额外请求；本审计没有真实 API 延迟基准，不能声称提速百分比。
2. src/desktop/teaching-parts.ts:34 对所有模块用 callAI 默认 16384 输出 token；语文 practice 蓝图、练习复核等短输出也默认 16384。按任务 schema 设上限，短蓝图/布尔复核可从 2048–4096 做受限验证；长题面/讲义保留更大预算。必须观察截断率，不能仅凭降低上限就宣称模型生成更快。
3. 词汇/篇章/独立练习的额外 reviewContent 是真实质量闸门，不建议为了速度直接删除。可以减少 review 请求中与判定无关的重复源字段，复用确定的引用目录，保持独立新题与参考答案边界。不得把“上次通过”跨来源当这次已通过。
4. R16 的 phase 每变一次就序列化整个项目并落盘，项目含 base64 图片和历史时开销更大。进度仅内存发送，关键快照落盘并 await，保留取消后已完成内容。需要压测与断电恢复测试后才能判定收益。
5. generation-service.ts:18 有最多四题解析 batch，但 parallel-generation.ts:60 已将 snapshot.job.tasks 过滤为当前一个任务，因此正常并行入口实际上逐题请求。此处“可批处理”的代码目前不产生批量收益。可以删除误导性的死 batch 分支，或在调度器显式实现同篇最多四题组，保持逐题校验、部分成功、依赖和独立重试；不能直接删除 snapshot 过滤，否则会重复领别的 worker 任务。
6. callAI 的 429/5xx 退避最多两次有界合理；可尊重有效且有上限的 Retry-After。网络超时可能已计费，不应为了“快恢复”加入自动换模型或重复发送。

### H01：执行器成功契约加固（合成风险，不计入已确认问题）

parallel-generation.ts:63 将 outcome 非 failed 一律设 complete；旧 generation.ts:61 同类。正规翻译和教学执行器正常返回时不自行标 complete，调度器负责完成状态，这是当前设计契约，不能机械改成“返回 task 不是 complete 就失败”。

合成执行器原样返回 translation='' 的项目，可得到 job.complete。这仅证明该接口信任执行器的边界；没有证明正规 API 路径已经产生无译文的 complete。建议以 discriminated result/outcome 契约和各任务真实产出断言加固（新版本/译文/专项项），不要从不确定状态猜成功，也不要把已有旧版本当成本次新产出。错误建议 GenerationInvariantError：“执行器未返回本项有效产出，未标记完成”。

## 6. 验证记录与复现方法

本任务没有跑全套 Vitest，避免与主代理验证重复。进行了静态调用链审查及一次成功的内存合成运行。首次尝试 esbuild 内存 bundle 因 Windows sandbox 子进程 spawn EPERM 失败；随后改用 TypeScript transpileModule 的进程内 CommonJS require hook 成功，无提权、无产品源文件修改。

执行器与保存回调为合成：没有网络、没有真实磁盘保存成果，结果只能证明错误控制流，不能包装为真实 AI、打包版或线上验证。

~~~text
{"case":"prompt_dynamic_scope","retained":false,"id":"chinese-organize"}
{"case":"unknown_exception_dispatch","tasks":4,"started":4,"state":"partial","complete":3,"stopReason":null}
{"case":"no_output_executor","state":"complete","translation":""}
{"case":"unknown_question_number","result":"1. Original first question"}
~~~

可在仓库根目录把以下脚本以 PowerShell here-string 管道交给 node；只在内存转译，不创建脚本文件：

~~~js
const fs=require('fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}
}).outputText,f);
const {PromptBook}=require('./src/desktop/prompt-store.ts');
const {chineseOrganizeInstruction,chineseSystem}=require('./src/core/chinese-prompts.ts');
const {demoProject}=require('./src/core/demo.ts');
const {planSelectedGeneration}=require('./src/core/generation.ts');
const {runParallelGeneration}=require('./src/desktop/parallel-generation.ts');
const {questionSource}=require('./src/core/source-fidelity.ts');
(async()=>{
  const scope='\n本次只整理当前试卷片段，必须完整覆盖题号：12、13；不要只返回第一篇。';
  const composed=new PromptBook().compose(chineseOrganizeInstruction+scope+'\n输入：{}',chineseSystem);
  console.log('dynamic scope retained:',composed.prompt.includes(scope));
  let p=demoProject();
  p=planSelectedGeneration(p,p.questions.map(q=>q.id),['translation','lexicon','structure','imitation']);
  const started=[];
  const out=await runParallelGeneration(p,new AbortController().signal,async(snapshot,t)=>{
    started.push(t.id);
    if(started.length===1)throw new TypeError('synthetic invariant failure');
    return snapshot;
  },async()=>{});
  console.log({tasks:p.job.tasks.length,started:started.length,state:out.job.state,stopReason:out.job.stopReason});
  console.log(questionSource([{id:'s',name:'paper',role:'paper',kind:'text',
    blocks:[{id:'b',text:'1. Original first question'}]}],'99'));
})().catch(error=>{console.error(error);process.exitCode=1;});
~~~

仍未验证：真实服务计费/质量/速度、Electron 用户交互、正式安装升级、真实磁盘故障注入及主代理修复后的回归。过度防御点的建议需与主代理改动整合后验证；本报告本身不表示这些问题已修复。

## 7. 类型迁移清单与修复进展

先迁移下列确定的模型输出/可预期输入错误，再收窄 O01–O07，避免把所有业务普通 Error 都当程序故障阻断：

| 基线位置 | 应迁移的具体条件 | 建议类型 |
| :--- | :--- | :--- |
| src/desktop/ai.ts:86、94 | AI 材料 ID 重复、题目关联无效 | GenerationContentError |
| src/desktop/ai.ts:104 | 解析未知/重复题号 | GenerationContentError |
| src/desktop/ai.ts:107 | AI 漏题、字段不合格、解析空白 | GenerationContentError；schema parse 保留 cause |
| src/desktop/ai.ts:114–115 | citation 的 EvidenceValidationError、explanationSchema 的输出 ZodError | 只在输出边界转 GenerationContentError |
| src/desktop/chinese.ts:35–36 | 整理漏题、超出当前片段题号 | GenerationContentError |
| src/desktop/chinese.ts:64、66、68 | 无题目、AI 材料来源/块无效、输出重复或引用不存在 | GenerationContentError |
| src/desktop/chinese.ts:91；src/core/chinese.ts:23 | 新练习复核不通过、输出引用与材料不符/图片未核 | GenerationContentError |
| src/desktop/generation-service.ts:36、53 | 蓝图题型不一致、专项无可用项 | GenerationContentError |
| src/desktop/special.ts:8–11 | AI 引用段落/材料不存在，引用未逐字命中，原句/题号/答案/选项/段首句改变，空结果 | GenerationContentError |
| src/desktop/teaching-parts.ts:24 | 原文没有不含空位的完整句子，仅当前模块不适用 | GenerationContentError 或明确 ModuleUnavailableError |
| src/core/evidence.ts | 外部输出引用校验失败 | 保留 EvidenceValidationError，由输出边界统一分类 |

相反，target/任务查找后对 undefined 写字段、任务属于不存在 passage、mergeMissing 内部映射不变量失败、输出之外的 ZodError，不应笼统归类为可由 AI 修正的内容错误。操作前置“请选择/先核对/材料已变化”等本来应阻断当前操作，保留明确输入错误即可。避免按 message 字符串猜测类型。

最小 O08 修复应照顾英语 seven/cloze/grammar 的内联空号：这些题本来就使用全卷与 marker 检查，不应要求每一空都有“数字+点”的独立题号标题。其它题号未命中写 SourceFidelityIssue；多来源按 sourceId/语文 materialIds 收窄。非标准题号的旧卷仍可保留待核草稿，不能默认认作已定位。

主代理反馈的进展（本子任务未独立重跑）：P01 动态后缀已修，34 个模板回归通过；SettingsStore 正在由主代理实现。以上统计维持基线快照，最终修复状态与回归结果以主代理最终验证为准。

随后本子任务独立执行 test-results/release-0.17.0/audit/reproduce.cjs，在主代理当前修改后的工作树中确认：动态范围 retained=true；未知 TypeError 时 4 个任务只 started=1，job.failed 且 stopReason 保留；英语与语文错号 99 都出现明确的“未找到明确题号”来源 issue。该复核仍为无网络、合成执行器与空持久化回调，不覆盖真实 AI、磁盘失败或完整安装应用。原始观测和本次观测分别保存在 baseline-observations.json、post-fix-local-observations.json。

另按主代理分配准备 test-results/release-0.17.0/live/workloads.ts，导出 runWorkloads({s,key,record})。只写 fixture，没有真实调用或密钥读取。覆盖三科整理/校对、英语四教学模块及翻译解析、七类新编练习、语文实际六模块、化学五模块、vision 识别小样。基础预计 30 次请求，含重试的实际 fetch 硬上限 40；金额由主代理外层预算闸门控制。本地构建三科 fixture 均通过 projectSchema；独立 TypeScript createProgram 检查 0 诊断。live/preflight.json 明确标为静态与本地 fixture 检查。脚本将所有结构通过项标为 manual_quality_pending；没有把模型质量、PDF整链识别或真实账户结果标为已通过。

## 8. 正式版修复对照与界面补充审计

O01–O07 已改为仅接受已分类的内容错误进行单项隔离或有界修正；未知程序故障停止后续派发，等待在途操作收尾。O08 已删除找不到题号就扩大到整卷的回退，保留七选五、完形、语法填空本身的空号规则。P01 已修复模板替换吞掉动态后缀，34 个注册模板均覆盖默认与自定义两种回归。H01 没有实际业务无产出成功的证据，不借审计引入重复防御。

界面层追加检索 catch/fallback/degrade/默认值，并按同一语义策略口径核查以下九类；它们显示错误、阻断导出或只清理外围资源，没有发现需删除的静默业务替代。连同核心/桌面层，本次产品运行代码共评估 **69 类策略：8 类过度防御（11.59%），61 类合理防御（88.41%）**。构建脚本没有业务降级；QA脚本中记录失败/失败截图异常隔离不计产品策略。此数字仍不是每个条件运算符或catch语句的数量。

| ID | 模块/位置 | 触发及行为 | 判定与动作 |
| :--- | :--- | :--- | :--- |
| U01 | main.tsx、ChineseWorkspace.tsx、ChemistryWorkspace.tsx | 操作失败就地显示错误，结束busy | 合理，保留 |
| U02 | 三科PreparationGeneration、GenerationControls | 生成/取消失败显示错误，恢复可操作状态 | 合理，保留 |
| U03 | 三科LessonSetup | 组装页失败加入issues并阻断放映/导出 | 合理，保留 |
| U04 | OcrReview.tsx、ocr-page-preview.ts | 预览失败/取消可重试，不自动确认OCR | 合理，保留 |
| U05 | ocr-page-preview.ts | 已完成/取消的worker清理异常被隔离 | 合理，保留资源收尾 |
| U06 | MathText.tsx | 无效公式显示原式及错误，导出仍校验 | 合理，保留可诊断展示 |
| U07 | Notebook、NotebookManager、NotebookEditor | 条目操作失败显示错误；无来源明确保留快照 | 合理，保留 |
| U08 | PptTemplatePicker.tsx | 模板读取/导入失败显示错误，不伪造指定模板 | 合理，保留 |
| U09 | ConnectionSettings.tsx、PromptSettings.tsx | 读写失败就地反馈，保存成功才同步有效配置 | 合理，保留 |

另修复了交互问题：返回入口与保存分开，未保存连接/提示词/错题编辑离开提醒，保存提示词期间锁定编辑；这些属于状态和操作改进，不混入回退统计。连接读取损坏、加密不可用、迁移复制失败继续明确失败，避免覆盖现有数据。

正式版验证汇总见 ../正式版-0.17.0.md。此处基线代码片段保留用于说明因果，不代表修复后的实现。
