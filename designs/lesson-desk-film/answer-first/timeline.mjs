// All coordinates are in the 1280 × 720 editorial composition.
export const cuts=[0,8,22,40,57,88,104,120,137,150];
export const captions=[
  [1.1,7.5,'她明明赶得上车，为什么还要走回家？'],
  [8.4,14.5,'先看原卷，读清第 8 题。'],[14.5,21.5,'把题号和参考答案对上。'],
  [22.5,30,'同一篇阅读，一起备。'],[30.5,39.4,'今天，先讲第 8 题。'],
  [40.6,46,'Yet 提醒我们：她原本有另一个选择。'],[46.2,51.7,'再往后读，谁怕黑？'],
  [52,56.7,'把这个问题写进讲义，留给学生。'],
  [57.3,64.8,'连续讲评，顺着原文读一遍。'],[65.2,73.6,'侧栏板书，把题目留在旁边。'],
  [74.2,80.1,'逐步揭示。这里，等学生先说。'],[81,87.6,'大家找到依据，再翻出答案。'],
  [88.4,95,'只勾选今天要讲的内容。'],[95.2,103.4,'导出的 PPT 页序一致，追问还可以改。'],
  [104.3,111.7,'语文，回到原句里找依据。'],[112.2,119.7,'化学，指着试卷上的原图讲。'],
  [120.4,126.2,'也可以在支持 Skill 的 AI 客户端起稿。'],[126.5,131.5,'一次生成可编辑 PPT 和课件包。'],
  [132,136.7,'把课件包导回工作台，接着核对。'],
  [137.2,142.9,'她想陪怕黑的 Sam 一起回家。']
];
const ink='#1e2521',red='#b33f2e',muted='#666f69',paper='#f5f1e8',green='#153e35',rule='#dcded6';
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>1-Math.pow(1-clamp(x),3);
const rise=(t,a,d=.65)=>ease((t-a)/d);
export function drawFilm(c,img,t){
  const {width,height}=c.canvas;
  c.setTransform(width/1280,0,0,height/720,0,0);
    c.clearRect(0,0,1280,720);
  c.fillStyle='#fdfdfb';c.fillRect(0,0,1280,720);
  function group(fn){c.save();fn();c.restore();}
  function enter(start,fn,dx=0,dy=22,d=.7){let p=rise(t,start,d);if(!p)return;group(()=>{c.globalAlpha*=p;c.translate(dx*(1-p),dy*(1-p));fn()})}
  function text(s,x,y,size=24,face='Sans',color=ink,align='left'){
    c.font=size+'px '+face;c.fillStyle=color;c.textAlign=align;c.textBaseline='alphabetic';c.fillText(s,x,y);c.textAlign='left';
  }
  function box(x,y,w,h,fill,r=12,border=''){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();if(border){c.lineWidth=1;c.strokeStyle=border;c.stroke()}}
  function line(x,y,xx,yy,col=rule,lw=1){c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.strokeStyle=col;c.lineWidth=lw;c.stroke()}
  function label(s,x,y){text(s,x,y,16,'Bold',muted)}
  function hand(x,y,w,at){const p=rise(t,at,.65);if(!p)return;c.beginPath();for(let i=0;i<=60*p;i++){const k=i/60,xx=x+k*w,yy=y+Math.sin(k*5)*3-3*k;i?c.lineTo(xx,yy):c.moveTo(xx,yy)}c.strokeStyle=red;c.lineWidth=3.4;c.lineCap='round';c.stroke()}
  function ring(x,y,rx,ry,at){const p=rise(t,at,.72);if(!p)return;c.beginPath();c.ellipse(x,y,rx,ry,-.08,-2.2,-2.2+6.45*p);c.strokeStyle=red;c.lineWidth=2.8;c.stroke()}
  function sheet(x,y,w,h,fill='#fff'){group(()=>{c.shadowColor='rgba(29,42,32,.12)';c.shadowBlur=20;c.shadowOffsetY=8;box(x,y,w,h,fill,12)});box(x,y,w,h,fill,12,'#dddcd5')}
  function picture(key,x,y,w,h,rounded=0){const im=img[key];if(!im)throw Error('Missing plate '+key);group(()=>{c.beginPath();c.roundRect(x,y,w,h,rounded);c.clip();c.drawImage(im,x,y,w,h)})}
  function chapter(ch){text('讲题工作台',67,51,18,'Bold');line(178,34,178,52);text(ch,193,50,15,'Sans',muted);text('LESSON DESK    /    0.18',1213,49,14,'Mono',muted,'right')}
  function editorial(left,x,y){text(left,x,y,56,'Editorial')}
  function cap(){const row=captions.find(([a,b])=>a<=t&&t<b);if(!row)return;const alpha=Math.min(clamp((t-row[0])/.22),clamp((row[1]-t)/.2));group(()=>{c.globalAlpha=alpha;text(row[2],640,672,26,'Sans',ink,'center')})}
  function badge(s,x,y,w){box(x,y-24,w,34,'#f3e5dd',7);text(s,x+10,y,17,'Bold',red)}
  function anchoredPlate(key,x,y,w,h,at){enter(at,()=>{sheet(x,y,w,h);picture(key,x,y,w,h,12)},12,15)}
  function counter(s,x,y){text(s,x,y,15,'Mono',red)}
  function titleRule(s,sub){chapter(s);text(sub,70,153,50,'Editorial')}
  if(t<8){
    const pull=rise(t,6.7,1.3);group(()=>{c.translate(640,340);c.scale(1-.09*pull,1-.09*pull);c.translate(-640,-340);
      picture('walk',470,230,800,450); // original graphite scene, held on the paper throughout the reading beat
      text('英语阅读',72,74,18,'Bold',muted);text('答案先别放',1204,74,20,'Bold',ink,'right');line(72,94,1204,94);
      enter(0,()=>text('08',66,320,220,'Display',red),-28,0,.62);
      enter(.34,()=>{text('Mia could still',412,211,66,'Serif');text('catch her bus.',412,286,66,'Serif')},0,18);
      enter(1.7,()=>{text('赶得上车。',80,432,65,'Editorial');text('为什么还要走？',80,511,65,'Editorial')});hand(79,529,365,2.6);
    });
  }else if(t<22){
    chapter('材料核对');const key=t<14.5?'source-paper':'source-key';
    enter(8,()=>{text('08',57,257,162,'Display',red);editorial('把题目',68,345);editorial('和答案对上。',68,414);label('放学以后  /  英语阅读',72,496)});
    anchoredPlate(key,440,122,758,426,t<14.5?8.35:14.5);
    enter(10,()=>{box(499,494,639,75,paper,8,'#d3c6b3');text(t<14.5?'8.  Why did Mia walk home?':'第 8 题　·　参考答案已关联',521,542,31,t<14.5?'Serif':'Bold')});
  }else if(t<40){
    titleRule('备课范围','同一篇阅读，一起备。');
    const squeeze=rise(t,30,1);const rows=[['07','Could Mia still catch her bus?'],['08','Why did Mia walk home?'],['09','Who was afraid of the dark?']];
    rows.forEach(([n,s],i)=>{const y=205+i*103;enter(22.5+i*.27,()=>{group(()=>{if(i!==1)c.globalAlpha=1-.78*squeeze;
      const slide=i===1?0:(i===0?-12:12)*squeeze; c.translate(0,slide);box(75,y,1125,78,i===1?'#f4f0e6':'#fafaf7',9,rule);
      text(n,102,y+53,37,'Display',i===1?red:muted);text(s,199,y+50,34,'Serif');text(i===1&&squeeze>.5?'本次讲评':'逐题解析',1156,y+48,20,'Bold',i===1?red:muted,'right');})},16,0)});
    enter(31.3,()=>{hand(201,370,372,31.3);text('Why?',640,574,55,'Italic',red,'center')});
  }else if(t<57){
    chapter('教师讲义');sheet(73,106,1134,473,'#fcfaf4');label('放学以后  /  原文',110,156);
    text('Mia could still catch her bus.',110,237,50,'Serif');
    text('Yet she chose to walk home with Sam,',110,306,50,'Serif');
    text('who was afraid of the dark.',110,374,50,'Serif');
    ring(151,290,52,32,41.6);hand(113,388,586,46.25);
    enter(49.4,()=>{line(110,415,1152,415);label('教师追问',110,463)});
    const q='哪几个词告诉你，她是为了 Sam？';const p=clamp((t-50.1)/3.6);
    if(t>=50.1){const shown=q.slice(0,Math.floor(p*q.length));text(shown,110,529,43,'Editorial');if(t<54.6&&Math.floor(t*2)%2===0){const w=c.measureText(shown).width;line(111+w,489,111+w,531,red,2)}}
    enter(54.7,()=>badge('已保存',1055,528,90),0,5);
  }else if(t<88){
    const mode=t<65?0:t<74?1:2;const start=[57,65,74][mode];const names=['连续讲评','侧栏板书','逐步揭示'];chapter('课堂放映');
    enter(start,()=>{text('0'+(mode+1),73,211,102,'Display',red);editorial(names[mode],69,299);line(72,331,337,331);
      const subs=[['把一段原文','从头读下来。'],['左边留题，','右边讲依据。'],['留两秒，','让学生先说。']][mode];text(subs[0],73,397,30,'Editorial');text(subs[1],73,443,30,'Editorial')});
    const key= mode===0?(t<61?'paper-1':'paper-3'):mode===1?(t<69?'blue-2':'blue-3'):(t<83.7?'forest-2':'forest-3');
    const at=({ 'paper-1':57,'paper-3':61,'blue-2':65,'blue-3':69,'forest-2':74,'forest-3':83.7 })[key];
    anchoredPlate(key,377,132,834,469,at);
    if(t>=78.7&&t<83.7)enter(78.7,()=>{box(416,385,726,83,'#f5f0e5',10);text('who was afraid of the dark',452,440,36,'Serif');hand(454,449,412,79.4)},0,8);
  }else if(t<104){
    chapter('授课与导出');const ppt=t>=95;
    enter(ppt?95:88,()=>{editorial(ppt?'带进':'选好',68,234);editorial(ppt?'PowerPoint。':'这一节课。',68,302);line(71,345,362,345);text(ppt?'同一页 · 可编辑文字':'第 8 题 · 英文原文与逐题解析',73,394,20,'Sans',muted)});
    const key=ppt?(t<99.1?'powerpoint-before':'powerpoint-after'):'setup';anchoredPlate(key,399,133,813,457,ppt?95:88);
    if(ppt)enter(95.7,()=>{box(440,415,727,112,paper,9);label('PowerPoint  /  第 2 页文字',461,453);text(t<99.1?'哪几个词告诉你，她是为了 Sam？':'哪些词能说明，她是为了 Sam？',461,500,34,'Editorial')},0,7);
  }else if(t<112){
    chapter('语文讲评');label('苏轼  /  记承天寺夜游',74,146);
    enter(104,()=>{text('庭下如积水空明，',70,276,82,'Editorial');text('水中藻、荇交横，',70,388,82,'Editorial')});
    enter(106.2,()=>text('盖竹柏影也。',464,510,91,'Editorial',red),28,0);hand(476,532,452,108);
  }else if(t<120){
    chapter('化学讲评');editorial('这根导管，',65,246);editorial('通向哪里？',65,317);line(71,359,398,359);
    text(t<116?'试卷原图':'讲评课件中的原图',72,414,26,'Sans',muted);
    sheet(451,151,743,373);picture('apparatus',460,161,725,353,6);ring(870,395,62,37,115.8);
    enter(116,()=>badge('原图随题保留',886,556,150),0,8);
  }else if(t<137){
    chapter('讲题工作台 Skill');
    if(t<131.6){
      enter(120,()=>{editorial('从一条备课要求开始。',67,161);box(70,207,1138,105,green,14);text('“按参考答案核对第 8 题，输出 PPT 和可导入的课件包。”',105,275,32,'Editorial','#fff9e9')});
      [[72,'PPT','讲评课件','可编辑 .pptx'],[650,'ZIP','课件包','可导入 .lesson.zip']].forEach(([x,ext,s,format],i)=>enter(125.6+i*.3,()=>{sheet(x,372,550,159);text(ext,x+21,451,48,'Display',red);text(s,x+140,443,36,'Bold');text(format,x+141,490,23,'Sans',muted)},0,32));
    }else{
      enter(131.6,()=>{editorial('带回来，',69,251);editorial('接着核对。',69,321);text('.lesson.zip',72,408,34,'Serif',red)});anchoredPlate('library',420,132,792,446,131.6);
    }
  }else if(t<143){
    picture('walk',376,120,900,506);chapter('放学以后');
    enter(137,()=>{text('They walked',67,242,62,'Italic');text('home together.',68,317,62,'Italic');text('她想陪怕黑的 Sam',72,411,41,'Editorial');text('一起回家。',72,468,41,'Editorial')});hand(72,482,203,139);
  }else{
    group(()=>{c.globalAlpha=.28;picture('walk',652,187,620,349)});enter(143,()=>{text('讲题工作台',65,271,106,'Editorial');text('打开教学示例，试讲一道题。',73,382,53,'Editorial');hand(74,406,539,143.8);text('Windows 版 0.18.0',75,474,25,'Bold',red);text('github.com/zazedwhwhy/lesson-desk',74,522,28,'Mono',muted)});
    line(74,598,1206,598);text('Tobu — Hope   ·   CC BY 3.0   ·   音乐经截取、混音及淡出',75,633,17,'Sans',muted);text('soundcloud.com/7obu/tobu-hope-original-mix',75,663,16,'Mono',muted);
  }
  cap();
}
