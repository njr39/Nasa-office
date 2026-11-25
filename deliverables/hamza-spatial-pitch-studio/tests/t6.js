const {chromium}=require('playwright');const http=require('http'),fs=require('fs');
const FILE='/home/user/Nasa-office/deliverables/hamza-spatial-pitch-studio/HAMZA-Spatial-Pitch-Studio-V1.html';
const srv=http.createServer((q,r)=>{r.setHeader('content-type','text/html');fs.createReadStream(FILE).pipe(r);}).listen(0);
const STUB=`export const FilesetResolver={forVisionTasks:async()=>({})};
export const HandLandmarker={createFromOptions:async()=>({detectForVideo:()=>{const hs=window.__fakeHands||[];return {landmarks:hs.map(h=>h.lm),handedness:hs.map(h=>[{categoryName:h.side,score:.95}]),worldLandmarks:[]};}})};`;
(async()=>{
 const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:640,height:400}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route('**/vision_bundle.mjs',r=>r.fulfill({contentType:'text/javascript',body:STUB}));await p.addInitScript({path:'hand.js'});
 await p.goto(`http://localhost:${srv.address().port}/`);await p.waitForTimeout(1200);
 const o={};
 await p.click('#live');await p.waitForFunction(()=>window.__ironoj.mode==='core',null,{timeout:20000});await p.waitForTimeout(1000);
 if(!(await p.evaluate(()=>window.__ironoj.towers.on)))await p.click('#bTow');
 const scr=(t,i)=>p.evaluate(([t,i])=>{const I=window.__ironoj,m=I.towers.list[t].screens[i].mesh,v=m.getWorldPosition(new m.position.constructor()).project(I.camera);return {x:Math.round((v.x+1)*innerWidth/2),y:Math.round((1-v.y)*innerHeight/2)};},[t,i]);
 const tw=(i)=>p.evaluate((i)=>{const q=window.__ironoj.towers.list[i];return {x:+q.off.x.toFixed(3),y:+q.off.y.toFixed(3),mul:+q.mul.toFixed(3),held:q.held,lit:q.screens.filter(s=>s.until>performance.now()).map(s=>s.k)};},i);
 const gest=()=>p.evaluate(()=>{const g=document.getElementById('twgest');return g&&g.classList.contains('on')?g.textContent:'';});
 const setH=(arr)=>p.evaluate((a)=>{window.__fakeHands=a.map(h=>window.__hand(h.x,h.y,h.pose,h.side));},arr);
 const hold=async(arr,ms)=>{for(let k=0;k<Math.ceil(ms/60);k++){await setH(arr);await p.waitForTimeout(60);}};
 const T0=await scr(0,2);
 // A. short pinch with a small wobble (<28 px, <350 ms) is a tap: selects, does not move
 await hold([{x:T0.x,y:T0.y,pose:false}],700);await hold([{x:T0.x,y:T0.y,pose:true}],120);await hold([{x:T0.x+6,y:T0.y,pose:true}],100);
 o.hintOver=await p.$eval('#hint',e=>e.textContent);
 await hold([{x:T0.x+6,y:T0.y,pose:false}],600);o.A_tap=await tw(0);
 await hold([{x:T0.x,y:T0.y,pose:false}],1000);   // let the 900 ms cooldown pass
 // B. pinch held still for 600 ms, then carried: moves only after the hold; size unchanged
 await hold([{x:T0.x,y:T0.y,pose:true}],250);o.B_early=await tw(0);
 await hold([{x:T0.x,y:T0.y,pose:true}],350);
 for(let k=1;k<=10;k++)await hold([{x:T0.x+8*k,y:T0.y-3*k,pose:true}],70);await hold([{x:T0.x+80,y:T0.y-30,pose:true}],400);
 o.B_carry={tw:await tw(0),label:await gest(),hint:await p.$eval('#hint',e=>e.textContent),coreX:await p.evaluate(()=>window.__ironoj.S.x)};
 await hold([{x:T0.x+80,y:T0.y-30,pose:false}],1100);o.B_after=await tw(0);
 // C. open-hand swipe left over the right tower -> next screen
 const R=await scr(1,2);
 await hold([{x:R.x,y:R.y,pose:false}],700);o.C_label=await gest();
 for(let k=1;k<=2;k++)await hold([{x:R.x-110*k,y:R.y,pose:false}],30);
 o.C_swipe={lit:(await tw(1)).lit,label:await gest(),coreSpread:await p.evaluate(()=>window.__ironoj.S.spread)};
 await hold([{x:R.x-220,y:R.y,pose:false}],300);await p.evaluate(()=>{window.__fakeHands=[];});await p.waitForTimeout(1200);
 await hold([{x:R.x,y:R.y,pose:false}],700);for(let k=1;k<=2;k++)await hold([{x:R.x-110*k,y:R.y,pose:false}],30);o.C_swipe2=(await tw(1)).lit;
 await p.evaluate(()=>{window.__fakeHands=[];});await p.waitForTimeout(1200);
 // D. fist held 0.9 s over the right tower clears it
 await p.evaluate(()=>window.__ironoj.towers.light('unmade'));o.D_before=(await tw(1)).lit;await hold([{x:R.x,y:R.y,pose:false}],500);await hold([{x:R.x,y:R.y,pose:'fist'}],500);o.D_mid={label:await gest(),lit:(await tw(1)).lit,held:(await tw(1)).held};
 await hold([{x:R.x,y:R.y,pose:'fist'}],900);o.D_after={lit:(await tw(1)).lit,label:await gest(),towerMoved:(await tw(1)).x};
 await hold([{x:R.x,y:R.y,pose:false}],1100);
 // E. two hands on one tower resize it
 const A=await scr(1,1),B=await scr(1,3),H2=(d,pin)=>[{x:A.x,y:A.y-d,pose:pin,side:'Left'},{x:B.x,y:B.y+d,pose:pin,side:'Right'}];
 await hold(H2(0,false),700);await hold(H2(0,true),500);const m0=(await tw(1)).mul;
 for(let k=1;k<=8;k++)await hold(H2(5*k,true),70);await hold(H2(40,true),400);
 o.E_two={pair:await p.evaluate(()=>window.__ironoj.pair&&window.__ironoj.pair.tw),mulBefore:m0,mulAfter:(await tw(1)).mul,label:await gest(),coreSpread:await p.evaluate(()=>window.__ironoj.S.spread)};
 await hold(H2(40,false),700);
 // F. pinch on the Core still moves the Core only
 const tb=await tw(0);await hold([{x:320,y:200,pose:false}],600);await hold([{x:320,y:200,pose:true}],500);
 for(let k=1;k<=8;k++)await hold([{x:320-6*k,y:200,pose:true}],70);await hold([{x:272,y:200,pose:true}],400);
 o.F_core={coreX:+(await p.evaluate(()=>window.__ironoj.S.x)).toFixed(3),towerUnchanged:(await tw(0)).x===tb.x};
 await hold([{x:272,y:200,pose:false}],300);
 await p.screenshot({path:'shots/g1-hands.png'});
 o.errors=errs;console.log(JSON.stringify(o,null,1));await b.close();srv.close();
})().catch(e=>{console.error(e);process.exit(1);});
