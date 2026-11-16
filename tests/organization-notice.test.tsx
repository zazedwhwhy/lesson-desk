import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {emptyProject,questionSchema} from '../src/core/model';
import {chemQuestionSchema} from '../src/core/chemistry';
import {OrganizationNotice} from '../src/ui/OrganizationNotice';
it.each(['english','chemistry'] as const)('%s 旧课件直接显示具体漏题和补漏入口',subject=>{
 const p=emptyProject('旧课件',subject);
 p.sources=[{id:'s',role:'paper',name:'原卷<script>',kind:'text',blocks:[{id:'b',text:'1. First question?\n2. Second question?'}]}];
 if(subject==='chemistry')p.chemistry!.questions=[chemQuestionSchema.parse({id:'q',sourceId:'s',number:'1'})];
 else p.questions=[questionSchema.parse({id:'q',number:'1',passageId:'p',type:'reading',stem:'First question?',options:[],answer:'',confirmed:false,excluded:false,stale:false,versions:[]})];
 const html=renderToStaticMarkup(<OrganizationNotice project={p} busy={false} recover={()=>{}}/>);
 expect(html).toContain('第 2 题');expect(html).toContain('补齐遗漏题目（保留已有讲评）');expect(html).toContain('原卷&lt;script&gt;');
 p.sources[0].ocrReviewPages=[1];
 expect(renderToStaticMarkup(<OrganizationNotice project={p} busy={false} recover={()=>{}}/>)).toContain('disabled');
});
