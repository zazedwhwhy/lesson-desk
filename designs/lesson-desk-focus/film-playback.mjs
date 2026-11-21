import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const video=new URL('out/对焦-OpenMotion-1080p60.mp4',import.meta.url);
const html=new URL('work/watch-focus.html',import.meta.url);
await fs.writeFile(html,'<!doctype html><meta charset=utf-8><video controls src="'+video.href+'"></video>');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage();await page.goto(html.href);
 await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
 await page.evaluate(()=>document.querySelector('video').play());
 await page.waitForFunction(()=>document.querySelector('video').ended,null,{timeout:145000});
 const report=await page.evaluate(async()=>{
  const v=document.querySelector('video'),quality=v.getVideoPlaybackQuality();
  const result={duration:v.duration,ended:v.ended,error:v.error?.message,frames:quality.totalVideoFrames,dropped:quality.droppedVideoFrames,seeks:[]};
  for(const time of [9,38,51,80,94,0]){
   const done=new Promise(resolve=>v.addEventListener('seeked',resolve,{once:true}));
   v.currentTime=time;await done;result.seeks.push(v.currentTime);
  }
  await v.play();await new Promise(resolve=>setTimeout(resolve,700));v.pause();result.replay=v.currentTime;return result;
 });
 if(!report.ended||report.error||Math.abs(report.duration-96)>.06||report.replay<=0)throw Error(JSON.stringify(report));
 await fs.writeFile(new URL('work/player-check.json',import.meta.url),JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close()}
