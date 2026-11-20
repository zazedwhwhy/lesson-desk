import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
const [startArg='0', secondsArg='1', outputArg='qa/trial.mp4'] = process.argv.slice(2);
const start=Number(startArg), seconds=Number(secondsArg), fps=60;
if(!Number.isInteger(start*fps)||!Number.isInteger(seconds*fps)||seconds<=0) throw Error('start and duration must align to frames');
const output=resolve('designs/lesson-desk-film',outputArg);
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
let ff;
try {
 await page.goto('http://localhost:4312/lesson-desk-film/index.html?capture',{waitUntil:'networkidle'});
 await page.waitForSelector('[data-om-exportable-video-with-duration-secs]');
 await page.evaluate(()=>document.fonts.ready);
 ff=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',String(fps),'-vcodec','mjpeg','-i','pipe:0','-an','-vf','scale=in_range=full:out_range=tv,format=yuv420p','-color_range','tv','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',output],{stdio:['pipe','inherit','inherit']});
 const ffExit=new Promise((resolve,reject)=>{ff.on('error',reject);ff.on('exit',(code,signal)=>code===0?resolve():reject(Error(`ffmpeg exited ${code} ${signal}`)));});
 ff.stdin.on('error',e=>console.error('ffmpeg stdin:',e.message));
 for(let frame=0;frame<seconds*fps;frame++){
  const time=(start*fps+frame)/fps;
  await page.evaluate(time=>document.querySelector('[data-om-exportable-video-with-duration-secs]').dispatchEvent(new CustomEvent('data-om-seek-to-time-frame',{detail:{time,sync:true}})),time);
  const image=await page.screenshot({type:'jpeg',quality:100});
  if(!ff.stdin.write(image)) await once(ff.stdin,'drain');
  if(frame%300===0) console.log(`${start}s: ${frame}/${seconds*fps}`);
 }
 ff.stdin.end(); await ffExit; console.log(`Rendered ${output}`);
} finally {if(ff && !ff.killed && ff.exitCode===null) ff.kill();await browser.close();}
