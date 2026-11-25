const {chromium}=require('playwright');const http=require('http'),fs=require('fs');
const FILE='/home/user/Nasa-office/deliverables/hamza-spatial-pitch-studio/HAMZA-Spatial-Pitch-Studio-V1.html';
const srv=http.createServer((q,r)=>{r.setHeader('content-type','text/html');fs.createReadStream(FILE).pipe(r);}).listen(0);
const STUB=`export const FilesetResolver={forVisionTasks:async()=>({})};
export const HandLandmarker={createFromOptions:async()=>({detectForVideo:()=>{const hs=window.__fakeHands||[];return {landmarks:hs.map(h=>h.lm),handedness:hs.map(h=>[{categoryName:h.side,score:.95}]),worldLandmarks:[]};}})};`;
const mode=process.argv[2];
(async()=>{
 const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--enable-unsafe-swiftshader']});
 const vp=mode==='touch'?{width:1440,height:900}:{width:640,height:400};
 const p=await (await b.newContext({viewport:vp})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route('**/vision_bundle.mjs',r=>r.fulfill({contentType:'text/javascript',body:STUB}));await p.addInitScript({path:'hand.js'});
 await p.goto(`http://localhost:${srv.address().port}/`);await p.waitForTimeout(1200);
 const scr=(t,i)=>p.evaluate(([t,i])=>{const I=window.__ironoj,m=I.towers.list[t].screens[i].mesh,v=m.getWorldPosition(new m.position.constructor()).project(I.camera);return {x:Math.round((v.x+1)*innerWidth/2),y:Math.round((1-v.y)*innerHeight/2)};},[t,i]);
 const tw=(i)=>p.evaluate((i)=>{const q=window.__ironoj.towers.list[i];return {x:+q.off.x.toFixed(3),y:+q.off.y.toFixed(3),mul:+q.mul.toFixed(3),yaw:+q.yawAdd.toFixed(3),held:q.held,lit:q.screens.filter(s=>s.until>performance.now()).map(s=>s.k)};},i);
 const o={};
 if(mode==='touch'){
  await p.click('#try');await p.waitForTimeout(2000);
  const s=await scr(0,2);await p.mouse.click(s.x,s.y);await p.waitForTimeout(400);o.mouseTapOnBlueprint=await tw(0);
  await p.mouse.click(s.x,s.y);await p.waitForTimeout(300);o.secondTapTurnsOff=(await tw(0)).lit;
 } else {
  await p.click('#live');await p.waitForFunction(()=>window.__ironoj.mode==='core',null,{timeout:20000});await p.waitForTimeout(1000);if(!(await p.evaluate(()=>window.__ironoj.towers.on)))await p.click('#bTow');o.towersOn=await p.evaluate(()=>window.__ironoj.towers.on);
  const setH=(arr)=>p.evaluate((a)=>{window.__fakeHands=a.map(h=>window.__hand(h.x,h.y,h.pinch,h.side));},arr);
  const hold=async(arr,ms)=>{for(let k=0;k<Math.ceil(ms/60);k++){await setH(arr);await p.waitForTimeout(60);}};
  const t=await scr(0,2);
  await hold([{x:t.x,y:t.y,pinch:false}],700);await hold([{x:t.x,y:t.y,pinch:true}],600);
  o.grab=await tw(0);o.hint=await p.$eval('#hint',e=>e.textContent);
  for(let k=1;k<=10;k++)await hold([{x:t.x+8*k,y:t.y-3*k,pinch:true}],70);await hold([{x:t.x+80,y:t.y-30,pinch:true}],500);
  o.carried=await tw(0);o.coreXduringTower=await p.evaluate(()=>window.__ironoj.S.x);
  await p.screenshot({path:'shots/h1-holding-tower.png'});
  await hold([{x:t.x+80,y:t.y-30,pinch:false}],600);o.released=await tw(0);
  const s=await scr(0,3);await hold([{x:s.x,y:s.y,pinch:false}],600);await hold([{x:s.x,y:s.y,pinch:true}],180);await hold([{x:s.x,y:s.y,pinch:false}],600);
  o.quickPinch=await tw(0);
  const A=await scr(1,1),Bb=await scr(1,3);o.twoHandStart={A,B:Bb};
  const H2=(da,db,pin)=>[{x:A.x,y:A.y-da,pinch:pin,side:'Left'},{x:Bb.x,y:Bb.y+db,pinch:pin,side:'Right'}];
  await hold(H2(0,0,false),700);await hold(H2(0,0,true),600);
  o.pair=await p.evaluate(()=>{const q=window.__ironoj.pair;return q?{tw:q.tw}:null;});const mb=(await tw(1)).mul;
  for(let k=1;k<=8;k++)await hold(H2(5*k,5*k,true),70);await hold(H2(40,40,true),500);
  o.twoHand={mulBefore:mb,right:await tw(1),coreSpread:await p.evaluate(()=>window.__ironoj.S.spread)};
  await hold(H2(40,40,false),600);
  const tb=await tw(0),tb1=await tw(1);
  await hold([{x:320,y:200,pinch:false}],600);await hold([{x:320,y:200,pinch:true}],500);
  for(let k=1;k<=8;k++)await hold([{x:320-6*k,y:200,pinch:true}],70);await hold([{x:272,y:200,pinch:true}],500);
  o.coreOwner={coreX:+(await p.evaluate(()=>window.__ironoj.S.x)).toFixed(3),towerLeftUnchanged:JSON.stringify((await tw(0)).x)===JSON.stringify(tb.x),towerRightUnchanged:(await tw(1)).x===tb1.x};
  await hold([{x:272,y:200,pinch:false}],400);
  await p.screenshot({path:'shots/h2-after.png'});
 }
 o.errors=errs;console.log(mode,JSON.stringify(o));await b.close();srv.close();
})().catch(e=>{console.error(e);process.exit(1);});
