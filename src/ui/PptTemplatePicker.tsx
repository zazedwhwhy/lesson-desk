import React,{useEffect,useState} from 'react';
import {Upload} from 'lucide-react';
import {builtinPptTemplates,type PptTemplate} from '../core/ppt-templates';
import {invoke} from './api';
import './ppt-templates.css';

type Props={value:PptTemplate;onChange:(value:PptTemplate)=>void;busy:boolean;onPending:(pending:boolean)=>void};
export function PptTemplatePicker({value,onChange,busy,onPending}:Props){
 const [templates,setTemplates]=useState<PptTemplate[]>(()=>value.custom?[...builtinPptTemplates,value]:builtinPptTemplates),[pending,setPending]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  if(!window.desk)return;
  let active=true;
  invoke('ppt-templates').then((items:PptTemplate[])=>{if(active)setTemplates(items);}).catch(e=>{if(active)setError('模板库读取失败：'+(e instanceof Error?e.message:String(e)));});
  return()=>{active=false;};
 },[]);
 async function upload(){
  setError('');setPending(true);onPending(true);
  try{
   const template:PptTemplate|null=await invoke('import-ppt-template');
   if(template){setTemplates(items=>[...items.filter(t=>t.id!==template.id),template]);onChange(template);}
  }catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setPending(false);onPending(false);}
 }
 const custom=templates.filter(t=>t.custom);
 return <fieldset className="ppt-picker" disabled={busy||pending}>
  <legend>PPT 模板</legend>
  <div className="ppt-builtin-options" role="group" aria-label="内置 PPT 模板">{builtinPptTemplates.map(t=><label className={'ppt-template-option'+(value.id===t.id?' is-selected':'')} key={t.id}>
   <input type="radio" name="ppt-template" value={t.id} checked={value.id===t.id} onChange={()=>onChange(t)}/>
   <span className="ppt-miniature" aria-hidden="true" style={{background:'#'+t.colors.background,color:'#'+t.colors.text,borderColor:'#'+t.colors.line}}><strong style={{color:'#'+t.colors.accent}}>逐题讲评</strong><span>观点需要证据支撑</span><small style={{color:'#'+t.colors.muted}}>定位原文 · 梳理思路</small></span>
   <span className="ppt-template-name">{t.name}</span>
  </label>)}</div>
  <div className="ppt-custom-controls"><label>我的模板<select aria-label="我的 PPT 模板" value={value.custom?value.id:''} onChange={e=>{const template=custom.find(t=>t.id===e.target.value);if(template)onChange(template);}}><option value="" disabled>{custom.length?'选择已上传模板':'尚未上传模板'}</option>{custom.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label><button type="button" onClick={()=>void upload()}><Upload size={16}/>{pending?'正在导入…':'上传 PPT 模板'}</button></div>
  <p className="ppt-template-help">支持 .pptx / .potx（25 MB 内），适合使用母版制作的模板。短内容合页，长内容自动分页；题面与答案分开呈现。</p>
  {value.custom&&<div className="ppt-custom-preview"><span className="ppt-color-sample" aria-hidden="true" style={{background:'#'+value.colors.background,color:'#'+value.colors.text}}>Aa 文</span><p><strong>已选：{value.name}</strong><span>{value.layoutName} · {value.layout.width.toFixed(1)} × {value.layout.height.toFixed(1)} 英寸</span><small>此处预览主题色；导出时保留模板母版背景与装饰，正文重新排版。</small></p></div>}
  {error&&<p className="ppt-template-error" role="alert">{error}</p>}
 </fieldset>;
}
