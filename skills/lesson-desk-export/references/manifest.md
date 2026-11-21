# 生成输入

UTF-8 JSON 顶层有 `project`、可选 `assets` 和可选 `reviewNotes`。`assets` 把来源 ID 映射到原文件路径，例如 `{"paper":"inputs/paper.pdf","key":"inputs/key.docx"}`。`reviewNotes` 是给教师看的待核对条目数组，写清题号、缺失项和可采取的核对动作。路径以 JSON 所在目录为基准。按授课顺序排列篇目、材料组和题目。

所有学科的 `project` 都需要 `title`、`subject`、`sources`。来源用 `{ "id":"paper", "name":"试卷.pdf", "role":"paper", "kind":"pdf", "blocks":[{"id":"b1","text":"原文逐字摘录","page":2}] }`。`role` 可取 `paper/answer/listening`，`kind` 可取 `pdf/docx/text`。至少提供一个 `paper`。PDF 和 DOCX 在 `assets` 中关联该 ID 对应的原文件；粘贴文本使用 `text`，直接保存原文块。页码从 1 起，未知时省略。尽量把题干和参考答案也放在各自来源的文字块里。各层 ID 用唯一、稳定的英文标识，引用使用实际存在的 ID。

## 英语

在 `project` 中添加 `passages` 和 `questions`。以下是最小示例，实际回答要用老师提交的材料。

```json
{
  "project": {
    "title": "阅读讲评",
    "subject": "english",
    "sources": [
      {"id":"paper","name":"原卷","role":"paper","kind":"text","blocks":[{"id":"p1","text":"The team started early to avoid the heat."},{"id":"stem21","text":"21. Why did the team start early? A. To avoid the heat. B. To catch a bus."}]},
      {"id":"key","name":"参考答案","role":"answer","kind":"text","blocks":[{"id":"a21","text":"21. A"}]}
    ],
    "passages": [{"id":"reading1","title":"Reading A","type":"reading","paragraphs":[{"id":"p1","text":"The team started early to avoid the heat."}]}],
    "questions": [{"id":"q21","number":"21","sourceId":"paper","passageId":"reading1","type":"reading","stem":"Why did the team start early?","options":["A. To avoid the heat.","B. To catch a bus."],"answer":"A","analysis":{"answer":"A","text":"不定式 to avoid the heat 直接交代出发目的。B 项的公交车在文中没有依据。","evidence":[{"blockId":"p1","quote":"to avoid the heat"}]}}]
  }
}
```

`type` 可取 `reading/seven/cloze/grammar/listening/writing/continuation`。`answer` 是参考答案，`analysis.answer` 是解析所得答案。选择题用同一答案编号格式，实质冲突时写真实分歧，构建器会排除该题。题面缺失、模糊或不能和答案绑定时可标 `excluded:true`，略去无法证实的解析和引用。完全读不出题干的条目只记在 `reviewNotes`，注明原卷页码。英语题图由原件保留，现有英语 PPT 导出不支持单题配图。依赖原图作答的题应留待核对。一篇的共用选项池填 `pool`，篇目译文填 `translation`。

词汇手账用篇目的 [`lexicon` 数组](lexicon.md)。只做篇目级内容时设 `questions: []`，原文来源仍保留。要加句法拆解、篇章脉络或表达迁移，给篇目加 `teaching: {modules, data}`，`modules` 使用 `sentences/structure/imitation` 中实选的值。`data` 的固定形状如下，未选的数组留空，未选篇章时 `structure` 的字符串留空并设 `outline:[]`。同一篇可同时填写 `lexicon` 和 `teaching`。

| 字段 | 每项字段 |
| --- | --- |
| `sentences` | `quote, translation, trunk, clauses, examTip`，可加 `parts` 数组，每项 `{text,role,explanation}` |
| `structure` | 对象 `genre, theme, outline, logic, examFocus`，`outline` 每项 `{paragraph,endParagraph,role,summary}`，段号从 1 起 |
| `lexicon` | 新课件填 `[]`，词条放在篇目级 `lexicon`。旧清单用 `modules:["lexicon"]` 和 `data.lexicon`，条目字段为 `term, meaning, sourceQuote, collocations, contrast, memory, quiz, answer`，可加 `sourceForm, partOfSpeech, usageNote, memoryExample, exampleTranslation`。同一篇只用一种写法。 |
| `imitation` | `quote, pattern, why, example, task, reference, checklist`，`checklist` 是字符串数组 |
| `transfer` | 留空。独立考点演练填到题目的 `analysis.practice` |

`analysis.practice` 为 `{kind,skill,sourceTopic,newTopic,material,stem,options,answer,analysis,point}`。英文新材料应自足，题型与原题一致。要让一个篇目的逐题演练进入 PPT，请给本次选入的各题提供有效练习。

## 语文

`project.subject` 为 `chinese`。`project.groups` 每项包含 `id, section, title, kind, materials, questions, versions`。`kind` 可取 `information/literature/classical/poetry/recitation/language/writing`。

- 材料为 `{id,title,text,sourceId,blockIds}`，有原图时加 `imageFile`（PNG 或 JPEG）。`sourceId` 和 `blockIds` 对应 `sources`。应重新核对的整组可写 `sourceNeedsReview:true`。
- 题目为 `{id,number,stem,format,materialIds,options,answer}`，`format` 可取 `choice/short/translation/segmentation/recitation/revision/expression/essay`。冲突或未核对的题加 `excluded:true` 和清单说明。保留原选项字面。
- 讲义为 `{module,questionId,result}`。`module` 可取 `analysis/structure/language/translation/writing/practice`，逐题讲评和演练用 `questionId` 关联原题，组级模块省略。要放映某道题的演练，同时提供其可用的逐题讲评。`result` 为 `{status,notices,blocks}`，`status` 可取 `ok/needs_review/insufficient_material`，`notices` 是字符串数组，`blocks` 每项为 `{label,text,evidence:[{materialId,quote}]}`。`quote` 是该材料的原文字面，非引用块填 `evidence:[]`。

## 化学

`project.subject` 为 `chemistry`。`project.questions` 每项包含 `id,number,stem,options,answer,sourceId,pages,images,versions`。`pages` 是原文件页码数组；`stage` 可取 `junior/senior`，`kind` 可取 `choice/principle/calculation/experiment/process/organic`。题面或题图存疑时加 `excluded:true`。

- `images` 每项为 `{id,name,file,sourceId,page,description}`。`file` 指向从原卷裁的 PNG 或 JPEG，保留坐标、箭头和图注。题目有配图时可设 `imageMode:"vision"`；使用 `description` 模式时每张图补实质性的 `description`。
- `versions` 每项为 `{module,result}`。`module` 可取 `analysis/knowledge/method/experiment/practice`。`result` 为 `{status,notices,blocks}`，状态与语文相同。每个内容块是 `{label,text}`。考点演练使用三个内容块，标签依次为 `题目`、`答案`、`解析与迁移`。化学方程、上下标可用 `$\ce{2H2 + O2 -> 2H2O}$` 或 LaTeX，写进 JSON 文件时转义反斜杠。

## 打包约定

两种输出通过工作台本身的项目校验与课件分页逻辑生成。原件原字节写入课件包。`project.json` 由脚本生成。待核对 PPT 的放映页范围按当次有效内容决定，包里仍可保留需补充的题和待确认讲义。教师审核后再从应用编排当前课堂。当前版本使用工作台内置纸面教案版式。
