import {expect,it} from 'vitest';
import {questionPages} from '../src/core/question-layout';
import {builtinPptTemplates,defaultPptTemplate} from '../src/core/ppt-templates';
import {projectSlide} from '../src/core/ppt-page';

const stem='After reading the school report, Mia says that the new bike racks caused more students to cycle to school. Which response best evaluates her conclusion using the evidence in the report?';
const choices=[
 'A. The two counts prove that the new racks persuaded sixteen students to stop travelling to school by bus.',
 'B. More bicycles were recorded on the second Tuesday, but the counts cannot separate the effect of the racks from that of the cycling challenge.',
 'C. Because both counts were made on dry Tuesdays, the cycling challenge could not have affected the number of bicycles.',
 'D. The increase shows that more students cycled every day in May than on any school day before the racks were installed.',
];
for(const template of builtinPptTemplates){
 it(template.name+' 在一页内按原顺序完整展示题干与四个长选项',()=>{
  const pages=questionPages(stem,choices,template.layout);
  expect(pages).toHaveLength(1);
  const drawn=projectSlide({...pages[0],title:'第 21 题',section:'阅读',kind:'question'},template,'校刊',1,2,true);
  const text=drawn.filter(item=>item.type==='text' && item.role==='body');
  expect(text.map(item=>item.type==='text' && item.text)).toEqual([stem,...choices]);
  for(const part of pages[0].questionLayout!.parts){
   expect(part.pt).toBeGreaterThanOrEqual(21);
   expect(part.y+part.h).toBeLessThanOrEqual(template.layout.body.y+template.layout.body.h+.001);
  }
 });
}
it('超长材料续页保留全文，每个短选项完整出现且只出现一次',()=>{
 const longStem='雨后，学校的自行车架上还有水珠。'.repeat(150);
 const pages=questionPages(longStem,choices,defaultPptTemplate.layout,'chinese');
 expect(pages.length).toBeGreaterThan(1);
 const text=pages.flatMap(p=>p.blocks.map(b=>b.text));
 expect(text.join('')).toBe(longStem+choices.join(''));
 choices.forEach(option=>expect(text.filter(t=>t===option)).toHaveLength(1));
});
it('化学图文在各自区域排版，公式语法错误会阻断',()=>{
 const layout=defaultPptTemplate.layout;
 const fig={data:'data:image/png;base64,abc',name:'溶解度曲线'};
 const [page]=questionPages('结合曲线，比较两种盐在同一温度下的溶解度。',['A. 甲更高','B. 乙更高'],layout,'chemistry',fig);
 const fitted=page.questionLayout!;
 expect(fitted.figure?.data).toBe(fig.data);
 for(const part of fitted.parts)expect(part.x+part.w).toBeLessThan(fitted.figure!.box.x);
 expect(()=>questionPages('没有闭合的公式 $x',[],layout,'chemistry',fig)).toThrow(/未闭合/);
});
