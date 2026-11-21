import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const dir=path.dirname(fileURLToPath(import.meta.url)),draft=process.argv[2]==='motion';
await fs.writeFile(path.join(dir,'work','stage.html'),'<!doctype html><meta charset="utf-8"><style>*{margin:0}canvas{display:block}</style><script defer src="stage.js"></script>');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:draft?{width:960,height:540}:{width:1440,height:810}});
 page.on('pageerror',e=>console.error(e.message));await page.goto(pathToFileURL(path.join(dir,'work','stage.html')).href);
 await page.waitForFunction(()=>window.ready);
 if(!draft){
  await fs.writeFile(path.join(dir,'work','original-chart.png'),Buffer.from((await page.evaluate(()=>window.chartImage)).split(',')[1],'base64'));
  for(const [name,t] of [['assembled',0],['exploded',3.35],['registration',7.1]]){
   await page.evaluate(v=>window.pose(v),t);await page.screenshot({path:path.join(dir,name+'.jpg'),type:'jpeg',quality:94});
  }
 }else{
  const ff=spawn('ffmpeg',['-hide_banner','-v','error','-y','-f','image2pipe','-framerate','24','-vcodec','mjpeg','-i','pipe:0','-vf','scale=in_range=full:out_range=tv,format=yuv420p','-c:v','libx264','-preset','fast','-crf','17','-movflags','+faststart',path.join(dir,'work','mechanics.mp4')],{windowsHide:true,stdio:['pipe','ignore','inherit']});
  const done=once(ff,'exit');
  for(let frame=0;frame<180;frame++){await page.evaluate(t=>window.pose(t),frame/24);const data=await page.screenshot({type:'jpeg',quality:93});if(!ff.stdin.write(data))await once(ff.stdin,'drain')}
  ff.stdin.end();const [code]=await done;if(code)throw Error('Encoder exited '+code);
 }
}finally{await browser.close()}
