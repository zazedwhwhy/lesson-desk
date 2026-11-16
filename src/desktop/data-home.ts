import fs from 'node:fs';
import path from 'node:path';

const dataEntries=['Local State','settings.json','prompts.json','notebook.json','projects','ppt-templates'];
function exists(file:string){try{fs.accessSync(file);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error;}}
/** First stable launch copies app data, never moves or overwrites older installs. */
export function initializeStableData(target:string,candidates:string[]){
 if(exists(target))return;
 const source=candidates.find(candidate=>exists(path.join(candidate,'settings.json'))||exists(path.join(candidate,'projects')));
 const staging=target+'.import-'+crypto.randomUUID();
 fs.mkdirSync(staging,{recursive:true});
 try{
  if(source)for(const name of dataEntries)if(exists(path.join(source,name)))fs.cpSync(path.join(source,name),path.join(staging,name),{recursive:true,errorOnExist:true,force:false});
  fs.writeFileSync(path.join(staging,'migration.json'),JSON.stringify({version:1,source:source||null,at:new Date().toISOString()},null,2));
  fs.renameSync(staging,target);
 }catch(error){fs.rmSync(staging,{recursive:true,force:true});throw error;}
}
