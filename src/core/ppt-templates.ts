import {defaultSlideLayout,type SlideLayout} from './slide-layout';

export type PptTemplate={id:string;name:string;custom:boolean;layoutName?:string;layout:SlideLayout;colors:{background:string;text:string;accent:string;muted:string;line:string};fonts:{heading:string;body:string;source:string}};
export const builtinPptTemplates:PptTemplate[]=[
 {id:'paper',name:'纸面教案',custom:false,layout:defaultSlideLayout,colors:{background:'FAF7EF',text:'302C26',accent:'823E2B',muted:'7E715F',line:'D9CFBF'},fonts:{heading:'Microsoft YaHei',body:'Microsoft YaHei',source:'Georgia'}},
 {id:'blue',name:'清爽蓝白',custom:false,layout:defaultSlideLayout,colors:{background:'F7FAFF',text:'182C46',accent:'175BB0',muted:'526B89',line:'CDDBEF'},fonts:{heading:'Microsoft YaHei',body:'Microsoft YaHei',source:'Calibri'}},
 {id:'forest',name:'墨绿课堂',custom:false,layout:defaultSlideLayout,colors:{background:'163D35',text:'F4F5E9',accent:'EDD38B',muted:'BCD0C3',line:'50766A'},fonts:{heading:'Microsoft YaHei',body:'Microsoft YaHei',source:'Georgia'}}
];
export const defaultPptTemplate=builtinPptTemplates[0];
