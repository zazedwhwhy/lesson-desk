# 三科备课功能

在 Hermes 中让已连接的模型读取材料、按指定范围生成，最后用本地脚本校验和打包。每个课件包对应一科。若同一请求含三科，分别出包，各用自己的原件和材料 ID。

| 学科 | 可写入工作台原生讲义 | 备课结果 |
| --- | --- | --- |
| 英语 | 逐题讲评、中文译文、句法拆解、篇章脉络、词汇手账、表达迁移、考点演练、专项讲评（选项对证、衔接推敲、完形线索链、写作审题单、续写接续图） | 原卷、答案、听力原文、扫描转录、试卷与讲义校对、带可撤销记录的自动修正 |
| 语文 | 逐题讲评、文本脉络、语言品读、文言译注、写作指导、考点演练 | 材料组与子问、原页图片、扫描转录、对照原卷校对 |
| 化学 | 逐题讲评、知识梳理、题型方法、实验剖析、考点演练 | 试卷整理与跨页题、扫描转录、题图定位和裁切、对照原卷校对 |

## 读取现有提示词和字段

用 SKILL.md 所在目录替换示例的前缀。在 JSON 校验报错时核实对应字段后修正。生成前只读当前学科和目标模块对应的提示词，使用本 Skill 的清单字段保存结果。应用内请求有些字段使用短别名或临时编号，导入清单使用实际材料 ID。

```text
node /path/to/lesson-desk-export/scripts/build-lesson.cjs --reference prompts
node /path/to/lesson-desk-export/scripts/build-lesson.cjs --reference manifest
```

第一条列出当前工作台的提示词目录，包括整理、答题、内容复核和题图定位。只给独立练习生成新题所需的考点、题型、作答限制，不把原卷事实和原答案带到新题中。出题后单独解一遍新题，再核对结构、答案与依据。词汇和篇章也逐项按 `review-lexicon`、`review-structure` 核对。

## 英语专项讲评

将 `{kind,input,result}` 写在篇目的 `special`。类型随题型选择。

| `kind` | 题型 |
| --- | --- |
| `option_evidence` | 阅读、听力 |
| `cohesion` | 七选五 |
| `cloze_chain` | 完形 |
| `writing_task` | 应用文 |
| `continuation` | 读后续写 |

`input` 为 `{material_complete,extra,opening1,opening2,questionIds}`。没有附加要求或段首句时相应字符串留空。续写必须逐字录入两段给定段首句。题目级功能至少选一题。结果按 `--reference manifest` 中相应的 `result` 结构填写。`result.items` 的题号、选项和参考答案必须从清单复制。原文证据的 `source_id` 用篇目 ID、`location` 用从 1 起的 `P1/P2/…`。题干证据的 `source_id` 用题目 ID、`location` 留空。缺材、证据不足或答案冲突写入核对清单，保留可复核的部分。工作台内按实际题面状态确认后使用专项讲义。

## 扫描、校对与修正

这几项可只生成课件包和核对清单。在构建命令末尾加 `--bundle-only`。如后续要出讲义，基于已核对的材料继续生成。

- **扫描识别。** 看得到原页时逐页转录，将每页文字和稳定的段落 ID 写进来源的 `blocks`，每段带 `page`。给来源写 `pageCount` 与 `ocr:[{page,blank,uncertain}]`，真实空页设 `blank:true`，疑字、缺图和无法辨读的公式按页记录。保留原 PDF。默认导入后显示待核对。读不到图像时列明页码和缺失条件。
- **题图定位。** 化学可用 `sources[].figures` 保存原卷题图候选。用 `chemistry-figures` 的规则定位并从原页裁出 PNG 或 JPEG，填 `id,name,kind,description,questionNumbers,page,unit,box,file`。PDF 的 `unit` 等于页码，Word 的 `unit` 是图片序号。坐标按原页左上角归一化到 0–1000。配到题目时填写 `questions[].images`，保留图名、来源、页码和原图。
- **对照校对。** 只有实际读过的题目和来源才列入检查范围。部分覆盖时设 `coverage:"partial"`，在 `limitations` 写未核对的页、图或题。英语写 `project.review:{includeExplanations,result}`，`result` 为 `{coverage,checkedQuestionIds,checkedSourceIds,limitations,findings}`，证据逐字关联来源和文本块。语文和化学直接用 `project.review:{coverage,checkedQuestionIds,limitations,findings}`。语文问题为 `{groupId,questionId,message}`，组级问题的 `questionId` 留空。化学问题为 `{questionId,message}`。校对报告会随课件导入。
- **英语自动修正。** 先从原卷和答案建立可核对的校对报告，再提供 `project.correction:{includeExplanations,plan}`。用 JSON Schema 查看操作字段，证据用清单里的实际来源和块 ID。修正清单中的 `analysis` 时设 `includeExplanations:true`，并用 `beforeVersion:"manifest"` 绑定该题的原解析。脚本用工作台相同的修正校验生成可撤销记录。修正后重新校对，以持有修正记录的课件包为准。语文和化学把疑点写入校对报告，由教师在工作台对原卷核实和修正。

API 连接、软件里的任务进度与续跑、交互放映、工作台模板管理和本地错题本属于工作台功能。通过 Hermes 得到的课件是一份独立导入件。
