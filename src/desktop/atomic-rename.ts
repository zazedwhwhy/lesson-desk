import {rename} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';

/** Windows can briefly lock newly written files while indexing/scanning them.
 * Retry the same atomic operation; never delete the destination or copy over it. */
export async function atomicRename(source:string,destination:string){
 for(let attempt=0;;attempt++){
  try{await rename(source,destination);return;}catch(error){
   const code=(error as NodeJS.ErrnoException).code;
   if(process.platform!=='win32'||!['EPERM','EBUSY','EACCES'].includes(code||'')||attempt===5)throw error;
   await delay(50*2**attempt);
  }
 }
}
