export type PdfFragment={text:string;x:number;y:number;width?:number;height?:number};
export function pdfReadingLines(rows:PdfFragment[],pageWidth:number):PdfFragment[]{
 const middle=pageWidth/2;
 // A text run crossing the gutter is evidence of a full-width line, not a column.
 const crossing=rows.some(r=>r.x<pageWidth*.45&&r.x+(r.width||0)>pageWidth*.55);
 const left=rows.filter(r=>r.x<pageWidth*.45),right=rows.filter(r=>r.x>pageWidth*.5);
 const columns=!crossing&&left.length>8&&right.length>8?[rows.filter(r=>r.x<=middle),rows.filter(r=>r.x>middle)]:[rows];
 return columns.flatMap(column=>{
  const sorted=[...column].sort((a,b)=>b.y-a.y),lines:PdfFragment[][]=[];
  for(const item of sorted){const last=lines.at(-1);if(last&&Math.abs(last[0].y-item.y)<=8)last.push(item);else lines.push([item]);}
  return lines.map(line=>{
   const body=line.reduce((a,b)=>(b.height||0)>(a.height||0)?b:a),height=body.height||0;
   line.sort((a,b)=>Math.abs(a.x-b.x)<.15?a.y-b.y:a.x-b.x);
   const text=line.map(r=>{if(!height||!r.height||r.height>=height*.85)return r.text;const up=r.y>body.y+1,down=r.y<body.y-.5;if(!up&&!down)return r.text;const from='0123456789+-−=()x',to=up?'⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁻⁼⁽⁾ˣ':'₀₁₂₃₄₅₆₇₈₉₊₋₋₌₍₎ₓ';return [...r.text].map(c=>{const at=from.indexOf(c);return at>=0?to[at]:c;}).join('');}).join(' ');
   return {...body,text};
  });
 });
}
