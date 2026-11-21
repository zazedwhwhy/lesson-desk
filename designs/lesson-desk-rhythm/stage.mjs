import {shots,beat,phrase} from './shots.mjs';
import {makePress} from './paper.mjs';
import {pageImage,type,rule,dot,graph,ink,red,blue,light,paper,sans,serif,latin} from './pages.mjs';
const W=1920,H=1080,canvas=document.querySelector('#film'),g=canvas.getContext('2d',{alpha:false});
const press=makePress(),images=new Map(),paperCache=new Map();
let vocabulary;
const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>(t=clamp(t),t*t*(3-2*t));
const fast=t=>1-(1-clamp(t))**4;
const cue=(t,a,d)=>fast((t-a)/d);
const mix=(a,b,t)=>a+(b-a)*t;
const indexed=(id,k)=>id[k%id.length];
const radians=n=>n*Math.PI/180;
function img(key){if(images.has(key))return images.get(key);if(!paperCache.has(key))paperCache.set(key,pageImage(key));return paperCache.get(key)}
function box(x,y,w,h,r,color){g.fillStyle=color;g.beginPath();g.roundRect(x,y,w,h,r);g.fill()}
function line(x1,y1,x2,y2,c,w){rule(g,[[x1,y1],[x2,y2]],c,w)}
function title(s,x,y,size,opts={}){type(g,s,x,y,size,opts.color||ink,opts.font||sans,opts.weight||'bold')}
function shadow(x,y,w,h,a=.12){
 g.save();g.translate(x,y);g.scale(w,h);const grad=g.createRadialGradient(0,0,0,0,0,1);
 grad.addColorStop(0,'rgba(42,49,45,'+a+')');grad.addColorStop(1,'rgba(42,49,45,0)');g.fillStyle=grad;g.fillRect(-1,-1,2,2);g.restore();
}
function sheet(id,x,y,w,h,rx=0,ry=0,rz=0,curl=0,z=0){press.draw(id,img(id),x,y,w,h,rx,ry,rz,curl,z)}
function flush(){g.drawImage(press.canvas,0,0);press.clear()}
function base(dark=false){
 g.fillStyle=dark?'#182f38':'#f6f5ee';g.fillRect(0,0,W,H);press.clear();
}
function folio(section,name,dark=false){
 const c=dark?'#d0d8d4':'#52646a';
 type(g,section,86,73,28,dark?'#f4b299':red,sans,'bold');let sw=g.measureText(section).width;
 line(106+sw,48,106+sw,76,c,1.6);type(g,name,130+sw,73,27,c);
 type(g,'讲题工作台',1640,73,27,c);line(86,102,1834,102,dark?'#48616a':'#d2d8cc',1.4);
}
function sub(txt,dark=false){
 if(!txt)return;g.font='500 37px '+sans;const width=g.measureText(txt).width;
 const x=(W-width)/2;box(x-25,957,width+50,74,13,dark?'#0e232be8':'#fffdf5f3');
 type(g,txt,x,1008,37,dark?'#fdfcf5':ink,sans,'500');
}
function headerBig(kicker,lines,t,dark=false){
 const x=86;type(g,kicker,x,270,30,dark?'#f0ad91':red,'Arial','bold');
 lines.forEach((s,i)=>{const q=cue(t,i*.10,.32);
 g.save();g.globalAlpha=q;title(s,x+(1-q)*-80,424+i*132,105,{color:dark?paper:ink});g.restore()});
}
const printHead={
 fan:[['三科，一张','备课桌。'],'LESSON DESK'],intake:[['试卷和答案','一起带来。'],'SOURCE MATERIALS'],
 scan:[['先识别，','再核对。'],'SOURCE REVIEW'],experiment:[['看到什么？','说明什么？'],'CHEMISTRY'],
 package:[['从 AI 客户端','带回课堂。'],'LESSON DESK SKILL'],closebook:[['把这一课','带走。'],'LESSON DESK'],
 sequence:[['今天，就讲','这一题。'],'LESSON ORDER'],layouts:[['同一道题，','三种讲法。'],'IN THE CLASSROOM'],
 reveal:[['答案，','下一页见。'],'IN THE CLASSROOM']
};
function paperSet(i,b,kind,ids){
 const dark=[16,20,26,32,34].includes(i);base(dark);
 let [head,eyebrow]=printHead[kind]||printHead.fan;
 if(i===16){head=['换一篇，','换一种讲法。'];eyebrow='CHINESE LANGUAGE'}
 if(i===29){head=['用学校的','课件模板。'];eyebrow='POWERPOINT'}
 headerBig(eyebrow,head,b*beat,dark);
 const phase=cue(b,6,1.45),late=cue(b,11.8,1.0),out=cue(b,15.35,.65);
 const highlight=kind==='sequence'?['题面','原图','讲解']:kind==='layouts'?['纸面教案','侧栏板书','逐步揭示']:null;
 if(highlight)type(g,highlight[b<5?0:b<10?1:2],94,742,39,dark?'#ebb297':red);
 const spread=kind==='intake'||kind==='fan'||kind==='closebook';
 const wide=['layouts','reveal'].includes(kind);
 const count=ids.length;
 for(let n=0;n<count;n++){
  const enter=cue(b,n*.57,1.38);
  let x=1270,y=523,angle=0,ry=-.18,rx=.09,curl=.10,w=wide?815:517,h=wide?460:650;
  const k=n-(count-1)/2;
  if(spread){
   const factor=kind==='closebook'?1-.94*late:1;
   x+=k*(192+55*phase)*factor;y+=k*(23+6*phase)*factor;
   angle=radians(k*13*factor);ry=-.18+k*.06+.13*phase;curl=.26*Math.sin(b*.4+n)*.42;
   if(kind==='intake'){y-=n*21*phase;x+=k*28*late}
  }else if(kind==='package'){
   if(n===0){x=1080-170*phase;y=488;w=415;h=522}
   else{x=1165+n*165+phase*(n===1?-118:104);y=510+n*43;angle=radians(n===1?-9:8);w=426;h=536}
  }else if(kind==='scan'){x=1215+n*172+phase*(n?80:-90);y=501+n*45;angle=radians(n?4:-5)}
  else if(kind==='sequence'||kind==='experiment'){
   x=1090+n*160;y=454+n*70;angle=radians(-8+n*5);x+=k*72*phase;w=450;h=566;
  }else if(wide){x=1165+n*40;y=475+n*30;ry=-.10;angle=radians(-6+n*2)}
  const step=wide?Math.floor(b/5.3):0;
  if(wide&&n>Math.min(2,step))continue;
  const reveal=wide&&n>0?cue(b,n*5.3,.95):enter;
  x+=(1-reveal)*650+out*(n-count/2)*80;y-=(1-reveal)*270;
  angle+=(1-reveal)*.28;curl+=(1-reveal)*.92;
  shadow(x+30,y+h*.48,w*.65,60,.17);
  sheet(ids[n],x,y,w,h,rx,ry,angle,curl,n*18);
 }
 flush();
 if(kind==='scan'){
  const ys=282+clamp((b-4)/5.4)*505;
  if(b>4&&b<9.4){line(1080,ys,1610,ys,'#366c76',3);box(1078,ys-42,533,40,2,'#c3dfcf55')}
 }
 if(kind==='package'&&b>8){type(g,'.pptx    +    .lesson.zip',93,745,35,'#e8c8af',latin)}
 folio(shots[i][0],shots[i][1],dark);
 if(i===3&&b<2.35){
  const p=smooth((b-.18)/2.17);
  sheet('ppt-bridge',960-1820*p,540-175*p,1920,1080,0,-.95*p,-.13*p,1.55*Math.sin(p*Math.PI));
  flush();
 }
 return dark;
}
// Normalized locations target the product evidence, with the text retained at reading size.
const roi={
 'source-paper':[.24,.27,1.04],'source-key':[.12,.43,1.10],proof:[.48,.54,1.30],history:[.46,.56,1.30],
 prepare:[.62,.54,1.23],counts:[.50,.42,1.20],syntax:[.76,.5,1.57],'structure-en':[.68,.55,1.33],
 imitation:[.73,.52,1.35],transfer:[.70,.54,1.42],structure:[.58,.48,1.12],language:[.70,.52,1.35],
 'chem-review':[.44,.50,1.29],'chem-show':[.5,.5,1.08],partial:[.48,.56,1.37],
 setup:[.55,.50,1.18],arrange:[.72,.53,1.21],library:[.48,.43,1.19],imported:[.64,.45,1.22],
 notebook:[.41,.42,1.29],'notebook-show':[.47,.47,1.17],confirmed:[.75,.47,1.42],recall:[.74,.50,1.45],
 'ppt-before':[.32,.40,1.7],'ppt-after':[.32,.40,1.7]
};
function surface(id,x,y,w,h,zoom,cx,cy,radius=16){
 const im=img(id),aw=im.width,ah=im.height;const scale=Math.max(w/aw,h/ah)*zoom;
 const sw=w/scale,sh=h/scale,sx=Math.max(0,Math.min(aw-sw,cx*aw-sw/2)),sy=Math.max(0,Math.min(ah-sh,cy*ah-sh/2));
 g.save();g.beginPath();g.roundRect(x,y,w,h,radius);g.clip();g.drawImage(im,sx,sy,sw,sh,x,y,w,h);g.restore();
}
function evidence(i,b,kind,ids){
 let second=b>=8,phase=second?b-8:b,id=ids[second?1:0]||ids[0];
 if(kind==='edit'){id='edit-'+(b<4?0:Math.min(14,Math.floor((b-4)*2.8)+1));phase=b;second=false}
 if(kind==='versions'){id='confirmed';phase=b;second=false}
 if(kind==='recall'){id=ids[0];phase=b;second=false}
 let dark=[10,14,18,23,28,33].includes(i);base(dark);
 const [cx,cy,z]=roi[id]||(kind==='edit'?[.78,.51,1.57]:[.50,.50,1.2]);
 const fly=cue(phase,0,1.05),detail=cue(phase,2.65,1.15);
 const x=80+(1-fly)*(second?-210:270),y=132+(1-fly)*45,w=1760,h=779;
 shadow(960,906,900,42,dark?.30:.13);
 box(x-2,y-2,w+4,h+4,20,dark?'#536c72':'#c7cec4');
 surface(id,x,y,w,h,1+(z-1)*(.46+.54*detail),.5+(cx-.5)*fly,.5+(cy-.5)*fly);
 if(kind==='recall'&&b<8){
  const slide=cue(b,1,.9)*(1-cue(b,6.94,1.06));
  if(slide>0){const yy=298,xx=1080;box(xx,yy,606*slide,240,12,'#213c45');if(slide>.92){type(g,'先回忆',xx+62,yy+111,64,paper);type(g,'再打开释义核对。',xx+65,yy+181,35,'#c4d9cf')}}
 }
 if(kind==='versions'&&b>6){
  const y0=764+80*(1-cue(b,6,1));box(100,y0,648,100,10,'#163b46');type(g,'原版',135,y0+64,36,paper);line(243,y0+50,325,y0+50,'#b8d0c7',3);type(g,'教师修订版',356,y0+64,36,paper)
 }
 folio(shots[i][0],shots[i][1],dark);return dark;
}
function expansive(i,b,kind){
 const dark=['yet','poetry','reaction'].includes(kind);base(dark);const fg=dark?paper:ink;
 if(kind==='yet'){
  type(g,'Mia could still catch her bus.',100,267,70,'#c5d4d0',latin);
  const k=cue(b,2.15,1.15);g.save();g.translate(95+(1-k)*-350,0);type(g,'Yet',0,690,390,'#f4ad8b',latin,'italic');g.restore();
  const q=cue(b,5.9,1.12);g.save();g.globalAlpha=q;type(g,'she chose to walk',752+(1-q)*135,496,85,fg,latin);type(g,'home with Sam.',752+(1-q)*135,605,85,fg,latin);g.restore();
  line(760,643,760+640*cue(b,9,.95),643,'#f29c7a',6);
 }else if(kind==='clause'){
  type(g,'阅读理解',100,265,41,red);type(g,'Sam,',100,466,160,ink,latin);type(g,'who was afraid of the dark',100,665,106,blue,latin);
  const q=cue(b,3,1.1);line(110,700,110+1220*q,700,blue,6);const k=cue(b,7.85,1.25);
  if(k>0){rule(g,[[250,559],[250,510],[250+130*k,510]],red,4);type(g,'who 指代 Sam',445,510,55,red)}
 }else if(kind==='landscape'||kind==='poetry'){
  const q=cue(b,5.65,1.4),sl=cue(b,0,1.25);
  if(kind==='landscape'){
   // Engraved contour lines progressively leave a single boat in negative space.
   for(let j=0;j<19;j++){const pts=[];for(let x=0;x<=1920;x+=20){
    const y=686-j*13-100*Math.sin(x*.004+j*.046)-42*Math.sin(x*.009+j*.07);
    pts.push([x-110*q,y+90*q])}rule(g,pts,j%4===0?'#859892':'#c9d1c4',j%4===0?2.4:1.2)}
   box(0,720,1920,160,0,'#f6f5ee');type(g,'千山',94+(1-sl)*140,413,168,ink,serif);type(g,'万径',620+(1-sl)*170,413,168,ink,serif);
   const bx=1345-220*q,by=710;rule(g,[[bx-71,by],[bx-35,by+28],[bx+53,by+23],[bx+90,by-6]],ink,8);line(bx+14,by-3,bx+22,by-56,ink,6);dot(g,bx+24,by-67,9,ink);line(bx+28,by-41,bx+144,by-21,ink,3);if(q>.6)type(g,'一叶孤舟',bx-65,808,43,blue,serif);
  }else{
   const r=cue(b,0,1.26),s=cue(b,6.8,1.3);type(g,'孤',100+(1-r)*-140,665,410,'#e5ecdd',serif);
   type(g,'舟蓑笠翁',526,500,85,'#e5ecdd',serif);
   g.save();g.globalAlpha=s;type(g,'独',988+(1-s)*155,665,377,'#f3ae8d',serif);type(g,'钓寒江雪',1402,505,85,'#f3ae8d',serif);g.restore();
  }
 }else if(kind==='plot'){
  type(g,'20',85,567,258,ink,latin);type(g,'℃',384,554,103,red,serif);
  type(g,'同一温度',97,690,60,ink,serif);const k=cue(b,7,.8);
  if(k>0){type(g,'B   30 g',101,795,55,blue,latin);type(g,'A   18 g',101,870,55,red,latin)}
  graph(g,650,238,1030,550,cue(b,.65,4.5),k);
 }else if(kind==='reaction'){
  type(g,'化学方程式',93,256,45,'#c2d6cf');const q=cue(b,4,1.25);
  type(g,'H₂',257,630,180,fg,latin);type(g,'+',541,609,116,'#c7d9d2',latin);type(g,'O₂',695,630,180,fg,latin);
  type(g,'点燃',1015,450,46,'#f0a685');line(985,558,1240,558,'#e4e9da',9);rule(g,[[1209,536],[1240,558],[1209,580]],'#e4e9da',8);
  type(g,'H₂O',1405,630,170,fg,latin);g.save();g.globalAlpha=q;type(g,'2',141,630-95*(1-q),185,'#f1a481',latin);type(g,'2',1298,630-95*(1-q),185,'#f1a481',latin);g.restore();
  if(b>8)type(g,'氢原子   4  =  4                       氧原子   2  =  2',295,800,49,'#c3d6d0');
 }else if(kind==='connections'){
  type(g,'选择连接',97,317,91,ink);type(g,'AI 生成使用自己的服务账号',101,416,38,blue);
  const names=['OpenAI','Claude','DeepSeek','OpenAI-compatible'];
  names.forEach((s,n)=>{let y=551+(n%2)*115,x=102+(n>1?440:0),q=cue(b,n*.72,1);type(g,s,x+(1-q)*-55,y,n===3?43:50,n===2?red:ink,latin)});
  line(1000,235,1000,837,'#bbc3b7',2);type(g,'服务商',1120,345,33,blue);type(g,'模型',1120,498,33,blue);type(g,'API Key',1120,647,33,blue);
  type(g,b<8?'OpenAI':'DeepSeek',1120,423,66,ink,latin);type(g,'由教师指定',1120,563,48,ink);type(g,'••••  ••••  ••••',1120,728,55,ink,latin);
 }else if(kind==='lexicon'){
  type(g,'词汇手账',95,238,53,red,serif);
  type(g,vocabulary.term,88,474,157,ink,latin);
  type(g,vocabulary.meaning,101,582,61,blue,serif);
  line(98,648,1815,648,'#b9c5ba',2);
  const q=cue(b,7.8,1.0);type(g,q>.5?'回忆原句':'原文摘录',104,730,32,red);
  const s=q>.5?vocabulary.quiz.split('\n').at(-1):vocabulary.sourceQuote;
  type(g,s,100,829,52,ink,latin);
 }
 folio(shots[i][0],shots[i][1],dark);return dark;
}
function glassLab(b){
 base();folio('化学','从现象到结论');
 const burst=cue(b,4.75,4.0);
 type(g,'CO₂',101,432,183,blue,latin);type(g,'通入澄清石灰水',106,556,71,ink,serif);
 type(g,burst>.8?'澄清   →   浑浊':'观察液体的变化',109,740,57,burst>.8?red:ink);
 // The dip tube terminates below the solution. The precipitate appears in the fluid.
 g.save();g.beginPath();g.moveTo(1100,390);g.lineTo(1142,787);g.quadraticCurveTo(1144,818,1188,818);g.lineTo(1560,818);g.quadraticCurveTo(1603,817,1607,779);g.lineTo(1640,390);g.closePath();g.clip();
 const liquid=g.createLinearGradient(0,515,0,823);liquid.addColorStop(0,'#b3d4d4');liquid.addColorStop(1,'#7eacae');g.fillStyle=liquid;g.fillRect(1080,530,570,310);
 g.globalAlpha=.77*burst;g.fillStyle='#f5f5e9';g.fillRect(1080,532,570,310);g.globalAlpha=1;
 for(let k=0;k<20;k++){const cyc=((b*.22+k*.167)%1),x=1250+22*Math.sin(12*cyc+k),y=720-cyc*195;if(b<1.3)continue;g.strokeStyle='#497b85';g.lineWidth=2;g.beginPath();g.arc(x,y,3+5*cyc,0,2*Math.PI);g.stroke()}
 g.restore();rule(g,[[1085,367],[1100,390],[1142,787],[1153,807],[1188,818],[1560,818],[1592,807],[1607,779],[1640,390],[1657,367]],ink,6);
 rule(g,[[994,258],[1220,258],[1250,285],[1250,723]],ink,7);
 line(1103,530,1623,530,blue,3);
 for(let n=0;n<5;n++)line(1517,607+n*38,1555+(n%2)*17,607+n*38,'#5d8286',2);
 if(b>9)type(g,'生成碳酸钙沉淀',1120,904,46,blue);
 return false;
}
function timelinePages(b,ids){
 base();folio('课堂','从题面到答案');
 type(g,'按上课的顺序排。',90,257,90,ink,serif,'bold');
 const q=cue(b,3.7,1.45),r=cue(b,7.75,1.15);
 let centers=[420,960,1500];const prior=[660,1390,910];
 ids.forEach((id,n)=>{
  const entrance=cue(b,n*.45,1.15),x=mix(prior[n],centers[n],q)+(1-entrance)*390,y=573+(n===1?-150:65)*Math.sin(q*Math.PI);
  shadow(x,825,200,38,.16);sheet(id,x,y,340+25*r,438+31*r,.03,-.1+.09*q,radians((1-q)*(-8+n*6)),.06+.60*(1-entrance));
 });flush();
 ['题面','原图','讲解'].forEach((s,n)=>{const a=cue(b,5+n*.65,1);if(a){dot(g,centers[n]-64,882,6+n,red);type(g,s,centers[n]-39,894,39,ink)}});
 return false;
}
function printStudio(b,ids,isReveal){
 const step=b<5?0:b<10?1:2,ss=[0,5,10][step],k=cue(b,ss,.99);
 base(true);folio('课堂',isReveal?'先让学生回答':'同一道题，三种讲法',true);
 const titleText=(isReveal?['先读题','再找依据','展开讲评']:['连续讲评','侧栏板书','逐步揭示'])[step];
 title(titleText,90,250,82,{color:paper,font:serif});
 const prior=ids[Math.max(0,step-1)],now=ids[step];const x=1000,y=592,w=1230,h=692;
 shadow(x,875,660,60,.4);
 sheet(prior,x-19,y+21,w,h,.04,-.06,-.018,.04);
 sheet(now,x+(1-k)*440,y-(1-k)*72,w,h,.025,-.16+.16*k,.008+(1-k)*.09,.015+(1-k)*1.55);
 flush();type(g,isReveal?'放映':'课堂版式',88,360,34,'#b5cdc4');
 return true;
}
function foldedEnvelope(b,ids){
 base(true);folio('课件包','从 AI 客户端回来',true);
 type(g,'Lesson Desk Skill',85,325,80,'#f3ede0',latin);
 type(g,'从一份材料，',86,510,83,paper,serif);type(g,'交出两种文件。',86,620,82,paper,serif);
 const release=cue(b,4.1,2.1),settle=cue(b,9.9,1.1);
 box(856,504,865,335,32,'#78958e');g.fillStyle='#a0b8a7';g.beginPath();g.moveTo(856,531);g.lineTo(1250,280);g.quadraticCurveTo(1285,255,1317,280);g.lineTo(1721,531);g.fill();
 for(let n=1;n<=2;n++){
  let x=1286+(n===1?-216:215)*release,y=623-258*release+23*n;
  sheet(ids[n],x,y,353,435,-.05,(n===1?-1:1)*.19,radians((n===1?-8:9)*release),.14+Math.sin(release*Math.PI)*.85);
 }flush();
 g.fillStyle='#c4cfaf';g.beginPath();g.moveTo(855,534);g.lineTo(1283,684);g.lineTo(1723,534);g.lineTo(1723,815);g.quadraticCurveTo(1723,845,1686,845);g.lineTo(891,845);g.quadraticCurveTo(855,845,855,813);g.fill();
 type(g,'讲题工作台',1155,784,43,ink);
 if(settle>.6)type(g,'.pptx   /   .lesson.zip',91,762,48,'#edb094',latin);
 return true;
}
function bind(b,ids){
 base();folio('课件库','三科合为一册');const q=cue(b,6.25,2.15),m=cue(b,11,1.15);
 type(g,'备好的课，',92,391,98,ink,serif,'bold');type(g,'下次接着讲。',92,525,98,ink,serif,'bold');
 const cx=1270,cy=545;
 for(let n=0;n<3;n++){
  const x=cx+(n-1)*(274*(1-q)+8),y=cy+n*(24-17*q);
  shadow(x,y+278,270,35,.19);sheet(ids[n],x,y,425,540,.06,-.18,radians((n-1)*18*(1-q)),.04+.31*(1-q),n*3);
 }flush();
 if(m>0){g.save();g.globalAlpha=m;box(1041,310,45,477,9,'#294651');type(g,'英语　／　语文　／　化学',93,724,47,blue);g.restore()}
 return false;
}
const mechanisms=new Set(['fan','intake','scan','sequence','package','experiment','layouts','reveal','closebook']);
const proofs=new Set(['evidence','edit','versions','recall','ppt']);
export async function setup(){
 vocabulary=await (await fetch('/lexicon.json')).json();
 const ids=await (await fetch('/plates.json')).json();
 await Promise.all(ids.map(async id=>{const im=new Image();im.src='/plates/'+encodeURIComponent(id)+'.jpg';await im.decode();images.set(id,im)}));
 await document.fonts.ready;
 if(window.loadOptics)await window.loadOptics();
}
export function draw(i,seconds){
 const s=shots[i],b=seconds/beat,k=s[2];let dark;
 if(k==='optic'||k==='projector'){
  base();g.drawImage(window.renderOptics(k,b),0,0,1920,1080);
  if(k==='optic'&&b>5&&b<9.5){g.save();g.globalAlpha=cue(b,5,.62)*(1-cue(b,8.6,.9));
   const ground=g.createLinearGradient(0,0,586,0);ground.addColorStop(0,'#f7f7f0');ground.addColorStop(.76,'#f7f7f0f5');ground.addColorStop(1,'#f7f7f000');g.fillStyle=ground;g.fillRect(0,0,588,208);
   type(g,'LESSON DESK',82,77,26,red,'Arial');type(g,'讲题工作台',78,167,70,ink,sans,'bold');g.restore()}
  dark=false;
 }else if(k==='experiment')dark=glassLab(b);
 else if(k==='sequence')dark=timelinePages(b,s[3]);
 else if(k==='layouts'||k==='reveal')dark=printStudio(b,s[3],k==='reveal');
 else if(k==='package')dark=foldedEnvelope(b,s[3]);
 else if(k==='closebook')dark=bind(b,s[3]);
 else if(mechanisms.has(k))dark=paperSet(i,b,k,s[3]);else if(proofs.has(k))dark=evidence(i,b,k,s[3]);else dark=expansive(i,b,k);
 if(i!==3||b>=2.35)sub(s[b<8?4:5],dark);
}
export {canvas};
