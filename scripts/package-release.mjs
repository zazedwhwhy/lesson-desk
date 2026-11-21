import fs from 'node:fs';
import {createRequire} from 'node:module';
import {buildChannel} from './build-channel.mjs';
const require=createRequire(import.meta.url),{build,Platform,Arch}=require('electron-builder');
const channel=process.argv[2]||'stable',beta=channel==='beta';
const target=process.argv[3]||'win';
if(!['win','mac'].includes(target))throw Error('Package target must be win or mac');
if(target==='mac'&&(process.platform!=='darwin'||!['arm64','x64'].includes(process.arch)))
 throw Error('Run npm run package:mac on macOS with a native arm64 or x64 Node.js installation.');
const mac=target==='mac';
buildChannel(channel);
const pkg=JSON.parse(fs.readFileSync('package.json','utf8')),version=pkg.version+(beta?'-beta.2':'');
if(pkg.version.includes('-'))throw Error('package.json must contain the stable base version');
const config={directories:{output:mac?'release/'+version+'/macos':'release/'+version},artifactName:'LessonDesk-'+version+'-Setup.${ext}'};
if(beta)Object.assign(config,{
 appId:'top.rainhollow.lessondesk.beta',productName:'讲题工作台 Beta',
 extraMetadata:{name:'lesson-desk-beta',version,main:'dist-desktop-beta/main.cjs'},
 files:['dist-beta/**','dist-desktop-beta/**','!dist/**','!dist-desktop/**','assets/**','package.json','!assets/fonts/*.ttf','LICENSE','THIRD_PARTY_NOTICES.md']
});
const targets=mac?Platform.MAC.createTarget('dmg',Arch[process.arch]):Platform.WINDOWS.createTarget('nsis',Arch.x64);
await build({targets,publish:'never',config});
