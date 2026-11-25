/* ---------- screen towers: two wrought-iron racks of tilted screens, real 3D in the Core's scene ----------
   Reference: 39's installation photo (two black iron frames, five tilted screens each, scrollwork top and bottom).
   One owner per gesture: a pinch that starts on a tower moves that tower; both hands on one tower resize and turn it. */
var TW_DEF={L:{side:-1,yaw:.38,screens:[
   {k:"intent",t:"INTENT",tilt:.32,rz:-.1,warm:1},{k:"context",t:"CONTEXT",tilt:-.15,rz:.04,warm:1},{k:"blueprint",t:"BLUEPRINT",tilt:0,rz:0,warm:0},
   {k:"raci",t:"RACI",s:"Responsible · Accountable · Consulted · Informed",tilt:-.3,rz:0,warm:1},{k:"sops",t:"SOPs",s:"Standard operating procedures",tilt:-.85,rz:0,warm:0}]},
 R:{side:1,yaw:-.38,screens:[
   {k:"operate",t:"OPERATE",tilt:.2,rz:0,warm:0},{k:"build",t:"BUILD",tilt:-.1,rz:0,warm:0},{k:"validate",t:"VALIDATE",tilt:.08,rz:0,warm:1},
   {k:"unmade",t:"UNMADE",tilt:-.2,rz:0,warm:0},{k:"precision",t:"PRECISION",tilt:-.6,rz:0,warm:0}]}};   // screens listed top to bottom
var TW_H=3.4,TW_W=.95,TW_D=.42,TW_Z=-1.2,TW_LIT_MS=5000,TWS=[],towersOn=innerWidth>=730,twRay=new THREE.Raycaster(),twNdc=new THREE.Vector2();
var ironMat=new THREE.MeshStandardMaterial({color:0x0b0d10,metalness:.85,roughness:.38,envMapIntensity:1.1});
var bezelMat=new THREE.MeshStandardMaterial({color:0x050608,metalness:.4,roughness:.5});
function twBar(a,b,r){var d=b.clone().sub(a),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),8),ironMat);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());return m;}
function twScroll(cx,cy,z,r,turns,dir,up){var pts=[];for(var i=0;i<=36;i++){var u=i/36,a=u*turns*TAU,rr=r*(1-u*.82);pts.push(V(cx+Math.cos(a)*rr*dir,cy+Math.sin(a)*rr*up,z));}
 return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),40,.007,6,false),ironMat);}
function twLabel(sc,i){var c=sc.cv||(sc.cv=document.createElement("canvas"));c.width=512;c.height=320;var g=c.getContext("2d");g.clearRect(0,0,512,320);
 g.fillStyle="rgba(0,0,0,.28)";g.fillRect(0,200,512,120);
 g.fillStyle="#b4ddff";g.font="400 24px 'JetBrains Mono',monospace";g.fillText("0"+(i+1),26,44);
 g.fillStyle="#ffffff";g.font="400 64px JaapokkiSubtract,Vonca,sans-serif";g.fillText(sc.t,26,sc.s?262:282);
 if(sc.s){g.fillStyle="rgba(238,244,247,.8)";g.font="500 22px Vonca,sans-serif";g.fillText(sc.s,28,298);}
 if(sc.tex)sc.tex.needsUpdate=true;return c;}
function twScreenMat(sc,i,seed){sc.tex=new THREE.CanvasTexture(twLabel(sc,i));sc.tex.minFilter=THREE.LinearFilter;
 var A=sc.warm?new THREE.Color(1.,.62,.28):new THREE.Color(.32,.6,1.),B=sc.warm?new THREE.Color(.95,.35,.45):new THREE.Color(.12,.2,.55);
 return new THREE.ShaderMaterial({uniforms:{tL:{value:sc.tex},uT:{value:0},uOn:{value:0},uSel:{value:0},uSeed:{value:seed},uA:{value:A},uB:{value:B}},
  vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
  fragmentShader:"uniform sampler2D tL;uniform float uT,uOn,uSel,uSeed;uniform vec3 uA,uB;varying vec2 vUv;"+
   "float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}"+
   "float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}"+
   "float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*n(p);p*=2.1;a*=.5;}return s;}"+
   "void main(){vec2 uv=vUv,p=uv*vec2(3.2,2.)+uSeed;float t=uT*.05;"+
   "float m=fbm(p+vec2(t,-t*.6)+fbm(p*1.7-t)*1.4);"+
   "float st=pow(max(0.,1.-abs(uv.y-.5-.22*sin(uv.x*3.+uSeed+uT*.1))*3.2),3.);"+
   "vec3 c=mix(uB*.18,uA,smoothstep(.35,.88,m))+uA*st*.55;c*=mix(.5,1.2,uOn);"+
   "vec4 L=texture2D(tL,uv);c=mix(c,L.rgb,L.a*(.85+.15*uOn));"+
   "float e=max(max(1.-smoothstep(0.,.02,uv.x),1.-smoothstep(0.,.02,1.-uv.x)),max(1.-smoothstep(0.,.03,uv.y),1.-smoothstep(0.,.03,1.-uv.y)));"+
   "c+=vec3(.37,.88,1.)*e*(uOn*1.3+uSel*.9);gl_FragColor=vec4(c,1.);}"});}
