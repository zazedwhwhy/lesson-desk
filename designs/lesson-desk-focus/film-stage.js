import {T,scene,camera,renderer,back,gate,read,iris,front,cursor,blades,ring,box,mesh,mat,copper,gun,black,silver,print,cue} from './model.js';

// A second gate sits on the same bench. Its two shutters physically uncover the print.
const easel=new T.Group();
easel.position.set(-1.2,.4,4.6);
easel.rotation.y=.5;
scene.add(easel);
const paperW=3.28,paperH=2.45;
box(easel,0,0,-.13,3.5,2.67,.2,.075,gun);
const paper=mesh(easel,new T.PlaneGeometry(paperW,paperH),new T.MeshBasicMaterial({map:print}),0,0,.01);
const shutter=box(easel,0,0,.10,3.33,2.49,.075,.024,black);
box(shutter,0,-1.23,.044,3.31,.026,.012,.006,copper);
for(const x of [-1.76,1.76])box(easel,x,-.1,-.04,.048,2.92,.10,.015,silver);
const sight=box(easel,-.418,-.43,.037,.013,.74,.016,.005,copper);
const marker=new T.Mesh(new T.TorusGeometry(.073,.012,10,64),copper);
marker.position.set(-.417,-.224,.043);easel.add(marker);
const matte=new T.MeshBasicMaterial({color:0xeeeae0});
const screen=mesh(easel,new T.PlaneGeometry(4.0,2.25),matte,0,.02,.17);
screen.visible=false;
const screenFrame=box(easel,0,.02,.135,4.13,2.38,.05,.048,gun);
const textures={};
window.loadPlates=async names=>{
 const loader=new T.TextureLoader();
 for(const name of names){const tx=await loader.loadAsync(name+'.png');tx.colorSpace=T.SRGBColorSpace;textures[name]=tx;}
};
const v=(a)=>new T.Vector3(...a);
function path(keys,t){
 let prev=keys[0];
 for(const next of keys.slice(1)){
  if(t<=next[0])return v(prev[1]).lerp(v(next[1]),cue(t,prev[0],next[0]));
  prev=next;
 }
 return v(prev[1]);
}
window.filmFrame=t=>{
 const split=cue(t,16,26.5),lift=cue(t,24,34),lock=cue(t,31,37.5),turn=cue(t,12.4,16.8);
 back.position.x=-.92-1.73*split;
 gate.position.set(-.53-.43*split,.4*lift,2.26*lift);
 read.position.set(-.26+.65*split-1.29*lock,.4*lift,2.26*lift);
 cursor.position.set(0,-.013,-.81+1.101*cue(t,32,37.8));
 iris.position.x=.08+1.52*split;iris.rotation.x=.38*turn+.54*split;
 front.position.set(.59+2.57*split,.11*split,0);front.rotation.x=1.58*turn+.56*split;
 blades.forEach(b=>{b.position.y=.13*turn+.07*split;b.rotation.z=-.16*split;});
 const later=t>=57;
 easel.visible=later;screen.visible=screenFrame.visible=t>=71.25;
 const p= later ? [[57,[4.3,2.0,8.25]],[60.5,[2.3,1.05,8.35]],[64.5,[1.6,.78,8.15]],[68.8,[1.18,.75,8.76]],[71.25,[1.85,1.68,9.15]],[74.2,[.96,.78,8.65]],[78.2,[.74,.52,8.19]],[82,[.82,.48,8.52]],[87,[1.13,.74,8.68]]]
 : [[12,[4.45,.23,.12]],[15.8,[5.65,.8,2.83]],[20,[6.27,2.15,6.27]],[26.4,[6.9,3.1,9.35]],[30.5,[5.04,1.8,5.62]],[35,[3.13,1.11,3.28]],[38.3,[2.84,.67,2.45]],[41,[2.75,.58,2.35]]];
 const a=later ? [[57,[-1.26,.35,4.54]],[61,[-1.3,-.05,4.6]],[65,[-1.39,.27,4.6]],[69,[-1.2,.40,4.6]],[87,[-1.2,.42,4.6]]]
 : [[12,[.5,0,0]],[16,[-.06,.02,0]],[26,[-.27,0,0]],[32,[-.82,.30,1.84]],[37,[-.93,.35,2.29]],[41,[-.93,.36,2.3]]];
 shutter.position.y= .02+ .52*cue(t,57.5,60.1)+1.02*cue(t,61.8,64.05)+1.32*cue(t,65.7,68.4);
 shutter.visible=t<71.25;shutter.children[0].visible=shutter.visible;
 marker.visible=sight.visible=t>=63&&t<71.25;
 if(screen.visible){
  const map=textures[t<78.8?'show-2':t<81?'show-3':t<84?'ppt-before':'ppt-after'];
  if(map!==matte.map){matte.map=map;matte.color.set(0xffffff);matte.toneMapped=false;matte.needsUpdate=true;}
 }
 camera.position.copy(path(p,t));camera.lookAt(path(a,t));
 camera.fov=later?34:31+2*split-2*lock;camera.updateProjectionMatrix();renderer.render(scene,camera);
};
