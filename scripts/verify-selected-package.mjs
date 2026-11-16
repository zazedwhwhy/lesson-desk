import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import asar from '@electron/asar';
const pkg=JSON.parse(await fs.readFile('package.json','utf8')),version=pkg.version;
const output=pkg.build.directories.output;
const archive=path.join(output,'win-unpacked/resources/app.asar');
const files=['dist/index.html','dist-desktop/main.cjs','dist-desktop/preload.cjs',...(await fs.readdir('dist/assets')).filter(f=>/\.(js|css)$/.test(f)&&!f.startsWith('pdf.worker')).map(f=>'dist/assets/'+f)];
const checks=[];
for(const file of files){const packed=asar.extractFile(archive,file.split('/').join(path.sep)),local=await fs.readFile(file);checks.push({file,matches:packed.equals(local)});}
const packaged=JSON.parse(asar.extractFile(archive,'package.json').toString('utf8'));
if(packaged.version!==version)throw Error('安装包版本与源码不一致');
const installer=await fs.readFile(path.join(output,pkg.build.productName+' Setup '+version+'.exe'));
const report={version,checks,installer:{size:installer.length,sha256:createHash('sha256').update(installer).digest('hex')}};
await fs.writeFile('test-results/selected-package-integrity.json',JSON.stringify(report,null,2));
if(checks.some(c=>!c.matches))throw Error('打包文件与当前构建不一致');
console.log('PACKAGE INTEGRITY PASS '+version+' '+checks.length+' files; '+installer.length+' bytes');
