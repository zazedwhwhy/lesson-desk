import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
const file=fileURLToPath(new URL('render.mjs',import.meta.url));
let next=0;
async function render(){
  while(next<9){
    const scene=next++;
    const child=spawn(process.execPath,[file,String(scene)],{windowsHide:true,stdio:'inherit'});
    const [status]=await once(child,'exit');
    if(status!==0)throw Error('Scene '+scene+' exited '+status);
  }
}
await Promise.all([render(),render()]);
