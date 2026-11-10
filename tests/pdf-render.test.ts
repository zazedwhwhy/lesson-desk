import { expect, it } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

it('PDF clipping renders with the same native canvas used by OCR and thumbnails', async () => {
    const stream = 'q 10 10 40 40 re W* n 0 0 100 100 re f Q';
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> /Contents 4 0 R >>',
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (const [i, object] of objects.entries()) {
        offsets.push(Buffer.byteLength(pdf));
        pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
    }
    const xref = Buffer.byteLength(pdf);
    pdf += 'xref\n0 5\n0000000000 65535 f \n' + offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('');
    pdf += `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const task = getDocument({ data: new Uint8Array(Buffer.from(pdf)) });
    try {
        const doc = await task.promise;
        const page = await doc.getPage(1);
        const canvas = createCanvas(100, 100);
        await page.render({ canvas: canvas as any, canvasContext: canvas.getContext('2d') as any, viewport: page.getViewport({ scale: 1 }) }).promise;
        expect(Array.from(canvas.getContext('2d').getImageData(20, 80, 1, 1).data)).toEqual([0, 0, 0, 255]);
        expect(Array.from(canvas.getContext('2d').getImageData(80, 20, 1, 1).data)).toEqual([255, 255, 255, 255]);
    } finally {
        await task.destroy();
    }
}, 20000);
