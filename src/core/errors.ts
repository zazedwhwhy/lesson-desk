// Only model output / content validation failures may trigger a content repair.
export class GenerationContentError extends Error {
 constructor(message:string,options?:ErrorOptions){super(message,options);this.name='GenerationContentError';}
}

export function friendlyError(error:unknown){return String(error).replace(/^(?:Error|GenerationContentError|EvidenceValidationError):\s*/,'').replace(/^Error invoking remote method '[^']+':\s*/,'').replace(/^(?:Error|GenerationContentError|EvidenceValidationError):\s*/,'');}
