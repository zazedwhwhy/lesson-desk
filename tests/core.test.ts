import { describe, it, expect } from 'vitest';
import { issues, reviseProject, buildDeck, validateBundlePath } from '../src/core/logic';
import { demoProject } from '../src/core/demo';
describe('审阅和版本', () => {
    it('缺答案阻止确认', () => { const p = demoProject(); p.questions[0].answer = ''; expect(issues(p, p.questions[0])).toContain('缺少参考答案'); });
    it('重复题号只在同组判重，ID保持独立', () => { const p = demoProject(); p.questions.push({ ...p.questions[0], id: 'other' }); expect(issues(p, p.questions[0])).toContain('同组题号重复'); });
    it('改答案让已有解析过期', () => { const p = demoProject(); const next = structuredClone(p); next.questions[0].answer = 'B'; expect(reviseProject(p, next).questions[0].stale).toBe(true); });
    it('所有页面保持顺序且题目页不漏答案', () => { const p = demoProject(); const d = buildDeck(p); expect(d.length).toBeGreaterThan(4); const q = d.find(x => x.kind === 'question')!; expect(q.body.join('')).not.toContain('参考答案'); expect(d.some(x => x.kind === 'practice-answer')).toBe(true); });
    it('长内容分页且不丢字', () => { const p = demoProject(); p.passages[0].paragraphs[0].text = 'Long sentence. '.repeat(800); const d = buildDeck(p); expect(d.filter(x => x.kind === 'passage').length).toBeGreaterThan(10); });
    it('大量短行按行高分页且保持原文', () => { const p = demoProject(); const text = 'short\n'.repeat(60); p.passages[0].paragraphs[0].text = text; const pages = buildDeck(p).filter(s => s.kind === 'passage'); expect(pages.length).toBeGreaterThan(5); expect(pages.map(p => p.body.join('')).join('')).toBe(text); });
    it.each(['../secret', 'C:/secret', 'a/../../secret', 'a\\secret', '/secret'])('拒绝危险包路径 %s', x => expect(() => validateBundlePath(x)).toThrow());
});
