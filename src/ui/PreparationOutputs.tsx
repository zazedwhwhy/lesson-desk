import React from 'react';
import {Download, Presentation} from 'lucide-react';

export function PreparationOutputs({busy,canArrange,arrange,backup}:{busy:boolean;canArrange:boolean;arrange:()=>void;backup:()=>void}) {
  return <section className="prep-outputs" id="prepare-output" aria-labelledby="prepare-output-heading">
    <div><h2 id="prepare-output-heading">导出与备份</h2></div>
    <div className="prep-output-row"><div><h3>可编辑 PPT</h3><p>选择本次讲课的题目、讲义和模板。</p></div><button disabled={busy||!canArrange} onClick={arrange}><Presentation size={17}/>编排并导出 PPT</button></div>
    <div className="prep-output-row"><div><h3>备份课件包</h3><p>保存原材料、讲义和修改记录，换电脑后可导入继续备课。</p></div><button disabled={busy} onClick={backup}><Download size={17}/>导出备份课件包</button></div>
  </section>;
}
