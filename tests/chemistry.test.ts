import {describe,it,expect} from 'vitest';
import {chemistrySchema,chemQuestionSchema,chemFingerprint,chemReady,chemSlides,chemResultSchema,chemVersionSchema} from '../src/core/chemistry';

const question=()=>chemQuestionSchema.parse({id:'q1',number:'1',kind:'experiment',stem:'用澄清石灰水检验 CO₂',answer:'变浑浊',confirmed:true});
const version=(q=question())=>({id:'v1',module:'knowledge' as const,createdAt:'2026-11-12',origin:'ai' as const,fingerprint:chemFingerprint(q),confirmed:true,result:chemResultSchema.parse({status:'ok',notices:[],blocks:[{label:'适用条件',text:'少量 CO₂ 通入澄清石灰水。'}]})});
describe('化学课件完整性',()=>{
 it('题面改变后保留历史但不能输出',()=>{const q=question();q.versions.push(version(q));expect(chemReady(q,q.versions[0])).toBe(true);q.answer='先浑浊后澄清';expect(chemReady(q,q.versions[0])).toBe(false);expect(()=>chemSlides(chemistrySchema.parse({questions:[q]}),['v1'])).toThrow(/过期/);});
 it('未核对图示或缺少文字说明时不能冒充完整题面',()=>{const q=question();q.images=[{id:'i',name:'装置图',data:'data:image/png;base64,YQ==',description:'',confirmed:false}];expect(()=>chemSlides(chemistrySchema.parse({questions:[q]}),['question:q1'])).toThrow(/图片/);});
 it('拒绝失踪的选择，并允许排除未完成模块',()=>{const q=question();q.versions.push(version(q));const d=chemistrySchema.parse({questions:[q]});expect(()=>chemSlides(d,['lost'])).toThrow(/不存在/);expect(chemSlides(d,['question:q1','v1']).length).toBeGreaterThan(1);});
 it('考点演练题目与答案分开分页',()=>{const q=question(),v={...version(q),module:'practice' as const,result:{status:'ok' as const,notices:[],blocks:[{label:'题目',text:'请写出离子方程式。'},{label:'答案',text:'CO₂ + Ca²⁺ + 2OH⁻ → CaCO₃↓ + H₂O'},{label:'解析与迁移',text:'检查电荷与原子守恒。'}]}};q.versions=[v];const slides=chemSlides(chemistrySchema.parse({questions:[q]}),['v1']);expect(slides.some(s=>s.blocks.some(b=>b.label==='题目')&&s.blocks.some(b=>b.label==='答案'))).toBe(false);expect(slides.length).toBeGreaterThanOrEqual(2);});
 it('空白内容无法通过有效结果校验',()=>{expect(()=>chemResultSchema.parse({status:'ok',notices:[],blocks:[{label:'知识',text:'  '}]})).toThrow();});
 it('图片指纹不复制原图，每次图像内容改变都使讲义失效',()=>{const q=question();q.images=[{id:'i',name:'图',data:'data:image/png;base64,'+'YQ=='.repeat(10000),description:'说明',confirmed:true}];const before=chemFingerprint(q);expect(before.length).toBeLessThan(1000);q.images[0].data=q.images[0].data.replace('YQ==','Yg==');expect(chemFingerprint(q)).not.toBe(before);});
});

it('教师不能把结构不完整的待核实演练直接改为可用',()=>{const q=question(),v={...version(q),module:'practice' as const};expect(()=>chemVersionSchema.parse(v)).toThrow(/演练必须/);expect(chemReady(q,v)).toBe(false);expect(()=>chemVersionSchema.parse({...v,result:{...v.result,status:'needs_review'}})).not.toThrow();});
