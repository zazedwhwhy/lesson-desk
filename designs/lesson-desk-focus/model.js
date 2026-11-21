import * as T from 'three';
import {RoundedBoxGeometry} from './work/package/examples/jsm/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from './work/package/examples/jsm/environments/RoomEnvironment.js';

// The optical bench is a visual metaphor built at one scale, with the optical axis along X.
const scene=new T.Scene(), camera=new T.PerspectiveCamera(31,16/9,.05,80);
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:false});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;
renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.0;document.body.append(renderer.domElement);
const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();
scene.environment=pmrem.fromScene(room,.035).texture;
scene.environmentIntensity=.92;
const surround=document.createElement('canvas');surround.width=1200;surround.height=675;
const sg=surround.getContext('2d'),falloff=sg.createLinearGradient(45,0,1130,675);
falloff.addColorStop(0,'#faf9f3');falloff.addColorStop(.54,'#e7e8e3');falloff.addColorStop(1,'#cbd0ce');
sg.fillStyle=falloff;sg.fillRect(0,0,1200,675);scene.background=new T.CanvasTexture(surround);scene.background.colorSpace=T.SRGBColorSpace;
const mat=(color,metalness,roughness)=>new T.MeshStandardMaterial({color,metalness,roughness});
const black=mat(0x242821,.81,.29),rubber=mat(0x151815,.12,.55),silver=mat(0xc0c5bf,.94,.23);
const gun=mat(0x444941,.9,.26),copper=mat(0xb56b36,.81,.24),white=mat(0xe4e0d0,.65,.32);
const ground=new T.Mesh(new T.PlaneGeometry(150,150),new T.ShadowMaterial({color:0x3b4740,opacity:.16}));
ground.rotation.x=-Math.PI/2;ground.position.y=-1.55;ground.receiveShadow=true;scene.add(ground);
const light=new T.DirectionalLight(0xfff3dc,3.1);
light.position.set(-2,8,4);light.castShadow=true;light.shadow.mapSize.set(2048,2048);
Object.assign(light.shadow.camera,{left:-9,right:9,top:7,bottom:-7,near:.1,far:24});light.shadow.normalBias=.017;light.shadow.bias=-.00015;scene.add(light);
const fill=new T.DirectionalLight(0xcfecfa,1.5);fill.position.set(4,2,-4);scene.add(fill);
const body=new T.Group();scene.add(body);
function mesh(parent,geometry,material,x=0,y=0,z=0){
  const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function box(p,x,y,z,w,h,d,r,m){return mesh(p,new RoundedBoxGeometry(w,h,d,2,r),m,x,y,z)}
function turned(p,profile,m){
  const g=new T.LatheGeometry(profile.map(([x,r])=>new T.Vector2(r,x)),112);
  const part=mesh(p,g,m);part.rotation.z=-Math.PI/2;return part;
}
function ring(p,x,r,inner,length,m){
  const d=Math.min(.026,length/4,(r-inner)/3),left=x-length/2,right=x+length/2;
  return turned(p,[[left,inner],[left,r-d],[left+d,r],[right-d,r],[right,r-d],[right,inner],[left,inner]],m);
}
function face(p,x,w,h,texture){
  const m=new T.MeshStandardMaterial({map:texture,roughness:.63,metalness:.04,side:T.DoubleSide});
  const panel=mesh(p,new T.PlaneGeometry(w,h),m,x);panel.rotation.y=Math.PI/2;return panel;
}
function tex(w,h,paint){const cv=document.createElement('canvas');cv.width=w;cv.height=h;paint(cv.getContext('2d'));const tx=new T.CanvasTexture(cv);tx.colorSpace=T.SRGBColorSpace;tx.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return tx}
function inkText(g,s,x,y,size,col,font='Arial'){g.fillStyle=col;g.font=size+'px '+font;g.fillText(s,x,y)}
const print=tex(1100,820,g=>{
  g.fillStyle='#f4efe1';g.fillRect(0,0,1100,820);
  inkText(g,'化学  /  溶解度曲线',67,85,50,'#222923','Microsoft YaHei');
  inkText(g,'12',870,119,104,'#353c32','Georgia');
  g.strokeStyle='#8d9287';g.lineWidth=3;g.beginPath();g.moveTo(66,151);g.lineTo(1035,151);g.stroke();
  inkText(g,'20 ℃ 时，哪种物质的溶解度更大？',68,230,43,'#121a16','Microsoft YaHei');
  const xy=(x,y)=>[190+x*11,671-y*6.2];
  for(let n=0;n<=60;n+=20){const [x]=xy(n,0),[,y]=xy(0,n);g.strokeStyle='#c2c6b8';g.lineWidth=2;g.beginPath();g.moveTo(x,287);g.lineTo(x,671);g.moveTo(190,y);g.lineTo(850,y);g.stroke();inkText(g,''+n,x-12,717,31,'#435045');if(n)inkText(g,''+n,126,y+9,25,'#435045')}
  g.strokeStyle='#364139';g.lineWidth=5;g.beginPath();g.moveTo(190,293);g.lineTo(190,671);g.lineTo(873,671);g.stroke();
  function curve(values,col){g.strokeStyle=col;g.lineWidth=9;g.beginPath();values.forEach(([x,y],i)=>g[i?'lineTo':'moveTo'](...xy(x,y)));g.stroke()}
  curve([[0,8],[20,18],[40,35],[60,58]],'#a95935');curve([[0,25],[20,30],[40,35],[60,40]],'#244b4d');
  inkText(g,'A',876,323,42,'#a95935');inkText(g,'B',878,445,42,'#244b4d');inkText(g,'温度 / ℃',799,767,30,'#41483d','Microsoft YaHei');
  inkText(g,'g / 100 g 水',68,283,24,'#475047','Microsoft YaHei');
});
window.chartImage=print.image.toDataURL('image/png');
const back=new T.Group(),gate=new T.Group(),read=new T.Group(),iris=new T.Group(),front=new T.Group();
body.add(back,gate,read,iris,front);
// Milled carrier with narrow vent fins and an engraved identifier.
box(back,-.72,-.03,0,1.65,2.45,2.7,.13,black);
for(let i=0;i<17;i++)box(back,-1.39+i*.081,.03,1.36,.033,1.98,.09,.014,gun);
box(back,-.67,.02,1.424,1.49,.37,.042,.032,black);
const serial=tex(1024,212,g=>{g.fillStyle='#20251f';g.fillRect(0,0,1024,212);inkText(g,'LESSON DESK',29,117,84,'#e8e8dc');inkText(g,'OPTICAL STUDY   /   012',34,182,38,'#b0b8ac')});
const tag=mesh(back,new T.PlaneGeometry(1.39,.29),new T.MeshBasicMaterial({map:serial}),-.66,.03,1.46);
ring(back,.19,1.15,.75,.25,silver);ring(back,.26,1.07,.75,.15,gun);
for(const y of [-.92,.92])for(const z of [-1.07,1.07]){
 const screw=new T.Group();screw.position.set(.119,y,z);back.add(screw);ring(screw,0,.072,.022,.04,silver);
}
// Chamfered sample gates. Four separate rails leave the optical aperture open.
function frame(p,w,h,d,rail,m){
  box(p,0,(h-rail)/2,0,d,rail,w,.043,m);box(p,0,-(h-rail)/2,0,d,rail,w,.043,m);
  box(p,0,0,(w-rail)/2,d,h-rail*1.75,rail,.038,m);box(p,0,0,-(w-rail)/2,d,h-rail*1.75,rail,.038,m);
}
frame(gate,2.52,2.12,.19,.13,silver);face(gate,.024,2.3,1.89,print);
box(gate,0,1.13,-.60,.16,.22,.48,.055,copper);
frame(read,2.54,2.13,.09,.066,gun);
const pane=mesh(read,new T.BoxGeometry(.026,2.0,2.40),new T.MeshPhysicalMaterial({color:0xacd8c5,metalness:.12,roughness:.12,transparent:true,opacity:.19,depthWrite:false}));
pane.castShadow=false;
const cursor=new T.Group();read.add(cursor);
box(cursor,.054,-.05,0,.035,1.25,.016,.005,copper);
function torus(p,x,y,z,r,tube,m){const o=mesh(p,new T.TorusGeometry(r,tube,10,72),m,x,y,z);o.rotation.y=Math.PI/2;return o}
torus(cursor,.07,-.158,0,.064,.012,copper);
// Rotating steel iris with ten overlapping, individually modelled leaves.
ring(iris,0,1.08,.78,.16,gun);ring(iris,.095,1.07,.91,.04,copper);
const blades=[];
for(let i=0;i<10;i++){
 const pivot=new T.Group();pivot.rotation.x=i*Math.PI/5;iris.add(pivot);
 const sh=new T.Shape();sh.moveTo(-.12,.89);sh.quadraticCurveTo(.27,.94,.57,.71);sh.quadraticCurveTo(.38,.20,.065,.11);sh.quadraticCurveTo(-.13,.34,-.12,.89);
 const b=mesh(pivot,new T.ExtrudeGeometry(sh,{depth:.013,bevelEnabled:false}),mat(i%2?0x414940:0x333b36,.75,.33),i*.001);
 b.rotation.y=Math.PI/2;blades.push(b);
}
// Front optical housing, retaining rings, ribbing and a curved coated optical element.
ring(front,-.14,1.11,.75,.40,black);ring(front,.065,1.10,.77,.06,silver);
ring(front,.18,1.14,.77,.24,rubber);
const ridges=new T.InstancedMesh(new T.BoxGeometry(.19,.055,.034),gun,120);
const dummy=new T.Object3D();
for(let i=0;i<120;i++){const a=i*Math.PI/60;dummy.position.set(.17,1.135*Math.cos(a),1.135*Math.sin(a));dummy.rotation.x=a;dummy.updateMatrix();ridges.setMatrixAt(i,dummy.matrix)}
front.add(ridges);ring(front,.34,1.095,.79,.13,black);ring(front,.40,.94,.77,.035,copper);
const lens=turned(front,[[.14,.005],[.16,.55],[.18,.79],[.23,.815],[.34,.765],[.415,.59],[.47,.35],[.49,.005],[.14,.005]],new T.MeshPhysicalMaterial({color:0x2b635d,metalness:.69,roughness:.097,clearcoat:1,clearcoatRoughness:.045,iridescence:.69,iridescenceThicknessRange:[100,440]}));
// Fine engraved retaining rings catch grazing light around the polished element.
for(let i=0;i<4;i++)ring(front,.39+i*.012,.838-i*.013,.82-i*.013,.012,i%2?black:gun);
const focusScale=new T.InstancedMesh(new T.BoxGeometry(.032,.012,.023),white,56);
for(let i=0;i<56;i++){const a=i*Math.PI/28;dummy.position.set(.329,1.099*Math.cos(a),1.099*Math.sin(a));dummy.rotation.x=a;dummy.scale.set(i%7===0?2.5:1,1,1);dummy.updateMatrix();focusScale.setMatrixAt(i,dummy.matrix)}
front.add(focusScale);
function sat(v){return Math.max(0,Math.min(1,v))}
function smooth(x){x=sat(x);return x*x*(3-2*x)}
function cue(t,start,end){return smooth((t-start)/(end-start))}
const from=new T.Vector3(6.7,2.0,5.6),wide=new T.Vector3(6.7,3.1,8.65),macro=new T.Vector3(4.15,1.05,2.03);
const aim=new T.Vector3();
window.pose=t=>{
 const split=cue(t,.35,3.15),close=cue(t,3.7,6.25),lock=cue(t,5.35,7.05);
 back.position.x=-.92-1.68*split;gate.position.set(-.53-.40*split,.37*close,1.30*close);
 read.position.set(-.26+.66*split-1.22*lock,.37*close,1.30*close);
 cursor.position.z=-.75+.17*split+ .88*lock;
 iris.position.x=.08+1.50*split;iris.rotation.x=.36*split+.27*close;
 blades.forEach(b=>{b.position.y=.095*cue(t,.55,2.6);b.rotation.z=-.10*split});
 front.position.x=.59+2.53*split;front.rotation.x=.75*split+.24*close;
 front.position.y=.10*split;camera.position.copy(from).lerp(wide,split).lerp(macro,close);
 aim.set(-.45,0,0).lerp(new T.Vector3(-.83,.30,1.31),close);
 camera.lookAt(aim);camera.fov=31+2*split-1.8*close;camera.updateProjectionMatrix();
 renderer.render(scene,camera);
};
window.pose(0);window.ready=true;
