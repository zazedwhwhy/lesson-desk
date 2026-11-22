import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft,Check,Eye,EyeOff,Plus,Save,Trash2} from 'lucide-react';
import {defaultSettings,type Settings} from '../core/model';
import {connectionSettings,providerPresets,selectProvider} from '../core/ai-settings';
import {friendlyError} from '../core/errors';
import {invoke} from './api';
import './settings.css';

export function ConnectionSettings({current,onSaved,back,prompts}:{current:Settings;onSaved:(s:Settings)=>void;back:()=>void;prompts:()=>void}){
 const [rows,setRows]=useState<Settings[]>([]),[draft,setDraft]=useState<Settings>({...current,key:''}),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[visible,setVisible]=useState(false),[revealed,setRevealed]=useState('');
 const generation=useRef(0);
 useEffect(()=>{invoke('connections').then(setRows).catch(e=>setError(friendlyError(e)));return()=>{generation.current++;};},[]);
 const clearSecret=()=>{generation.current++;setVisible(false);setRevealed('');};
 const edit=(patch:Partial<Settings>)=>{setDraft(d=>({...d,...patch}));setDirty(true);setMessage('');setError('');};
 const leave=()=>!dirty||confirm('连接设置尚未保存。放弃这些修改？');
 const navigate=(fn:()=>void)=>{if(!busy&&leave()){clearSecret();fn();}};
 const load=(s:Settings)=>{clearSecret();setDraft({...s,key:''});setDirty(false);setMessage('');setError('');};
 async function action(fn:()=>Promise<void>){setBusy(true);setError('');setMessage('');try{await fn();}catch(e){setError(friendlyError(e));}finally{setBusy(false);}}
 async function save(){await action(async()=>{connectionSettings(draft);const saved:Settings=await invoke('save-settings',draft);onSaved(saved);load(saved);setRows(await invoke('connections'));setMessage('连接已保存并设为当前连接');});}
 async function reveal(){
  if(visible){clearSecret();return;}
  if(draft.key){setVisible(true);return;}
  if(!draft.id||!draft.hasKey)return;
  const token=++generation.current;
  await action(async()=>{const value=await invoke('reveal-key',draft.id);if(token===generation.current){setRevealed(value);setVisible(true);}});
 }
 const sameEndpoint=rows.some(s=>s.id===draft.id&&s.provider===draft.provider&&s.baseUrl.replace(/\/+$/,'')===draft.baseUrl.trim().replace(/\/+$/,''));
 return <main className="connection-page" data-screen-label="连接设置">
  <div className="settings-heading"><button className="settings-back" disabled={busy} onClick={()=>navigate(back)}><ArrowLeft size={17}/>返回工作区</button><h1>连接设置</h1><p>保存常用连接，在这里切换模型和服务。</p></div>
  <div className="connection-layout paper-sheet"><aside className="connection-list" aria-label="已保存的连接"><div className="connection-list-heading"><h2>已保存的连接</h2><button aria-label="新增连接" disabled={busy} onClick={()=>navigate(()=>load({...defaultSettings,name:'',sentenceCount:current.sentenceCount,lexiconCount:current.lexiconCount}))}><Plus size={17}/>新增</button></div>
   {!rows.length&&<p className="muted">还没有保存的连接。填写右侧信息即可开始。</p>}
   {rows.map(s=><button key={s.id} className={'connection-item '+(draft.id===s.id?'selected':'')} aria-pressed={draft.id===s.id} disabled={busy} onClick={()=>navigate(()=>load(s))}><strong>{s.name}</strong><span>{s.model}</span><small>{s.id===current.id?<><Check size={13}/>当前使用</>:providerPresets[s.provider].label}</small></button>)}
   <button className="prompt-link" disabled={busy} onClick={()=>navigate(prompts)}>查看与编辑提示词</button>
  </aside>
  <section className="connection-editor" aria-label="连接详情"><form onSubmit={e=>{e.preventDefault();void save();}}>
   <div className="connection-editor-title"><h2>{draft.id?'连接详情':'新增连接'}</h2>{dirty&&<span className="muted">有未保存的修改</span>}</div>
   <fieldset disabled={busy} className="connection-fields"><label>连接名称<input value={draft.name||''} placeholder="例如：日常备课" maxLength={80} onChange={e=>edit({name:e.target.value})}/></label>
   <div className="connection-pair"><label>服务商<select value={draft.provider} onChange={e=>{clearSecret();edit(selectProvider(draft,e.target.value as Settings['provider']));}}>{Object.entries(providerPresets).map(([id,p])=><option key={id} value={id}>{p.label}</option>)}</select></label><label>模型名称<input required value={draft.model} placeholder="填写账号可用的模型" onChange={e=>edit({model:e.target.value})}/></label></div>
   <label>API 地址<input required type="url" value={draft.baseUrl} onChange={e=>{clearSecret();edit({baseUrl:e.target.value,key:'',hasKey:false});}}/></label><p className="field-help">{providerPresets[draft.provider].protocol} · 填写基础地址，请勿附加请求路径。</p>
   <label htmlFor="connection-key">API Key{draft.hasKey&&sameEndpoint?'（已保存，留空保留）':''}</label><div className="key-field"><input id="connection-key" type={visible?'text':'password'} autoComplete="off" spellCheck={false} value={revealed||draft.key||''} placeholder={draft.hasKey&&sameEndpoint?'已加密保存':'输入 API Key'} readOnly={!!revealed} onChange={e=>edit({key:e.target.value})}/><button type="button" disabled={!draft.key&&!(draft.hasKey&&sameEndpoint)} aria-label={visible?'隐藏 API Key':'显示 API Key'} onClick={()=>void reveal()}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>{revealed&&<button type="button" className="replace-key" onClick={()=>{clearSecret();edit({key:''});}}>更换 API Key</button>}
   <p className="field-help">密钥在本机加密保存，不随课件导出。更换服务商或地址时需重新填写。</p></fieldset>
   <details className="generation-preferences"><summary>英语生成偏好</summary><div className="connection-pair"><label>句法拆解句子数<select disabled={busy} value={draft.sentenceCount??0} onChange={e=>edit({sentenceCount:+e.target.value})}><option value={0}>自动（最多4句）</option>{Array.from({length:8},(_,i)=><option key={i+1} value={i+1}>{i+1}句</option>)}</select></label><label>词汇手账词条数<select disabled={busy} value={draft.lexiconCount??0} onChange={e=>edit({lexiconCount:+e.target.value})}><option value={0}>自动（最多8项）</option>{Array.from({length:20},(_,i)=><option key={i+1} value={i+1}>{i+1}项</option>)}</select></label></div><p className="field-help">素材不足时可以少选。保存后适用于所有连接。</p></details>
   {error&&<p role="alert" className="error-text">{error}</p>}{message&&<p role="status" className="settings-success">{message}</p>}
   <div className="settings-footer"><div className="actions"><button className="primary" type="submit" disabled={busy}><Save size={16}/>{busy?'处理中…':'保存连接'}</button>{draft.id!==current.id&&draft.id&&!dirty&&<button type="button" disabled={busy} onClick={()=>void action(async()=>{const saved=await invoke('activate-connection',draft.id);onSaved(saved);load(saved);setMessage('已切换当前连接');})}>使用此连接</button>}</div>{draft.id&&<button className="delete-connection" type="button" disabled={busy} onClick={()=>{if(confirm('删除此连接及其密钥？课件不受影响。'))void action(async()=>{const saved=await invoke('delete-connection',draft.id);onSaved(saved);load(saved);setRows(await invoke('connections'));setMessage(saved.id?'连接已删除':'连接已删除，请选择或新增用于生成的连接。');});}}><Trash2 size={15}/>删除连接</button>}</div>
   <p className="field-help connection-footnote">扫描识别和题图讲解需要支持图片输入的模型。生成使用当前保存的连接。</p>
  </form></section></div>
 </main>;
}
