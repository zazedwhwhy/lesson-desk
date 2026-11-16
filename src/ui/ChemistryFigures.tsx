import React from 'react';
import type {ChemQuestion} from '../core/chemistry';
import {MathText} from './MathText';

export function ChemistryFigures({question:q}:{question:ChemQuestion}){
 return <div className="chem-figures">{q.images.map(im=><figure key={im.id}>
  <img className="chem-source-image" src={im.data} alt={im.name}/>
  <figcaption>{im.name}{im.page?' · 原卷第 '+im.page+' 页':''}{im.description&&<> — <MathText text={im.description}/></>}{!im.automatic&&!im.confirmed&&'（图片待核对）'}</figcaption>
 </figure>)}</div>;
}
