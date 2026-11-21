import {createCanvas,GlobalFonts,loadImage} from '@napi-rs/canvas';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {cuts,captions,drawFilm} from './timeline.mjs';
const root=fileURLToPath(new URL('./',import.meta.url)),work=path.join(root,'work'),out=path.join(root,'out');
await fs.mkdir(out,{recursive:true});
for(const [file,name] of [['Deng.ttf','Sans'],['Dengb.ttf','Bold'],['georgia.ttf','Serif'],['georgiai.ttf','Italic'],['georgiab.ttf','Display'],['consola.ttf','Mono']]){
  if(!GlobalFonts.registerFromPath(path.join('C:/Windows/Fonts',file),name))throw Error('Missing font '+file);
}
GlobalFonts.registerFromPath(path.resolve('assets/fonts/WenKai.ttf'),'Editorial');
const keys=['source-paper','source-key','paper-1','paper-3','blue-2','blue-3','forest-2','forest-3','setup','powerpoint-before','powerpoint-after','library','walk','apparatus'];
const pics=Object.fromEntries(await Promise.all(keys.map(async k=>[k,await loadImage(path.join(['walk','apparatus'].includes(k)?root:work,k+'.png'))])));
// Feather just the margins of the illustration into the surrounding white page.
const art=createCanvas(pics.walk.width,pics.walk.height),a=art.getContext('2d');
a.drawImage(pics.walk,0,0);a.globalCompositeOperation='destination-in';
for(const [x,y] of [[1,0],[0,1]]){
  const g=a.createLinearGradient(0,0,x*art.width,y*art.height);
  for(const [p,alpha] of [[0,0],[.055,1],[.93,1],[1,0]])g.addColorStop(p,'rgba(0,0,0,'+alpha+')');
  a.fillStyle=g;a.fillRect(0,0,art.width,art.height);
}
pics.walk=art;
const board=createCanvas(1920,1080),ctx=board.getContext('2d');
const option=process.argv[2]||'proof';
if(option==='proof'){
  const times=[3.2,11,18,33,48.7,55.6,62.4,70.4,80,85.4,91.8,101.3,109,117.5,128.5,134.8,140,147];
  const grid=createCanvas(1280,Math.ceil(times.length/3)*252),g=grid.getContext('2d');
  g.fillStyle='#e7e8e3';g.fillRect(0,0,grid.width,grid.height);
  times.forEach((t,i)=>{drawFilm(ctx,pics,t);let x=i%3*426,y=Math.floor(i/3)*252;g.drawImage(board,x,y,425,239);g.fillStyle='#202822';g.font='11px Mono';g.fillText(t.toFixed(1)+' s',x+5,y+250)});
  await fs.writeFile(path.join(work,'proof.jpg'),grid.toBuffer('image/jpeg',93));
}else{
  const index=Number(option),from=cuts[index],to=cuts[index+1];if(!Number.isFinite(to))throw Error('Invalid scene');
  const dest=path.join(work,'scene-'+index+'.mp4');
  const ff=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','60','-vcodec','mjpeg','-i','pipe:0','-an','-vf','scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p','-c:v','libx264','-preset','veryfast','-threads','4','-crf','17','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709',dest],{windowsHide:true,stdio:['pipe','ignore','inherit']});
  const finished=once(ff,'close');
  // Detect holds from the actual draw commands. Static frames reuse their encoded pixels.
  let previous='',jpeg;
  const departing=createCanvas(1920,1080);
  if(index>0)drawFilm(departing.getContext('2d'),pics,from-1/60);
  const runs=[],measure=createCanvas(10,10).getContext('2d');
  const id=new Map(Object.entries(pics).map(([k,v])=>[v,k]));
  const recorder=new Proxy({},{
    get(_,key){if(key==='canvas')return board;if(key==='measureText')return s=>measure.measureText(s);
      if(key==='globalAlpha')return measure.globalAlpha;
      return (...args)=>{if(key==='save'||key==='restore')measure[key]();runs.push([key,...args.map(a=>id.get(a)??a)])};},
    set(_,key,value){runs.push(['=',key,value]);if(key==='font'||key==='globalAlpha')measure[key]=value;return true}
  });
  for(let i=from*60;i<to*60;i++){
    runs.length=0;drawFilm(recorder,pics,i/60);const sig=JSON.stringify(runs);
    const elapsed=i/60-from,turn=index>0&&elapsed<.55;
    if(sig!==previous||turn||Math.abs(elapsed-.55)<.017){
      drawFilm(ctx,pics,i/60);
      if(turn){
        const progress=1-(1-elapsed/.55)**3;
        ctx.save();ctx.setTransform(1,0,0,1,0,0);
        ctx.globalAlpha=1-progress;
        ctx.translate(-44*progress,12*progress);
        ctx.drawImage(departing,0,0,1920*(1-.025*progress),1080*(1-.025*progress));
        ctx.restore();
      }
      jpeg=board.toBuffer('image/jpeg',95);previous=sig
    }
    if(!ff.stdin.write(jpeg))await once(ff.stdin,'drain');
  }
  ff.stdin.end();const [status]=await finished;if(status!==0)throw Error('ffmpeg status '+status);console.log('Scene '+index+' complete');
}
function stamp(n){return new Date(n*1000).toISOString().slice(11,23).replace('.',',')}
await fs.writeFile(path.join(out,'答案先别放.srt'),captions.map(([s,e,str],i)=>[i+1,stamp(s)+' --> '+stamp(e),str,''].join('\n')).join('\n'),'utf8');
