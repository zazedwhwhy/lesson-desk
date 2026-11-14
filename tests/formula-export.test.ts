import {it,expect} from 'vitest';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {unzipSync,strFromU8} from 'fflate';
import {exportLessonSlides} from '../src/desktop/export';
import {loadImage} from '@napi-rs/canvas';
it('PPT保留正文、公式SVG、有效PNG预览和LaTeX替代文本',async()=>{const dir=await mkdtemp(path.join(os.tmpdir(),'formula-ppt-'));try{const file=path.join(dir,'out.pptx');await exportLessonSlides([{title:'反应条件',section:'合成测试',kind:'analysis',blocks:[{label:'原理',text:String.raw`反应式 $\ce{2H2 + O2 ->[\Delta] 2H2O}$。浓度 $\frac{n}{V}$。`}]}],'合成测试','chemistry',file);const files=unzipSync(new Uint8Array(await readFile(file)));const xml=strFromU8(files['ppt/slides/slide1.xml']);expect(xml).toContain('反应式');expect(xml).toContain('asvg:svgBlip');expect(xml).toContain('\\ce');const svg=Object.keys(files).filter(n=>n.endsWith('.svg'));expect(svg.length).toBe(2);for(const name of svg){expect(strFromU8(files[name])).toContain('<path');expect(strFromU8(files[name])).not.toContain('currentColor');}const png=Object.keys(files).filter(n=>n.endsWith('.png'));expect(png).toHaveLength(2);for(const name of png){const image=await loadImage(Buffer.from(files[name]));expect(image.width).toBeGreaterThan(10);expect(image.height).toBeGreaterThan(10);}}finally{await rm(dir,{recursive:true,force:true});}},15000);
