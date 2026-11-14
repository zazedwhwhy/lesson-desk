import {pdfReadingLines} from '../core/pdf-reading-lines';
import { unzipSync } from 'fflate';
import fs from 'node:fs/promises';
import path from 'node:path';
import mammoth from 'mammoth';
import sanitize from 'sanitize-html';
import { uid, type Source } from '../core/model';
export async function readDocument(file: string, role: Source['role']): Promise<{
    source: Source;
    bytes: Uint8Array;
}> { const bytes = new Uint8Array(await fs.readFile(file)); if (bytes.length > 30 * 1024 * 1024)
    throw Error('单文件不能超过30 MB'); const ext = path.extname(file).toLowerCase(); const source: Source = { id: uid(), name: path.basename(file), role, kind: ext === '.pdf' ? 'pdf' : 'docx', blocks: [] }; source.warnings = [];source.ocrPages=[]; if (ext === '.pdf') {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await getDocument({ data: bytes.slice(), useSystemFonts: true }).promise;
    try {
        if (doc.numPages > 100)
            throw Error('PDF不能超过100页');
        for (let n = 1; n <= doc.numPages; n++) {
            const page = await doc.getPage(n);
            const c = await page.getTextContent();
            const rows = c.items.filter((x): x is any => 'str' in x).map((x: any) => ({ text: x.str as string, x: x.transform[4] as number, y: x.transform[5] as number, width:x.width as number,height:x.height as number }));
            if(rows.map(r=>r.text).join('').trim().length<30){source.ocrPages.push(n);source.warnings.push('第'+n+'页没有足够文字，需扫描识别。');continue;}
            const w = page.getViewport({ scale: 1 }).width;
            source.warnings.push(`第${n}页：阅读顺序由版面估算，请对照原页核对。`);
            for(const line of pdfReadingLines(rows,w))source.blocks.push({id:uid(),text:line.text,page:n,x:line.x,y:line.y});
        }
    }
    finally {
        await doc.loadingTask.destroy();
    }
    
}
else if (ext === '.docx') {
    let expanded = 0, count = 0;
    unzipSync(bytes, { filter: f => { expanded += f.originalSize; if (++count > 2000 || expanded > 120 * 1024 * 1024)
            throw Error('Word文档解压内容超限'); return false; } });
    const r = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) }, { externalFileAccess: false });
    const safe = sanitize(r.value, { allowedTags: ['p', 'br', 'table', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'li', 'img', 'sub', 'sup'], allowedAttributes: { img: ['src'] }, allowedSchemes: ['data'] });
    source.previewHtml = safe;
    const scriptChars=(value:string,kind:string)=>[...value].map(c=>{const from='0123456789+-=()',to=kind==='sub'?'₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎':'⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾';const i=from.indexOf(c);return i>=0?to[i]:c;}).join('');
    const text = safe.replace(/<(sub|sup)>(.*?)<\/\1>/g,(_,kind,value)=>scriptChars(value,kind)).replace(/<img[^>]*>/g, '\n[原文含图片，请对照原文件补充必要文字]\n').replace(/<\/(p|tr|h[1-3]|li)>/g, '\n').replace(/<\/(td|th)>/g, ' | ').replace(/<br\s*\/?\s*>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    source.blocks = text.split('\n').filter(x => x.trim()).map(text => ({ id: uid(), text }));
    if (!source.blocks.length)
        throw Error('Word文档没有可提取内容');
}
else
    throw Error('仅支持PDF与DOCX，旧版DOC请另存为DOCX'); return { source, bytes }; }
