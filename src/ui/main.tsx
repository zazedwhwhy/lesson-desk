import {PresentationView} from './PresentationView';
import {PreparationPage} from './PreparationPage';
import {SourceMaterials} from './SourceMaterials';
import {ChemistryWorkspace} from './ChemistryWorkspace';
import {Notebook} from './Notebook';
import {defaultPptTemplate,type PptTemplate} from '../core/ppt-templates';
import {LessonSlideView} from './LessonSlideView';
import {ChineseWorkspace} from './ChineseWorkspace';
import {PromptSettings} from './PromptSettings';
import{optionEntries}from'../core/options';
import{friendlyError}from'../core/errors';
import { applyReviewBatch, type ReviewAction } from '../core/review';
import { ReviewBatch, SelectionBox } from './ReviewBatch';
import {GenerationControls}from'./GenerationControls';
import {PreparationOutputs} from './PreparationOutputs';
import{type GenerationContent}from'../core/generation-model';
import { ProofreadPanel, type ReviewLocation } from './ProofreadPanel';
import{SpecialPanel}from'./SpecialPanel';
import{specialFingerprint}from'../core/special';
import {WorkspaceHeader} from './WorkspaceHeader';
import {LessonSetup} from './LessonSetup';
import {buildLessonDeck,defaultLessonSelection,type LessonSelection,type LessonSlide}from'../core/lesson-deck';
import {LearningPanel,learningTabs,learningNames} from './LearningPanel';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BookOpen, Upload, Settings as SettingsIcon, Play, Download, ArrowLeft, Menu, Maximize, Plus, Save, Check, ChevronLeft, ChevronRight, X, Trash2 } from 'lucide-react';
import { active, emptyProject, uid, labels, types, defaultSettings, type Project, type Settings, type Question } from '../core/model';
import { issues, reviseProject,teachingSource } from '../core/logic';
import { demoProject } from '../core/demo';
import { invoke } from './api';
import './style.css';
function App() {
    const [returnScreen,setReturnScreen]=useState('review');
    const goSettings=()=>{setReturnScreen(screen);setScreen('settings');};
    const [pptTemplate,setPptTemplate]=useState<PptTemplate>(defaultPptTemplate),[templatePending,setTemplatePending]=useState(false);
    const [p, setP] = useState<Project | null>(null), [list, setList] = useState<any[]>([]), [screen, setScreen] = useState('home'), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false), [settings, setSettings] = useState<Settings>(defaultSettings), [index, setIndex] = useState(0), [mode, setMode] = useState('compare'), [font, setFont] = useState(24), [cn, setCn] = useState(false), [toc, setToc] = useState(true), [reveal, setReveal] = useState<string[]>([]), [slide, setSlide] = useState(0), [selected, setSelected] = useState<string[]>([]), [split, setSplit] = useState(50), [tab, setTab] = useState('解析'), [sourceId, setSourceId] = useState(''), [paste, setPaste] = useState(''), [newTitle,setNewTitle]=useState('英语试卷讲解'),[recallMode,setRecallMode]=useState(false);
    const [lessonSelection,setLessonSelection]=useState<LessonSelection>({passageIds:[],questionIds:[],modules:{}}),[presentationDeck,setPresentationDeck]=useState<LessonSlide[]>([]);
    useEffect(()=>{notebookRoot.render(<Notebook project={p}/>);},[p]);
    const [subject,setSubject]=useState<'english'|'chinese'|'chemistry'>('english');
    const [generationKinds,setGenerationKinds]=useState<GenerationContent[]>(['analysis']);
    const [reviewSelected, setReviewSelected] = useState<string[]>([]), [reviewReport, setReviewReport] = useState<string[]>([]);
    useEffect(() => { setReviewSelected([]); setReviewReport([]); }, [p?.id]);
    const refresh = () => invoke('list').then(setList).catch(e => setMsg(String(e)));
    useEffect(() => { if (window.desk) {
        refresh();
        invoke('settings').then(setSettings).catch(e => setMsg(String(e)));
        return window.desk.onProgress(({ project, message }) => { if(project)setP(project); setMsg(message); });
    } setList([{ id: 'preview', title: '国家公园 · 英语讲题示例', example: true }]); }, []);
    async function run(fn: () => Promise<any>) { setBusy(true); setMsg(''); try {
        return await fn();
    }
    catch (e) {
        setMsg(friendlyError(e));
    }
    finally {
        setBusy(false);
    } }
    async function save(next: Project) { if (!p)
        return; const updated = reviseProject(p, next); if (window.desk) {
        const saved = await invoke('save', updated);
        setP(saved);
        return saved;
    } setP(updated); return updated; }
    async function change(fn: (v: Project) => void) { if (!p)
        return; const n = structuredClone(p); fn(n); return save(n); }
    async function open(id: string) { await run(async () => { const v = id === 'preview' ? demoProject() : await invoke('load', id); setP(v); setSelected(v.questions.filter((q: Question) => !q.excluded).map((q: Question) => q.id)); setIndex(0); setScreen('teach'); }); }
    async function removeProject(id:string){await run(async()=>{
        const result=await invoke('delete-project',id);if(!result.deleted)return;
        if(p?.id===id){setP(null);setSelected([]);setReveal([]);setSourceId('');}
        setList(await invoke('list'));setMsg('课件已移到系统回收站，需要时可从回收站恢复。');
    });}
    const deck = presentationDeck;
    const openLessonSetup=()=>{if(!p)return;setLessonSelection(defaultLessonSelection(p));setScreen('lesson-setup');};
    const startLesson=()=>{if(!p)return;try{setPresentationDeck(buildLessonDeck(p,lessonSelection,pptTemplate.layout));setSlide(0);setScreen('show');}catch(e){setMsg(friendlyError(e));}};
    const a = p?.passages[index];
    const qs = p?.questions.filter(q => q.passageId === a?.id && !q.excluded) || [];
    const full = () => window.desk ? invoke('fullscreen') : document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    const btn = (text: string, fn: () => void, Icon?: any, cls = '') => <button className={cls} onClick={fn} disabled={busy}>{Icon && <Icon size={17}/>} {text}</button>;
    const task = (name: string, ...args: any[]) => run(async () => { const result = await invoke(name, ...args); if (result && typeof result === 'object' && result.schemaVersion) {
        setP(result);if(name==='files'){setSourceId(result.sources.at(-1)?.id||'');if(result.sources.some((s:any)=>s.ocrPages?.length))setMsg('PDF已保存。检测到扫描页，请点击“识别扫描页”，完成后再整理试卷。');}
        setSelected(result.questions.filter((q: Question) => !q.excluded).map((q: Question) => q.id));
    } return result; });
    function editQuestion(q: Question, key: keyof Question, value: any) { return run(() => change(n => { Object.assign(n.questions.find(x => x.id === q.id)!, { [key]: value }); })); }
    const batchReview = (action: ReviewAction) => run(async () => {
        if (!p) return;
        const result = applyReviewBatch(p, reviewSelected.filter(id=>p.questions.some(q=>q.id===id)), action);
        await save(result.project);
        const names = { confirm: '核对', exclude: '排除', restore: '恢复', unconfirm: '取消核对' };
        setReviewReport([
            '已'+names[action]+' '+result.changed+' 题'+(result.skipped.length ? '；跳过 '+result.skipped.length+' 题' : '')+'。',
            ...result.skipped.map(q => '第 '+q.number+' 题：'+q.reason)
        ]);
    });
    function locateReview(where: ReviewLocation) {
        if(where.sourceId)setSourceId(where.sourceId);
        setTimeout(()=>{
            const id=where.sourceId?(where.blockId?'review-source-'+where.sourceId+'-'+where.blockId:'review-source-list'):where.questionId?'review-q-'+where.questionId:where.passageId?'review-group-'+where.passageId:'review-question-list';
            const el=document.getElementById(id);
            if(!el){setMsg('关联内容已变化，请重新校对或从材料列表查找');return;}
            el.scrollIntoView({behavior:'smooth',block:'start'});el.classList.add('review-target');
            el.tabIndex=-1;el.focus({preventScroll:true});
            setTimeout(()=>el.classList.remove('review-target'),2400);
        },0);
    }
    const importFiles = (role: string) => p && task('files', p.id, role);
    function highlight(text: string) { const quotes = qs.filter(q => reveal.includes(q.id)).flatMap(q => active(q)?.evidence || []).filter(r => r.quote && text.includes(r.quote)); if (!quotes.length)
        return text; const spans: {
        s: number;
        e: number;
    }[] = []; for (const q of quotes) {
        const s = text.indexOf(q.quote);
        spans.push({ s, e: s + q.quote.length });
    } spans.sort((a, b) => a.s - b.s); let pos = 0; const parts: React.ReactNode[] = []; for (const r of spans) {
        if (r.s < pos)
            continue;
        parts.push(text.slice(pos, r.s), <mark key={r.s}>{text.slice(r.s, r.e)}</mark>);
        pos = r.e;
    } parts.push(text.slice(pos)); return parts; }
    if(p?.subject==='chemistry'&&!['home','settings','prompts'].includes(screen))return <ChemistryWorkspace key={p.id} project={p} onProject={setP} onSave={save} home={()=>{setScreen('home');refresh();}} settings={()=>setScreen('settings')} message={msg}/>;

    if (screen === 'show' && p && p.subject!=='chinese') return <PresentationView deck={deck} template={pptTemplate} title={p.title} back={()=>setScreen('lesson-setup')} fullscreen={()=>void full()}/>;
    return <>{p?.subject==='chinese'&&screen!=='home'&&<div hidden={['settings','prompts'].includes(screen)}><ChineseWorkspace key={p.id} screen={['settings','prompts'].includes(screen)?returnScreen:screen} onScreen={setScreen} template={pptTemplate} onTemplate={setPptTemplate} templatePending={templatePending} onTemplatePending={setTemplatePending} project={p} onProject={setP} onSave={save} home={()=>{setScreen('home');refresh();}} settings={goSettings} generationSettings={settings} message={msg}/></div>}{(p?.subject!=='chinese'||['home','settings','prompts'].includes(screen))&&<WorkspaceHeader title={p?.title} screen={screen} busy={busy} font={font} mode={mode} translated={cn} setFont={setFont} setMode={setMode} setTranslated={setCn} home={()=>{setScreen('home');refresh();}} prepare={()=>setScreen(screen==='review'?'teach':'review')} present={openLessonSetup} exportDeck={openLessonSetup} fullscreen={()=>void full()} answers={()=>{setTab('答案');setMode('analysis');}} settings={goSettings}/>}
    {msg && (p?.subject!=='chinese'||['home','settings','prompts'].includes(screen)) && <div className="notice" role="status">{msg}<button aria-label="关闭提示" onClick={() => setMsg('')}><X size={16}/></button></div>}
    {screen === 'home' && <main className="home" data-screen-label="课件列表"><div className="page-title"><div><h1>我的课件</h1><p>选择已有课件，或导入一份新试卷。</p></div><div className="new-project"><label>课件名称<input aria-label="课件名称" value={newTitle} onChange={e=>setNewTitle(e.target.value)}/></label><label>学科<select aria-label="学科" value={subject} onChange={e=>{const v=e.target.value as 'english'|'chinese'|'chemistry';setSubject(v);setNewTitle(v==='chemistry'?'化学试卷讲解':v==='chinese'?'语文试卷讲解':'英语试卷讲解');}}><option value="english">英语</option><option value="chinese">语文</option><option value="chemistry">化学（测试版）</option></select></label>{btn('新建课件',()=>run(async()=>{if(!newTitle.trim())throw Error('请填写课件名称');setP(await invoke('create',newTitle.trim(),subject));setSelected([]);setIndex(0);setScreen('review');}),Plus,'primary')}</div></div><div className="home-actions">{btn('导入课件包', () => run(async () => { const v = await invoke('import-bundle'); if (v) {
        setP(v);
        setSelected(v.questions.filter((q: Question) => !q.excluded).map((q: Question) => q.id));
        setScreen('teach');
    } }), Upload)}{btn('体验教学示例',()=>task('example').then(v=>{if(v){setScreen('teach');setIndex(0);}}),BookOpen)}<span>英语、语文与化学 · 整卷备课与授课</span></div><section className="project-list">{list.map(item => <div className="project-entry" key={item.id}><button className="project-row" disabled={busy} onClick={() => open(item.id)}><BookOpen size={30}/><span><strong>{item.title}</strong><small>{item.example ? '示例课件 · 内容已预置，不代表AI已连接' : item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '文件读取异常'}</small></span><span>打开课件</span></button><button className="delete-project" aria-label={'删除课件：'+item.title} disabled={busy||!window.desk} onClick={()=>removeProject(item.id)}><Trash2 size={16}/>删除</button></div>)}{!list.length&&<p className="empty">还没有课件，可以新建课件或导入课件包。</p>}</section><aside className="home-note"><h2>从一张试卷开始</h2><p>支持电子 PDF 和 Word（DOCX）。生成前可核对题目与答案，生成后可修改讲解、保存课件并导出 PowerPoint。</p></aside></main>}
    {screen === 'prompts' && <PromptSettings back={()=>setScreen('settings')}/>}
    {screen === 'settings' && <main className="settings panel" data-screen-label="模型设置"><h1>模型设置</h1><button onClick={()=>setScreen('prompts')}>查看与编辑提示词</button><p>材料按需发送给所选API服务。课件保存在本机，API Key不随课件导出。</p><label>服务商<select value={settings.provider} onChange={e => { const provider = e.target.value as Settings['provider']; setSettings({ ...settings, provider, model: provider === 'deepseek' ? 'deepseek-flash' : '', baseUrl: provider === 'openai' ? 'https://api.openai.com/v1' : provider === 'deepseek' ? 'https://api.deepseek.com' : '', key: '' }); }}><option value="deepseek">DeepSeek</option><option value="openai">OpenAI</option><option value="custom">OpenAI兼容接口</option></select></label><label>模型名称<input value={settings.model} onChange={e => setSettings({ ...settings, model: e.target.value })}/></label><label>API地址<input value={settings.baseUrl} onChange={e => setSettings({ ...settings, baseUrl: e.target.value })}/></label><fieldset><legend>每篇生成数量</legend><label>句法拆解句子数<select aria-label="句法拆解句子数" value={settings.sentenceCount??0} onChange={e=>setSettings({...settings,sentenceCount:Number(e.target.value)})}><option value={0}>自动（最多4句）</option>{Array.from({length:8},(_,i)=><option key={i+1} value={i+1}>{i+1}句</option>)}</select></label><label>词汇手账词条数<select aria-label="词汇手账词条数" value={settings.lexiconCount??0} onChange={e=>setSettings({...settings,lexiconCount:Number(e.target.value)})}><option value={0}>自动（最多8项）</option>{Array.from({length:20},(_,i)=><option key={i+1} value={i+1}>{i+1}个词/语块</option>)}</select></label><p className="muted">保存设置后生效，适用于整理材料和单篇生成。素材不足或教学价值不足时可以少选，不凑数。</p></fieldset><label>API Key {settings.hasKey ? '（已安全保存，留空保留）' : ''}<input type="password" autoComplete="off" value={settings.key || ''} onChange={e => setSettings({ ...settings, key: e.target.value })}/></label><div className="actions">{btn('保存设置', () => run(async () => { await invoke('save-settings', settings); setSettings(await invoke('settings')); setMsg('设置已保存'); }), Save, 'primary')}{btn('返回', () => setScreen(p ? p.subject==='chemistry'?'review':returnScreen : 'home'))}</div><p className="muted">请填写你账号可用的模型名称。程序不会在失败时自动切换服务商。</p></main>}
    {screen === 'review' && p && p.subject!=='chinese' && <PreparationPage organize={<button className="primary" disabled={busy||!p.sources.length||p.sources.some(s=>!!s.ocrPages?.length)} onClick={() => { if (p.questions.length && !confirm('重新整理将替换当前题目和讲解，建议先保存课件包。继续？'))
        return; task('organize', p.id); }}>整理试卷</button>} materials={<SourceMaterials paste={paste} setPaste={setPaste} project={p} busy={busy} sourceId={sourceId} setSourceId={setSourceId} change={change} run={run} task={task}/>} questions={<section className="panel" id="review-question-list"><h2>题目与答案</h2><div className="actions">{btn('新增材料组', () => run(() => change(n => n.passages.push({ id: uid(), title: '新材料', type: 'reading', paragraphs: [{ id: uid(), text: '' }], translation: '', vocabulary: '', longSentences: '', pool: '' }))), Plus)}</div>{!!p.questions.length && <ReviewBatch p={p} selected={reviewSelected} setSelected={setReviewSelected} busy={busy} apply={batchReview} report={reviewReport}/>}{!p.passages.length && <p className="empty">上传材料后点击“整理试卷”，也可手工新增材料与题目。</p>}{p.passages.map((pa, pi) => <section className="group-edit" key={pa.id} id={'review-group-'+pa.id}><input aria-label="材料标题" defaultValue={pa.title} onBlur={e => run(() => change(n => { n.passages[pi].title = e.target.value; }))}/><select aria-label="题型" value={pa.type} onChange={e => run(() => change(n => { n.passages[pi].type = e.target.value as any; n.questions.filter(q => q.passageId === pa.id).forEach(q => q.type = e.target.value as any); }))}>{types.map(t => <option key={t} value={t}>{labels[t]}</option>)}</select><label>材料原文（空行分段）<textarea defaultValue={pa.paragraphs.map(b => b.text).join('\n\n')} onBlur={e => run(() => change(n => { n.passages[pi].paragraphs = e.target.value.split('\n\n').map((text, i) => ({ id: pa.paragraphs[i]?.id || uid(), text })); }))}/></label>{pa.type === 'seven' && <label>共用选项池<textarea defaultValue={pa.pool} onBlur={e => run(() => change(n => { n.passages[pi].pool = e.target.value; }))}/></label>}<div className="actions">{pi > 0 && btn('材料上移', () => run(() => change(n => { [n.passages[pi - 1], n.passages[pi]] = [n.passages[pi], n.passages[pi - 1]]; })))}{btn('新增题目', () => run(() => change(n => n.questions.push({ id: uid(), number: String(n.questions.length + 1), passageId: pa.id, type: pa.type, stem: '', options: [], answer: '', confirmed: false, excluded: false, stale: false, versions: [] }))), Plus)}</div><div className="group-selection"><SelectionBox ids={p.questions.filter(q=>q.passageId===pa.id).map(q=>q.id)} selected={reviewSelected} setSelected={setReviewSelected} disabled={busy} label="选择本组"/><span>{p.questions.filter(q=>q.passageId===pa.id&&q.confirmed&&!q.excluded).length} 题已核对 · {p.questions.filter(q=>q.passageId===pa.id&&q.excluded).length} 题已排除</span></div>{p.questions.filter(q => q.passageId === pa.id).map(q => <div className={'question-edit ' + (q.excluded ? 'excluded ' : '') + (reviewSelected.includes(q.id) ? 'is-selected' : '')} key={q.id} id={'review-q-'+q.id}><div className="actions"><SelectionBox ids={[q.id]} selected={reviewSelected} setSelected={setReviewSelected} disabled={busy} label={'选择第 '+q.number+' 题'}/><label>题号<input value={q.number} onChange={e => setP({ ...p, questions: p.questions.map(x => x.id === q.id ? { ...x, number: e.target.value } : x) })} onBlur={() => run(() => save(p))}/></label><label><input type="checkbox" checked={q.excluded} disabled={busy} onChange={e => run(() => change(n => { const nq=n.questions.find(x=>x.id===q.id)!; nq.excluded=e.target.checked; nq.confirmed=false; }))}/>排除本题</label><label><input type="checkbox" checked={q.confirmed} disabled={busy || q.excluded || issues(p, q).length > 0} onChange={e => editQuestion(q, 'confirmed', e.target.checked)}/>已核对</label></div><label>题干<textarea defaultValue={q.stem} onBlur={e => editQuestion(q, 'stem', e.target.value)}/></label><label>选项（每行一项）<textarea defaultValue={q.options.join('\n')} onBlur={e => editQuestion(q, 'options', e.target.value.split('\n').filter(Boolean))}/></label><label>参考答案<textarea aria-label="参考答案" rows={['writing','continuation'].includes(q.type)?6:1} style={{minHeight:['writing','continuation'].includes(q.type)?160:42}} defaultValue={q.answer} onBlur={e => editQuestion(q, 'answer', e.target.value)}/></label><label>关联材料<select value={q.passageId} onChange={e => editQuestion(q, 'passageId', e.target.value)}>{p.passages.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label><p className="error-text">{issues(p, q).join('；')}{q.stale ? ' · 原题已修改，解析需重新核对' : ''}</p><div className="actions">{btn('拆成两题', () => run(() => change(n => { const pos = n.questions.findIndex(x => x.id === q.id); n.questions.splice(pos + 1, 0, { ...q, id: uid(), number: q.number + 'b', answer: '', confirmed: false, versions: [], activeVersion: undefined }); })))}{btn('与下一题合并', () => run(() => change(n => { const pos = n.questions.findIndex(x => x.id === q.id), next = n.questions[pos + 1]; if (!next || next.passageId !== q.passageId)
        throw Error('没有同组下一题'); n.questions[pos].stem += '\n' + next.stem; n.questions[pos].answer += '；' + next.answer; n.questions.splice(pos + 1, 1); })))}</div></div>)}</section>)}</section>} checks={<ProofreadPanel key={p.id} p={p} settings={settings} busy={busy} generate={include=>task('proofread',p.id,include)} correct={include=>task('auto-correct',p.id,include)} undo={()=>task('undo-correction',p.id)} locate={locateReview}/>} generation={<GenerationControls p={p} kinds={generationKinds} setKinds={setGenerationKinds} selected={reviewSelected} busy={busy} provider={settings.provider} model={settings.model} connected={!!window.desk} settings={goSettings} generate={(kinds,ids,resume)=>task('generate-selected',p.id,ids,kinds,resume)} cancel={()=>invoke('cancel',p.id)}/>} outputs={<PreparationOutputs busy={busy} canArrange={!!p.passages.length} arrange={openLessonSetup} backup={()=>void task('export-bundle',p.id).then(saved=>{if(saved)setMsg('备份课件包已导出，可重新导入工作台继续备课。');})}/>}/>}
    {screen === 'teach' && p && p.subject!=='chinese' && <><nav className="tabs">{btn('', () => setToc(!toc), Menu)}{p.passages.map((a, i) => <button key={a.id} className={index === i ? 'active' : ''} onClick={() => { setIndex(i); setTab('解析'); }}>{a.title}</button>)}</nav>{!a ? <main className="empty"><h1>还没有整理好的题目</h1>{btn('上传与核对', () => setScreen('review'), Upload, 'primary')}</main> : <div className="classroom" style={{ '--text-size': font + 'px' } as React.CSSProperties}>{toc && <aside className="toc"><h3>题目目录</h3><p className="toc-subtitle">{labels[a.type]} · {qs.length} 题</p><nav aria-label="本篇题目">{qs.map(q => <button className="question-link" key={q.id} onClick={() => {setTab('解析');setMode('compare');setTimeout(()=>document.getElementById('q-'+q.id)?.scrollIntoView({behavior:'smooth'}),0);}}><span>第 {q.number} 题</span><small>{q.stale||active(q)?.conflict?'需核对':active(q)?'已有讲评':'待生成'}</small></button>)}</nav><p className="toc-summary">本篇已生成 {qs.filter(q=>!!active(q)).length} / {qs.length} 题<br/>点击题号定位讲评</p><hr/><small>{p.example ? '示例课件' : '当前课件已保存到本机'}</small></aside>}<div className={'columns ' + mode}>{mode !== 'analysis' && <article data-source-passage={a.id} className="reading" style={{ flexBasis: mode === 'original' ? '100%' : split + '%' }}><h2>{a.title}</h2>{recallMode&&tab==='词句记忆'?<p className="recall-source-note">回忆时暂收起原文。点击“返回讲解”后恢复。</p>:<>{a.paragraphs.map((b, i) => <p key={b.id}><small className="paragraph-no">{i + 1}</small>{highlight(b.text)}</p>)}{a.pool && <p>{a.pool}</p>}{cn && <section className="translation"><h3>中文对照</h3><p>{a.translation || '尚未生成译文'}</p></section>}</>}</article>}{mode === 'compare' && <div className="splitter"><input aria-label="分栏宽度" type="range" min="25" max="75" value={split} onChange={e => setSplit(+e.target.value)}/></div>}{mode !== 'original' && <article className="explanations"><nav className="section-tabs" aria-label="讲评内容">{['解析', ...learningTabs, '专项讲评', '答案'].map(t => <button key={t} aria-current={tab===t?'page':undefined} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{learningNames[t]||t}</button>)}</nav>{tab==='专项讲评'?<SpecialPanel key={a.id} a={a} questions={qs} currentSource={specialFingerprint(p,a.id)} busy={busy} generate={(kind,input)=>task('special',p.id,a.id,kind,input)} save={async(updated)=>{await run(()=>change(n=>{n.passages[index]=updated;}));}}/>:learningTabs.includes(tab)?<LearningPanel onRecallChange={setRecallMode} key={a.id+tab} currentSource={teachingSource(p,a.id)} legacyQuestions={qs} a={a} tab={tab} busy={busy} generate={()=>task('teaching',p.id,a.id,({'长难句':'sentences','文章结构':'structure','词句记忆':'lexicon','迁移练习':'transfer','好句仿写':'imitation'}as Record<string,string>)[tab])} save={async(updated)=>{await run(()=>change(n=>{n.passages[index]=updated;}));}}/>:tab === '词汇' ? <p className="prewrap">{(tab === '词汇' ? a.vocabulary : a.longSentences) || '尚未生成'}</p> : tab === '答案' ? <div>{p.questions.filter(q => !q.excluded).map(q => <p key={q.id}>第 {q.number} 题：{q.answer || '待补充'}</p>)}</div> : qs.map(q => { const e = active(q), shown = reveal.includes(q.id); return <section id={'q-' + q.id} className="q-card" key={q.id}><div className="q-heading"><strong>第 {q.number} 题</strong><small>{labels[q.type]}{q.stale ? ' · 解析已过期' : ''}</small></div><p>{q.stem}</p>{optionEntries(q.options).map((o, i) => <p className="option" key={i}>{o.label}. {o.text}</p>)}{btn(shown ? '收起讲解' : '显示答案与讲解', () => setReveal(shown ? reveal.filter(id => id !== q.id) : [...reveal, q.id]))}{shown && <div className="answer"><h3>参考答案：{q.answer}</h3>{e ? <><small>{e.origin === 'example' ? '示例解析' : e.origin === 'teacher' ? '教师修订' : 'AI生成 · 请核对'}{e.conflict ? ' · 答案冲突，待核实' : ''}</small><p className="prewrap">{e.analysis}</p>{e.evidence.map((r, i) => <blockquote key={i}>{r.quote}</blockquote>)}<details><summary>修改讲解与版本</summary><label>历史版本<select value={q.activeVersion} onChange={ev => editQuestion(q, 'activeVersion', ev.target.value)}>{q.versions.map(v => <option key={v.id} value={v.id}>{v.origin} {new Date(v.createdAt).toLocaleString()}</option>)}</select></label><label>解析<textarea key={e.id} defaultValue={e.analysis} onBlur={ev => run(() => change(n => { const nq = n.questions.find(x => x.id === q.id)!; const version = { ...e, id: uid(), createdAt: new Date().toISOString(), origin: 'teacher' as const, analysis: ev.target.value }; nq.versions.push(version); nq.activeVersion = version.id; }))}/></label>{btn('确认已核实冲突', () => run(() => change(n => { const nq = n.questions.find(x => x.id === q.id)!; const version = { ...e, id: uid(), createdAt: new Date().toISOString(), origin: 'teacher' as const, conflict: false }; nq.versions.push(version); nq.activeVersion = version.id; })))}{btn('删除当前解析', () => run(() => change(n => { const nq = n.questions.find(x => x.id === q.id)!; nq.versions = nq.versions.filter(v => v.id !== e.id); nq.activeVersion = nq.versions.at(-1)?.id; })))}</details></> : <p>暂无本题解析，可到整理材料中生成解析。</p>}{btn('重新生成本题解析', () => task('generate', p.id, [q.id],'analysis'))}</div>}</section>; })}</article>}</div></div>}</>}
    {screen === 'lesson-setup' && p && p.subject!=='chinese' && <LessonSetup template={pptTemplate} onTemplate={setPptTemplate} onTemplatePending={setTemplatePending} project={p} selection={lessonSelection} onChange={setLessonSelection} busy={busy||templatePending} onPresent={startLesson} onExport={()=>run(async()=>{const n=await invoke('export-ppt',p.id,lessonSelection,{templateId:pptTemplate.id});if(n)setMsg(`已导出 ${n} 页可编辑课件`);})} onBack={()=>setScreen('teach')}/>}
    {busy && !(screen==='review'&&p?.job.state==='running'&&p.job.mode==='selected') && <div className="busy" role="status">正在处理，完成的内容会逐组保存。{p && <button onClick={() => invoke('cancel', p.id)}>取消任务</button>}</div>}
    </>;
}
const notebookHost=document.createElement('div');document.body.append(notebookHost);const notebookRoot=createRoot(notebookHost);
createRoot(document.getElementById('root')!).render(<App />);

import './paper.css';

import './workspace-header.css';

import './special.css';

import './review-navigation.css';

import './proofread.css';

import './teaching-quality.css';
import './project-list.css';
import './lesson-deck.css';

import './preparation.css';
