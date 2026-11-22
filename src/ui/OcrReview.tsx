import React, { useEffect, useRef, useState } from 'react';
import type { Project, Source } from '../core/model';
import { pendingOcrPages } from '../core/source-fidelity';
import { ocrPageKey, type OcrReviewPage, type OcrReviewRequest } from '../core/ocr-review';
import { friendlyError } from '../core/errors';
import { invoke } from './api';
import { loadOcrPagePreview } from './ocr-page-preview';
import './ocr-review.css';

export function OcrReview({ project: p, onProject, onSavingChange, disabled = false }: { project: Project; onProject: (p: Project) => void; disabled?: boolean; onSavingChange?: (saving:boolean)=>void }) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [image, setImage] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string[]>([]);
  const [previewError, setPreviewError] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [actionKeys, setActionKeys] = useState<string[]>([]);
  const [saving, setSaving] = useState(false), [message, setMessage] = useState('');
  const previews = useRef(new Map<string, AbortController>()), saveLock = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; for (const c of previews.current.values()) c.abort(); previews.current.clear(); }; }, []);
  const pages = p.sources.flatMap(source => pendingOcrPages(source).map(page => ({ source, page, key: ocrPageKey(source.id, page) })));
  const blocksFor = (source: Source, page: number) => source.blocks.filter(b => b.page === page);
  const dirty = (source: Source, page: number) => blocksFor(source, page).some(b => draft[b.id] !== undefined && draft[b.id] !== b.text);
  const ready = pages.filter(({ source, page }) => !source.ocrPages?.includes(page));
  const chosen = ready.filter(({ key }) => selected.includes(key));
  const hasUnsavedSelection = chosen.some(({ source, page }) => dirty(source, page));
  const locked = disabled || saving;
  const entry = (source: Source, page: number): OcrReviewPage => ({ sourceId: source.id, page, expectedBlocks: structuredClone(blocksFor(source, page)) });

  async function preview(source: Source, page: number) {
    const key = ocrPageKey(source.id, page);
    if (previews.current.has(key)) return;
    const controller = new AbortController(); previews.current.set(key, controller);
    setLoading(keys => [...keys, key]); setPreviewError(errors => ({ ...errors, [key]: '' }));
    try {
      const url = await loadOcrPagePreview(p.id, source.id, page, controller.signal);
      if (mounted.current && !controller.signal.aborted) setImage(images => ({ ...images, [key]: url }));
    } catch (error) {
      if (mounted.current) setPreviewError(errors => ({ ...errors, [key]: friendlyError(error) }));
    } finally {
      previews.current.delete(key);
      if (mounted.current) setLoading(keys => keys.filter(k => k !== key));
    }
  }

  async function save(request: OcrReviewRequest) {
    if (disabled || saveLock.current) return;
    saveLock.current = true; setSaving(true); onSavingChange?.(true); setMessage('');
    setActionKeys((request.kind === 'verify' ? request.pages : [request.page]).map(v => ocrPageKey(v.sourceId, v.page)));
    try {
      const saved: Project = await invoke('save-ocr-review', p.id, request);
      if (!mounted.current) return;
      onProject(saved);
      if (request.kind === 'verify') {
        const keys = request.pages.map(v => ocrPageKey(v.sourceId, v.page));
        for (const key of keys) previews.current.get(key)?.abort();
        setSelected(items => items.filter(key => !keys.includes(key)));
        setMessage(`已记录 ${keys.length} 页人工核对结果；全部核对后可整理试卷。`);
      } else if(request.kind==='restore'){
        const ids=new Set(request.page.expectedBlocks.map(b=>b.id));
        setDraft(values=>Object.fromEntries(Object.entries(values).filter(([id])=>!ids.has(id))));
        setMessage('已恢复本页上次修改前文字，请对照原页核对。');
      } else {
        // Saving one page must not discard unsaved edits on another page.
        setDraft(values => Object.fromEntries(Object.entries(values).filter(([id]) => !Object.hasOwn(request.texts, id))));
        setMessage('本页校订已保存，原始转录仍保留；请核对后确认通过。');
      }
    } catch (error) { if (mounted.current) setMessage(friendlyError(error)); }
    finally { saveLock.current = false; onSavingChange?.(false); if (mounted.current) setSaving(false); }
  }

  if (!pages.length) return message ? <section className="paper-sheet" aria-label="OCR原页核对"><h2>OCR 原页核对完成</h2><p role="status">全部页面已核对，可继续整理试卷。</p></section> : null;
  return <section className="paper-sheet ocr-review" aria-label="OCR原页核对">
    <h2>OCR 原页核对</h2>
    <p>请对照原图核对题号、空号、选项、公式和原题错字。可在这里显示原图，也可对照已打开的原PDF；确认通过表示你已人工核对。</p>
    <div className="ocr-review-toolbar paper-inset">
      <strong>待核对 {pages.length} 页 · 已选择 {chosen.length} 页</strong>
      <div className="actions">
        <button disabled={locked || !ready.length} onClick={() => setSelected(ready.map(v => v.key))}>全选待核对页</button>
        <button disabled={locked || !selected.length} onClick={() => setSelected([])}>清空选择</button>
        <button className="primary" aria-busy={saving} disabled={locked || !chosen.length || hasUnsavedSelection} onClick={() => void save({ kind: 'verify', pages: chosen.map(({ source, page }) => entry(source, page)) })}>批量通过所选页（{chosen.length}）</button>
      </div>
      {hasUnsavedSelection && <p role="status">所选页面有未保存的校订，请先保存，或取消选择这些页面。</p>}
      {saving && <p role="status">正在保存核对结果…</p>}
    </div>
    {message && <p role="status">{message}</p>}
    {pages.map(({ source, page, key }) => {
      const blocks = blocksFor(source, page), changed = dirty(source, page), recognizing = source.ocrPages?.includes(page), fetching = loading.includes(key);
      return <div className="ocr-review-page" key={key}>
        <label className="ocr-review-select"><input type="checkbox" aria-label={`选择 ${source.name} 第${page}页`} checked={selected.includes(key)} disabled={locked || recognizing} onChange={e => setSelected(items => e.target.checked ? [...new Set([...items, key])] : items.filter(k => k !== key))}/>选择此页</label>
        <details><summary>{source.name} · 第{page}页待核对</summary>
          <div className="actions">
            <button aria-busy={fetching} disabled={disabled || fetching} onClick={() => void preview(source, page)}>{fetching ? `第${page}页原图加载中…` : image[key] ? `重新显示第${page}页原图` : `显示第${page}页原图`}</button>
            {fetching && <button onClick={() => previews.current.get(key)?.abort()}>取消第{page}页加载</button>}
          </div>
          {previewError[key] && <p role="status">{previewError[key]}</p>}
          {image[key] && <img src={image[key]} alt={'OCR核对原页' + page} style={{ maxWidth: '100%', objectFit: 'contain' }}/>}
          {blocks.map((b, i) => <label key={b.id}>第{page}页段落{i + 1}<textarea disabled={locked} aria-label={'OCR第' + page + '页段落' + (i + 1)} value={draft[b.id] ?? b.text} onChange={e => setDraft(values => ({ ...values, [b.id]: e.target.value }))}/></label>)}
          <div className="actions">
            <button disabled={locked || !changed || recognizing} onClick={() => void save({ kind: 'correct', page: entry(source, page), texts: Object.fromEntries(blocks.filter(b => draft[b.id] !== undefined && draft[b.id] !== b.text).map(b => [b.id, draft[b.id]])) })}>保存本页校订</button>
            <button disabled={locked || changed || recognizing} onClick={() => void save({ kind: 'verify', pages: [entry(source, page)] })}>已对照原图核对第{page}页</button>
            {source.ocrCorrections?.some(h=>h.page===page&&h.before.length)&&<button disabled={locked||changed||recognizing} onClick={()=>void save({kind:'restore',page:entry(source,page)})}>恢复本页上次修改前文字</button>}
          </div>
          {actionKeys.includes(key) && (saving || message) && <p role="status">{saving ? '正在保存本页核对结果…' : message}</p>}
          {changed && <p>请先保存校订，再确认本页。</p>}
          {recognizing && <p>本页尚未识别完成，暂不能通过核对。</p>}
        </details>
      </div>;
    })}
  </section>;
}
