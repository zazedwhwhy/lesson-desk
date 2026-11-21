import fs from 'node:fs/promises';
import {cuts} from './timeline.mjs';
const work=new URL('work/',import.meta.url);
async function result(name){return JSON.parse(JSON.parse(await fs.readFile(new URL(name+'.result.json',work),'utf8')).content[0].text)}
const assets=(await result('import')).items;
const state=await result('detail'),round=await result('begin');
if(assets.length!==10||assets.some(a=>a.status!=='completed'))throw Error('All nine scenes and the score must be imported');
const names=['开场提问','材料核对','备课范围','教师追问','三种课堂版式','放映与可编辑PPT','语文与化学','Skill课件包','答案与片尾'];
const media=names.map((name,i)=>{
  const a=assets.find(a=>a.itemId==='scene-'+i),duration=cuts[i+1]-cuts[i];
  if(a.duration!==duration)throw Error('Scene timing mismatch '+name);
  return '<video class="clip" id="shot-'+i+'" data-hf-id="shot-'+i+'" data-name="'+name+'" data-track-index="0" data-start="'+cuts[i]+'" data-duration="'+duration+'" src="'+a.path+'" muted playsinline></video>';
});
media.push('<audio class="clip" id="hope" data-hf-id="hope" data-name="Tobu · Hope" data-track-index="1" data-start="0" data-duration="150" data-volume="1" src="'+assets.find(a=>a.itemId==='score').path+'"></audio>');
const html='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>答案先别放 · 讲题工作台</title><script src="assets/gsap.min.js"></script><style>body{margin:0;background:white}#main{position:relative;width:1920px;height:1080px;overflow:hidden}video{position:absolute;inset:0;width:100%;height:100%}</style></head><body><div id="main" data-hf-id="main" data-composition-id="main" data-start="0" data-duration="150" data-width="1920" data-height="1080" data-fps="60">'+media.join('\n')+'</div><script>window.__timelines={main:gsap.timeline({paused:true})};</script></body></html>';
await fs.writeFile(new URL('edit.json',work),JSON.stringify({projectId:state.projectId,workId:round.inlineWork.id,requestId:'answer-first-native-cut-01',expectedRevision:state.revision,expectedVersionId:state.currentVersionId,files:[{path:'index.html',content:html}],summary:'九段完整分镜与独立音乐轨，150 秒，1080p60。'}));
