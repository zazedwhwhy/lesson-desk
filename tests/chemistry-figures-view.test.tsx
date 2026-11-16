import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect} from 'vitest';
import {chemistrySchema,chemQuestionSchema} from '../src/core/chemistry';
import {ChemistryTeaching} from '../src/ui/ChemistryTeaching';
it('只看讲解也直接展示原图，图不会藏在原文栏里',()=>{
 const data=chemistrySchema.parse({questions:[chemQuestionSchema.parse({id:'q',number:'12',stem:'装置图',imageMode:'auto',images:[{id:'f',name:'实验装置',data:'data:image/png;base64,YQ==',automatic:true}]})]});
 const html=renderToStaticMarkup(<ChemistryTeaching data={data} questionId="q" onQuestion={()=>{}} module="experiment" onModule={()=>{}} mode="analysis" setMode={()=>{}} font={18} figures={true} busy={false} prepare={()=>{}} generate={()=>{}} edit={async()=>{}}/>);
 expect(html).toContain('alt="实验装置"');expect(html).not.toContain('图片待核对');expect(html).not.toContain('class="reading"');
});
