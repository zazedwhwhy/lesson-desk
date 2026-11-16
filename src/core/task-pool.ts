/** Stop dispatching on failure, but always settle already-started work. */
export async function taskPool<T>(items:T[],work:(item:T)=>Promise<void>,stop:()=>boolean,limit=3){
 let cursor=0,failed=false,error:unknown;
 await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
  while(!failed&&!stop()&&cursor<items.length){const item=items[cursor++];try{await work(item);}catch(e){failed=true;error??=e;}}
 }));
 if(failed)throw error;
}
export function serialSnapshots<T>(save:(snapshot:T,message:string)=>Promise<unknown>){
 let tail=Promise.resolve<unknown>(undefined);
 return (value:T,message='')=>{const snapshot=structuredClone(value);tail=tail.then(()=>save(snapshot,message));return tail;};
}
