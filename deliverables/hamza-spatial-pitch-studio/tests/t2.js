const {chromium}=require('playwright');const http=require('http'),fs=require('fs');
const FILE='/home/user/Nasa-office/deliverables/hamza-spatial-pitch-studio/HAMZA-Spatial-Pitch-Studio-V1.html';
const srv=http.createServer((q,r)=>{r.setHeader('content-type','text/html');fs.createReadStream(FILE).pipe(r);}).listen(0);
(async()=>{
 const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route('**/vision_bundle.mjs',r=>r.fulfill({contentType:'text/javascript',body:'export const FilesetResolver={forVisionTasks:async()=>({})};export const HandLandmarker={createFromOptions:async()=>({detectForVideo:()=>({landmarks:[],handedness:[],worldLandmarks:[]})})};'}));
 await p.goto(`http://localhost:${srv.address().port}/`);await p.waitForTimeout(1500);
 await p.click('#live');
 const ok=await p.waitForFunction(()=>window.__ironoj.mode==='core',null,{timeout:20000}).then(()=>true).catch(()=>false);
 await p.waitForTimeout(2500);
 const o={mode:await p.evaluate(()=>window.__ironoj.mode),errText:await p.$eval('#err',e=>e.textContent),
  cam:await p.evaluate(()=>{const v=window.__ironoj.camVideo;if(!v)return null;const t=v.srcObject.getVideoTracks()[0];return {settings:t.getSettings(),videoW:v.videoWidth,videoH:v.videoHeight};}),
  readout:await p.$eval('#cstat',e=>e.textContent),
  barVisible:await p.$eval('#spx',e=>!e.hidden)};
 await p.screenshot({path:'shots/s6-camera-fake.png'});
 console.log(JSON.stringify({ok,o,errs},null,1));await b.close();srv.close();
})();
