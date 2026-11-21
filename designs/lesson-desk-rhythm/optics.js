// The original Focus front element and engraved paper carrier are retained.
// The box body, measuring rod, cursor ring and star-shaped iris never enter this cut.
import {T,scene,camera,renderer,back,gate,read,iris,front,box,ring,gun,copper,silver} from '../lesson-desk-focus/model.js';
back.visible=read.visible=iris.visible=false;
front.scale.set(.62,.89,.89);
front.traverse(m=>{if(m.material===copper)m.material=gun;if(m.material?.isMeshPhysicalMaterial){m.material.color.setHex(0x455f68);m.material.iridescence=.08;m.material.roughness=.19;m.material.clearcoat=.68}});
ring(front,.429,.931,.917,.012,copper);
const screen=new T.Group();screen.rotation.y=Math.PI/2;scene.add(screen);
box(screen,0,0,-.095,4.32,2.49,.14,.055,gun);
for(const y of [-1.19,1.19])box(screen,0,y,.004,4.26,.046,.03,.012,silver);
const face=new T.Mesh(new T.PlaneGeometry(4.19,2.35),new T.MeshBasicMaterial({toneMapped:false}));face.position.z=.009;screen.add(face);
const gloss=new T.Mesh(new T.PlaneGeometry(4.19,2.35),new T.MeshBasicMaterial({color:0x141c1b,transparent:true,opacity:0,depthWrite:false}));gloss.position.z=.015;screen.add(gloss);
const bar=box(screen,0,1.19,.016,4.24,.025,.024,.008,copper);
const lim=u=>Math.min(1,Math.max(0,u)),ease=(t,a,d)=>{const q=lim((t-a)/d);return q*q*(3-2*q)};
const poses=(knots,t)=>{
 let [a,v]=knots[0];for(const [b,w] of knots.slice(1)){if(t<=b){const f=ease(t,a,b-a);return v.map((x,i)=>x+(w[i]-x)*f)}a=b;v=w}return v;
};
const tx={};
window.loadOptics=async()=>{
 for(const key of ['chem-show','chem-notes']){
  const image=await new T.TextureLoader().loadAsync('/plates/'+key+'.jpg');
  image.colorSpace=T.SRGBColorSpace;image.anisotropy=4;tx[key]=image;
 }
};
window.renderOptics=(kind,b)=>{
 const optic=kind==='optic';front.visible=gate.visible=optic;screen.visible=!optic;
 if(optic){
  const open=ease(b,2.3,3.15),pull=ease(b,7.0,2.7);
  front.position.set(.20+open*.92,.10+open*.11,-2.55*pull);
  front.rotation.x=ease(b,.4,2.0)*.48+open*.63;
  gate.position.set(-.63,.10,open*.18+pull*.68);
  camera.position.fromArray(poses([[0,[3.07,.14,.014]],[2.1,[3.29,.2,.24]],[5.65,[4.35,1.2,3.34]],[8.35,[4.74,1.23,3.95]],[10.95,[3.50,.52,1.58]],[14.65,[3.20,.23,1.01]],[16,[3.14,.22,1.0]]],b));
  camera.lookAt(...poses([[0,[0,.1,0]],[5.65,[-.08,.09,.1]],[10.95,[-.63,.11,.85]],[16,[-.63,.13,.88]]],b));
  camera.fov=31+2*open;
 }else{
  const cut=8.02;
  const tex=tx[b<cut?'chem-show':'chem-notes'];
  if(face.material.map!==tex){face.material.map=tex;face.material.needsUpdate=true}
  gloss.material.opacity=.68*(1-ease(b,.10,1.1))+.59*(ease(b,7.40,.55)-ease(b,8.02,.55));
  bar.position.y=1.19;
  camera.position.fromArray(poses([[0,[6.0,1.50,2.48]],[1.8,[5.37,.47,.64]],[5.1,[5.13,.22,.34]],[8.5,[5.26,.23,.30]],[12.1,[4.93,.13,.18]],[16,[4.86,.13,.13]]],b));
  camera.lookAt(0,0,0);camera.fov=31;
 }
 camera.updateProjectionMatrix();renderer.render(scene,camera);return renderer.domElement;
};
