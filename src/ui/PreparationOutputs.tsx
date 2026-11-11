import React from 'react';
import {Download, Presentation} from 'lucide-react';

export function PreparationOutputs({busy,canArrange,arrange,backup}:{busy:boolean;canArrange:boolean;arrange:()=>void;backup:()=>void}) {
  return <section className="prep-outputs" id="prepare-output" aria-labelledby="prepare-output-heading">
    <div><h2 id="prepare-output-heading">带去课堂，或留作备份</h2><p>生成后先核对讲义，再选择本次要讲的内容。</p></div>
    <div className="prep-output-row"><div><h3>可编辑 PPT</h3><p>进入现有编排页，勾选篇目、题目与模块，选好模板后再导出。</p></div><button disabled={busy||!canArrange} onClick={arrange}><Presentation size={17}/>编排并导出 PPT</button></div>
    <div className="prep-output-row"><div><h3>备份课件包</h3><p>保留材料、生成内容和修改记录，可重新导入工作台继续备课；不是 PPT，不含 API 凭据。</p></div><button disabled={busy} onClick={backup}><Download size={17}/>导出备份课件包</button></div>
  </section>;
}
