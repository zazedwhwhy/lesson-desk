export const ink='#162b35',red='#cd4931',blue='#2d5d79',paper='#fffdf5',light='#eef0e8';
export const sans='"Microsoft YaHei","Microsoft YaHei UI",sans-serif',serif='SimSun,serif',latin='Georgia,serif';
export function type(g,s,x,y,size,color=ink,font=sans,weight='normal'){
 g.fillStyle=color;g.font=weight+' '+size+'px '+font;g.textAlign='left';g.textBaseline='alphabetic';g.fillText(s,x,y);
}
export function rule(g,pts,color,width=3){
 g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.lineJoin='round';g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();
}
export function dot(g,x,y,r,color){g.fillStyle=color;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill()}
export function waveLines(g,x,y,width,n,spacing=38){
 for(let i=0;i<n;i++)rule(g,[[x,y+i*spacing],[x+width*(i===n-1?.59:i%3===1?.87:1),y+i*spacing]],'#b2bcb6',3);
}
export function graph(g,x,y,w,h,progress=1,marks=0,guide=true){
 const X=n=>x+w*n/60,Y=n=>y+h*(1-n/60);
 for(const n of [0,20,40,60]){
  rule(g,[[x,Y(n)],[x+w,Y(n)]],'#d8dcd1',1.6);type(g,''+n,x-49,Y(n)+8,24,'#56696e',latin);
  type(g,''+n,X(n)-12,y+h+34,25,n===20&&marks?red:'#56696e',latin);
 }
 rule(g,[[x,y-5],[x,y+h],[x+w+8,y+h]],ink,3);
 function curve(vals,col){const points=[];for(let i=0;i<3;i++){const u=Math.max(0,Math.min(1,progress*3-i));if(!u&&i)break;if(!i)points.push([X(0),Y(vals[0])]);points.push([X((i+u)*20),Y(vals[i]+(vals[i+1]-vals[i])*u)]);}rule(g,points,col,6);}
 curve([8,18,35,58],red);curve([25,30,35,40],blue);
 if(progress>.95){type(g,'A',x+w+14,Y(58)+8,28,red,latin);type(g,'B',x+w+14,Y(40)+8,28,blue,latin)}
 if(marks>0){dot(g,X(20),Y(18),8*marks,red);dot(g,X(20),Y(30),8*marks,blue);}
 if(guide){type(g,'g / 100 g 水',x-8,y-21,22,ink);type(g,'温度 / ℃',x+w-74,y+h+70,22,ink)}
}
const dic={
 english:['ENGLISH','阅读理解','Mia could still catch her bus.','Yet she chose to walk home','with Sam, who was afraid','of the dark.'],
 poem:['LITERATURE','江雪','柳宗元','千山鸟飞绝，','万径人踪灭。','孤舟蓑笠翁，','独钓寒江雪。'],
 graph:['CHEMISTRY','溶解度曲线','20 ℃ 时，哪种物质的溶解度更大？'],
 pdf:['SOURCE  /  PDF','试题原卷','阅读理解  ·  第 8 题','Mia could still catch her bus.','Why did Mia walk home?'],
 word:['SOURCE  /  DOCX','参考答案','第 8 题','她想陪怕黑的 Sam 回家。'],
 paste:['SOURCE  /  TEXT','粘贴材料','补充说明','请学生圈出表示转折的词。'],
 scanpage:['SOURCE  /  SCAN','原始卷面','第 8 题','Why did Mia walk home?','A. To walk with Sam.'],
 transcript:['REVIEW','识别稿','第 8 题','Why did Mia walk home?','A. To walk with Sam.'],
 classical:['CLASSICAL TEXT','文言译注','词义  /  句意','对照原句，核实译文。'],
 writing:['COMPOSITION','写作指导','立意  /  提纲','先确定要写的细节。'],
 practice:['PRACTICE','考点演练','自己试一题','找出最能表现寂静的诗句。'],
 lab:['EXPERIMENT','实验剖析','操作','将二氧化碳通入澄清石灰水。','现象','石灰水变浑浊。'],
 method:['METHOD','题型方法','从证据到结论','先说看到的现象，','再解释发生的变化。'],
 'chem-practice':['PRACTICE','考点演练','轮到你来判断','为什么要记录反应前后的现象？'],
 question:['QUESTION  /  12','课堂提问','20 ℃ 时','哪种物质的溶解度更大？'],
 solution:['EXPLANATION','读图方法','先找 20 ℃，','再比纵坐标。','同温度下，B 的点更高。'],
 custom:['POWERPOINT','学校模板','.potx','背景、配色、字体'],
 manifest:['LESSON DESK SKILL','整理材料','试卷','参考答案','教学要求'],
 'ppt-file':['EXPORT  /  01','可编辑课件','.pptx','课堂展示与二次编辑'],
 bundle:['EXPORT  /  02','课件包','.lesson.zip','导入讲题工作台']
};
export function pageImage(id){
 const a=dic[id];if(!a)throw Error('Unknown paper '+id);
 const c=document.createElement('canvas');c.width=860;c.height=1080;const g=c.getContext('2d');
 const tone=id==='poem'||id==='classical'?'#eff1e8':id==='word'||id==='bundle'?'#e8eff0':paper;
 g.fillStyle=tone;g.fillRect(0,0,860,1080);g.fillStyle=id==='poem'?blue:red;g.fillRect(0,0,860,17);
 type(g,a[0],58,92,26,red,'Arial','bold');type(g,a[1],53,224,76,ink,id==='poem'?serif:sans,'bold');rule(g,[[58,270],[802,270]],ink,3);
 if(id==='graph'){
  type(g,a[2],60,337,34,ink,serif);graph(g,135,472,554,325);
 }else if(id==='poem'){
  type(g,'唐  ·  柳宗元',63,336,28,blue);for(let i=0;i<4;i++)type(g,a[i+3],81,453+i*102,66,ink,serif);
 }else{
  let yy=390;
  for(const s of a.slice(2)){const en=/^[A-Za-z.]/.test(s);let size=en?52:41;
   g.font=size+'px '+(en?latin:serif);while(g.measureText(s).width>742){size--;g.font=size+'px '+(en?latin:serif)}
   type(g,s,62,yy,size,ink,en?latin:serif);yy+=82;
  }
  if(yy<790)waveLines(g,63,yy+65,580,3,38);
 }
 rule(g,[[60,959],[800,959]],'#bec4b9',2);type(g,'讲题工作台',60,1016,25,'#52646a');type(g,'LESSON DESK',612,1017,22,'#52646a','Arial');return c;
}
