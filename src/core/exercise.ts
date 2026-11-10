import {GenerationContentError} from './errors';
import { z } from 'zod';
import { optionEntries } from './options';

export const exerciseKinds=['reading','seven','cloze','grammar','listening','writing','continuation'] as const;
export const exerciseSchema=z.object({kind:z.enum(exerciseKinds),skill:z.string().min(1),sourceTopic:z.string().min(1),newTopic:z.string().min(1),material:z.string().min(1),stem:z.string().min(1),options:z.array(z.string()),answer:z.string().min(1),analysis:z.string().min(1),point:z.string().min(1)});
export type Exercise=z.infer<typeof exerciseSchema>;
export const exerciseBlueprintSchema=z.object({kind:z.enum(exerciseKinds),skill:z.string().min(1).max(100),sourceTopic:z.string().min(1).max(100)});
export type ExerciseBlueprint=z.infer<typeof exerciseBlueprintSchema>;
export const newExerciseTopics=['School science club','Community arts workshops','Urban wildlife observation','Local history exhibition','Neighbourhood book exchange','Student recycling project','Public garden volunteering','Weekend astronomy event'];
export function assignedExerciseTopic(blueprint:ExerciseBlueprint,index:number){const source=blueprint.sourceTopic.toLowerCase();for(let n=0;n<newExerciseTopics.length;n++){const topic=newExerciseTopics[(index+n)%newExerciseTopics.length];if(!topic.toLowerCase().split(/\s+/).some(w=>w.length>3&&source.includes(w)))return topic;}throw new GenerationContentError('未找到与原文不同的练习主题');}
export const exerciseNames:Record<string,string>={reading:'阅读理解',seven:'七选五',cloze:'完形填空',grammar:'语法填空',listening:'听力迁移 · 文字稿',writing:'应用文写作',continuation:'读后续写'};
const words=(s:string)=>s.toLowerCase().match(/[a-z]+(?:['’][a-z]+)*/g)||[];
const english=(s:string,label:string,min=2)=>{if(/[\u3400-\u9fff]/u.test(s)||words(s).length<min)throw new GenerationContentError('同类练习的'+label+'必须是完整英文，不能用中文转述原题');};
export function validateExercise(raw:unknown,kind:string,sourceTexts:string[]=[]):Exercise{
  const e=exerciseSchema.parse(raw);if(e.kind!==kind)throw new GenerationContentError('同类练习题型与原题不一致');
  for(const value of[e.skill,e.sourceTopic,e.newTopic,e.answer,e.analysis,e.point])if(!value.trim())throw new GenerationContentError('同类练习缺少具体考点、主题、答案或解析');
  english(e.material,'新材料');english(e.stem,'题干');e.options.forEach(o=>english(o,'选项',1));
  if(/(?:above|original|previous)\s+(?:passage|text|question)|根据原文|上文/i.test(e.material+' '+e.stem))throw new GenerationContentError('同类练习必须自足，不能依赖原卷或上文');
  if(e.sourceTopic.toLowerCase().trim()===e.newTopic.toLowerCase().trim())throw new GenerationContentError('同类练习必须更换主题和情境');
  const minimum:Record<string,number>={reading:35,seven:65,cloze:25,grammar:5,listening:20,writing:20,continuation:90};
  if(words(e.material).length<(minimum[kind]||5))throw new GenerationContentError('同类练习新材料不足，无法独立作答');
  const count=kind==='listening'?3:4;
  if(['reading','listening','cloze'].includes(kind)){
    if(e.options.length!==count||!/^[A-D]$/i.test(e.answer.trim())||e.answer.trim().toUpperCase().charCodeAt(0)-65>=count)throw new GenerationContentError('同类选择题的选项数量或答案编号无效');
  }else if(kind==='seven'){
    const gaps=[...e.material.matchAll(/\[([1-5])\]/g)].map(m=>m[1]);
    const pairs=[...e.answer.matchAll(/([1-5])\s*[-:：]\s*([A-G])/gi)];
    if(e.options.length!==7||new Set(gaps).size!==5||gaps.length!==5||pairs.length!==5||new Set(pairs.map(m=>m[1])).size!==5||new Set(pairs.map(m=>m[2].toUpperCase())).size!==5)throw new GenerationContentError('七选五练习必须有5个空位、7个选项及完整且不重复的答案对应');
  }else if(e.options.length)throw new GenerationContentError('此同类练习不应包含选择题选项');
  if(['cloze','grammar'].includes(kind)&&([...e.material.matchAll(/\[1\]/g)].length!==1||/\[\d+\]|_{2,}/.test(e.stem)||/\[(?!1\])\d+\]|_{2,}/.test(e.material)))throw new GenerationContentError('填空迁移练习必须仅在material中用一个[1]替代待填词；题干不能重复空位或用下划线另挖空');
  if(kind==='continuation'&&!/Paragraph\s*1\s*:/i.test(e.stem)||kind==='continuation'&&!/Paragraph\s*2\s*:/i.test(e.stem))throw new GenerationContentError('续写迁移练习缺少两段给定段首句');
  if(['writing','continuation'].includes(kind)&&/[\u3400-\u9fff]/u.test(e.answer))throw new GenerationContentError('写作迁移练习的参考文本必须使用英文');
  const normalized=words([e.material,e.stem,...e.options].join(' ')).join(' '),sources=sourceTexts.map(t=>words(t).join(' '));
  for(const source of sources){const tokens=source.split(' ');for(let i=0;i+14<=tokens.length;i++)if(normalized.includes(tokens.slice(i,i+14).join(' ')))throw new GenerationContentError('同类练习连续照搬了原卷内容，请更换独立材料');}
  if(new Set(optionEntries(e.options).map(o=>o.text.toLowerCase().trim())).size!==e.options.length)throw new GenerationContentError('同类练习包含重复选项');
  if(e.options.some((o,i)=>{const label=o.match(/^\s*([A-G])[.、:)]/);return !!label&&label[1]!==String.fromCharCode(65+i);}))throw new GenerationContentError('同类练习选项标签顺序不正确');
  return e;
}
export const exerciseText=(e:Exercise)=>[e.material,e.stem,...optionEntries(e.options).map(o=>o.label+'. '+o.text)].join('\n\n');
export const exerciseAnswerText=(e:Exercise)=>['参考答案：'+e.answer,e.analysis,'考点：'+e.point].join('\n');
export const exercisePrompt=`practice/练习必须是独立的新编英语试题，不是中文教学提问或原卷的缩写。原题只用于抽取题型、考点、解题方法和难度；必须更换话题、人物、数字和事件，不能沿用原文事实、专名、选项、参考答案或“根据上文”作答。sourceTopic/newTopic分别用英文关键词说明原主题和新主题，二者不同。新题答案独立推导，不能照抄原卷答案字母。输出kind、skill、sourceTopic、newTopic、material、stem、options、answer、analysis、point。
material、stem、options全部英文，中文只用于skill/analysis/point等教师说明。材料必须给全、问题自足、答案有充分且尽量唯一的依据；不要先在题面暴露答案。kind复制原题型。阅读还须沿用原题的具体考法（细节、推断、主旨、词义等），不能把所有题改成词汇翻译。
reading：45–90词新短文+同考法英文问句+4选项+单个A–D答案；listening：25–70词新对话文字稿+问句+3选项+单个A–C答案，不声称生成音频；cloze：30–70词新语境、一个[1]空位+4个英文选项+单个A–D答案，考查相同语义关系或搭配；grammar：含一个[1]及必要提示词的完整新英文句子/语境+英文要求，options=[]，测试相同语法点，answer给所填形式；seven：80–140词完整新篇章、[1]至[5]共5个空、7个A–G英文选项，answer格式1-A;2-C;3-E;4-B;5-G，每个答案选项只用一次；writing：全新英文任务背景与要求、options=[]、英文参考范文；continuation：100–160词全新故事+英文续写要求及Paragraph 1:/Paragraph 2:两段给定段首句，options=[]、英文参考续写。
空位格式必须严格执行：cloze/grammar的待填词只能在material中用[1]替代，不能把完整答案留在该位置，也不能把[1]挪到stem或句末；不要再加___等第二种空位。stem仅写完整英文作答指令，不含编号空位。cloze的material本身就是有一个空位的完整新语篇，不是先展示答案再附一道复述题。grammar必须测试skill指定的具体结构和用法，例如要求“同位语中的冠词”就要在新同位语中设空，不能仅改成表语冠词。
analysis用中文写出可核对的解题链：先标明正确项对应的新材料原词/关键句，再解释如何推出答案；逐个说明其余选项为什么错（偷换对象、范围扩大、因果颠倒、未提及等，只写实际错误，不机械套用）。不能仅写“其他项无依据”，不能把“没有说”当成“原文说相反”。主旨题覆盖全文且避免片面选项，推断题不得依赖材料以外的常识猜测。七选五逐空说明前后指代和逻辑，语法填空说明填回后的结构、词形和排他条件，写作说明要点与可替换表达。干扰项要与语境有关、长度和表达形式可比，避免三个明显荒谬选项。写作范文严格遵守题干字数要求，续写必须自然接续两段段首。不把AI范文当唯一答案。先自查题面与答案一致，再输出规定JSON。`;
