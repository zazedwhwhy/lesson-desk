import{it,expect}from'vitest';import{optionEntries}from'../src/core/options';
it('不把A user中的冠词当作选项A',()=>{expect(optionEntries(['A user goes back.','A user stops.','A user runs.','A user falls.'])).toEqual([{label:'A',text:'A user goes back.'},{label:'B',text:'A user stops.'},{label:'C',text:'A user runs.'},{label:'D',text:'A user falls.'}]);});
it('正确剥离完整ABCD选项标签',()=>{expect(optionEntries(['A. one','B. two','C. three','D. four']).map(o=>o.text)).toEqual(['one','two','three','four']);});
