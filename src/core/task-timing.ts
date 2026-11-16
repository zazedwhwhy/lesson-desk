import {z} from 'zod';
export const taskTiming={phase:z.enum(['generating','reviewing','retrying','saving']).optional(),startedAt:z.number().optional(),finishedAt:z.number().optional()};
export type TaskTiming={phase?:'generating'|'reviewing'|'retrying'|'saving';startedAt?:number;finishedAt?:number};
export function phaseFor(message:string):NonNullable<TaskTiming['phase']>{return /重试|修正/.test(message)?'retrying':/复核/.test(message)?'reviewing':'generating';}
