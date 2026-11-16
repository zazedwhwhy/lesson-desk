import {protectChemistry} from './source-fidelity';
import {chemFingerprint} from './chemistry';
import type {Project} from './model';
export function chemistryReviewSnapshot(p:Project){return JSON.stringify([p.sources,p.chemistry?.questions.map(q=>[q.id,chemFingerprint(q),q.confirmed,q.excluded])]);}
export function refreshChemistryFidelity(p:Project){
 if(p.subject!=='chemistry'||!p.chemistry)throw Error('请选择化学课件');
 const next=structuredClone(p),report:NonNullable<Project['sourceFidelityIssues']>=[];
 // Run the checker on a separate candidate: a report refresh must never alter
 // the teacher's answers, wording, confirmation state or saved explanations.
 protectChemistry(p,{questions:structuredClone(p.chemistry.questions)},report);
 next.sourceFidelityIssues=report;return next;
}
