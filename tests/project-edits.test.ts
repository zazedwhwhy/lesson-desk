import {expect,it,vi} from 'vitest';
import {emptyProject} from '../src/core/model';
import {chemQuestionSchema} from '../src/core/chemistry';
import {projectEdits} from '../src/ui/project-edits';

function fixture(){const p=emptyProject('合成编辑','chemistry');p.chemistry!.questions=[chemQuestionSchema.parse({id:'q',number:'1'})];return p;}
it('连续编辑以最新草稿为基础，旧保存响应不会覆盖下一字段，磁盘保存有序',async()=>{
 const p=fixture(),snapshots:typeof p[]=[];let release!:()=>void;
 const gate=new Promise<void>(r=>release=r),save=vi.fn(async(n:typeof p)=>{snapshots.push(structuredClone(n));if(snapshots.length===1)await gate;return n;});
 const editor=projectEdits(p,save,()=>{});
 const first=editor.change(n=>{n.chemistry!.questions[0].stem='题干';});
 editor.sync(p);
 const second=editor.change(n=>{n.chemistry!.questions[0].answer='答案';});
 const third=editor.change(n=>{n.chemistry!.questions[0].confirmed=true;});
 await Promise.resolve();expect(save).toHaveBeenCalledTimes(1);release();await Promise.all([first,second,third]);
 expect(snapshots.map(n=>{const q=n.chemistry!.questions[0];return[q.stem,q.answer,q.confirmed];})).toEqual([['题干','',false],['题干','答案',false],['题干','答案',true]]);
 expect(p.chemistry!.questions[0].stem).toBe('');
});
it('保存失败会阻断已排队快照；重新同步后可显式再次编辑',async()=>{
 const p=fixture(),save=vi.fn().mockRejectedValueOnce(Error('磁盘已满')).mockImplementation(async(n)=>n),editor=projectEdits(p,save,()=>{});
 const first=editor.change(n=>{n.title='失败修改';}),second=editor.change(n=>{n.title='依赖修改';});
 const results=await Promise.allSettled([first,second]);expect(results.every(r=>r.status==='rejected')).toBe(true);expect(save).toHaveBeenCalledTimes(1);
 editor.sync(p);const next=await editor.change(n=>{n.title='重新保存';});expect(next.title).toBe('重新保存');expect(save).toHaveBeenCalledTimes(2);
});
