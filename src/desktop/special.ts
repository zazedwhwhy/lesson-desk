import {specialSchemas,specialSystem,specialPrompts,specialFingerprint,type SpecialKind} from '../core/special';
import {prepareSpecial,validateSpecialResult} from '../core/special-workflow';
import {callAI} from './ai';
import {uid,type Project,type Settings} from '../core/model';

export async function generateSpecial(p:Project,pid:string,kind:SpecialKind,raw:unknown,s:Settings,key:string,signal:AbortSignal,onStatus:(message:string)=>void=()=>{}){
 const prepared=prepareSpecial(p,pid,kind,raw);
 const {input,context,passage:a}=prepared;
 const output=await callAI(s,key,specialSchemas[kind],specialPrompts[kind]+'\n输入材料：\n'+JSON.stringify(context),signal,onStatus,specialSystem);
 const result=validateSpecialResult(prepared,output);
 if(signal.aborted)throw Error('已取消');const v={id:uid(),kind,createdAt:new Date().toISOString(),sourceText:specialFingerprint(p,pid),input,result};a.special={versions:[...(a.special?.versions||[]),v],active:{...a.special?.active,[kind]:v.id}};p.updatedAt=new Date().toISOString();return p;}
