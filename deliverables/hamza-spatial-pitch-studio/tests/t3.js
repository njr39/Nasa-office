const {chromium}=require('playwright');const http=require('http'),fs=require('fs');
const FILE='/home/user/Nasa-office/deliverables/hamza-spatial-pitch-studio/HAMZA-Spatial-Pitch-Studio-V1.html';
const srv=http.createServer((q,r)=>{r.setHeader('content-type','text/html');fs.createReadStream(FILE).pipe(r);}).listen(0);
const STUB=`export const FilesetResolver={forVisionTasks:async()=>({})};
export const HandLandmarker={createFromOptions:async()=>({detectForVideo:()=>{const hs=window.__fakeHands||[];return {landmarks:hs.map(h=>h.lm),handedness:hs.map(h=>[{categoryName:h.side,score:.95}]),worldLandmarks:[]};}})};`;
(async()=>{
 const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route('**/vision_bundle.mjs',r=>r.fulfill({contentType:'text/javascript',body:STUB}));
 await p.addInitScript(()=>{ // synthetic hand: normalized landmarks around a screen point
  const B=[[0,.10],[-.03,.07],[-.05,.04],[-.065,.015],[-.075,-.01],[-.025,0],[-.03,-.04],[-.032,-.065],[-.034,-.09],[0,-.005],[0,-.05],[0,-.08],[0,-.105],[.022,0],[.025,-.04],[.027,-.065],[.028,-.088],[.042,.008],[.047,-.025],[.05,-.045],[.052,-.065]];
  window.__hand=(px,py,pinch,side,scale)=>{const v=window.__ironoj.camVideo,va=v.videoWidth/v.videoHeight,asp=innerWidth/innerHeight,AX=Math.max(1,va/asp),AY=Math.max(1,asp/va),s=scale||1;
   const cx=.5-(px/innerWidth-.5)/AX,cy=.5+(py/innerHeight-.5)/AY; // inverse of the page's mirror mapping, for the pinch point
   let lm=B.map(([x,y])=>({x:x*s,y:y*s,z:0}));if(pinch){lm[4]={x:lm[8].x+.004*s,y:lm[8].y+.004*s,z:0};}
   const mx=(lm[4].x+lm[8].x)/2,my=(lm[4].y+lm[8].y)/2; // put the pinch midpoint on the target
   return {side:side||'Right',lm:lm.map(q=>({x:cx+(-(q.x-mx)),y:cy+(q.y-my),z:0}))};}; // x flipped so the mirrored picture shows a right hand
 });
 const port=srv.address().port;await p.goto(`http://localhost:${port}/`);await p.waitForTimeout(1500);
 const o={};
 // ---------- 1. touch mode with the mouse ----------
 await p.click('#try');await p.waitForTimeout(2500);
 await p.screenshot({path:'shots/t1-towers-touch.png'});
 const findTower=async(i)=>p.evaluate((i)=>{for(let y=200;y<800;y+=20)for(let x=20;x<1420;x+=20)if(window.__ironoj.towers.at(x,y)===i)return {x,y};return null;},i);
 let L=await findTower(0),R=await findTower(1);o.towerHit={L,R};
 const tw0=()=>p.evaluate(()=>{const q=window.__ironoj.towers.list[0];return {x:+q.off.x.toFixed(3),y:+q.off.y.toFixed(3),mul:+q.mul.toFixed(3),held:q.held,lit:q.screens.filter(s=>s.until>performance.now()).map(s=>s.k)};});
 // drag the left tower 180 px right with the mouse
 const st=L?{x:L.x+30,y:L.y+150}:null;
 await p.mouse.move(st.x,st.y);await p.mouse.down();await p.waitForTimeout(100);o.mouseHeld=(await tw0()).held;
 for(let k=1;k<=10;k++){await p.mouse.move(st.x+18*k,st.y-6*k);await p.waitForTimeout(16);}await p.mouse.up();await p.waitForTimeout(400);
 o.afterMouseDrag=await tw0();const core0=await p.evaluate(()=>({x:window.__ironoj.S.x,y:window.__ironoj.S.y}));o.coreUnmovedByTowerDrag=core0;
 // wheel to resize
 const c2=await findTower(0);await p.mouse.move(c2.x+20,c2.y+100);for(let k=0;k<5;k++){await p.mouse.wheel(0,-100);await p.waitForTimeout(30);}await p.waitForTimeout(300);
 o.afterWheel=await tw0();
 // quick tap on a screen lights it
 const c3=await findTower(0);await p.mouse.click(c3.x+40,c3.y+200);await p.waitForTimeout(500);o.afterTap=await tw0();
 // keyword light from speech layer
 await p.evaluate(()=>window.__spatial.scan('our precision and the UNMADE system'));await p.waitForTimeout(600);
 o.rightLit=await p.evaluate(()=>window.__ironoj.towers.list[1].screens.filter(s=>s.until>performance.now()).map(s=>s.k));
 await p.screenshot({path:'shots/t2-moved-resized-lit.png'});
 // Reset button restores towers
 await p.click('#center');await p.waitForTimeout(300);o.afterReset=await tw0();
 // towers toggle
 await p.click('#bTow');await p.waitForTimeout(200);o.toggledOff=await p.evaluate(()=>!window.__ironoj.towers.on&&!window.__ironoj.towers.list[0].g.visible);await p.click('#bTow');
 await p.click('#exitLive');await p.waitForTimeout(800);
 // ---------- 2. camera mode with synthetic hands ----------
 await p.click('#live');await p.waitForFunction(()=>window.__ironoj.mode==='core',null,{timeout:20000});await p.waitForTimeout(1500);
 const setH=async(arr)=>{await p.evaluate((a)=>{window.__fakeHands=a.map(h=>window.__hand(h.x,h.y,h.pinch,h.side,h.s));},arr);};
 const hold=async(arr,ms)=>{const n=Math.ceil(ms/50);for(let k=0;k<n;k++){await setH(arr);await p.waitForTimeout(50);}};
 L=await findTower(0);const tgt={x:L.x+30,y:L.y+120};
 await hold([{x:tgt.x,y:tgt.y,pinch:false}],700);          // open hand over the tower
 o.handVisible=await p.$eval('#sigt',e=>e.textContent);
 await hold([{x:tgt.x,y:tgt.y,pinch:true}],600);            // pinch: grab
 o.handGrab=await tw0();
 for(let k=1;k<=12;k++)await hold([{x:tgt.x+15*k,y:tgt.y-5*k,pinch:true}],60);  // carry right and up
 await hold([{x:tgt.x+180,y:tgt.y-60,pinch:true}],500);
 o.hintWhileHolding=await p.$eval('#hint',e=>e.textContent);
 await p.screenshot({path:'shots/t3-hand-holding-tower.png'});
 await hold([{x:tgt.x+180,y:tgt.y-60,pinch:false}],600);    // release
 o.handAfterRelease=await tw0();
 // quick pinch on a screen of the moved tower
 L=await findTower(0);const sp={x:L.x+40,y:L.y+260};
 await hold([{x:sp.x,y:sp.y,pinch:false}],500);await hold([{x:sp.x,y:sp.y,pinch:true}],200);await hold([{x:sp.x,y:sp.y,pinch:false}],500);
 o.handTap=await tw0();
 // two hands pinching the same tower, then spread
 L=await findTower(0);const m={x:L.x+45,y:L.y+180};
 await hold([{x:m.x-15,y:m.y,pinch:false,side:'Left'},{x:m.x+15,y:m.y+40,pinch:false,side:'Right'}],700);
 await hold([{x:m.x-15,y:m.y,pinch:true,side:'Left'},{x:m.x+15,y:m.y+40,pinch:true,side:'Right'}],500);
 o.pairOnTower=await p.evaluate(()=>{const q=window.__ironoj.pair;return q?{tw:q.tw}:null;});
 const mul0=(await tw0()).mul;
 for(let k=1;k<=10;k++)await hold([{x:m.x-15-12*k,y:m.y,pinch:true,side:'Left'},{x:m.x+15+12*k,y:m.y+40,pinch:true,side:'Right'}],60);
 await hold([{x:m.x-135,y:m.y,pinch:true,side:'Left'},{x:m.x+135,y:m.y+40,pinch:true,side:'Right'}],400);
 o.twoHand={mulBefore:mul0,mulAfter:(await tw0()).mul,spreadCore:await p.evaluate(()=>window.__ironoj.S.spread)};
 await hold([{x:m.x-135,y:m.y,pinch:false,side:'Left'},{x:m.x+135,y:m.y+40,pinch:false,side:'Right'}],600);
 // pinch on the Core moves the Core, not the towers
 const before=await tw0(),cs=await p.evaluate(()=>({x:window.__ironoj.S.x}));
 const cc={x:720,y:450};await hold([{x:cc.x,y:cc.y,pinch:false}],600);await hold([{x:cc.x,y:cc.y,pinch:true}],400);
 for(let k=1;k<=8;k++)await hold([{x:cc.x-15*k,y:cc.y,pinch:true}],60);await hold([{x:cc.x-120,y:cc.y,pinch:true}],400);
 o.coreGrab={coreXBefore:+cs.x.toFixed(3),coreXAfter:+(await p.evaluate(()=>window.__ironoj.S.x)).toFixed(3),towerBefore:before.x,towerAfter:(await tw0()).x};
 await hold([{x:cc.x-120,y:cc.y,pinch:false}],400);
 await p.screenshot({path:'shots/t4-camera-mode.png'});
 o.errors=errs;console.log(JSON.stringify(o,null,1));await b.close();srv.close();
})().catch(e=>{console.error(e);process.exit(1);});
