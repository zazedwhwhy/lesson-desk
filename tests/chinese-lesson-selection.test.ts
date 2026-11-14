import {describe,expect,it} from 'vitest';
import {chineseSchema,chineseFingerprint,chineseSlides} from '../src/core/chinese';
import {defaultChineseLessonSelection,resolveChineseLessonSelection} from '../src/core/chinese-lesson-selection';

function sample(){
 const d=chineseSchema.parse({groups:[{id:'g',title:'阅读',section:'一',kind:'information',materials:[{id:'m',title:'原文',text:'春雨润物。',sourceId:'s',blockIds:['b']}],questions:[{id:'q',number:'1',stem:'分析表达效果',format:'short',materialIds:['m'],confirmed:true}]}]});
 const g=d.groups[0];
 g.versions.push({id:'old',module:'analysis',questionId:'q',createdAt:'2026-11-10',fingerprint:chineseFingerprint(d,g,'q'),confirmed:true,result:{status:'ok',notices:[],blocks:[{label:'解析',text:'旧版解析',evidence:[]}]}});
 g.versions.push({...structuredClone(g.versions[0]),id:'new',createdAt:'2026-11-14',result:{status:'ok',notices:[],blocks:[{label:'解析',text:'以春雨写滋养。',evidence:[{materialId:'m',quote:'春雨润物。'}]}]}});
 return d;
}
describe('语文共用授课选择流程',()=>{
 it('默认选有效讲义的最新版本，放映与导出使用同一内容 ID',()=>{
  const d=sample(),s=defaultChineseLessonSelection(d),r=resolveChineseLessonSelection(d,s);
  expect(s.groupIds).toEqual(['g']);expect(s.questionIds).toEqual(['q']);
  expect(r.issues).toEqual([]);expect(r.ids).toEqual(['source:g','new']);
  const slides=chineseSlides(d,r.ids);expect(slides.map(x=>x.title)).toEqual(['原文','第 1 题','第 1 题 · 逐题讲评']);
  expect(slides.flatMap(x=>x.body).join()).not.toContain('旧版解析');
 });
 it('已选讲义过期必须提示，取消该模块后可以仅输出原文',()=>{
  const d=sample(),s=defaultChineseLessonSelection(d);d.groups[0].questions[0].answer='新答案';
  expect(resolveChineseLessonSelection(d,s).issues.join()).toMatch(/过期/);
  s.modules.g=['source'];expect(resolveChineseLessonSelection(d,s)).toEqual({ids:['source:g'],issues:[]});
 });
 it('排除题目不会输出题面或解析；未知选择不能静默丢弃',()=>{
  const d=sample(),s=defaultChineseLessonSelection(d);d.groups[0].questions[0].excluded=true;
  expect(resolveChineseLessonSelection(d,s).issues.join()).toMatch(/排除/);
  expect(defaultChineseLessonSelection(d).questionIds).toEqual([]);
  s.groupIds.push('missing');expect(resolveChineseLessonSelection(d,s).issues.join()).toMatch(/不存在/);
 });
 it('未确认的原图默认不选，手动选择时阻断',()=>{
  const d=sample();d.groups[0].materials[0].image='data:image/png;base64,AAAA';
  const s=defaultChineseLessonSelection(d);expect(s.modules.g).not.toContain('source');
  s.groupIds=['g'];s.modules.g=['source'];expect(resolveChineseLessonSelection(d,s).issues.join()).toMatch(/图片.*核对/);
 });
 it('新生成的未确认或待核实版本不挤掉已确认的有效旧版',()=>{
  const d=sample(),g=d.groups[0];g.versions[1].confirmed=false;
  expect(resolveChineseLessonSelection(d,defaultChineseLessonSelection(d)).ids).toEqual(['source:g','old']);
  g.versions[1].confirmed=true;g.versions[1].result.status='needs_review';
  expect(resolveChineseLessonSelection(d,defaultChineseLessonSelection(d)).ids).toEqual(['source:g','old']);
 });
});
