import {chineseSystem,chineseOrganizeInstruction,chineseInstructions} from './chinese-prompts';
import {chineseModuleNames,type ChineseModule} from './chinese';
import {teachingInstructions} from './teaching-instructions';
import {teachingSystem} from './learning';
import {specialKinds,specialNames,specialPrompts,specialSystem} from './special';
import {apiSystem,analysisInstruction,organizeInstruction,translationInstruction,blueprintInstruction,practiceInstruction,practiceSystem,proofreadInstruction,proofreadSystem,correctionInstruction,correctionSystem,ocrInstruction,ocrSystem,reviewInstruction,reviewSystem} from './request-instructions';
export type PromptTemplate={id:string;title:string;instruction:string;system:string};
export function promptCatalog():PromptTemplate[]{return [
 {id:'chinese-organize',title:'语文 · 整理试卷',instruction:chineseOrganizeInstruction,system:chineseSystem},
 ...Object.entries(chineseInstructions).map(([id,instruction])=>({id:'chinese-'+id,title:'语文 · '+chineseModuleNames[id as ChineseModule],instruction,system:chineseSystem})),
 ...(['sentences','structure','lexicon','imitation'] as const).map((id,i)=>({id,title:['句法拆解','篇章脉络','词汇手账','表达迁移'][i],instruction:teachingInstructions(id),system:teachingSystem})),
 {id:'organize',title:'整理试卷',instruction:organizeInstruction,system:apiSystem},
 {id:'analysis',title:'逐题解析',instruction:analysisInstruction,system:teachingSystem},
 {id:'translation',title:'原文译文',instruction:translationInstruction,system:apiSystem},
 {id:'blueprint',title:'练习考点提炼',instruction:blueprintInstruction,system:apiSystem},
 {id:'practice',title:'考点演练',instruction:practiceInstruction,system:practiceSystem},
 ...specialKinds.map(id=>({id:'special-'+id,title:specialNames[id],instruction:specialPrompts[id],system:specialSystem})),
 {id:'proofread',title:'试卷校对',instruction:proofreadInstruction,system:proofreadSystem},
 {id:'correction',title:'自动修正',instruction:correctionInstruction,system:correctionSystem},
 {id:'ocr',title:'扫描识别',instruction:ocrInstruction(false),system:ocrSystem},
 ...(['structure','lexicon','practice'] as const).map((kind,i)=>({id:'review-'+kind,title:['篇章内容复核','词汇内容复核','练习内容复核'][i],instruction:reviewInstruction(kind),system:reviewSystem}))
 ];}
