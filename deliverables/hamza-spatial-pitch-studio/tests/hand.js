(function(){const B=[[0,.10],[-.03,.07],[-.05,.04],[-.065,.015],[-.075,-.01],[-.025,0],[-.03,-.04],[-.032,-.065],[-.034,-.09],[0,-.005],[0,-.05],[0,-.08],[0,-.105],[.022,0],[.025,-.04],[.027,-.065],[.028,-.088],[.042,.008],[.047,-.025],[.05,-.045],[.052,-.065]];
window.__hand=(px,py,pinch,side,scale)=>{const v=window.__ironoj.camVideo,va=v.videoWidth/v.videoHeight,asp=innerWidth/innerHeight,AX=Math.max(1,va/asp),AY=Math.max(1,asp/va),s=scale||1;
 const cx=.5-(px/innerWidth-.5)/AX,cy=.5+(py/innerHeight-.5)/AY;
 let lm=B.map(([x,y])=>({x:x*s,y:y*s,z:0}));if(pinch){lm[4]={x:lm[8].x+.004*s,y:lm[8].y+.004*s,z:0};}
 const mx=(lm[4].x+lm[8].x)/2,my=(lm[4].y+lm[8].y)/2;
 return {side:side||'Right',lm:lm.map(q=>({x:cx-(q.x-mx),y:cy+(q.y-my),z:0}))};};})();
