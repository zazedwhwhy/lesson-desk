import {unzipSync,zipSync,strFromU8} from 'fflate';
import path from 'node:path';
import {createCanvas,loadImage} from '@napi-rs/canvas';
// PptxGenJS emits a broken-image PNG for Node SVG previews. Replace each fallback
// using the SVG actually embedded in that picture, retaining the vector original.
export async function withFormulaPreviews(bytes:Uint8Array){
 const files=unzipSync(bytes);let changed=false;
 for(const name of Object.keys(files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n))){
  const relName='ppt/slides/_rels/'+path.posix.basename(name)+'.rels',rels=strFromU8(files[relName]);
  const targets=new Map<string,string>();
  for(const match of rels.matchAll(/<Relationship\s+([^>]+)\/?\s*>/g)){const attrs=Object.fromEntries(Array.from(match[1].matchAll(/(\w+)="([^"]*)"/g),m=>[m[1],m[2]]));if(attrs.Id&&attrs.Target)targets.set(attrs.Id,path.posix.normalize('ppt/slides/'+attrs.Target));}
  for(const picture of strFromU8(files[name]).matchAll(/<p:pic[ >][\s\S]*?<\/p:pic>/g)){
   const svgId=picture[0].match(/<asvg:svgBlip[^>]*r:embed="([^"]+)"/)?.[1];if(!svgId)continue;
   const pngId=picture[0].match(/<a:blip\s[^>]*r:embed="([^"]+)"/)?.[1],svgName=targets.get(svgId),pngName=pngId&&targets.get(pngId);
   if(!svgName||!pngName||!files[svgName])throw Error('公式预览资源缺失，已停止导出');
   const image=await loadImage(Buffer.from(files[svgName]));if(image.width>12000||image.height>12000)throw Error('公式图片尺寸过大');
   const canvas=createCanvas(image.width,image.height);canvas.getContext('2d').drawImage(image,0,0);files[pngName]=new Uint8Array(canvas.toBuffer('image/png'));changed=true;
  }
 }
 return changed?zipSync(files):bytes;
}
