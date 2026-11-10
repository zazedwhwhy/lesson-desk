import {expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PptTemplatePicker} from '../src/ui/PptTemplatePicker';
import {defaultPptTemplate} from '../src/core/ppt-templates';

it('重进编排页时，已选自定义模板在模板库返回前就能正确显示',()=>{
 const template={...defaultPptTemplate,id:'custom-current',name:'我的学校',custom:true};
 const markup=renderToStaticMarkup(createElement(PptTemplatePicker,{value:template,busy:false,onChange:()=>{},onPending:()=>{}}));
 expect(markup).toContain('<option value="custom-current" selected="">我的学校</option>');
});
