import {it,expect} from 'vitest';
import {pdfReadingLines} from '../src/core/pdf-reading-lines';
import {checkLiteral,assertOcrReviewed,protectEnglish,protectChemistry,protectChinese,reconcileOcrReview,sourceText} from '../src/core/source-fidelity';
import {emptyProject} from '../src/core/model';

it('整行跨过中线时不把空号分成第二栏，按行内x排序',()=>{
 const rows=[{text:'The first paragraph.',x:50,y:680,width:340},{text:'36 .',x:400,y:680,width:30},{text:'The next paragraph.',x:50,y:664,width:300},{text:'37 Virtual guides',x:360,y:664,width:150}];
 expect(pdfReadingLines(rows,595).map(r=>r.text)).toEqual(['The first paragraph. 36 .','The next paragraph. 37 Virtual guides']);
});
it('真正双栏仍按左栏后右栏，不把同行跨栏混起来',()=>{
 const rows=Array.from({length:10},(_,i)=>[{text:'L'+i,x:40,y:700-i*20,width:180},{text:'R'+i,x:320,y:700-i*20,width:180}]).flat();
 expect(pdfReadingLines(rows,595).map(r=>r.text)).toEqual([...Array.from({length:10},(_,i)=>'L'+i),...Array.from({length:10},(_,i)=>'R'+i)]);
});
it('空位被删除或移到不同句子时拒绝，格式空格与弯引号可兼容',()=>{
 const source='The first paragraph. 36 .\nThe next paragraph. 37 Virtual guides';
 expect(()=>checkLiteral(source,'The first paragraph.','原文',{complete:true})).toThrow(/保真/);
 expect(()=>checkLiteral(source,'The next paragraph. 36 .','第36题')).toThrow(/保真/);
 expect(()=>checkLiteral('We didn’t know.','We didn\'t\nknow.','原文')).not.toThrow();
});
it('保护选项原字、气体追问和配离子，不以化学常识自动校订',()=>{
 expect(()=>checkLiteral('B.从化学物质中获取能量','B.从有机物质中获取能量','第1题选项B')).toThrow(/保真/);
 expect(()=>checkLiteral('⑶铜的形式___。气体a为___。','⑶铜的形式___。','第16题',{complete:true})).toThrow(/保真/);
 expect(()=>checkLiteral('[Ni(NH₃)]²⁺和[Ni(NH₃)₂]²⁺','[Ni(NH₃)₂]²⁺和[Ni(NH₃)₂]²⁺','第16题')).toThrow(/保真/);
});
it('OCR仅转录不等于核验，旧版已识别但无核对记录的页也需确认',()=>{
 expect(()=>assertOcrReviewed([{name:'原卷',ocrReviewPages:[4]}])).toThrow(/第4页/);
 expect(()=>assertOcrReviewed([{name:'原卷',warnings:['第4页经AI识别，须核对题号、拼写和答案。']}])).toThrow(/核对/);
 expect(()=>assertOcrReviewed([{name:'原卷',ocrReviewPages:[],ocrVerifiedPages:[4]}])).not.toThrow();
});
it('七选五段尾空号也必须保留，不能因前文仍是连续原文而漏检',()=>{
 const p=emptyProject('英语');p.sources=[{id:'s',name:'原卷',kind:'text',role:'paper',blocks:[{id:'b',text:'The first paragraph. 36 .\nThe next paragraph. 37 Virtual guides.'}]}];
 const out={passages:[{id:'a',type:'seven',paragraphs:[{id:'b',text:'The first paragraph.'},{id:'c',text:'The next paragraph. 37 Virtual guides.'}],pool:''}],questions:[{number:'36',stem:'',type:'seven',options:[],answer:'',passageId:'a'}]};
 expect(()=>protectEnglish(p,out)).toThrow(/36.*空号/);
});
it('空格可归一但不能吞掉作答横线或将纯横线候选替换成整页',()=>{
 expect(()=>checkLiteral('气体a为___。','气体a为。','题干',{complete:true})).toThrow(/保真/);
 expect(checkLiteral('气体a为___。','___','填空')).toBe('___');
});
it('正确的原文及参考答案可以整理，保留原卷故意错字和上下标',()=>{
 const p=emptyProject('化学','chemistry');p.sources=[{id:'s',name:'原卷',kind:'text',role:'paper',blocks:[{id:'b',text:'16.气体a为___。比较[Ni(NH₃)]²⁺与[Ni(NH₃)₂]²⁺。'}]},{id:'ans',name:'答案',kind:'text',role:'answer',blocks:[{id:'ab',text:'16.NH₃；[Ni(NH₃)]²⁺+H₂=Ni+NH₄⁺+H⁺。'}]}];
 const out={questions:[{number:'16',sourceId:'s',stem:'气体a为___。比较[Ni(NH3)]2+与[Ni(NH3)2]2+。',options:[],answer:'NH3；[Ni(NH3)]2++H2=Ni+NH4++H+。'}]};
 protectChemistry(p,out);expect(out.questions[0].stem).toContain('[Ni(NH₃)]²⁺');expect(out.questions[0].answer).toContain('NH₄⁺');
 const c=emptyProject('语文','chinese');c.sources=[{id:'s',name:'原卷',kind:'text',role:'paper',blocks:[{id:'b',text:'18. 找出错别字：幕色，火曝。'}]}];
 const co={groups:[{questions:[{number:'18',stem:'找出错别字：幕色，火曝。',options:[],answer:'',answerSource:'none',confirmed:true}]}]};protectChinese(c,co);expect(co.groups[0].questions[0].confirmed).toBe(false);
});
it('已核对OCR页被编辑后撤回核对状态，未改页仍保留',()=>{
 const old=[{id:'s',name:'扫描',kind:'text' as const,role:'paper' as const,ocrVerifiedPages:[1,2],blocks:[{id:'a',page:1,text:'幕色'},{id:'b',page:2,text:'原字'}]}],next=structuredClone(old);next[0].blocks[0].text='暮色';reconcileOcrReview(old,next);
 expect(next[0].ocrVerifiedPages).toEqual([2]);expect(()=>assertOcrReviewed(next)).toThrow(/第1页/);expect(old[0].ocrVerifiedPages).toEqual([1,2]);
});
it('节选PDF的印刷页码不等于文件页码时也不混进跨页原文',()=>{
 const sources=[{id:'s',name:'节选',kind:'pdf' as const,role:'paper' as const,blocks:[{id:'a',page:1,y:100,text:'across'},{id:'footer',page:1,y:65.331,text:'6'},{id:'b',page:2,y:700,text:'pages'}]}];
 expect(checkLiteral(sourceText(sources),'across pages','跨页原文')).toBe('across\npages');
});
it('PDF公式的上下标与正文合成同一行，同x的下标先于电荷',()=>{
 const rows=[{text:'SO',x:100,y:608,height:10.45},{text:'4',x:113,y:605.45,height:7.45},{text:'2−',x:113,y:612.05,height:7.45},{text:'和[Ni(NH',x:122,y:608,height:10.45},{text:'3',x:160,y:607.16,height:6.85},{text:')]',x:164,y:608,height:10.45},{text:'2+',x:170,y:611.48,height:6.85},{text:'下一行',x:100,y:587,height:10.45}];
 expect(pdfReadingLines(rows,595).map(b=>b.text.replace(/\s/g,''))).toEqual(['SO₄²⁻和[Ni(NH₃)]²⁺','下一行']);
});
it('化学题号分值属于标题，原答案按明确题号直接取回而不采用模型重写',()=>{
 const p=emptyProject('化学','chemistry');p.sources=[{id:'s',name:'原题',kind:'text',role:'paper',blocks:[{id:'b',text:'16.（13分）气体a为___。'}]},{id:'a',name:'参考答案',kind:'text',role:'answer',blocks:[{id:'ab',text:'16.【答案】(3) NH₃；原公式NiNH₃²⁺。\n【解析】补充解析。\n17.【答案】ADF'}]}];
 for(const stem of ['气体a为___。','（13分）气体a为___。']){const out={questions:[{number:'16',sourceId:'s',stem,options:[],answer:'模型改写答案'}]};protectChemistry(p,out);
 expect(out.questions[0].answer).toBe('(3) NH₃；原公式NiNH₃²⁺。');expect(out.questions[0].stem).toBe('气体a为___。');}
});
it('语文题干重复携带独立题号时按相同题号去重，不误拦原文',()=>{
 const p=emptyProject('语文','chinese');p.sources=[{id:'s',name:'原卷节选',kind:'text',role:'paper',blocks:[{id:'b',text:'1.下列选项不正确的一项是(3分) （ ）\nA.从化学物质中获取能量'}]}];
 const out={groups:[{questions:[{number:'1',stem:'1.下列选项不正确的一项是(3分) （ ）',options:['A.从化学物质中获取能量'],answer:'',answerSource:'none'}]}]};protectChinese(p,out);expect(out.groups[0].questions[0].stem).toBe('下列选项不正确的一项是(3分) （ ）');
});
