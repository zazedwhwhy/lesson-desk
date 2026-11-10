import{z}from'zod';
export const taskKinds=['analysis','translation','practice','sentences','structure','lexicon','imitation','special']as const;
export const taskSchema=z.object({id:z.string(),passageId:z.string(),kind:z.enum(taskKinds),questionIds:z.array(z.string()),specialKind:z.string().optional(),title:z.string(),source:z.string(),state:z.enum(['pending','running','complete','failed']),error:z.string(),attempts:z.number().int()});
export type GenerationTask=z.infer<typeof taskSchema>;
export type GenerationContent=typeof taskKinds[number];
export const generationNames:Record<GenerationContent,string>={analysis:'解析',translation:'中文译文',practice:'考点演练',sentences:'句法拆解',structure:'篇章脉络',lexicon:'词汇手账',imitation:'表达迁移',special:'专项讲评'};
export type GenerationMode=GenerationContent|'lesson'|'modules'|'selected';
export class ServiceStopError extends Error{constructor(message:string){super(message);this.name='ServiceStopError';}}
