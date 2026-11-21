import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ChemistryTeaching} from '../../src/ui/ChemistryTeaching';
import {ChemistryQuestions} from '../../src/ui/ChemistryQuestions';
import {chemFingerprint,chemQuestionSchema,chemSlides} from '../../src/core/chemistry';
import {builtinPptTemplates} from '../../src/core/ppt-templates';
import {LessonSlideView} from '../../src/ui/LessonSlideView';

const chart=(window as any).image,template=builtinPptTemplates[0];
const q=chemQuestionSchema.parse({id:'q12',number:'12',kind:'principle',stage:'junior',stem:'20 ℃ 时，哪种物质的溶解度更大？',answer:'B',sourceId:'paper',pages:[1],images:[{id:'graph',name:'溶解度曲线',data:chart,sourceId:'paper',page:1,description:'先确定温度，再比较两条曲线。',confirmed:true}],confirmed:true});
q.versions.push({id:'initial',module:'analysis',createdAt:'2026-11-20T12:00:00Z',origin:'teacher',fingerprint:chemFingerprint(q),confirmed:true,result:{status:'ok',notices:[],blocks:[{label:'读图方法',text:'比较两条曲线的高度。'},{label:'在图上验证',text:'比较同一温度下的两个点。20 ℃ 时，B 在 A 的上方。'}]}});
function Capture(){
 const [data,set]=useState({questions:[q]}),[view,select]=useState('review'),[page,setPage]=useState(1);
 const selected=data.questions[0].versions.at(-1)!;
 async function edit(fn){const next=structuredClone(data);fn(next);set(next);return true}
 Object.assign(window,{selectView:select,setSlide:setPage,question:data.questions[0]});
 if(view==='review')return <div className="review"><ChemistryQuestions project={{sources:[{id:'paper',name:'化学读图练习.pdf'}],chemistry:data} as any} busy={false} selected={[]} setSelected={()=>{}} edit={edit} run={fn=>fn()} onError={s=>{throw Error(s)}}/></div>;
 if(view==='show'){
  const slides=chemSlides(data as any,[selected.id],template.layout);(window as any).slides=slides;
  return <LessonSlideView slide={slides[page-1]} template={template} projectTitle="溶解度曲线" page={page} total={slides.length} chinese/>;
 }
 return <ChemistryTeaching data={data as any} questionId="q12" onQuestion={()=>{}} module="analysis" onModule={()=>{}} mode="compare" setMode={()=>{}} font={22} figures busy={false} prepare={()=>{}} generate={()=>{}} edit={(id,fn)=>edit(d=>fn(d.questions[0]))}/>;
}
createRoot(document.getElementById('root')!).render(<Capture/>);
