import {TemplateStore} from './ppt-templates';
import {organizeChinese,generateChinese,reviewChinese} from './chinese';
import {chineseModules,type ChineseModule,chineseSlides} from '../core/chinese';
import {generationCounts} from '../core/generation-counts';
import {initializePrompts,promptBook,savePrompt} from './prompt-store';
import{recognizeScan}from'./ocr';
import { proofreadProject } from './proofread';
import { generateCorrections } from './correction';
import { undoCorrection } from '../core/correction';
import { checkIntegrity, proofreadFingerprint } from '../core/proofread';
import{generateSpecial}from'./special';
import{specialKinds,specialInputSchema,type SpecialKind}from'../core/special';
import{planGeneration,planSelectedGeneration,runGeneration,generationJobFor,archiveGenerationJob}from'../core/generation';
import{generationNotice}from'../core/generation-notice';
import{taskKinds,type GenerationContent}from'../core/generation-model';
import type{TeachingModule}from'../core/learning';
import{generationExecutor}from'./generation-service';
import { app, BrowserWindow, ipcMain, dialog, safeStorage, shell, Notification } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Store } from './store';
import { readDocument } from './documents';
import { organize } from './ai';
import { exportPpt } from './export';
import { buildLessonDeck, legacyLessonSelection, type LessonSelection } from '../core/lesson-deck';
import { emptyProject, projectSchema, defaultSettings, type Settings, type Project } from '../core/model';
import { reviseProject, issues, validateBundlePath } from '../core/logic';
import { demoProject } from '../core/demo';
let win: BrowserWindow, store: Store;
const running = new Map<string, AbortController>();
const notifications=new Set<Notification>();
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
async function settings(): Promise<Settings & {
    encryptedKey?: string;
}> { try {
    return JSON.parse(await fs.readFile(settingsFile(), 'utf8'));
}
catch (e: any) {
    if (e.code === 'ENOENT')
        return { ...defaultSettings };
    throw e;
} }
async function credentials() { const s = await settings(); if (!s.encryptedKey)
    throw Error('请先在设置中填写API Key'); return { s, key: safeStorage.decryptString(Buffer.from(s.encryptedKey, 'base64')) }; }
function handle(name: string, fn: (...args: any[]) => any) { ipcMain.handle('desk:' + name, async (event, ...args) => { if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame)
    throw Error('无效操作来源'); return fn(...args); }); }
