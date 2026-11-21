import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const video=process.argv[2]?pathToFileURL(path.resolve(process.argv[2])):new URL('out/答案先别放-1080p60.mp4',import.meta.url);
const name=process.argv[2]?'native-playback':'playback';
const pageFile=new URL('work/'+name+'.html',import.meta.url);
await fs.writeFile(pageFile,'<!doctype html><meta charset="utf-8"><video controls style="width:100vw" src="'+video.href+'"></video>');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage();
 await page.goto(pageFile.href);
 await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
 await page.evaluate(async()=>{const v=document.querySelector('video');await v.play()});
 await page.waitForFunction(()=>document.querySelector('video').ended,null,{timeout:180000});
 const report=await page.evaluate(async()=>{
   const v=document.querySelector('video'),quality=v.getVideoPlaybackQuality();
   const report={duration:v.duration,ended:v.ended,error:v.error?.message??null,frames:quality.totalVideoFrames,dropped:quality.droppedVideoFrames,seeks:[]};
   for(const time of [3,78,99,147,0]){
     const done=new Promise(resolve=>v.addEventListener('seeked',resolve,{once:true}));v.currentTime=time;await done;report.seeks.push(v.currentTime);
   }
   await v.play();await new Promise(resolve=>setTimeout(resolve,600));v.pause();report.replay=v.currentTime;return report;
 });
 if(!report.ended||report.error||Math.abs(report.duration-150)>1/60||report.replay<=0)throw Error(JSON.stringify(report));
 await fs.writeFile(new URL('work/'+name+'.json',import.meta.url),JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close()}
