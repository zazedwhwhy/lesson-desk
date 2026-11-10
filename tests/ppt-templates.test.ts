import {afterEach,expect,it} from 'vitest';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pptxgen from 'pptxgenjs';
import {strFromU8,strToU8,unzipSync,zipSync} from 'fflate';
import {builtinPptTemplates} from '../src/core/ppt-templates';
import {TemplateStore,inspectTemplate} from '../src/desktop/ppt-templates';
import {exportPpt} from '../src/desktop/export';
import {demoProject} from '../src/core/demo';
import {defaultLessonSelection} from '../src/core/lesson-deck';

const dirs:string[]=[];
async function temp(){const dir=await mkdtemp(path.join(os.tmpdir(),'ppt-template-'));dirs.push(dir);return dir;}
afterEach(async()=>{for(const dir of dirs)await rm(dir,{force:true,recursive:true});dirs.length=0;});
async function source(file:string){
 const ppt=new pptxgen();ppt.layout='LAYOUT_WIDE';ppt.theme={headFontFace:'Arial',bodyFontFace:'Arial'};
 ppt.defineSlideMaster({title:'CUSTOM',background:{color:'F1F8EF'},objects:[{rect:{x:0,y:0,w:.16,h:7.5,fill:{color:'248549'},line:{color:'248549'}}}]});
 const s=ppt.addSlide('CUSTOM');s.addText('模板示例文字，不应导入',{x:1,y:2,w:8,h:1});
 await ppt.writeFile({fileName:file});
}
it('三种内置风格写入不同背景，正文保持可编辑',async()=>{
 const dir=await temp(),p=demoProject();
 for(const template of builtinPptTemplates){const f=path.join(dir,template.id+'.pptx');await exportPpt(p,f,defaultLessonSelection(p),{template});const zip=unzipSync(new Uint8Array(await readFile(f)));const xml=strFromU8(zip['ppt/slides/slide1.xml']);expect(xml).toContain(template.colors.background);expect(xml).toContain('<a:t>');}
});
it('导入 pptx/potx 保存到本机，复制母版资源而不复制示例内容',async()=>{
 const dir=await temp(),file=path.join(dir,'我的模板.pptx');await source(file);
 const store=new TemplateStore(path.join(dir,'library')),template=await store.import(file);
 expect(template.custom).toBe(true);expect(template.name).toBe('我的模板');expect(template.colors.background).toBe('F1F8EF');
 expect((await new TemplateStore(path.join(dir,'library')).list()).some(t=>t.id===template.id)).toBe(true);
 const p=demoProject(),out=path.join(dir,'result.pptx');await exportPpt(p,out,defaultLessonSelection(p),await store.load(template.id));
 const zip=unzipSync(new Uint8Array(await readFile(out)));
 const xml=Object.entries(zip).filter(([k])=>/^ppt\/slides\/slide\d+\.xml$/.test(k)).map(([,v])=>strFromU8(v)).join('');
 expect(xml).not.toContain('模板示例文字');expect(xml).toContain('Which park');
 expect(Object.keys(zip).some(k=>k.startsWith('lessonTemplate/ppt/slideMasters/'))).toBe(true);
 expect(strFromU8(zip['ppt/slides/_rels/slide1.xml.rels'])).toContain('lessonTemplate');
 expect(Object.entries(zip).filter(([k])=>k.startsWith('lessonTemplate/ppt/slideLayouts/')).map(([,v])=>strFromU8(v)).join('')).toContain('248549');
 const potx=path.join(dir,'标准模板.potx');const original=unzipSync(new Uint8Array(await readFile(file)));original['[Content_Types].xml']=strToU8(strFromU8(original['[Content_Types].xml']).replace('presentationml.presentation.main+xml','presentationml.template.main+xml'));await writeFile(potx,zipSync(original));
 expect((await store.import(potx)).name).toBe('标准模板');
});

it('标题超出页面或与正文区域重叠时阻止导入，避免标题被裁切',async()=>{
 const dir=await temp(),file=path.join(dir,'bad-title.pptx');await source(file);
 for(const [x,y,h] of [[-914400,914400,914400],[914400,914400,5486400]]){
  const zip=unzipSync(new Uint8Array(await readFile(file)));
  for(const part of Object.keys(zip).filter(k=>/^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(k)))zip[part]=strToU8(strFromU8(zip[part]).replace('</p:spTree>',`<p:sp><p:nvSpPr><p:cNvPr id="40" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="7315200" cy="${h}"/></a:xfrm></p:spPr></p:sp></p:spTree>`));
  expect(()=>inspectTemplate(zipSync(zip),'test','异常标题')).toThrow(/标题/);
 }
});
it('损坏模板、外部资源与非法 ID 明确报错，不降级默认模板',async()=>{
 const dir=await temp(),store=new TemplateStore(path.join(dir,'library')),f=path.join(dir,'bad.pptx');await writeFile(f,'not a zip');await expect(store.import(f)).rejects.toThrow(/模板/);
 await expect(store.load('../settings')).rejects.toThrow(/模板/);
 await source(f);const zip=unzipSync(new Uint8Array(await readFile(f)));
 const rel='ppt/slideMasters/_rels/slideMaster1.xml.rels';zip[rel]=strToU8(strFromU8(zip[rel]).replace('</Relationships>','<Relationship Id="external" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://example.com/a.png" TargetMode="External"/></Relationships>'));
 await writeFile(f,zipSync(zip));await expect(store.import(f)).rejects.toThrow(/外部/);
});

it('模板绝对资源路径重新定位到导入区，4:3 正文尺寸用于分页',async()=>{
 const dir=await temp(),file=path.join(dir,'four-three.pptx');await source(file);
 const zip=unzipSync(new Uint8Array(await readFile(file)));
 zip['ppt/presentation.xml']=strToU8(strFromU8(zip['ppt/presentation.xml']).replace(/(<p:sldSz[^>]*cx=")\d+/, '$19144000'));
 const layout='ppt/slideLayouts/slideLayout1.xml';
 zip[layout]=strToU8(strFromU8(zip[layout]).replace('</p:spTree>','<p:sp><p:nvSpPr><p:cNvPr id="30" name="Body"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="914400" y="1828800"/><a:ext cx="7315200" cy="3657600"/></a:xfrm></p:spPr></p:sp></p:spTree>'));
 const masterRel='ppt/slideMasters/_rels/slideMaster1.xml.rels';
 zip[masterRel]=strToU8(strFromU8(zip[masterRel]).replace('Target="../theme/theme1.xml"','Target="/ppt/theme/theme1.xml"'));
 await writeFile(file,zipSync(zip));const store=new TemplateStore(path.join(dir,'library')),template=await store.import(file);
 expect(template.layout.width).toBe(10);expect(template.layout.body).toEqual({x:1,y:2,w:8,h:4});
 const out=path.join(dir,'out.pptx'),p=demoProject();await exportPpt(p,out,defaultLessonSelection(p),await store.load(template.id));
 const result=unzipSync(new Uint8Array(await readFile(out))),rel=strFromU8(result['lessonTemplate/'+masterRel]);
 expect(rel).not.toContain('Target="/ppt/');expect(rel).toContain('../theme/theme1.xml');
});