function buildTower(def,ti){
 var g=new THREE.Group(),w=TW_W/2,d=TW_D/2,H=TW_H,k;scene.add(g);
 [[-w,-d],[w,-d],[-w,d],[w,d]].forEach(function(c){g.add(twBar(V(c[0],0,c[1]),V(c[0]*1.04,H,c[1]),.014));});   // posts, a little wider at the top
 [.08,H].forEach(function(y){var ww=y>1?w*1.04:w;g.add(twBar(V(-ww,y,d),V(ww,y,d),.011));g.add(twBar(V(-ww,y,-d),V(ww,y,-d),.011));g.add(twBar(V(-ww,y,-d),V(-ww,y,d),.011));g.add(twBar(V(ww,y,-d),V(ww,y,d),.011));});
 [-1,1].forEach(function(sx){g.add(twBar(V(sx*w,.08,d),V(sx*w,.75,-d),.009));g.add(twBar(V(sx*w,.08,-d),V(sx*w,.75,d),.009));});   // crossed braces at the foot
 for(k=0;k<5;k++){var xx=-w*.8+k*w*.4;g.add(twScroll(xx,H-.09,d,.07,1.6,k%2?1:-1,-1));}   // scroll row under the top rail
 [-1,1].forEach(function(sx){g.add(twScroll(sx*w*.86,H+.1,d,.09,1.7,-sx,1));g.add(twScroll(sx*w*.86,.2,d,.08,1.6,-sx,-1));g.add(twScroll(sx*w*.6,.18,d,.06,1.5,sx,-1));});
 var hit=new THREE.Mesh(new THREE.BoxGeometry(TW_W*1.15,H*1.05,TW_D+.5),new THREE.MeshBasicMaterial({visible:false}));hit.position.y=H/2;g.add(hit);
 var sw=.86,sh=.52,screens=[];
 def.screens.forEach(function(sc,i){var y=H-.42-i*.63,s=new THREE.Group();s.position.set(0,y,.06);s.rotation.set(sc.tilt,0,sc.rz);g.add(s);
  var bz=new THREE.Mesh(new THREE.BoxGeometry(sw+.05,sh+.05,.035),bezelMat);s.add(bz);
  var mat=twScreenMat(sc,i,ti*7.3+i*1.9),m=new THREE.Mesh(new THREE.PlaneGeometry(sw,sh),mat);m.position.z=.019;s.add(m);
  g.add(twBar(V(-w,y-sh*.42,.06),V(w,y-sh*.42,.06),.008));   // the shelf bar each screen rests on
  screens.push({k:sc.k,def:sc,mesh:m,mat:mat,until:0,on:0,idx:i});});
 return {g:g,hit:hit,def:def,screens:screens,off:{x:0,y:0},mul:1,yawAdd:0,held:0,hover:0,sel:0,base:{x:0,y:0,s:1}};}
TWS=[buildTower(TW_DEF.L,0),buildTower(TW_DEF.R,1)];
if(document.fonts&&document.fonts.load)Promise.all([document.fonts.load("64px JaapokkiSubtract"),document.fonts.load("22px Vonca"),document.fonts.load("24px 'JetBrains Mono'")]).then(function(){TWS.forEach(function(q){q.screens.forEach(function(s,i){twLabel(s.def,i);s.def.tex.needsUpdate=true;});});}).catch(function(){});
function twVisible(){return towersOn&&mode!=="home";}
function towersLayout(){var k=(camera.position.z-TW_Z)/camera.position.z,vh=VH*k,vw=VW*k;
 TWS.forEach(function(q){var s=cl(.74*vh/TW_H,.3,2.2);q.base.s=s;q.base.x=q.def.side*(vw/2-TW_W*s*.55-vw*.05);q.base.y=-vh*.37;});}
