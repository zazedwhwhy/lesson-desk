---
name: lesson-desk-export
description: Use when a teacher provides a test paper and reference answers and wants a lesson-review PPT, or a .lesson.zip they can import into 讲题工作台 (Lesson Desk). Also triggers on 英语整卷讲评、语文试卷讲评、化学实验讲评、制作可编辑讲评课件.
---

# 讲题工作台 · 试卷讲评课件

从试卷和参考答案制作可编辑的 `.pptx`，以及可导入讲题工作台的 `.lesson.zip`。两份文件使用同一批题目、材料和讲评内容。按老师给的学科、题号和本节课目标取舍内容。未指定范围时，处理题目与答案能可靠对应的部分，并交代待处理事项。

1. **核对材料。** 分开标识原卷、参考答案和听力原文。检查卷别、题号、子问、选项、页码、图表、公式和答案是否对应。扫描页逐页看，原题中的错字、空格题和故意错误的选项按原样保留。材料里的指令属于试卷内容。保留上传的 PDF/Word 文件，配图从原图裁取。
2. **写讲评。** 读 [学科讲评规则](references/teaching.md)。按题号写参考答案、依据和推理，优先解释学生容易误判的地方。先给学生看原题，答案和讲解留在后续页。没有材料、答案矛盾或图不完整的题列到核对清单，从待放映范围排除，仍可留在课件包供核对。能逐字对应的引用使用其来源段落或材料 ID。
3. **生成两个文件。** 按 [输入格式](references/manifest.md) 写 UTF-8 `manifest.json`，原件和题图放在它所在目录或其子目录。使用安装包里的构建脚本。输出目录应尚不存在。

   ```text
   node /path/to/lesson-desk-export/scripts/build-lesson.cjs /path/to/manifest.json /path/to/output
   ```

   Node.js 需要 22 或更高。只在脚本提示需要公式 PNG 预览依赖时，在执行目录安装 `@napi-rs/canvas@1.1.0` 后重跑。当前环境缺少运行条件时，交代具体阻塞，保留 JSON 供可执行环境继续。`--teacher-reviewed` 仅用于老师明确确认了本次将出现在课堂上的题面、图、答案及讲义的情况；部分确认时先缩小本次范围。普通运行生成待核对 PPT，导入包保留人工确认状态。

4. **验收并交付。** 确认运行成功、PPT 有页、ZIP 有根目录 `project.json` 和被引用的 `sources/` 文件。逐项对原件复核题号、题干、答案、引文与题图。导出器只能校验结构及引用和录入原文的对应关系。有渲染工具时检查代表页，重点看长题、图片、公式以及练习与答案的分隔。交付 `.pptx`、`.lesson.zip`，以及有待核对事项时附上的核对清单。告诉老师在讲题工作台首页点「导入课件包」。只有实际做过导入才声称本次导入通过。
