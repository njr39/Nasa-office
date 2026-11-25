<script>
/* HAMZA Spatial Pitch Studio V1. Adds live captions, the tower controls and the camera grade on top of the
   original Core. It reads the Core only through window.__ironoj and never touches the camera, nodes,
   gloves or hand tracker. */
(function(){
"use strict";
var $=function(id){return document.getElementById(id);},core=window.__ironoj;
if(!core)return;

/* ---------- edit here ---------- */
// What the speaker says -> which tower screen lights. Screens and their words are set in TW_DEF in the Core script.
var KEYS=[["sops",/\bsops?\b|standard operating/i],["raci",/\braci\b/i],["precision",/precis|الدقة|دقة|دقه/i],["unmade",/\bunmade\b/i],
 ["blueprint",/blueprint/i],["validate",/validat/i],["intent",/\bintent/i],["context",/\bcontext/i],["build",/\bbuil[dt]/i],["operate",/\boperat/i]];
var GRADE={warm:.32,con:1.08,sat:.92,grain:.018,vig:.18};   // the cinematic grade
var GRADE_OFF={warm:0,con:1,sat:1,grain:.025,vig:1};        // the Core's own values, restored when Grade is off
var LANGS=[["en-US","EN"],["ar-EG","AR"]];                  // browser speech recognition language (no automatic switching)
var WIN=14;                                                  // words kept on screen

/* ---------- screen towers: 3D, built in the Core script; this only switches them and lights screens ---------- */
var TW=core.towers;
function light(k){if(TW)TW.light(k);}
function scan(text){KEYS.forEach(function(r){if(r[1].test(text))light(r[0]);});}
function setTowers(v){if(TW)TW.setVisible(v);$("bTow").classList.toggle("on",v);$("bTow").setAttribute("aria-pressed",String(v));}
$("bTow").onclick=function(){setTowers(!(TW&&TW.on));};

/* ---------- camera grade (uses the Core's own lens pass) ---------- */
var gradeOn=true,lens=core.lens;
function setGrade(v){gradeOn=v;var g=v?GRADE:GRADE_OFF;
 if(lens){var u=lens.uniforms;u.uWarm.value=g.warm;u.uCon.value=g.con;u.uSat.value=g.sat;u.uGrain.value=g.grain;u.uVig.value=g.vig;}
 $("bGrade").classList.toggle("on",v);$("bGrade").setAttribute("aria-pressed",String(v));}
$("bGrade").onclick=function(){if(!lens){say("Grade needs the post-processing pass, which did not start on this device.");return;}setGrade(!gradeOn);};

/* ---------- live captions (browser speech recognition, not ElevenLabs) ---------- */
var SR=window.SpeechRecognition||window.webkitSpeechRecognition,rec=null,liveOn=false,li=0,finalW=[],interimW=[],idleT=0,clearT=0,restartT=0,fails=0,warned=false;
var lcap=$("lcap"),lstat=$("lstat");
function say(s){lstat.textContent=s||"";}
function isAr(text){var a=(text.match(/[؀-ۿ]/g)||[]).length,l=(text.match(/[A-Za-z]/g)||[]).length;return a>l;}
function render(){var all=finalW.concat(interimW).slice(-WIN),nF=Math.max(0,all.length-interimW.length);
 lcap.textContent="";if(!all.length){lcap.classList.add("idle");return;}
 var text=all.join(" "),ar=isAr(text),ln=document.createElement("div");ln.className="ln"+(ar?" ar":"");ln.lang=ar?"ar":"en";ln.dir=ar?"rtl":"ltr";
 all.forEach(function(w,i){var s=document.createElement("span");s.textContent=w;if(i<nF)s.className="f";if(i===all.length-1)s.className+=" act";
  KEYS.some(function(r){return r[1].test(w);})&&(s.className+=" hit");ln.appendChild(s);ln.appendChild(document.createTextNode(" "));});
 lcap.appendChild(ln);lcap.classList.remove("idle");
 clearTimeout(idleT);idleT=setTimeout(function(){lcap.classList.add("idle");},4500);
 clearTimeout(clearT);clearT=setTimeout(function(){finalW=[];interimW=[];lcap.textContent="";},9000);}
function onResult(e){var chunk="",fin="";interimW=[];
 for(var i=e.resultIndex;i<e.results.length;i++){var r=e.results[i],t=(r[0]&&r[0].transcript||"").trim();if(!t)continue;chunk+=" "+t;
  if(r.isFinal){finalW=finalW.concat(t.split(/\s+/));fin+=" "+t;}else interimW=interimW.concat(t.split(/\s+/));}
 if(finalW.length>60)finalW=finalW.slice(-40);
 fails=0;scan(chunk);render();if(fin.trim())$("lcapSR").textContent=fin.trim();}
function startRec(){if(!liveOn||rec)return;
 rec=new SR();rec.continuous=true;rec.interimResults=true;rec.maxAlternatives=1;rec.lang=LANGS[li][0];
 rec.onstart=function(){say("Listening · "+LANGS[li][1]);};
 rec.onresult=onResult;
 rec.onerror=function(e){var c=e&&e.error;
  if(c==="not-allowed"||c==="service-not-allowed"){say("Microphone blocked. Allow it for this page, then press Live captions.");setLive(false,true);}
  else if(c==="audio-capture"){say("No microphone found.");setLive(false,true);}
  else if(c==="network"){fails++;say("Speech service unreachable"+(fails>2?". Captions stopped.":", retrying…"));if(fails>2)setLive(false,true);}
  else if(c==="language-not-supported"){say("This browser does not support "+LANGS[li][1]+" recognition.");setLive(false,true);}
  /* no-speech and aborted are normal: the end handler restarts */};
 rec.onend=function(){rec=null;if(liveOn){clearTimeout(restartT);restartT=setTimeout(startRec,fails?900*fails:250);}};
 try{rec.start();}catch(_){rec=null;}}
function stopRec(){clearTimeout(restartT);var r=rec;rec=null;if(r){r.onend=r.onerror=r.onresult=null;try{r.abort();}catch(_){}}}
function setLive(v,quiet){if(v&&!SR){say("Live captions need Chrome or Edge. This browser has no speech recognition.");return;}
 liveOn=v;document.body.classList.toggle("livecap",v);$("bLive").classList.toggle("on",v);$("bLive").setAttribute("aria-pressed",String(v));
 if(v){fails=0;if(!warned){warned=true;say("Chrome sends the audio to its speech service to caption it.");}startRec();}
 else{stopRec();finalW=[];interimW=[];lcap.textContent="";lcap.classList.add("idle");if(!quiet)say("");}}
$("bLive").onclick=function(){setLive(!liveOn);};
$("bLang").onclick=function(){li=(li+1)%LANGS.length;$("bLang").textContent=LANGS[li][1];if(liveOn){stopRec();finalW=[];interimW=[];lcap.textContent="";startRec();}};
document.addEventListener("visibilitychange",function(){if(!liveOn)return;if(document.hidden)stopRec();else startRec();});

/* the original fixed-time captions (studio mode, no live recognition) also light the tower screens */
try{new MutationObserver(function(ms){if(liveOn)return;ms.forEach(function(m){[].forEach.call(m.addedNodes,function(nd){if(nd.nodeType===1)scan(nd.textContent||"");});});}).observe($("cap"),{childList:true});}catch(_){}

/* ---------- bar visibility, camera readout, leaving the session ---------- */
var shown=false;
setInterval(function(){var inSession=core.mode!=="home";
 if(inSession!==shown){shown=inSession;$("spx").hidden=!inSession;if(!inSession){if(liveOn)setLive(false);}}
 var v=core.camVideo,s="";try{var tr=v&&v.srcObject&&v.srcObject.getVideoTracks()[0],st=tr&&tr.getSettings&&tr.getSettings();if(st&&st.width)s="CAM "+st.width+"×"+st.height+(st.frameRate?" @"+Math.round(st.frameRate):"");}catch(_){}
 $("cstat").textContent=s;},500);

setTowers(!!(TW&&TW.on));setGrade(true);
window.__spatial={light:light,scan:scan,setLive:setLive,setGrade:setGrade,setTowers:setTowers,get gradeOn(){return gradeOn;},get liveOn(){return liveOn;},GRADE:GRADE};
})();
</script>
