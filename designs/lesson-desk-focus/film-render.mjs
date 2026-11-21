import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright';
const work=fileURLToPath(new URL('work/',import.meta.url));
const [name,first,last]=process.argv.slice(2),start=Number(first),end=Number(last);
const file=path.join(work,'film-stage.html');
await fs.writeFile(file,'<!doctype html><meta charset=utf-8><style>*{margin:0}canvas{display:block}</style><script defer src="film-stage.js"></script>');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-gpu','--enable-webgl','--ignore-gpu-blocklist','--use-angle=d3d11','--allow-file-access-from-files']});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}});
 page.on('pageerror',e=>console.error(e));
 await page.goto(pathToFileURL(file).href);await page.waitForFunction(()=>window.filmFrame!==undefined);
 if(start>=57)await page.evaluate(()=>window.loadPlates(['show-2','show-3','ppt-before','ppt-after']));
 console.log(await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2');return gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL)}));
 const fps=Number(process.env.FOCUS_FPS||60);
 const ff=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',String(fps),'-vcodec','mjpeg','-i','pipe:0','-vf','scale=in_range=full:out_range=tv,format=yuv420p','-c:v','libx264','-threads','4','-preset','veryfast','-crf','17',path.join(work,name+'.mp4')],{stdio:['pipe','ignore','inherit'],windowsHide:true});
 const ended=once(ff,'exit');
 for(let n=0;n<Math.round((end-start)*fps);n++){
  const frame=await page.evaluate(t=>{window.filmFrame(t);return document.querySelector('canvas').toDataURL('image/jpeg',.91).split(',')[1]},start+n/fps);
  const data=Buffer.from(frame,'base64');if(n%(fps*4)===0){console.log(name,n/fps);await fs.writeFile(path.join(work,name+'-'+(n/fps)+'.jpg'),data)}
  if(!ff.stdin.write(data))await once(ff.stdin,'drain');
 }
 ff.stdin.end();const [code]=await ended;if(code)throw Error('FFmpeg '+code);
}finally{await browser.close()}
