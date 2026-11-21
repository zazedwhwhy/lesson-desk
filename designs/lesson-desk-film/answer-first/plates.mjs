import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const work=fileURLToPath(new URL('work/',import.meta.url));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
  const page=await browser.newPage({viewport:{width:1200,height:675},deviceScaleFactor:1.5});
  for(const name of (await fs.readdir(work)).filter(n=>n.endsWith('.html'))){
    await page.goto(pathToFileURL(path.join(work,name)).href);
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:path.join(work,name.replace('.html','.png'))});
  }
}finally{await browser.close();}
