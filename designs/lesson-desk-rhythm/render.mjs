import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {shots} from './shots.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url)),work=path.join(dir,'work');
const names=(await fs.readdir(path.join(dir,'plates'))).filter(x=>x.endsWith('.jpg')).map(n=>n.slice(0,-4));
const modules=['stage.mjs','pages.mjs','paper.mjs','shots.mjs'];
const needsOptics=!process.argv[3]||process.argv[3].split(',').some(s=>['2','27'].includes(s));
const html='<!doctype html><meta charset=utf-8><style>*{margin:0}canvas{display:block}</style><canvas id="film" width="1920" height="1080"></canvas>'+(needsOptics?'<script src="/optics.js"></script>':'')+'<script type="module">import {setup,draw,canvas} from "/stage.mjs";await setup();Object.assign(window,{draw,film:canvas,filmReady:true});</script>';
const server=createServer(async(req,res)=>{
 try{
  const key=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1);
  if(!key){res.setHeader('content-type','text/html;charset=utf-8');return res.end(html)}
  if(key==='plates.json'){res.setHeader('content-type','application/json');return res.end(JSON.stringify(names))}
  if(key==='lexicon.json'){res.setHeader('content-type','application/json');return res.end(await fs.readFile(path.join(dir,key)))}
  if(key==='optics.js'){res.setHeader('content-type','text/javascript;charset=utf-8');return res.end(await fs.readFile(path.join(work,'optics.js')))}
  if(modules.includes(key))res.setHeader('content-type','text/javascript;charset=utf-8');
  else if(key.startsWith('plates/')&&names.includes(key.slice(7,-4)))res.setHeader('content-type','image/jpeg');
  else{res.statusCode=404;return res.end()}
  res.end(await fs.readFile(path.join(dir,key)));
 }catch(e){res.statusCode=500;res.end(String(e))}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-gpu','--ignore-gpu-blocklist','--use-angle=d3d11','--disable-renderer-backgrounding']});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}});
 page.on('pageerror',console.error);await page.goto('http://127.0.0.1:'+server.address().port);
 await page.waitForFunction(()=>window.filmReady);
 const mode=process.argv[2]||'all',pick=process.argv[3]?.split(',').map(Number);
 const selected=shots.map((s,i)=>i).filter(i=>shots[i][2]!=='live'&&(!pick||pick.includes(i)));
 for(const i of selected){
  const target=path.join(work,'shot-'+String(i).padStart(2,'0'));
  if(mode==='proof'||mode==='rough'){
   const frames=mode==='proof'?[1.6,5.60]:Array.from({length:30},(_,n)=>n*.25);
   const list=await page.evaluate(({i,frames})=>{const small=document.createElement('canvas');small.width=640;small.height=360;const g=small.getContext('2d');return frames.map(t=>{window.draw(i,t);g.drawImage(window.film,0,0,640,360);return small.toDataURL('image/jpeg',.88).split(',')[1]})},{i,frames});
   for(let n=0;n<list.length;n++)await fs.writeFile(target+'-'+mode+'-'+String(n).padStart(2,'0')+'.jpg',Buffer.from(list[n],'base64'));
   continue;
  }
  const result=await page.evaluate(async i=>{
   let err,output=[];const codec='avc1.64002a';
   const cfg={codec,width:1920,height:1080,framerate:60,bitrate:15000000,latencyMode:'realtime',avc:{format:'annexb'}};
   const test=await VideoEncoder.isConfigSupported(cfg);if(!test.supported)throw Error('H.264 encoder unavailable');
   const encoder=new VideoEncoder({output(chunk){const a=new Uint8Array(chunk.byteLength);chunk.copyTo(a);output.push(a)},error(e){err=e}});
   encoder.configure(cfg);
   for(let f=0;f<450;f++){
    window.draw(i,f/60);
    const v=new VideoFrame(window.film,{timestamp:Math.round(f*1e6/60),duration:Math.round((f+1)*1e6/60)-Math.round(f*1e6/60)});
    encoder.encode(v,{keyFrame:f%120===0});v.close();
    if(encoder.encodeQueueSize>8)await new Promise(r=>encoder.addEventListener('dequeue',r,{once:true}));
    if(err)throw err;
   }
   await encoder.flush();encoder.close();if(err)throw err;
   const blob=new Blob(output);
   const data=await new Promise(ok=>{const reader=new FileReader();reader.onload=()=>ok(reader.result.split(',')[1]);reader.readAsDataURL(blob)});
   return {data,frames:output.length};
  },i);
  if(result.frames!==450)throw Error('Encoder produced '+result.frames+' frames for shot '+i);
  await fs.writeFile(target+'.h264',Buffer.from(result.data,'base64'));
  execFileSync('ffmpeg',['-nostdin','-v','error','-y','-r','60','-f','h264','-i',target+'.h264','-c:v','copy','-video_track_timescale','60000','-movflags','+faststart',target+'.mp4'],{windowsHide:true});
  console.log('Rendered',i,shots[i][1]);
 }
}finally{await browser.close();await new Promise(ok=>server.close(ok))}