const progress = (p: Project, message: string) => win.webContents.send('desk:progress', { project: p, message });
function notifyGeneration(p:Project){
    const notice=generationNotice(p);progress(p,notice.title+'：'+notice.body.replace('。点击返回查看。','。'));
    const deliveryError=(message:string)=>win.webContents.send('desk:progress',{message});
    if(!win.isFocused())win.flashFrame(true);
    if(!Notification.isSupported()){progress(p,'生成结果已保存；系统通知不可用，请在应用内查看进度。');return;}
    try{
        const notification=new Notification(notice);
        notifications.add(notification);notification.on('close',()=>notifications.delete(notification));
        notification.on('click',()=>{if(win.isMinimized())win.restore();win.show();win.focus();win.flashFrame(false);});
        notification.on('failed',()=>{notifications.delete(notification);deliveryError('生成结果已保存，但系统通知发送失败，请在 Windows 通知设置中检查讲题工作台。');});
        notification.show();
    }catch{deliveryError('生成结果已保存，但系统通知发送失败，请在应用内查看进度。');}
}
app.whenReady().then(async () => {
    await initializePrompts(app.getPath('userData'));
    app.setAppUserModelId('top.rainhollow.lessondesk');
    store = new Store(path.join(app.getPath('userData'), 'projects'));
    const firstLaunch=await fs.access(store.root).then(()=>false,(error:NodeJS.ErrnoException)=>{if(error.code==='ENOENT')return true;throw error;});
    if (!(await store.list()).length&&firstLaunch)
        await store.save(demoProject());
    handle('example',()=>store.save(demoProject()));
    handle('list', () => store.list());
    handle('delete-project',async(id:string)=>{
        if(running.has(id))throw Error('这份课件正在处理，请等待任务结束或取消后再删除');
        store.dir(id);
        running.set(id,new AbortController());
        try{
            const p=await store.load(id);
            const result=await dialog.showMessageBox(win,{type:'question',title:'删除课件',message:'删除“'+p.title+'”？',detail:'课件及导入的材料副本将移到系统回收站，可从回收站恢复。最初上传的原文件不受影响。',buttons:['取消','移到回收站'],defaultId:0,cancelId:0,noLink:true});
            if(result.response!==1)return{deleted:false};
            await store.trash(id,directory=>shell.trashItem(directory));
            return{deleted:true};
        }finally{running.delete(id);}
    });
    handle('load', (id: string) => { if (running.has(id))
        throw Error('任务处理中，请等待或取消'); return store.load(id); });
    handle('create', (title: string,subject:'english'|'chinese'='english') => {if(!['english','chinese'].includes(subject))throw Error('学科无效');return store.save(emptyProject(title.trim() || '未命名课件',subject));});
    handle('save', async (raw: unknown) => { const p = projectSchema.parse(raw); if (running.has(p.id))
        throw Error('生成中不可修改，请先取消'); return store.save(reviseProject(await store.load(p.id), p)); });
    handle('files', async (id: string, role: 'paper' | 'answer' | 'listening') => { if (running.has(id))
        throw Error('任务处理中'); if (!['paper', 'answer', 'listening'].includes(role))
        throw Error('材料类型无效'); const d = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'PDF或Word文档', extensions: ['pdf', 'docx'] }] }); if (d.canceled)
        return null; const p = await store.load(id); for (const file of d.filePaths) {
        const { source, bytes } = await readDocument(file, role);
        source.asset = `sources/${source.id}${path.extname(file).toLowerCase()}`;
        await store.asset(id, source.asset, bytes);
        p.sources.push(source);
    } return store.save(p); });
    handle('ocr',async(id:string)=>{if(running.has(id))throw Error('任务正在处理');const p=await store.load(id);const targets=p.sources.filter(s=>s.ocrPages?.length);if(!targets.length)throw Error('没有待识别扫描页');const {s,key}=await credentials();const c=new AbortController();running.set(id,c);try{for(const source of targets){if(!source.asset)throw Error('原PDF缺失，请重新上传');validateBundlePath(source.asset);await recognizeScan(path.join(store.dir(id),source.asset),source,s,key,c.signal,async(_,message)=>{p.updatedAt=new Date().toISOString();await store.save(p);progress(p,message);});}return await store.save(p);}finally{running.delete(id);}});
    handle('organize', async (id: string) => { if (running.has(id))
        throw Error('任务已在运行'); const p = await store.load(id); if (!p.sources.length)
        throw Error('请先上传试卷和答案，再点击整理试卷'); if(p.sources.some(s=>s.ocrPages?.length))throw Error('扫描页尚未识别，请先点击识别扫描页'); const { s, key } = await credentials(); const controller = new AbortController(); running.set(id, controller); try {
        const result = await (p.subject==='chinese'?organizeChinese:organize)(p, s, key, controller.signal);
        if (controller.signal.aborted)
            throw Error('已取消');
        return await store.save(result);
    }
    finally {
        running.delete(id);
    } });
    handle('proofread',async(id:string,includeExplanations=false)=>{
        if(running.has(id))throw Error('已有任务正在处理，请等待或取消');
        if(typeof includeExplanations!=='boolean')throw Error('校对范围无效');
        const c=new AbortController();running.set(id,c);
        try{
            const p=await store.load(id),{s,key}=await credentials();
            progress(p,'正在对照原材料校对试卷…');
            const result=await proofreadProject(p,s,key,includeExplanations,c.signal,message=>progress(p,message));
            if(c.signal.aborted)throw Error('校对已取消，未替换上次报告');
            result.updatedAt=new Date().toISOString();
            const saved=await store.save(result);progress(saved,'校对报告已保存，请查看问题与检查范围');return saved;
        }finally{running.delete(id);}
    });
    handle('auto-correct',async(id:string,include=false)=>{
        if(running.has(id))throw Error('已有任务正在处理，请等待或取消');if(typeof include!=='boolean')throw Error('修正范围无效');
        const c=new AbortController();running.set(id,c);
        try{
            let p=await store.load(id);const {s,key}=await credentials();
            if(!p.proofread||p.proofread.includeExplanations!==include||p.proofread.result.coverage!=='complete'||p.proofread.inputSnapshot!==proofreadFingerprint(p,include)){
                progress(p,'自动修正：正在校对当前内容…');p=await proofreadProject(p,s,key,include,c.signal,m=>progress(p,m));p=await store.save(p);
            }
            if(!p.proofread!.result.findings.length&&!checkIntegrity(p).length){progress(p,'本次校对未发现需要自动修正的问题');return p;}
            progress(p,'正在生成并校验自动修改…');p=await generateCorrections(p,s,key,include,c.signal,m=>progress(p,m));
            if(c.signal.aborted)throw Error('自动修正已取消，未应用修改');p=await store.save(p);
            const record=p.corrections!.at(-1)!;
            if(record.changes.length){
                progress(p,'已保存 '+record.changes.length+' 项修改，正在再次校对…');
                try{p=await proofreadProject(p,s,key,include,c.signal,m=>progress(p,m));p.corrections!.at(-1)!.recheck='complete';}
                catch(error){const r=p.corrections!.at(-1)!;r.recheck=c.signal.aborted?'cancelled':'failed';r.recheckError=error instanceof Error?error.message:String(error);}
                p=await store.save(p);
            }
            const final=p.corrections!.at(-1)!,remaining=final.unresolved.length+(final.recheck==='complete'?(p.proofread?.result.findings.length||0):0);progress(p,final.recheck==='failed'||final.recheck==='cancelled'?'自动修改已保存，但再次校对未完成，请查看记录':'自动修正结束：已改 '+final.changes.length+' 项，仍待处理 '+remaining+' 项');return p;
        }finally{running.delete(id);}
    });
    handle('undo-correction',async(id:string)=>{if(running.has(id))throw Error('任务处理中，请先等待或取消');return store.save(undoCorrection(await store.load(id)));});
    async function generate(id:string,ids:string[],kind:GenerationContent='analysis',resume=false){
        if(running.has(id))throw Error('已有任务正在处理，请等待或取消');
        let p=await store.load(id);if(!resume)p=planGeneration(p,ids,kind);else{archiveGenerationJob(p);const job=generationJobFor(p,kind);if(!job)throw Error('此项没有可继续的任务，请先生成');p.job=structuredClone(job);}
        const{s,key}=await credentials(),controller=new AbortController();running.set(id,controller);
        try{const result=await runGeneration(p,controller.signal,generationExecutor(s,key,controller.signal,progress),p=>store.save(p),resume,progress);notifyGeneration(result);return result;}finally{running.delete(id);}
    }
    handle('generate',(id:string,ids:string[],kind:GenerationContent='analysis')=>{if(!taskKinds.includes(kind))throw Error('请选择一种具体内容，已取消整份讲义生成');return generate(id,ids,kind);});
    handle('generate-selected',async(id:string,ids:string[],kinds:GenerationContent[],resume=false)=>{
        if(running.has(id))throw Error('已有任务正在处理，请等待或取消');if(typeof resume!=='boolean')throw Error('生成方式无效');
        const p=planSelectedGeneration(await store.load(id),ids,kinds,resume),{s,key}=await credentials(),c=new AbortController();running.set(id,c);
        try{const result=await runGeneration(p,c.signal,generationExecutor(s,key,c.signal,progress),p=>store.save(p),resume,progress);notifyGeneration(result);return result;}finally{running.delete(id);}
    });
    handle('resume-generation',(id:string,kind:GenerationContent)=>{if(!taskKinds.includes(kind))throw Error('请选择要继续的内容');return generate(id,[],kind,true);});
    handle('teaching',(id:string,pid:string,module?:TeachingModule)=>{
        if(running.has(id))throw Error('已有任务正在处理');
        if(!module||!['sentences','structure','lexicon','transfer','imitation'].includes(module))throw Error('请选择具体教学模块');
        return store.load(id).then(p=>generate(id,p.questions.filter(q=>q.passageId===pid&&!q.excluded&&q.confirmed).map(q=>q.id),module==='transfer'?'practice':module));
    });
    handle('special',async(id:string,pid:string,kind:SpecialKind,raw:unknown)=>{
        if(running.has(id))throw Error('已有任务正在处理');if(!specialKinds.includes(kind))throw Error('专项类型无效');const input=specialInputSchema.parse(raw);let p=planGeneration(await store.load(id),input.questionIds,'special');p.job.tasks=p.job.tasks!.filter(t=>t.passageId===pid&&t.specialKind===kind);if(!p.job.tasks.length)throw Error('此专项不适用于所选题目');
        const{s,key}=await credentials(),c=new AbortController();running.set(id,c);try{return await runGeneration(p,c.signal,async p=>{const next=await generateSpecial(p,pid,kind,input,s,key,c.signal),result=next.passages.find(a=>a.id===pid)!.special!.versions.at(-1)!.result;if(!result.items.length)throw Error('专项未生成可用内容：'+result.notices.join('；'));return next;},p=>store.save(p),false,progress).then(result=>{notifyGeneration(result);return result;});}finally{running.delete(id);}
    });
    handle('review-chinese',async(id:string)=>{if(running.has(id))throw Error('任务处理中');const p=await store.load(id),{s,key}=await credentials(),c=new AbortController();running.set(id,c);try{const next=await reviewChinese(p,s,key,c.signal);if(c.signal.aborted)throw Error('校对已取消，保留旧报告');return store.save(next);}finally{running.delete(id);}});
    handle('generate-chinese',async(id:string,groups:string[],modules:ChineseModule[],resume=false,questions?:string[])=>{
        if(running.has(id))throw Error('已有任务正在处理');if(!Array.isArray(groups)||!Array.isArray(modules)||modules.some(m=>!chineseModules.includes(m))||typeof resume!=='boolean')throw Error('生成范围无效');
        const p=await store.load(id),{s,key}=await credentials(),c=new AbortController();running.set(id,c);
        try{const result=await generateChinese(p,groups,modules,s,key,c.signal,async(next,message)=>{next.updatedAt=new Date().toISOString();await store.save(next);progress(next,message);},resume,questions);if(Notification.isSupported()){const n=new Notification({title:'语文讲义生成结束',body:`${result.chinese!.tasks.filter(t=>t.state==='complete').length} 项已保存，请核实后编排课件。`});notifications.add(n);n.on('close',()=>notifications.delete(n));n.on('click',()=>{if(win.isMinimized())win.restore();win.show();win.focus();});n.show();}return result;}finally{running.delete(id);}
    });
    handle('chinese-image',async(id:string,sid:string,pageNumber:number)=>{
        if(running.has(id))throw Error('任务处理中');const p=await store.load(id),src=p.sources.find(s=>s.id===sid);if(p.subject!=='chinese'||!src?.asset||src.kind!=='pdf'||!Number.isInteger(pageNumber)||pageNumber<1)throw Error('请选择PDF及有效页码');
        const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs'),{createCanvas}=await import('@napi-rs/canvas');const doc=await getDocument({data:new Uint8Array(await fs.readFile(path.join(store.dir(id),src.asset))),useSystemFonts:true}).promise;
        try{if(pageNumber>doc.numPages)throw Error('页码超出原文件');const page=await doc.getPage(pageNumber),vp=page.getViewport({scale:1.3}),canvas=createCanvas(Math.ceil(vp.width),Math.ceil(vp.height));await page.render({canvas:canvas as any,canvasContext:canvas.getContext('2d') as any,viewport:vp}).promise;return canvas.toDataURL('image/jpeg',80);}finally{await doc.destroy();}
    });
    handle('cancel', (id: string) => running.get(id)?.abort());
    handle('prompts',()=>promptBook.snapshot());
    handle('save-prompt',(id:string,value:unknown)=>savePrompt(id,value));
    handle('settings', async () => { const s = await settings(); const { encryptedKey, ...clean } = s; return { ...clean, hasKey: !!encryptedKey }; });
    handle('save-settings', async (s: Settings) => { if (!['openai', 'deepseek', 'custom'].includes(s.provider) || !s.model?.trim())
        throw Error('服务商或模型无效'); const previous = await settings(); const value: any = { provider: s.provider, model: s.model.trim(), baseUrl: s.baseUrl.trim(),...generationCounts({...previous,...s}) }; if (s.key?.trim()) {
        if (!safeStorage.isEncryptionAvailable())
            throw Error('系统凭据加密不可用，未保存Key');
        value.encryptedKey = safeStorage.encryptString(s.key.trim()).toString('base64');
    }
    else if (previous.provider === s.provider && previous.baseUrl === s.baseUrl)
        value.encryptedKey = previous.encryptedKey; await fs.writeFile(settingsFile(), JSON.stringify(value)); return true; });
    const templateStore=new TemplateStore(path.join(app.getPath('userData'),'ppt-templates'));
    handle('ppt-templates',()=>templateStore.list());
    handle('import-ppt-template',async()=>{
        const d=await dialog.showOpenDialog(win,{title:'选择 PowerPoint 模板',properties:['openFile'],filters:[{name:'PowerPoint 模板',extensions:['pptx','potx']}]});
        if(d.canceled)return null;
        return templateStore.import(d.filePaths[0]);
    });
    handle('export-ppt', async (id:string,requested:LessonSelection|string[],options:boolean|{templateId:string}=false)=>{
        if(running.has(id))throw Error('请先等待生成完成');
        const p=await store.load(id),loaded=await templateStore.load(typeof options==='boolean'?'paper':options.templateId);
        const selection=Array.isArray(requested)?legacyLessonSelection(p,requested,typeof options==='boolean'&&options):requested;
        if(p.subject==='chinese')chineseSlides(p.chinese!,requested as string[],loaded.template.layout);else buildLessonDeck(p,selection,loaded.template.layout);
        const d=await dialog.showSaveDialog(win,{defaultPath:p.title+'.pptx',filters:[{name:'PowerPoint',extensions:['pptx']}]});
        if(d.canceled)return null;
        return exportPpt(p,d.filePath!,p.subject==='chinese'?requested as string[]:selection,loaded);
    });
    handle('export-bundle', async (id: string) => { if (running.has(id))
        throw Error('请先等待生成完成'); const d = await dialog.showSaveDialog(win, { defaultPath: '课件.lesson.zip', filters: [{ name: '课件包', extensions: ['zip'] }] }); if (!d.canceled)
        await fs.writeFile(d.filePath!, await store.pack(id)); return !d.canceled; });
    handle('import-bundle', async () => { const d = await dialog.showOpenDialog(win, { filters: [{ name: '课件包', extensions: ['zip'] }] }); if (d.canceled)
        return null; if ((await fs.stat(d.filePaths[0])).size > 200 * 1024 * 1024)
        throw Error('课件包超过200 MB'); return store.unpack(new Uint8Array(await fs.readFile(d.filePaths[0]))); });
    handle('preview', async (id: string, sid: string) => { const p = await store.load(id); const source = p.sources.find(s => s.id === sid); if (!source?.asset)
        throw Error('没有可预览的原文件'); validateBundlePath(source.asset); const data = await fs.readFile(path.join(store.dir(id), source.asset)); return { kind: source.kind, data: Array.from(data) }; });
    handle('fullscreen', () => win.setFullScreen(!win.isFullScreen()));
    win = new BrowserWindow({ width: 1440, height: 960, minWidth: 1000, minHeight: 650, show: false, backgroundColor: '#f3f4f6', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.on('focus',()=>win.flashFrame(false));
    win.webContents.on('will-navigate', (event) => event.preventDefault());
    await win.loadFile(path.join(__dirname, '../dist/index.html'));
    win.show();
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { for (const c of running.values())
    c.abort(); });
