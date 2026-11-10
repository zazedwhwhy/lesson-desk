import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import{it,expect}from'vitest';import{friendlyError}from'../src/core/errors';import{readDocument}from'../src/desktop/documents';
it('扫描件导入保留材料并标记待识别',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'lesson-scan-'));
 try{
  // A self-contained image-only page, with no external paper or account needed.
  const objects=[
   '<< /Type /Catalog /Pages 2 0 R >>',
   '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
   '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>',
   '<< /Length 30 >>\nstream\nq 200 0 0 200 20 20 cm /Im0 Do Q\nendstream',
   '<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length 3 >>\nstream\n\xff\xff\xff\nendstream'
  ];
  let pdf='%PDF-1.4\n';const offsets=[0];
  objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(pdf,'latin1'));pdf+=`${i+1} 0 obj\n${object}\nendobj\n`;});
  const start=Buffer.byteLength(pdf,'latin1');
  pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  const bytes=Buffer.from(pdf,'latin1'),file=path.join(dir,'synthetic-scan.pdf');await writeFile(file,bytes);
  const r=await readDocument(file,'paper');expect(r.source.blocks).toEqual([]);expect(r.source.ocrPages).toEqual([1]);expect(Buffer.from(r.bytes)).toEqual(bytes);
 }finally{await rm(dir,{recursive:true,force:true});}
});
it('界面隐藏Electron远程调用前缀',()=>{expect(friendlyError(new Error("Error invoking remote method 'desk:files': Error: 原材料不足"))).toBe('原材料不足');});
