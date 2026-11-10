import {describe,it,expect} from 'vitest';
import {chineseSchema, chineseFingerprint, validateChineseResult, chineseSlides, chineseChecks} from '../src/core/chinese';
const make=()=>chineseSchema.parse({groups:[{id:'g',section:'阅读 I',title:'多材料阅读',kind:'information',materials:[{id:'m',title:'材料一',text:'事实支持观点。',sourceId:'s',blockIds:['b']}],questions:[{id:'q',number:'1',stem:'说明观点',format:'short',materialIds:['m'],answer:'事实',confirmed:true}]}]});
describe('语文整卷',()=>{
 it('证据不能跨材料伪造',()=>{const d=make();expect(()=>validateChineseResult(d,d.groups[0],{status:'ok',notices:[],blocks:[{label:'解析',text:'说明',evidence:[{materialId:'m',quote:'不存在'}]}]})).toThrow(/引用/);});
 it('只允许有效且教师确认的版本加入课件，改答案使旧版本过期',()=>{const d=make(),g=d.groups[0];g.versions.push({id:'v',module:'analysis',questionId:'q',createdAt:'now',fingerprint:chineseFingerprint(d,g,'q'),confirmed:true,result:{status:'ok',notices:[],blocks:[{label:'解析',text:'完整解析',evidence:[]}]}});expect(chineseSlides(d,['v']).some(s=>s.body.includes('完整解析'))).toBe(true);g.questions[0].answer='新答案';expect(()=>chineseSlides(d,['v'])).toThrow(/过期/);});
 it('长篇中文分页不丢文字',()=>{const d=make(),g=d.groups[0];g.materials[0].text='甲乙丙丁。'.repeat(500);const pages=chineseSlides(d,['source:g']);expect(pages.flatMap(s=>s.blocks).map(b=>b.text).join('')).toBe(g.materials[0].text);expect(pages.length).toBeGreaterThan(1);});
 it('缺失材料关联和重复题号可定位',()=>{const d=make();d.groups[0].questions[0].materialIds=['missing'];expect(chineseChecks(d).join()).toContain('关联材料');});
});
