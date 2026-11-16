import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);
export function buildChannel(channel){
 if(!['stable','beta'].includes(channel))throw Error('Build channel must be stable or beta');
 const env={...process.env,LESSON_DESK_CHANNEL:channel};
 for(const args of [[require.resolve('typescript/bin/tsc'),'--noEmit'],[path.join(path.dirname(require.resolve('vite/package.json')),'bin/vite.js'),'build'],['scripts/build-desktop.mjs']]){
  const result=spawnSync(process.execPath,args,{stdio:'inherit',env});
  if(result.error)throw result.error;if(result.status!==0)throw Error('Build failed: '+args[0]);
 }
}
if(process.argv[1]===fileURLToPath(import.meta.url))buildChannel(process.argv[2]||'stable');
