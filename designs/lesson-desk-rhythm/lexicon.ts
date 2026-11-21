import fs from 'node:fs/promises';
import path from 'node:path';
import {unzipSync,strFromU8} from 'fflate';
import {buildSkillLesson} from '../../skills/lesson-desk-export/tool/build-lesson';

async function main(){
 const dir=path.resolve('designs/lesson-desk-rhythm'),work=path.join(dir,'work');
 const p={id:'p1',text:'Yet she chose to walk home with Sam, who was afraid of the dark.'};
 const manifest={project:{title:'放学以后 · 词汇手账',subject:'english',sources:[{id:'paper',name:'放学以后',role:'paper',kind:'text',blocks:[p]}],passages:[{id:'reading',title:'Walking Home',type:'reading',paragraphs:[p],lexicon:[{term:'be afraid of',sourceForm:'was afraid of',partOfSpeech:'短语',meaning:'害怕……',usageNote:'of 后接害怕的事物，原句中是 the dark。',collocations:'be afraid of heights 怕高',contrast:'be afraid of 说明害怕的对象；be worried about 侧重对事情的担忧。',memoryExample:'My brother is afraid of heights.',exampleTranslation:'我哥哥怕高。',evidence:{blockId:'p1',quote:p.text}}]}],questions:[]}};
 const bundleRoot=await fs.mkdtemp(path.join(work,'lexicon-'));
 const result=await buildSkillLesson(manifest,work,path.join(bundleRoot,'export'));
 const project=JSON.parse(strFromU8(unzipSync(await fs.readFile(result.bundle))['project.json']));
 const entry=project.passages[0].learning.versions[0].data.lexicon[0];
 if(!entry.quiz.includes('[1]')||entry.sourceQuote!==p.text)throw Error('词条未绑定原句');
 await fs.writeFile(path.join(dir,'lexicon.json'),JSON.stringify(entry,null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1});
