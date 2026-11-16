import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect} from 'vitest';
import {emptyProject} from '../src/core/model';
import {SourceFidelityReport} from '../src/ui/SourceFidelityReport';
it('报告展示具体题号、字段及来源与候选，保留纯文本并明确报告时点',()=>{
 const p=emptyProject('卷');p.sourceFidelityIssues=[{location:'第66题题干',expected:'原句<script>',received:'AI改写'}];
 const html=renderToStaticMarkup(<SourceFidelityReport project={p}/>);
 for(const text of ['第66题题干','原句&lt;script&gt;','AI改写','其他题目已继续整理','不代表修改后的状态'])expect(html).toContain(text);
});
