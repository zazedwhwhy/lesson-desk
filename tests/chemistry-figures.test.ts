import {it,expect,vi,afterEach} from 'vitest';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {emptyProject,sourceSchema} from '../src/core/model';
import {figurePixels} from '../src/core/chemistry-figures';
import {questionFigures,completeFigureLinks} from '../src/core/chemistry-figure-links';
import {chemQuestionSchema,chemChecks,chemSlides} from '../src/core/chemistry';
import {detectChemistryFigures,recognizeChemistryFigures,wordFigureInputs,figureRenderScale} from '../src/desktop/chemistry-figures';
import {callAI} from '../src/desktop/ai';
import {organizeChemistry,chemistryCaller} from '../src/desktop/chemistry';
vi.mock('../src/desktop/ai',()=>({callAI:vi.fn()}));
const ai=vi.mocked(callAI),signal=()=>new AbortController().signal,settings={provider:'openai' as const,model:'fixture',baseUrl:'https://api.openai.com/v1'};
const canvas=createCanvas(1000,800);canvas.getContext('2d').fillRect(0,0,1000,800);
const data=canvas.toDataURL('image/png');
const box={x:100,y:100,width:700,height:600};
const detected={name:'工艺流程',kind:'flowchart' as const,description:'原图',questionNumbers:['12'],box};
function source(){return sourceSchema.parse({id:'s',name:'paper.docx',role:'paper',kind:'docx',blocks:[],previewHtml:`<p>12. 原题</p><img src="${data}"/>`,figures:[{...detected,id:'f',data,unit:1,page:2}]});}
afterEach(()=>vi.resetAllMocks());
it('裁图保留边缘裕量且不越界，拒绝无效或不可读区域',()=>{
 expect(figurePixels(box,1000,800)).toEqual({x:93,y:73,width:714,height:494});
 expect(figurePixels({x:0,y:0,width:1000,height:1000},1000,800)).toEqual({x:0,y:0,width:1000,height:800});
 expect(()=>figurePixels({...box,x:900},1000,800)).toThrow('超出');
 expect(()=>figurePixels({...box,width:1},1000,800)).toThrow('过小');
});
it('超大矢量PDF先缩放再分配画布，普通试卷保留2倍精度',()=>{
 expect(figureRenderScale(612,792)).toBe(2);expect(figureRenderScale(10000,10000)).toBe(.32);
 expect(10000*figureRenderScale(10000,10000)).toBe(3200);
});
it('同源跨页与共享图按题号关联，其他来源id明确报错',()=>{
 const s=source();s.figures![0].questionNumbers=['12','13'];
 expect(questionFigures(s,'12')[0].page).toBe(2);expect(questionFigures(s,'13')).toHaveLength(1);expect(questionFigures(s,'11')).toEqual([]);
 expect(()=>questionFigures(s,'12',['other-source'])).toThrow('其他来源');
 expect(questionFigures(s,'11',['f'])).toHaveLength(1);
 expect(questionFigures(s,'12',[])).toHaveLength(0);
});
it('恢复补图保留教师正文和讲义，未知归属原图明确提示',()=>{
 const p=emptyProject('图','chemistry');p.sources=[source()];p.chemistry!.questions=[chemQuestionSchema.parse({id:'q',number:'12',stem:'教师修订',sourceId:'s',confirmed:true})];
 completeFigureLinks(p);const q=p.chemistry!.questions[0];expect(q.stem).toBe('教师修订');expect(q.images).toHaveLength(1);expect(q.imageMode).toBe('auto');expect(q.confirmed).toBe(false);
 completeFigureLinks(p);expect(q.images).toHaveLength(1);
 p.sources[0].figures!.push({...p.sources[0].figures![0],id:'unmatched',questionNumbers:[]});completeFigureLinks(p);expect(p.organizationIssues?.join()).toContain('待关联');
});
it('教师移除的自动配图不会在补齐缺题时重新附入',()=>{
 const p=emptyProject('人工修正','chemistry');p.sources=[source()];
 p.chemistry!.questions=[chemQuestionSchema.parse({id:'q',number:'12',stem:'原题',sourceId:'s',dismissedFigureIds:['f']})];
 completeFigureLinks(p);expect(p.chemistry!.questions[0].images).toEqual([]);
});
it('Word重复图片只识别一次并携带每次出现的邻近题面，不把base64放入文字提示',()=>{
 const inputs=wordFigureInputs(`<p>11. 第一题</p><img src="${data}"/><p>12. 第二题</p><img src="${data}"/><p>后文</p>`);
 expect(inputs).toHaveLength(1);expect(inputs[0].contexts).toHaveLength(2);expect(inputs[0].contexts[1].before).toContain('12. 第二题');expect(JSON.stringify(inputs[0].contexts)).not.toContain('base64');
});
it('自动图随题核对即可生成和输出，旧手工图仍需核对',()=>{
 const q=chemQuestionSchema.parse({id:'q',number:'12',stem:'原题',imageMode:'auto',images:questionFigures(source(),'12')});
 expect(chemChecks(q)).toEqual(['题面尚未核对']);q.confirmed=true;expect(chemChecks(q)).toEqual([]);
 const p=emptyProject('图','chemistry');p.chemistry!.questions=[q];
 const slides=chemSlides(p.chemistry!,['question:q']);
 expect(slides).toHaveLength(1);
 expect(slides[0].questionLayout?.figure?.data).toBe(q.images[0].data);
 q.images[0].automatic=false;expect(chemChecks(q)).toContain('图片尚未核对');
});
it('整理的明确图ID覆盖初步题号，移除软件占位文字且不在补齐时错挂',async()=>{
 const p=emptyProject('明确归属','chemistry');p.sources=[source()];p.sources[0].blocks=[{id:'b',text:'12. 无图题。\n13. 有图题。\n[原文含图片，请对照原文件补充必要文字]'}];
 ai.mockResolvedValueOnce({questions:[{number:'12',kind:'principle',stem:'无图题。',options:[],answer:'',sourceId:'s',pages:[],figureIds:[]},{number:'13',kind:'process',stem:'有图题。\n[原文含图片，请对照原文件补充必要文字]',options:[],answer:'',sourceId:'s',pages:[],figureIds:['f']}]});
 const out=await organizeChemistry(p,settings,'synthetic',signal());
 expect(out.chemistry!.questions.map(q=>q.images.length)).toEqual([0,1]);expect(out.chemistry!.questions[1].stem).toBe('有图题。');
 completeFigureLinks(out);expect(out.chemistry!.questions.map(q=>q.images.length)).toEqual([0,1]);
});
it('自动模式实际发送关联原图，图示说明不能代替视觉输入',async()=>{
 const q=chemQuestionSchema.parse({id:'q',number:'12',stem:'原题',imageMode:'auto',images:questionFigures(source(),'12')});
 ai.mockResolvedValue({status:'needs_review',notices:['无答案'],blocks:[{label:'图示',text:'读取原图'}]});
 await chemistryCaller(settings,'synthetic')(q,'experiment',signal());expect(ai.mock.calls[0][7]).toEqual([data]);
});
it('只为坐标内容错误重试一次，成功后裁取真实像素',async()=>{
 ai.mockResolvedValueOnce({figures:[{...detected,box:{...box,x:900}}]}).mockResolvedValueOnce({figures:[detected]});
 const result=await detectChemistryFigures(canvas,{},settings,'synthetic',signal());const image=await loadImage(result[0].data);
 expect(image.width).toBe(714);expect(image.height).toBe(494);expect(ai).toHaveBeenCalledTimes(2);
 ai.mockReset().mockRejectedValue(new Error('401凭据无效'));await expect(detectChemistryFigures(canvas,{},settings,'synthetic',signal())).rejects.toThrow('401');expect(ai).toHaveBeenCalledTimes(1);
});
it('Word保存原图及扫描缓存，第二次整理不再请求',async()=>{
 const p=emptyProject('Word图','chemistry');p.sources=[source()];delete p.sources[0].figures;
 ai.mockResolvedValue({figures:[detected]});const save=vi.fn().mockResolvedValue(undefined);
 await recognizeChemistryFigures(p,'.',settings,'synthetic',signal(),save);
 expect(p.sources[0].figures).toHaveLength(1);expect(p.sources[0].figureScanUnits).toEqual([1]);expect(save).toHaveBeenCalledTimes(2);
 await recognizeChemistryFigures(p,'.',settings,'synthetic',signal(),save);expect(ai).toHaveBeenCalledTimes(1);
});
it('透明Word黑线图使用白底发送，JPEG不把透明背景变成黑色',async()=>{
 const transparent=createCanvas(100,100);transparent.getContext('2d').fillRect(40,40,20,20);
 const p=emptyProject('透明图','chemistry');p.sources=[source()];p.sources[0].previewHtml=`<img src="${transparent.toDataURL('image/png')}"/>`;
 ai.mockResolvedValue({figures:[]});await recognizeChemistryFigures(p,'.',settings,'synthetic',signal(),async()=>{});
 const sent=await loadImage(ai.mock.calls[0][7]![0]);const decoded=createCanvas(100,100);decoded.getContext('2d').drawImage(sent,0,0);
 expect([...decoded.getContext('2d').getImageData(0,0,1,1).data]).toEqual([255,255,255,255]);
 expect(decoded.getContext('2d').getImageData(50,50,1,1).data[0]).toBeLessThan(20);
});
it('取消不接纳晚到结果，保存失败不继续请求',async()=>{
 const p=emptyProject('取消','chemistry');p.sources=[source()];delete p.sources[0].figures;
 const controller=new AbortController();ai.mockImplementationOnce(async()=>{controller.abort();return {figures:[detected]};});
 await expect(recognizeChemistryFigures(p,'.',settings,'synthetic',controller.signal,async()=>{})).rejects.toThrow('取消');expect(p.sources[0].figureScanUnits).toBeUndefined();expect(p.sources[0].figures).toBeUndefined();
 ai.mockReset();await expect(recognizeChemistryFigures(p,'.',settings,'synthetic',signal(),async()=>{throw Error('磁盘已满');})).rejects.toThrow('磁盘已满');expect(ai).not.toHaveBeenCalled();
});
