import {readFileSync} from 'node:fs';
import {builtinPptTemplates} from '../../src/core/ppt-templates';
import {exportLessonSlides} from '../../src/desktop/export';
const work='designs/lesson-desk-focus/work/';
exportLessonSlides(JSON.parse(readFileSync(work+'film-deck.json','utf8')),'溶解度曲线','chemistry',work+'focus.pptx',{template:builtinPptTemplates[0]}).catch(e=>{console.error(e);process.exitCode=1});