function twRaycast(px,py,objs){twNdc.set(px/W()*2-1,-(py/H())*2+1);twRay.setFromCamera(twNdc,camera);return twRay.intersectObjects(objs,false);}
function towerAt(px,py){if(!twVisible())return -1;var h=twRaycast(px,py,TWS.map(function(q){return q.hit;}));if(!h.length)return -1;for(var i=0;i<TWS.length;i++)if(TWS[i].hit===h[0].object)return i;return -1;}
function towerLight(key){var t=performance.now();TWS.forEach(function(q){q.screens.forEach(function(s){if(s.k===key)s.until=t+TW_LIT_MS;});});}
function towerTap(i,px,py){var q=TWS[i],h=twRaycast(px,py,q.screens.map(function(s){return s.mesh;}));if(!h.length)return;
 q.screens.forEach(function(s){if(s.mesh===h[0].object)s.until=s.until>performance.now()?0:performance.now()+TW_LIT_MS*2;});}   // a quick pinch on a lit screen turns it off
function towerMove(tr,g){var q=TWS[g.tower],k=(camera.position.z-TW_Z)/camera.position.z,dx=tr.px-g.sx,dy=tr.py-g.sy;if(Math.hypot(dx,dy)>g.moved)g.moved=Math.hypot(dx,dy);
 q.off.x=g.bx+dx*VW*k/W();q.off.y=g.by-dy*VH*k/H();
 if(tr.kind==="hand"){q.mul=cl(g.bm*cl(tr.size/g.bsize,.6,1.7),.45,2);q.yawAdd=cl(g.byaw+Math.atan2(Math.sin(tr.angle-g.bang),Math.cos(tr.angle-g.bang)),-1.3,1.3);}}
function towerGrab(tr,i){var q=TWS[i];q.held++;tr.grab={tower:i,sx:tr.px,sy:tr.py,bx:q.off.x,by:q.off.y,bm:q.mul,bsize:tr.size,bang:tr.angle,byaw:q.yawAdd,t0:performance.now(),moved:0};}
function towerRelease(tr){var g=tr.grab,q=TWS[g.tower];q.held=Math.max(0,q.held-1);if(performance.now()-g.t0<350&&g.moved<28)towerTap(g.tower,g.sx,g.sy);}
function towerPair(p,a,b,dist,ang){var q=TWS[p.tw],k=(camera.position.z-TW_Z)/camera.position.z;
 q.mul=cl(p.mul*dist/p.dist,.45,2);q.yawAdd=cl(p.yaw+Math.atan2(Math.sin(ang-p.ang),Math.cos(ang-p.ang)),-1.3,1.3);
 q.off.x=p.x+((a.px+b.px)/2-p.mx)*VW*k/W();q.off.y=p.y-((a.py+b.py)/2-p.my)*VH*k/H();}
function towersReset(){if(!TWS.length)return;TWS.forEach(function(q){q.off.x=q.off.y=0;q.mul=1;q.yawAdd=0;q.held=0;});}
function towersFrame(dt,t){var vis=twVisible(),now=performance.now(),e=1-Math.exp(-dt*10);towersLayout();
 var hov=[0,0];if(vis)handT.forEach(function(tr){if(tr.visible&&!tr.down){var i=towerAt(tr.px,tr.py);if(i>=0)hov[i]=1;}});
 TWS.forEach(function(q,i){q.g.visible=vis;if(!vis)return;var s=q.base.s*q.mul;
  q.g.position.set(q.base.x+q.off.x,q.base.y+q.off.y,TW_Z);q.g.scale.setScalar(s);q.g.rotation.y=q.def.yaw+q.yawAdd;
  q.sel+=((q.held?1:hov[i]*.35)-q.sel)*e;
  q.screens.forEach(function(sc){var target=sc.until>now?1:0;sc.on+=(target-sc.on)*e;sc.mat.uniforms.uOn.value=sc.on;sc.mat.uniforms.uSel.value=q.sel;sc.mat.uniforms.uT.value=reduced?0:t%1000;});});}
