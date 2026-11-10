import {expect,it} from 'vitest';
import {defaultSlideLayout,layoutBlocks,paginateBlocks} from '../src/core/slide-layout';
import {chineseFingerprint,chineseSchema,chineseSlides} from '../src/core/chinese';

it('同一讲义的多个短块合页，标签和正文不丢失',()=>{
 const blocks=[{label:'思路',text:'先定位原文。'},{label:'依据',text:'核对关键词。'},{label:'参考作答',text:'观点需要证据。'}];
 expect(paginateBlocks(blocks)).toEqual([blocks]);
 const d=chineseSchema.parse({groups:[{id:'g',section:'阅读',title:'材料',kind:'information',materials:[],questions:[]}]});
 const g=d.groups[0];g.versions.push({id:'v',module:'structure',createdAt:'now',fingerprint:chineseFingerprint(d,g),confirmed:true,result:{status:'ok',notices:[],blocks:blocks.map(b=>({...b,evidence:[]}))}});
 expect(chineseSlides(d,['v'])).toHaveLength(1);
});

it('中英长文与空行完整保留，所有块位于正文区域内',()=>{
 const text=('The original evidence must remain complete. 原文需要完整保留。\n\n').repeat(70)+'尾';
 const pages=paginateBlocks([{label:'原文',text}]);
 expect(pages.length).toBeGreaterThan(1);
 expect(pages.flat().map(b=>b.text).join('')).toBe(text);
 for(const page of pages)for(const b of layoutBlocks(page)){
  expect(b.y+b.h).toBeLessThanOrEqual(defaultSlideLayout.body.y+defaultSlideLayout.body.h+.001);
 }
});

it('刚超过一页的正文平衡续页，不留下只有一两行的尾页',()=>{
 const text=Array.from({length:15},(_,i)=>`第${i+1}行内容`).join('\n');
 const pages=paginateBlocks([{label:'解析',text}]);
 expect(pages).toHaveLength(2);
 expect(pages[1].flatMap(b=>b.text.split('\n')).length).toBeGreaterThanOrEqual(4);
 expect(pages.flat().map(b=>b.text).join('')).toBe(text);
});

it('语文考点演练合并同类短块，但练习题面和参考答案仍分开',()=>{
 const d=chineseSchema.parse({groups:[{id:'g',section:'阅读',title:'材料',kind:'information',materials:[],questions:[]}]});
 const g=d.groups[0];g.versions.push({id:'v',module:'practice',createdAt:'now',fingerprint:chineseFingerprint(d,g),confirmed:true,result:{status:'ok',notices:[],blocks:[
  {label:'AI 新编材料',text:'新编情境：学生查证一条消息。',evidence:[]},{label:'题干与约束',text:'说明查证步骤。',evidence:[]},
  {label:'参考作答',text:'结论XYZ：核对可信来源。',evidence:[]},{label:'解析',text:'先判断来源，再交叉核实。',evidence:[]}
 ]}});
 const pages=chineseSlides(d,['v']);expect(pages).toHaveLength(2);
 expect(pages[0].blocks).toHaveLength(2);expect(pages[1].blocks).toHaveLength(2);
 expect(pages[0].body.join('')).not.toContain('结论XYZ');expect(pages[1].body.join('')).not.toContain('新编情境');
});
