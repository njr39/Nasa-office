const {chromium}=require('playwright');const http=require('http'),fs=require('fs');
const FILE='/home/user/Nasa-office/deliverables/hamza-spatial-pitch-studio/HAMZA-Spatial-Pitch-Studio-V1.html';
const OUT=process.argv[2];
const srv=http.createServer((q,r)=>{r.setHeader('content-type','text/html');fs.createReadStream(FILE).pipe(r);}).listen(0);
(async()=>{
 const port=srv.address().port;
 const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const ctx=await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push('pageerror '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('console '+m.text());});
 await p.addInitScript(()=>{ // SIMULATED speech recognition
  window.webkitSpeechRecognition=window.SpeechRecognition=function(){const s=this;window.__sr=s;s.start=()=>{s.started=true;s.onstart&&s.onstart();};s.abort=s.stop=()=>{s.started=false;s.onend&&s.onend();};};
  window.__emit=(items,idx=0)=>{const res=items.map(([t,f])=>{const r=[{transcript:t}];r.isFinal=f;return r;});window.__sr.onresult({resultIndex:idx,results:res});};
 });
 await p.goto(`http://localhost:${port}/`);await p.waitForTimeout(1500);
 const out={};
 out.title=await p.title();
 out.webgl=await p.evaluate(()=>!!document.createElement('canvas').getContext('webgl2'));
 out.barHiddenAtHome=await p.$eval('#spx',e=>e.hidden);
 await p.click('#try');await p.waitForTimeout(2500);
 out.mode=await p.evaluate(()=>window.__ironoj.mode);
 out.barVisible=await p.waitForFunction(()=>!document.getElementById('spx').hidden,null,{timeout:3000}).then(()=>true).catch(()=>false);
 out.lens=await p.evaluate(()=>!!window.__ironoj.lens);
 out.uni=await p.evaluate(()=>{const u=window.__ironoj.lens.uniforms;return {warm:u.uWarm.value,con:u.uCon.value,sat:u.uSat.value,grain:u.uGrain.value,vig:u.uVig.value};});
 out.bloom=await p.evaluate(()=>{const b=window.__ironoj.bloom;return {s:b.strength,r:b.radius,t:b.threshold};});
 await p.screenshot({path:OUT+'/c1-grade-on.png'});
 await p.click('#bGrade');await p.waitForTimeout(500);
 out.uniOff=await p.evaluate(()=>{const u=window.__ironoj.lens.uniforms;return {warm:u.uWarm.value,con:u.uCon.value,sat:u.uSat.value,grain:u.uGrain.value,vig:u.uVig.value};});
 await p.screenshot({path:OUT+'/c2-grade-off.png'});
 await p.click('#bGrade');
 // live captions
 await p.click('#bLive');await p.waitForTimeout(300);
 out.liveOn=await p.evaluate(()=>window.__spatial.liveOn&&window.__sr.started&&document.body.classList.contains('livecap'));
 await p.evaluate(()=>window.__emit([['our SOPs',false]]));await p.waitForTimeout(200);
 out.interim={txt:await p.$eval('#lcap',e=>e.textContent.trim()),act:await p.$eval('#lcap .act',e=>e.textContent),lit:await p.evaluate(()=>window.__ironoj.towers.list.flatMap(q=>q.screens.filter(s=>s.until>performance.now()).map(s=>s.k)))};
 await p.evaluate(()=>window.__emit([['our SOPs and the RACI are ready',true],['precision isn\'t optional',false]]));await p.waitForTimeout(300);
 out.final={txt:await p.$eval('#lcap',e=>e.textContent.trim()),finals:await p.$$eval('#lcap .f',e=>e.length),lit:await p.evaluate(()=>window.__ironoj.towers.list.flatMap(q=>q.screens.filter(s=>s.until>performance.now()).map(s=>s.k)))};
 await p.screenshot({path:OUT+'/c3-live-en.png'});
 await p.click('#bLang');await p.waitForTimeout(200);
 out.langBtn=await p.$eval('#bLang',e=>e.textContent);out.srLang=await p.evaluate(()=>window.__sr.lang);
 await p.evaluate(()=>window.__emit([['ليه البيزنس مايبقاش بالدقة دي',false]]));await p.waitForTimeout(300);
 out.ar={dir:await p.$eval('#lcap .ln',e=>e.dir),lang:await p.$eval('#lcap .ln',e=>e.lang),font:await p.$eval('#lcap .ln',e=>getComputedStyle(e).fontFamily.slice(0,20)),lit:await p.evaluate(()=>window.__ironoj.towers.list.flatMap(q=>q.screens.filter(s=>s.until>performance.now()).map(s=>s.k)))};
 await p.screenshot({path:OUT+'/c4-live-ar.png'});
 // restart on end, error handling
 await p.evaluate(()=>window.__sr.onend&&window.__sr.onend());await p.waitForTimeout(700);
 out.restarted=await p.evaluate(()=>window.__sr&&window.__sr.started===true);
 await p.evaluate(()=>window.__sr.onerror({error:'not-allowed'}));await p.waitForTimeout(200);
 out.denied={live:await p.evaluate(()=>window.__spatial.liveOn),msg:await p.$eval('#lstat',e=>e.textContent),fixedCapsBack:await p.evaluate(()=>!document.body.classList.contains('livecap'))};
 // towers toggle
 await p.click('#bTow');out.towersHidden=await p.evaluate(()=>!window.__ironoj.towers.list[0].g.visible);
 await p.click('#bTow');out.towersShown=await p.evaluate(()=>window.__ironoj.towers.list[0].g.visible);
 // narrow viewport
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(300);
 
 await p.screenshot({path:OUT+'/c5-mobile.png'});
 // exit stops live
 await p.setViewportSize({width:1440,height:900});await p.click('#bLive');await p.click('#exitLive');await p.waitForTimeout(900);
 out.afterExit={bar:await p.$eval('#spx',e=>e.hidden),live:await p.evaluate(()=>window.__spatial.liveOn)};
 out.errors=errs;
 console.log(JSON.stringify(out,null,1));
 await b.close();srv.close();
})();
