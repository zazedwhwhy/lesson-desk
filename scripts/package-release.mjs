import fs from 'node:fs';
import {createRequire} from 'node:module';
import {buildChannel} from './build-channel.mjs';
const require=createRequire(import.meta.url),{build,Platform,Arch}=require('electron-builder');
const channel=process.argv[2]||'stable',beta=channel==='beta';
buildChannel(channel);
const pkg=JSON.parse(fs.readFileSync('package.json','utf8')),version=pkg.version+(beta?'-beta.1':'');
if(pkg.version.includes('-'))throw Error('package.json must contain the stable base version');
const config={directories:{output:'release/'+version},artifactName:'LessonDesk-'+version+'-Setup.${ext}'};
if(beta)Object.assign(config,{
 appId:'top.rainhollow.lessondesk.beta',productName:'讲题工作台 Beta',
 extraMetadata:{name:'lesson-desk-beta',version,main:'dist-desktop-beta/main.cjs'},
 files:['dist-beta/**','dist-desktop-beta/**','!dist/**','!dist-desktop/**','assets/**','package.json','!assets/fonts/*.ttf','LICENSE','THIRD_PARTY_NOTICES.md']
});
await build({targets:Platform.WINDOWS.createTarget('nsis',Arch.x64),publish:'never',config});
