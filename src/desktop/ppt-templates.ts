import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
import {builtinPptTemplates,type PptTemplate} from '../core/ppt-templates';
import type {Rect} from '../core/slide-layout';

const P='http://schemas.openxmlformats.org/presentationml/2006/main';
const A='http://schemas.openxmlformats.org/drawingml/2006/main';
const R='http://schemas.openxmlformats.org/package/2006/relationships';
const O='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const C='http://schemas.openxmlformats.org/package/2006/content-types';
const emu=914400,prefix='lessonTemplate/';
type Archive=Record<string,Uint8Array>;
type Imported={files:Archive;layoutPart:string;masterPart:string;parts:Set<string>};
export type LoadedTemplate={template:PptTemplate;imported?:Imported};
const elements=(node:Document|Element,ns:string,name:string)=>Array.from(node.getElementsByTagNameNS(ns,name));
function xml(data:Uint8Array|undefined,part:string){
 if(!data)throw Error('模板缺少资源：'+part);
 const text=strFromU8(data);
 if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('模板 XML 不允许包含实体声明：'+part);
 const invalid=(m:string)=>{throw Error('模板 XML 损坏：'+part+' · '+m);};
 return new DOMParser({errorHandler:{warning:invalid,error:invalid,fatalError:invalid}}).parseFromString(text,'application/xml');
}
const encoded=(doc:Document)=>strToU8(new XMLSerializer().serializeToString(doc));
function archive(bytes:Uint8Array):Archive{
 if(bytes.length>25*1024*1024)throw Error('模板不能超过 25 MB');
 let size=0,count=0;
 try{return unzipSync(bytes,{filter:f=>{
  if(f.name.includes('\\')||f.name.startsWith('/')||f.name.split('/').includes('..'))throw Error('模板包含非法资源路径');
  size+=f.originalSize;if(++count>4000||size>100*1024*1024)throw Error('模板解压体积或资源数量超限');
  if(!f.name.endsWith('/')&&/vbaProject|embeddings\//i.test(f.name))throw Error('模板包含宏或嵌入对象，请另存为普通模板后重试');
  return true;
 }});}catch(e){throw Error('无法读取 PowerPoint 模板：'+(e instanceof Error?e.message:String(e)),{cause:e});}
}
const relPart=(part:string)=>path.posix.join(path.posix.dirname(part),'_rels',path.posix.basename(part)+'.rels');
function resolvePart(part:string,target:string){
 if(!target||/[\\?#]/.test(target)||/^[a-z]+:/i.test(target))throw Error('模板包含不支持的资源路径：'+target);
 let decoded:string;try{decoded=decodeURIComponent(target);}catch{throw Error('模板资源路径编码无效');}
 const resolved=path.posix.normalize(decoded.startsWith('/')?decoded.slice(1):path.posix.join(path.posix.dirname(part),decoded));
 if(resolved.startsWith('../')||resolved==='..'||resolved.includes('\\'))throw Error('模板资源越过文件边界');
 return resolved;
}
function relations(files:Archive,part:string){
 const name=relPart(part);return files[name]?elements(xml(files[name],name),R,'Relationship'):[];
}
function related(files:Archive,part:string,type:string){
 const rel=relations(files,part).find(r=>r.getAttribute('Type')===O+'/'+type);
 if(!rel||rel.getAttribute('TargetMode')==='External')throw Error('模板缺少内部 '+type+' 资源');
 return resolvePart(part,rel.getAttribute('Target')||'');
}
function geometry(shape:Element|undefined):Rect|undefined{
 if(!shape)return;
 const xfrm=elements(shape,A,'xfrm')[0];if(!xfrm)return;
 const off=elements(xfrm,A,'off')[0],ext=elements(xfrm,A,'ext')[0];if(!off||!ext)return;
 const rect={x:Number(off.getAttribute('x'))/emu,y:Number(off.getAttribute('y'))/emu,w:Number(ext.getAttribute('cx'))/emu,h:Number(ext.getAttribute('cy'))/emu};
 return Object.values(rect).every(Number.isFinite)&&rect.w>0&&rect.h>0?rect:undefined;
}
function placeholderRect(doc:Document,master:Document,title:boolean){
 const matches=(sp:Element)=>{const ph=elements(sp,P,'ph')[0],type=ph?.getAttribute('type');return !!ph&&(title?['title','ctrTitle'].includes(type||''):['body','obj',''].includes(type||''));};
 const candidates=elements(doc,P,'sp').filter(matches).map(sp=>{
  const ph=elements(sp,P,'ph')[0],idx=ph.getAttribute('idx')||'0';
  return geometry(sp)||geometry(elements(master,P,'sp').find(s=>matches(s)&&(elements(s,P,'ph')[0].getAttribute('idx')||'0')===idx));
 }).filter((r):r is Rect=>!!r);
 return candidates.sort((a,b)=>b.w*b.h-a.w*a.h)[0];
}
const light=(hex:string)=>{const c=hex.match(/../g)!.map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
const contrast=(a:string,b:string)=>(Math.max(light(a),light(b))+.05)/(Math.min(light(a),light(b))+.05);

export function inspectTemplate(bytes:Uint8Array,id:string,name:string):LoadedTemplate{
 const files=archive(bytes),presentation=xml(files['ppt/presentation.xml'],'ppt/presentation.xml');
 const sz=elements(presentation,P,'sldSz')[0],width=Number(sz?.getAttribute('cx'))/emu,height=Number(sz?.getAttribute('cy'))/emu;
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<6||height<4||width>24||height>15||width<=height)throw Error('请使用横向 PowerPoint 模板（宽 6–24 英寸，高 4–15 英寸）');
 const presentationRels=relations(files,'ppt/presentation.xml');
 const masterIds=elements(presentation,P,'sldMasterId');
 const masters=masterIds.map(e=>{const rel=presentationRels.find(r=>r.getAttribute('Id')===e.getAttributeNS(O,'id'));if(!rel)throw Error('模板母版关系缺失');return resolvePart('ppt/presentation.xml',rel.getAttribute('Target')||'');});
 if(!masters.length)throw Error('模板没有可用的幻灯片母版');
 const usedLayouts=new Map<string,number>();
 for(const slide of elements(presentation,P,'sldId')){
  const rel=presentationRels.find(r=>r.getAttribute('Id')===slide.getAttributeNS(O,'id'));
  if(!rel)throw Error('模板幻灯片关系缺失');
  const slidePart=resolvePart('ppt/presentation.xml',rel.getAttribute('Target')||'');
  const layout=related(files,slidePart,'slideLayout');usedLayouts.set(layout,(usedLayouts.get(layout)||0)+1);
 }
 const candidates=masters.flatMap(master=>relations(files,master).filter(r=>r.getAttribute('Type')===O+'/slideLayout').map(r=>{
  if(r.getAttribute('TargetMode')==='External')throw Error('模板包含外部版式');
  const part=resolvePart(master,r.getAttribute('Target')||''),doc=xml(files[part],part),masterDoc=xml(files[master],master);
  const body=placeholderRect(doc,masterDoc,false),type=doc.documentElement.getAttribute('type');
  return {part,master,doc,masterDoc,body,score:(body?100:0)+(['obj','tx'].includes(type||'')?50:0)+(type==='blank'?10:0)+Math.min(20,usedLayouts.get(part)||0)};
 })).sort((a,b)=>b.score-a.score);
 const chosen=candidates[0];if(!chosen)throw Error('模板没有可用的正文版式');
 const parts=new Set<string>();
 function visit(part:string){
  if(parts.has(part))return;
  if(!files[part])throw Error('模板缺少资源：'+part);
  parts.add(part);
  const rp=relPart(part);if(files[rp])parts.add(rp);
  for(const rel of relations(files,part)){
   if(rel.getAttribute('TargetMode')==='External')throw Error('模板包含外部资源，请在 PowerPoint 中嵌入或删除外部链接后重试');
   const type=rel.getAttribute('Type')||'';
   if(!['slideMaster','slideLayout','theme','themeOverride','image'].some(t=>type===O+'/'+t))throw Error('模板母版包含暂不支持的对象：'+type.split('/').pop());
   visit(resolvePart(part,rel.getAttribute('Target')||''));
  }
 }
 visit(chosen.part);
 const themePart=related(files,chosen.master,'theme'),theme=xml(files[themePart],themePart),scheme=elements(theme,A,'clrScheme')[0];
 if(!scheme)throw Error('模板缺少主题配色');
 const mapping=elements(chosen.doc,A,'overrideClrMapping')[0]||elements(chosen.masterDoc,P,'clrMap')[0];
 const color=(key:string)=>{const e=elements(scheme,A,mapping?.getAttribute(key)||key)[0];return e&&(elements(e,A,'srgbClr')[0]?.getAttribute('val')||elements(e,A,'sysClr')[0]?.getAttribute('lastClr'))||'';};
 const validColor=(value:string)=>/^[0-9a-f]{6}$/i.test(value);
 const lt=color('lt1'),dk=color('dk1');if(!validColor(lt)||!validColor(dk))throw Error('模板主题缺少可识别的文字或背景颜色');
 const bg=elements(chosen.doc,P,'bg')[0]||elements(chosen.masterDoc,P,'bg')[0];
 const rawBg=bg&&(elements(bg,A,'srgbClr')[0]?.getAttribute('val')||color(elements(bg,A,'schemeClr')[0]?.getAttribute('val')||''));
 const background=rawBg&&validColor(rawBg)?rawBg:lt;
 const text=contrast(dk,background)>=contrast(lt,background)?dk:lt;
 const accent=color('accent1'),muted=color('dk2');
 const font=(section:string)=>{const node=elements(theme,A,section)[0],ea=node&&(elements(node,A,'ea')[0]?.getAttribute('typeface')||elements(node,A,'font').find(f=>f.getAttribute('script')==='Hans')?.getAttribute('typeface')),latin=node&&elements(node,A,'latin')[0]?.getAttribute('typeface');return {ea:ea||'Microsoft YaHei',latin:latin||'Calibri'};};
 const heading=font('majorFont'),bodyFont=font('minorFont');
 const body=chosen.body||{x:width*.055,y:height*.23,w:width*.89,h:height*.66};
 const title=placeholderRect(chosen.doc,chosen.masterDoc,true)||{x:body.x,y:height*.08,w:body.w,h:height*.10};
 if(body.x<0||body.y<0||body.x+body.w>width+.02||body.y+body.h>height+.02||body.w<2||body.h<1)throw Error('模板正文占位区域无效，请使用留有正文空间的版式');
 if(!Object.values(title).every(Number.isFinite)||title.x<0||title.y<0||title.w<=0||title.h<=0||title.x+title.w>width+.02||title.y+title.h>height+.02)throw Error('模板标题占位区域超出页面，请调整标题框后重新上传');
 if(title.x<body.x+body.w&&title.x+title.w>body.x&&title.y<body.y+body.h&&title.y+title.h>body.y)throw Error('模板标题与正文区域重叠，请调整占位框后重新上传');
 const template:PptTemplate={id,name,custom:true,layoutName:elements(chosen.doc,P,'cSld')[0]?.getAttribute('name')||chosen.doc.documentElement.getAttribute('type')||'正文',layout:{width,height,body,title},colors:{background,text,accent:validColor(accent)&&contrast(accent,background)>=3?accent:text,muted:validColor(muted)&&contrast(muted,background)>=4.5?muted:text,line:text},fonts:{heading:heading.ea,body:bodyFont.ea,source:bodyFont.latin}};
 return {template,imported:{files,layoutPart:chosen.part,masterPart:chosen.master,parts}};
}

export class TemplateStore{
 constructor(private root:string){}
 async list():Promise<PptTemplate[]>{
  let names:string[];try{names=await fs.readdir(this.root);}catch(e:any){if(e.code==='ENOENT')return [...builtinPptTemplates];throw e;}
  const imported=await Promise.all(names.filter(n=>n.endsWith('.json')).map(n=>this.load(n.slice(0,-5))));
  return [...builtinPptTemplates,...imported.map(t=>t.template)];
 }
 async import(file:string):Promise<PptTemplate>{
  if(!['.pptx','.potx'].includes(path.extname(file).toLowerCase()))throw Error('请选择 .pptx 或 .potx 模板');
  const stat=await fs.stat(file);if(stat.size>25*1024*1024)throw Error('模板不能超过 25 MB');
  const bytes=new Uint8Array(await fs.readFile(file)),id=randomUUID(),name=path.basename(file,path.extname(file));
  const loaded=inspectTemplate(bytes,id,name);
  await fs.mkdir(this.root,{recursive:true});
  await fs.writeFile(path.join(this.root,id+'.pptx'),bytes,{flag:'wx'});
  await fs.writeFile(path.join(this.root,id+'.json'),JSON.stringify({name}),{flag:'wx'});
  return loaded.template;
 }
 async load(id:string):Promise<LoadedTemplate>{
  const builtin=builtinPptTemplates.find(t=>t.id===id);if(builtin)return {template:builtin};
  if(typeof id!=='string'||!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id))throw Error('所选模板无效，请重新选择');
  const metadata=JSON.parse(await fs.readFile(path.join(this.root,id+'.json'),'utf8'));
  if(typeof metadata.name!=='string')throw Error('模板名称记录损坏');
  const stat=await fs.stat(path.join(this.root,id+'.pptx'));if(stat.size>25*1024*1024)throw Error('模板不能超过 25 MB');
  return inspectTemplate(new Uint8Array(await fs.readFile(path.join(this.root,id+'.pptx'))),id,metadata.name);
 }
}

export function applyTemplate(bytes:Uint8Array,imported:Imported):Uint8Array{
 const files:Archive=unzipSync(bytes),types=xml(files['[Content_Types].xml'],'[Content_Types].xml'),sourceTypes=xml(imported.files['[Content_Types].xml'],'[Content_Types].xml');
 for(const part of imported.parts){
  const destination=prefix+part;files[destination]=imported.files[part];
  if(part.endsWith('.rels')){
   const doc=xml(files[destination],part),owner=path.posix.join(path.posix.dirname(path.posix.dirname(part)),path.posix.basename(part).slice(0,-5));
   for(const rel of elements(doc,R,'Relationship'))rel.setAttribute('Target',encodeURI(path.posix.relative(path.posix.dirname(owner),resolvePart(owner,rel.getAttribute('Target')||''))));
   files[destination]=encoded(doc);
  }
  const type=elements(sourceTypes,C,'Override').find(e=>e.getAttribute('PartName')==='/'+part)?.getAttribute('ContentType')||elements(sourceTypes,C,'Default').find(e=>e.getAttribute('Extension')===path.posix.extname(part).slice(1))?.getAttribute('ContentType');
  if(!type)throw Error('模板资源缺少内容类型：'+part);
  const entry=types.createElementNS(C,'Override');entry.setAttribute('PartName','/'+destination);entry.setAttribute('ContentType',type);types.documentElement.appendChild(entry);
 }
 files['[Content_Types].xml']=encoded(types);
 const relName='ppt/_rels/presentation.xml.rels',rels=xml(files[relName],relName),rel=rels.createElementNS(R,'Relationship');
 rel.setAttribute('Id','rIdLessonTemplate');rel.setAttribute('Type',O+'/slideMaster');rel.setAttribute('Target',path.posix.relative('ppt',prefix+imported.masterPart));rels.documentElement.appendChild(rel);files[relName]=encoded(rels);
 const presentation=xml(files['ppt/presentation.xml'],'ppt/presentation.xml'),list=elements(presentation,P,'sldMasterIdLst')[0];
 const entry=presentation.createElementNS(P,'p:sldMasterId');entry.setAttribute('id',String(Math.max(2147483647,...elements(presentation,P,'sldMasterId').map(e=>Number(e.getAttribute('id'))))+1));entry.setAttributeNS(O,'r:id','rIdLessonTemplate');list.appendChild(entry);files['ppt/presentation.xml']=encoded(presentation);
 for(const part of Object.keys(files).filter(p=>/^ppt\/slides\/slide\d+\.xml$/.test(p))){
  const slide=xml(files[part],part);for(const bg of elements(slide,P,'bg'))bg.parentNode?.removeChild(bg);files[part]=encoded(slide);
  const rp=relPart(part),doc=xml(files[rp],rp),layout=elements(doc,R,'Relationship').find(e=>e.getAttribute('Type')===O+'/slideLayout');
  if(!layout)throw Error('导出幻灯片缺少版式关系');
  layout.setAttribute('Target',path.posix.relative(path.posix.dirname(part),prefix+imported.layoutPart));files[rp]=encoded(doc);
 }
 return zipSync(files);
}
