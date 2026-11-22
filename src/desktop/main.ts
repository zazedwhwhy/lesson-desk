import {notebookBeta} from '../core/release-channel';
declare const __NOTEBOOK_BETA__: boolean;
import {recognizeChemistryFigures} from './chemistry-figures';
import {runParallelGeneration} from './parallel-generation';
import { applyOcrReview, ocrReviewRequestSchema } from '../core/ocr-review';
import {queueManualOcr,queueChemistryPdf} from '../core/manual-ocr';
import {refreshChemistryFidelity} from '../core/chemistry-review';
import {reviewChemistry} from './chemistry-review';
import { SettingsStore } from './settings-store';
import { initializeStableData } from './data-home';
import {initializeDiagnostics} from './diagnostics';
import {organizeChemistry,generateChemistry,chemistryCaller} from './chemistry';
import {chemSlides,chemModules,type ChemModule} from '../core/chemistry';
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
import{planGeneration,planSelectedGeneration,generationJobFor,archiveGenerationJob}from'../core/generation';
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
const beta=notebookBeta;
const isolated=app.commandLine.hasSwitch('user-data-dir');
// Copy Local State before Electron loads its encryption context at ready.
if(!isolated)initializeStableData(path.join(app.getPath('appData'),beta?'lesson-desk-notebook-beta':'lesson-desk-stable'),(beta?['lesson-desk-stable','lesson-desk-beta','lesson-desk']:['lesson-desk-beta','lesson-desk']).map(name=>path.join(app.getPath('appData'),name)));
if(!isolated)app.setPath('userData',path.join(app.getPath('appData'),beta?'lesson-desk-notebook-beta':'lesson-desk-stable'));
const running = new Map<string, AbortController>();
const notifications=new Set<Notification>();
const connections=new SettingsStore(path.join(app.getPath('userData'),'settings.json'),{
 encrypt:text=>{if(!safeStorage.isEncryptionAvailable())throw Error('系统凭据加密不可用，未保存 Key');return safeStorage.encryptString(text).toString('base64');},
 decrypt:text=>safeStorage.decryptString(Buffer.from(text,'base64')),
});
const credentials=()=>connections.credentials();
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
        notification.on('failed',()=>{
            notifications.delete(notification);
            const settings=process.platform==='win32'?'Windows 通知设置':'系统通知设置';
            deliveryError(`生成结果已保存，但系统通知发送失败，请在 ${settings} 中检查讲题工作台。`);
        });
        notification.show();
    }catch{deliveryError('生成结果已保存，但系统通知发送失败，请在应用内查看进度。');}
}
app.whenReady().then(async () => {
    initializeDiagnostics(app.getPath('userData'));
    await initializePrompts(app.getPath('userData'));
    if (process.platform === 'win32') {
        app.setAppUserModelId(beta ? 'top.rainhollow.lessondesk.beta' : 'top.rainhollow.lessondesk');
    }
    store = new Store(path.join(app.getPath('userData'), 'projects'));
    const firstLaunch=await fs.access(store.root).then(()=>false,(error:NodeJS.ErrnoException)=>{if(error.code==='ENOENT')return true;throw error;});
    if (!(await store.list()).length&&firstLaunch)
        await store.save(demoProject());
    handle('example',()=>store.save(demoProject()));
    if(__NOTEBOOK_BETA__){const {registerNotebook}=await import('./notebook-handlers');registerNotebook(handle,app.getPath('userData'),store,()=>win);}
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
    handle('create', (title: string,subject:'english'|'chinese'|'chemistry'='english') => {if(!['english','chinese','chemistry'].includes(subject))throw Error('学科无效');return store.save(emptyProject(title.trim() || '未命名课件',subject));});
    handle('save', async (raw: unknown) => { const p = projectSchema.parse(raw); if (running.has(p.id))
        throw Error('生成中不可修改，请先取消'); return store.save(reviseProject(await store.load(p.id), p)); });
    handle('save-ocr-review', async (id: string, raw: unknown) => {
        if (running.has(id)) throw Error('任务处理中，请等待或取消后再保存核对结果');
        const request = ocrReviewRequestSchema.parse(raw);
        running.set(id, new AbortController());
        try {
            const previous = await store.load(id);
            return await store.save(reviseProject(previous, applyOcrReview(previous, request)));
        } finally { running.delete(id); }
    });
    handle('files', async (id: string, role: 'paper' | 'answer' | 'listening') => { if (running.has(id))
        throw Error('任务处理中'); if (!['paper', 'answer', 'listening'].includes(role))
        throw Error('材料类型无效'); const d = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'PDF或Word文档', extensions: ['pdf', 'docx'] }] }); if (d.canceled)
        return null; const p = await store.load(id); for (const file of d.filePaths) {
        const { source, bytes } = await readDocument(file, role);
        if(p.subject==='chemistry')queueChemistryPdf(source);
        source.asset = `sources/${source.id}${path.extname(file).toLowerCase()}`;
        await store.asset(id, source.asset, bytes);
        p.sources.push(source);
    } const saved=await store.save(p);progress(saved,p.subject==='chemistry'&&p.sources.some(s=>s.ocrPages?.length)?'上传完成，请点击「AI识别」，核对后再整理试卷。':'材料上传完成，请核对原材料后继续。');return saved; });
    handle('ocr',async(id:string,manual?:unknown)=>{if(running.has(id))throw Error('任务正在处理');const p=await store.load(id);if(manual===undefined&&p.subject==='chemistry'&&!p.sources.some(s=>s.ocrPages?.length)){for(const source of p.sources.filter(s=>s.kind==='pdf'&&s.asset))queueChemistryPdf(source);}const requested=manual===undefined?undefined:queueManualOcr(p.sources,manual);const targets=requested?[requested.source]:p.sources.filter(s=>s.ocrPages?.length);if(!targets.length)throw Error('没有待识别扫描页');const {s,key}=await credentials();const c=new AbortController();running.set(id,c);try{for(const source of targets){if(!source.asset)throw Error('原PDF缺失，请重新上传');validateBundlePath(source.asset);await recognizeScan(path.join(store.dir(id),source.asset),source,s,key,c.signal,async(_,message)=>{p.updatedAt=new Date().toISOString();await store.save(p);progress(p,message);},requested?.pages);}return await store.save(p);}finally{running.delete(id);}});
    handle('organize', async (id: string,recover=false) => { if (running.has(id))
        throw Error('任务已在运行'); const p = await store.load(id); if (!p.sources.length)
        throw Error('请先上传试卷和答案，再点击整理试卷'); if(p.sources.some(s=>s.ocrPages?.length))throw Error('扫描页尚未识别，请先点击识别扫描页'); const { s, key } = await credentials(); const controller = new AbortController(); running.set(id, controller); try {
        if(p.subject==='chemistry')await recognizeChemistryFigures(p,store.dir(id),s,key,controller.signal,async(snapshot,message)=>{await store.save(snapshot);progress(snapshot,message);});
        const result = p.subject==='chinese'?await organizeChinese(p,s,key,controller.signal,message=>progress(p,message)):await (p.subject==='chemistry'?organizeChemistry:organize)(p, s, key, controller.signal,{recover:recover===true,onStatus:message=>progress(p,message)});
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
        try{const result=await runParallelGeneration(p,controller.signal,generationExecutor(s,key,controller.signal),p=>store.save(p),resume,progress);notifyGeneration(result);return result;}finally{running.delete(id);}
    }
    handle('generate',(id:string,ids:string[],kind:GenerationContent='analysis')=>{if(!taskKinds.includes(kind))throw Error('请选择一种具体内容，已取消整份讲义生成');return generate(id,ids,kind);});
    handle('generate-selected',async(id:string,ids:string[],kinds:GenerationContent[],resume=false)=>{
        if(running.has(id))throw Error('已有任务正在处理，请等待或取消');if(typeof resume!=='boolean')throw Error('生成方式无效');
        const p=planSelectedGeneration(await store.load(id),ids,kinds,resume),{s,key}=await credentials(),c=new AbortController();running.set(id,c);
        try{const result=await runParallelGeneration(p,c.signal,generationExecutor(s,key,c.signal),p=>store.save(p),resume,progress);notifyGeneration(result);return result;}finally{running.delete(id);}
    });
    handle('resume-generation',(id:string,kind:GenerationContent)=>{if(!taskKinds.includes(kind))throw Error('请选择要继续的内容');return generate(id,[],kind,true);});
    handle('teaching',(id:string,pid:string,module?:TeachingModule)=>{
        if(running.has(id))throw Error('已有任务正在处理');
        if(!module||!['sentences','structure','lexicon','transfer','imitation'].includes(module))throw Error('请选择具体教学模块');
        return store.load(id).then(p=>generate(id,p.questions.filter(q=>q.passageId===pid&&!q.excluded&&q.confirmed).map(q=>q.id),module==='transfer'?'practice':module));
    });
    handle('special',async(id:string,pid:string,kind:SpecialKind,raw:unknown)=>{
        if(running.has(id))throw Error('已有任务正在处理');if(!specialKinds.includes(kind))throw Error('专项类型无效');const input=specialInputSchema.parse(raw);let p=planGeneration(await store.load(id),input.questionIds,'special');p.job.tasks=p.job.tasks!.filter(t=>t.passageId===pid&&t.specialKind===kind);if(!p.job.tasks.length)throw Error('此专项不适用于所选题目');
        const{s,key}=await credentials(),c=new AbortController();running.set(id,c);try{return await runParallelGeneration(p,c.signal,async (p,_task,status)=>{const next=await generateSpecial(p,pid,kind,input,s,key,c.signal,status),result=next.passages.find(a=>a.id===pid)!.special!.versions.at(-1)!.result;if(!result.items.length)throw Error('专项未生成可用内容：'+result.notices.join('；'));return next;},p=>store.save(p),false,progress).then(result=>{notifyGeneration(result);return result;});}finally{running.delete(id);}
    });
    handle('recheck-chemistry',async(id:string)=>{if(running.has(id))throw Error('任务处理中');const c=new AbortController();running.set(id,c);try{const next=refreshChemistryFidelity(await store.load(id));const saved=await store.save(next);progress(saved,`已重新检查当前题目：${saved.sourceFidelityIssues?.length||0} 处文字差异；公式与题图请对照原页`);return saved;}finally{running.delete(id);}});
    handle('review-chemistry',async(id:string)=>{if(running.has(id))throw Error('任务处理中');const p=await store.load(id),{s,key}=await credentials(),c=new AbortController();running.set(id,c);try{const next=await reviewChemistry(p,s,key,c.signal,message=>progress(p,message));if(c.signal.aborted)throw Error('校对已取消，保留旧报告');return await store.save(next);}finally{running.delete(id);}});
    handle('review-chinese',async(id:string)=>{if(running.has(id))throw Error('任务处理中');const p=await store.load(id),{s,key}=await credentials(),c=new AbortController();running.set(id,c);try{const next=await reviewChinese(p,s,key,c.signal);if(c.signal.aborted)throw Error('校对已取消，保留旧报告');return store.save(next);}finally{running.delete(id);}});
    handle('generate-chinese',async(id:string,groups:string[],modules:ChineseModule[],resume=false,questions?:string[])=>{
        if(running.has(id))throw Error('已有任务正在处理');if(!Array.isArray(groups)||!Array.isArray(modules)||modules.some(m=>!chineseModules.includes(m))||typeof resume!=='boolean')throw Error('生成范围无效');
        const p=await store.load(id),{s,key}=await credentials(),c=new AbortController();running.set(id,c);
        try{const result=await generateChinese(p,groups,modules,s,key,c.signal,async(next,message)=>{next.updatedAt=new Date().toISOString();await store.save(next);progress(next,message);},resume,questions,progress);if(Notification.isSupported()){const n=new Notification({title:'语文讲义生成结束',body:`${result.chinese!.tasks.filter(t=>t.state==='complete').length} 项已保存，请核实后编排课件。`});notifications.add(n);n.on('close',()=>notifications.delete(n));n.on('click',()=>{if(win.isMinimized())win.restore();win.show();win.focus();});n.show();}return result;}finally{running.delete(id);}
    });
    handle('chinese-image',async(id:string,sid:string,pageNumber:number)=>{
        if(running.has(id))throw Error('任务处理中');const p=await store.load(id),src=p.sources.find(s=>s.id===sid);if(!['english','chinese','chemistry'].includes(p.subject)||!src?.asset||src.kind!=='pdf'||!Number.isInteger(pageNumber)||pageNumber<1)throw Error('请选择PDF及有效页码');
        const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs'),{createCanvas}=await import('@napi-rs/canvas');const doc=await getDocument({data:new Uint8Array(await fs.readFile(path.join(store.dir(id),src.asset))),useSystemFonts:true}).promise;
        try{if(pageNumber>doc.numPages)throw Error('页码超出原文件');const page=await doc.getPage(pageNumber),vp=page.getViewport({scale:1.3}),canvas=createCanvas(Math.ceil(vp.width),Math.ceil(vp.height));await page.render({canvas:canvas as any,canvasContext:canvas.getContext('2d') as any,viewport:vp}).promise;return canvas.toDataURL('image/jpeg',80);}finally{await doc.loadingTask.destroy();}
    });
    handle('generate-chemistry',async(id:string,ids:string[],modules:ChemModule[],resume=false)=>{
        if(running.has(id))throw Error('任务处理中');
        if(!Array.isArray(ids)||!Array.isArray(modules)||modules.some(m=>!chemModules.includes(m))||typeof resume!=='boolean')throw Error('生成范围无效');
        const p=await store.load(id),{s,key}=await credentials(),c=new AbortController();running.set(id,c);
        try{
            const result=await generateChemistry(p,ids,modules,c.signal,async(next,message)=>{next.updatedAt=new Date().toISOString();await store.save(next);progress(next,message);},chemistryCaller(s,key),resume,progress);
            progress(result,'化学生成已结束，请查看各项状态并核对讲义。');
            if(!win.isFocused())win.flashFrame(true);
            try{
                if(Notification.isSupported()){
                    const tasks=result.chemistry!.tasks,complete=tasks.filter(t=>t.state==='complete').length;
                    const n=new Notification({title:'化学生成结束',body:`已生成 ${complete} 项，未完成 ${tasks.length-complete} 项；请核对后编排课件。`});
                    notifications.add(n);n.on('close',()=>notifications.delete(n));n.on('click',()=>{if(win.isMinimized())win.restore();win.show();win.focus();});
                    n.on('failed',()=>{notifications.delete(n);win.webContents.send('desk:progress',{message:'结果已保存，系统通知发送失败。'});});n.show();
                }
            }catch{win.webContents.send('desk:progress',{message:'结果已保存，系统通知不可用。'});}
            return result;
        }finally{running.delete(id);}
    });
    handle('chemistry-image',async(id:string)=>{
        if(running.has(id))throw Error('任务处理中');
        const p=await store.load(id);if(p.subject!=='chemistry')throw Error('请选择化学课件');
        const chosen=await dialog.showOpenDialog(win,{properties:['openFile','multiSelections'],filters:[{name:'题目图片',extensions:['png','jpg','jpeg']}]});
        if(chosen.canceled)return null;
        if(chosen.filePaths.length>12)throw Error('每次最多选择12张图片');
        const images=[];
        for(const file of chosen.filePaths){
            if((await fs.stat(file)).size>10*1024*1024)throw Error('单张图片不能超过10 MB');
            const bytes=await fs.readFile(file),png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
            if(!png&&!jpeg)throw Error('不是有效的 PNG 或 JPEG 图片');
            images.push({id:crypto.randomUUID(),name:path.basename(file),data:'data:image/'+(png?'png':'jpeg')+';base64,'+bytes.toString('base64'),description:'',confirmed:false});
        }
        return images;
    });
    handle('cancel', (id: string) => running.get(id)?.abort());
    handle('prompts',()=>promptBook.snapshot());
    handle('save-prompt',(id:string,value:unknown)=>savePrompt(id,value));
    handle('settings',()=>connections.current());
    handle('connections',()=>connections.list());
    handle('save-settings',(s:Settings)=>connections.save(s));
    handle('activate-connection',(id:string)=>connections.activate(id));
    handle('delete-connection',(id:string)=>connections.remove(id));
    handle('reveal-key',(id:string)=>connections.reveal(id));
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
        if(p.subject==='chemistry')chemSlides(p.chemistry!,requested as string[],loaded.template.layout);else if(p.subject==='chinese')chineseSlides(p.chinese!,requested as string[],loaded.template.layout);else buildLessonDeck(p,selection,loaded.template.layout);
        const d=await dialog.showSaveDialog(win,{defaultPath:p.title+'.pptx',filters:[{name:'PowerPoint',extensions:['pptx']}]});
        if(d.canceled)return null;
        return exportPpt(p,d.filePath!,p.subject!=='english'?requested as string[]:selection,loaded);
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
    win = new BrowserWindow({
        title: beta ? '讲题工作台 Beta' : '讲题工作台',
        width: 1440,
        height: 960,
        minWidth: 1000,
        minHeight: 650,
        show: false,
        backgroundColor: process.platform === 'win32' ? '#f7f4ec' : '#faf7ef',
        ...(process.platform === 'win32' ? {
            icon: path.join(__dirname, '../assets/app-icon.ico'),
            titleBarStyle: 'hidden' as const,
            // The renderer paints the full caption behind Electron's native controls.
            titleBarOverlay: { color: '#00000000', symbolColor: '#302c26' },
        } : {}),
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });
    if (process.platform === 'win32') win.removeMenu();
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.on('focus',()=>win.flashFrame(false));
    win.webContents.on('will-navigate', (event) => event.preventDefault());
    await win.loadFile(path.join(__dirname, beta?'../dist-beta/index.html':'../dist/index.html'));
    win.show();
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { for (const c of running.values())
    c.abort(); });
