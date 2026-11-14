import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {chineseSchema,chineseFingerprint} from '../src/core/chinese';
import {ChineseTeaching} from '../src/ui/ChineseTeaching';
it('附文言译注保留原文变化与待核实标记',()=>{
 const data=chineseSchema.parse({groups:[{id:'g',title:'文言文',section:'阅读',kind:'classical',materials:[{id:'m',title:'原文',text:'学而时习之',sourceId:'s',blockIds:['b']}],questions:[]}]});
 const g=data.groups[0];g.versions.push({id:'v',module:'translation',createdAt:'2026-11-14',fingerprint:chineseFingerprint(data,g),confirmed:false,result:{status:'needs_review',notices:['字义待核实'],blocks:[{label:'译注',text:'学习之后时常温习。',evidence:[]}]}});
 const render=()=>renderToStaticMarkup(<ChineseTeaching data={data} groupId="g" onGroup={()=>{}} module="analysis" onModule={()=>{}} mode="original" setMode={()=>{}} font={24} translated busy={false} prepare={()=>{}} generate={()=>{}} edit={async()=>{}}/>);
 expect(render()).toContain('待核实');g.materials[0].text='学而不思则罔';expect(render()).toContain('材料已变化，内容过期');
});
