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
 layout:{...defaultSlideLayout,title:{x:.70,y:.25,w:7.9,h:.58},body:{x:.70,y:1.24,w:11.92,h:5.80}},
 colors:{background:'FFFCF5',text:'192632',accent:'163EA4',muted:'4F5963',line:'C6CFDE'},
 fonts:{heading:'Microsoft YaHei',body:'Microsoft YaHei',source:'Arial'},
};
const mint:PptTemplate = {
 id:'forest', name:'薄荷白板', custom:false,
 layout:{...defaultSlideLayout,title:{x:.72,y:.33,w:7.78,h:.66},body:{x:.74,y:1.24,w:11.84,h:5.65}},
 colors:{background:'F1F8F4',text:'173A33',accent:'17694F',muted:'45655B',line:'AACBBB'},
 fonts:{heading:'Microsoft YaHei',body:'Microsoft YaHei',source:'Calibri'},
};
export const builtinPptTemplates=[paper,bauhaus,mint];
export const defaultPptTemplate=paper;
export const builtinById:Record<BuiltinTemplateId,PptTemplate>={paper,blue:bauhaus,forest:mint};
