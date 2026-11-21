// Smoothly bent sheets, lit from the upper left. Perspective division happens after
// curling and rotation, so overlapping sheets have independent silhouettes and depth.
export function makePress(){
 const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
 const gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:true});
 if(!gl)throw Error('WebGL is required to render the paper stage');
 const vs=`attribute vec2 uv; varying vec2 coord; varying float shade;
 uniform vec2 center,size;uniform vec4 pose;uniform float elevation;
 void main(){
 vec2 p=(uv-.5)*size;float phi=pose.w*(uv.x-.18);
 float bend=pose.w;float u=uv.x-.18;
 if(abs(bend)>.001)p.x=(sin(bend*u)/bend-.32)*size.x;
 float z=(abs(bend)>.001?(1.-cos(phi))/bend:0.)*size.x;
 float x=p.x*cos(pose.y)+z*sin(pose.y);z=-p.x*sin(pose.y)+z*cos(pose.y);
 float y=p.y*cos(pose.x)-z*sin(pose.x); z=p.y*sin(pose.x)+z*cos(pose.x);
 vec2 r=mat2(cos(pose.z),sin(pose.z),-sin(pose.z),cos(pose.z))*vec2(x,y);
 float depth=1.-(z+elevation)/2250.;
 gl_Position=vec4((center-vec2(960.,540.)+r)/vec2(960.,-540.),0.,depth);
 coord=uv;shade=1.-.115*abs(sin(phi+pose.y))-.046*max(0.,sin(pose.x));}`;
 const fs=`precision highp float;varying vec2 coord;varying float shade;uniform sampler2D sheet;uniform vec2 size;
 void main(){vec2 p=abs((coord-.5)*size)-(size*.5-12.);float sd=length(max(p,0.))+min(max(p.x,p.y),0.)-12.;if(sd>0.)discard;
 vec3 col=texture2D(sheet,coord).rgb;col=mix(col,vec3(.66,.69,.64),.28*(1.-smoothstep(0.,2.5,-sd)));gl_FragColor=vec4(col*shade,1.);}`;
 function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
 const prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,vs));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));gl.useProgram(prog);
 const rows=5,cols=60,verts=[];
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++)for(const [a,b] of [[0,0],[1,0],[0,1],[1,0],[1,1],[0,1]])verts.push((i+a)/cols,(j+b)/rows);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);
 const attrib=gl.getAttribLocation(prog,'uv');gl.enableVertexAttribArray(attrib);gl.vertexAttribPointer(attrib,2,gl.FLOAT,false,0,0);
 const loc=Object.fromEntries(['center','size','pose','elevation'].map(n=>[n,gl.getUniformLocation(prog,n)]));const cache=new Map();
 function texture(key,source){
  if(cache.has(key))return cache.get(key);
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
  for(const n of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,n,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);cache.set(key,tex);return tex;
 }
 return {canvas,clear(){gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT)},draw(key,source,x,y,w,h,rx,ry,rz,curl,z=0){
  gl.bindTexture(gl.TEXTURE_2D,texture(key,source));gl.uniform2f(loc.center,x,y);gl.uniform2f(loc.size,w,h);gl.uniform4f(loc.pose,rx,ry,rz,curl);gl.uniform1f(loc.elevation,z);gl.drawArrays(gl.TRIANGLES,0,verts.length/2);
 }};
}
