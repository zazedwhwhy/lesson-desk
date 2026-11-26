import {defaultSlideLayout,type SlideLayout} from './slide-layout';

export const builtinTemplateIds = ['paper', 'blue', 'forest'] as const;
export type BuiltinTemplateId = typeof builtinTemplateIds[number];
export type PptTemplate = {
 id:string; name:string; custom:boolean; layoutName?:string; layout:SlideLayout;
 colors:{background:string;text:string;accent:string;muted:string;line:string};
 fonts:{heading:string;body:string;source:string};
};

const paper:PptTemplate = {
 id:'paper', name:'纸面教案', custom:false, layout:defaultSlideLayout,
 colors:{background:'FAF7EF',text:'302B25',accent:'813C2C',muted:'645B4D',line:'C7BBA7'},
 fonts:{heading:'KaiTi',body:'Microsoft YaHei',source:'Georgia'},
};
const bauhaus:PptTemplate = {
 id:'blue', name:'包豪斯板书', custom:false,
 layout:{...defaultSlideLayout,title:{x:.45,y:1.48,w:2.68,h:2.92},body:{x:4.06,y:.59,w:8.55,h:6.28}},
 colors:{background:'FFFCF5',text:'192632',accent:'163EA4',muted:'4F5963',line:'C6CFDE'},
 fonts:{heading:'Microsoft YaHei',body:'Microsoft YaHei',source:'Arial'},
};
const cinema:PptTemplate = {
 id:'forest', name:'影院暗场', custom:false,
 layout:{...defaultSlideLayout,sequence:'steps',title:{x:.91,y:6.39,w:10.35,h:.68},body:{x:.95,y:1.04,w:11.43,h:4.88}},
 colors:{background:'111621',text:'F3F5FB',accent:'BECFFF',muted:'BAC4D6',line:'37465F'},
 fonts:{heading:'Microsoft YaHei',body:'Microsoft YaHei',source:'Calibri'},
};
export const builtinPptTemplates=[paper,bauhaus,cinema];
export const defaultPptTemplate=paper;
export const builtinById:Record<BuiltinTemplateId,PptTemplate>={paper,blue:bauhaus,forest:cinema};
