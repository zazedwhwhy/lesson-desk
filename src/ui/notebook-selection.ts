import type {NotebookSourceRef} from '../core/notebook';

/** Each locator can live on a different ancestor (question, material, version). */
export function notebookSelectionRef(node:Element):NotebookSourceRef{
 const value=(name:string)=>node.closest('[data-source-'+name+']')?.getAttribute('data-source-'+name);
 const question=value('question')||node.closest('.q-card')?.id.replace(/^q-/,'');
 return {...(question?{questionId:question}:{}),...(value('passage')?{passageId:value('passage')!}:{}),...(value('group')?{groupId:value('group')!}:{}),...(value('version')?{versionId:value('version')!}:{}),...(value('module')?{module:value('module')!}:{})};
}

export function notebookSelectionText(selection:Selection){
 if(!selection.rangeCount)return '';
 const fragment=selection.getRangeAt(0).cloneContents();
 const text=(node:Node):string=>{
  if(node.nodeType===3)return node.textContent||'';
  if(node.nodeType===1){
   const element=node as Element;
   if(element.matches('.paragraph-no,button,input,select,textarea,[aria-hidden="true"]'))return '';
   const content=Array.from(node.childNodes).map(text).join('');
   return /^(P|DIV|SECTION|ARTICLE|H[1-6]|LI|BLOCKQUOTE|BR)$/.test(element.tagName)?content+'\n':content;
  }
  return Array.from(node.childNodes).map(text).join('');
 };
 return text(fragment).replace(/\n{3,}/g,'\n\n').trim();
}
