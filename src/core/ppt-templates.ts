import {defaultSlideLayout,type SlideLayout} from './slide-layout';

export type PptTemplate={id:string;name:string;custom:boolean;layoutName?:string;layout:SlideLayout;colors:{background:string;text:string;accent:string;muted:string;line:string};fonts:{heading:string;body:string;source:string}};
export const builtinPptTemplates:PptTemplate[]=[
 {id:'paper',name:'纸面教案 · 连续讲评',custom:false,layout:defaultSlideLayout,colors:{background:'FAF7EF',text:'302C26',accent:'823E2B',muted:'7E715F',line:'D9CFBF'},fonts:{heading:'Microsoft YaHei',body:'Microsoft YaHei',source:'Georgia'}},
 {id:'blue',name:'侧栏板书 · 左题右讲',custom:false,layout:{...defaultSlideLayout,title:{x:.55,y:1.02,w:2.8,h:2.45},body:{x:3.85,y:.62,w:8.86,h:6.18}},colors:{background:'F7FAFF',text:'182C46',accent:'175BB0',muted:'526B89',line:'CDDBEF'},fonts:{heading:'Microsoft YaHei',body:'Microsoft YaHei',source:'Calibri'}},
 {id:'forest',name:'逐步揭示 · 每页一要点',custom:false,layout:{...defaultSlideLayout,sequence:'steps',title:{x:.72,y:6.38,w:11.9,h:.55},body:{x:.85,y:.68,w:11.6,h:5.25}},colors:{background:'163D35',text:'F4F5E9',accent:'EDD38B',muted:'BCD0C3',line:'50766A'},fonts:{heading:'Microsoft YaHei',body:'Microsoft YaHei',source:'Georgia'}}
];
export const defaultPptTemplate=builtinPptTemplates[0];
