# 英语词汇手账

每篇默认最多 8 条，按老师指定的数量选取，构建器每篇最多接收 20 条。短文按实际价值少选。优先选影响理解或解题的语块、熟词生义、搭配，以及适合迁移到高中英语写作的自然表达。材料不足时在核对清单里写明缺口。

把词条写在 `project.passages[].lexicon`。只做手账时将 `project.questions` 设为 `[]`，可省略 `teaching`。在 `sources` 保留原文来源，粘贴的原文用 `role:"paper",kind:"text"`。和其他模块同做时，题目讲评填在 `questions`，其它篇目讲义填在 `teaching`，其中 `teaching.data.lexicon` 留空，`teaching.modules` 不重复列出 `lexicon`。

词条示例，假设 `p1` 是该篇 `paragraphs` 中的段落 ID。

```json
{
  "term": "be known for",
  "sourceForm": "is known for",
  "partOfSpeech": "动词短语",
  "meaning": "以……闻名",
  "evidence": {"blockId": "p1", "quote": "The town is known for its weekly market."},
  "usageNote": "for 后的 its weekly market 交代这座小镇出名的原因。",
  "collocations": "be known for local food 以当地美食闻名；be known for doing something 以做某事而闻名",
  "contrast": "be known for 说明出名的原因；be known as 引出身份或称号。",
  "memoryExample": "The school is known for its music programme.",
  "exampleTranslation": "这所学校以音乐课程闻名。"
}
```

- `term` 写英文词典形或固定搭配。`sourceForm` 写原句里的连续词形。`evidence.quote` 用可在所指段落找到的完整原句，保留原文空位、标点和限定。
- 核对词性、本篇义和本句用法。用全文厘清否定、可能性、数量和义务等限定。无真正易混表达时，用 `contrast` 写适用边界。用真实搭配帮助记忆，略去未经核实的词源、谐音和词频。
- `memoryExample` 写含该词或语块的自然英文新句，`exampleTranslation` 逐项核对新句的人物、事物和动作。脚本会把引用绑定到原文，校验词形和重复词条，并自动生成回忆题及答案。`sourceQuote`、`memory`、`quiz`、`answer` 由脚本处理。
