import {it,expect} from 'vitest';
import {renderFormula,splitMath,mathLines} from '../src/core/math-text';
import {paginateBlocks,layoutBlocks,defaultSlideLayout} from '../src/core/slide-layout';
it('离线渲染化学式、电荷、反应条件和分数为自包含 SVG',()=>{for(const tex of [String.raw`\ce{SO4^2-}`,String.raw`\ce{2H2 + O2 ->[\Delta] 2H2O}`,String.raw`\frac{n}{V}`]){const r=renderFormula(tex);expect(r.svg).toContain('<path');expect(r.svg).not.toMatch(/<script|<image|href=/);expect(r.width).toBeGreaterThan(0);}});
it('保留混合文本和定界符，转义美元不被误作公式',()=>{const text=String.raw`浓度 $c=\frac{n}{V}$，离子 \(\ce{Fe^3+}\)。\$5`;
 const parts=splitMath(text);expect(parts.map(p=>p.raw).join('')).toBe(text);expect(parts.filter(p=>p.math)).toHaveLength(2);});
it('非法公式明确报错，不执行链接或注入 HTML',()=>{expect(()=>renderFormula(String.raw`\badcommand{a}`)).toThrow(/公式/);expect(()=>renderFormula(String.raw`\href{https://example.test}{x}`)).toThrow(/公式/);});
it('公式分页保留完整定界符且高度不溢出',()=>{const text=(String.raw`由 $\frac{n}{V}$ 得到 $\ce{SO4^2-}$。`+'\n').repeat(24);const pages=paginateBlocks([{label:'推导',text,math:true}]);expect(pages.flat().map(b=>b.text).join('')).toBe(text);expect(pages.length).toBeGreaterThan(1);for(const page of pages)for(const b of layoutBlocks(page))expect(b.y+b.h).toBeLessThanOrEqual(defaultSlideLayout.body.y+defaultSlideLayout.body.h+.001);});
it('过宽公式阻断输出，不裁切或缩成不可读小字',()=>{expect(()=>mathLines('$'+String.raw`\ce{H2O + H2O + H2O + H2O + H2O + H2O}`+'$',2,22)).toThrow(/公式.*宽/);});

it('货币原文不变，化学中未闭合公式明确阻断',()=>{const text='The ticket costs $5 and the book costs $10.';expect(splitMath(text).some(p=>p.math)).toBe(false);expect(splitMath(text).map(p=>p.raw).join('')).toBe(text);expect(()=>mathLines(String.raw`浓度 $\frac{n}{V}`,11,22)).toThrow(/未闭合/);});

it('宏定义只在当前公式生效，不污染另一题或另一课件',()=>{expect(renderFormula(String.raw`\def\customchem{X}\customchem`).svg).toContain('<path');expect(()=>renderFormula(String.raw`\customchem`)).toThrow(/公式/);});
