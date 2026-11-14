import React from 'react';
import {renderFormula,splitMath,mathLines} from '../core/math-text';
import './math-text.css';
export function MathText({text}:{text:string}){return <span className="math-text">{splitMath(text).map((part,i)=>{if(!part.math)return <React.Fragment key={i}>{part.text}</React.Fragment>;try{if(part.error)throw Error(part.error);const f=renderFormula(part.text,part.display);return <span key={i} className={part.display?'formula formula-display':'formula'} role="math" aria-label={part.text} style={{width:f.width+'em',height:f.height+'em'}} dangerouslySetInnerHTML={{__html:f.svg}}/>;}catch(e){return <span key={i} className="formula-error" role="alert" title={e instanceof Error?e.message:String(e)}>{part.raw}（{part.error||'公式语法错误'}）</span>;}})}</span>;}
// Use the same measured rows as pagination and PPT, including tall fractions and reaction arrows.
export function MathSlideText({text,width,fontSize,color}:{text:string;width:number;fontSize:number;color:string}){
 const rows=mathLines(text,width,fontSize),em=fontSize/72;let y=0;
 return <span className="math-slide-text">{rows.flatMap((row,i)=>{const top=y;y+=row.h;return row.runs.map((run,j)=><span key={i+'-'+j} style={{position:'absolute',left:run.x/em+'em',top:(top+(row.h-run.h)/2)/em+'em',width:run.w/em+'em',height:run.h/em+'em',color,lineHeight:1.32,whiteSpace:'pre'}}>{run.formula?<span className="formula" role="math" aria-label={run.text} style={{width:'100%',height:'100%'}} dangerouslySetInnerHTML={{__html:run.formula.svg}}/>:run.text}</span>);})}</span>;
}
