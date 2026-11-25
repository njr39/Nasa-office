src='/root/.claude/uploads/197e18ad-fb1f-573c-bd74-dc2e49ca448c/ffb53c23-Ironoj-HAMZA.html'
out='/home/user/Nasa-office/deliverables/hamza-spatial-pitch-studio/HAMZA-Spatial-Pitch-Studio-V1.html'
t=open(src,encoding='utf8').read()
def rep(old,new):
    global t
    n=t.count(old); assert n==1,(n,old[:90]); t=t.replace(old,new)
css=open('add.css').read();html=open('add.html').read();js=open('add.js').read();tw=open('towers.js').read()
rep('<title>HAMZA · Hands Lab: Core','<title>HAMZA · Spatial Pitch Studio V1')
rep('</style>',css+'</style>')
rep('<div id="toast"',html+'<div id="toast"')
rep('tr.applyConstraints({width:{ideal:1280},height:{ideal:720}})','tr.applyConstraints({width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:30}})')
# towers module, before the input section
rep('/* ---------- input: hands and pointers share one track shape ---------- */',tw+'\n/* ---------- input: hands and pointers share one track shape ---------- */')
# reset also resets the towers
rep('function resetCore(){','function resetCore(){towersReset();')
# release a tower grab (tap = select a screen)
rep('function release(tr){','function release(tr){if(tr.grab&&tr.grab.tower!=null)towerRelease(tr);')
# pick: nodes, then the Core, then a tower
rep('if(best>=0)return {node:best};var c=corePx();return Math.hypot(c.x-px,c.y-py)<reachPx()?{asm:true}:null;}',
    'if(best>=0)return {node:best};var c=corePx();if(Math.hypot(c.x-px,c.y-py)<reachPx())return {asm:true};var tw=towerAt(px,py);return tw>=0?{tower:tw}:null;}')
# capture a tower
rep(' else if(hit)tr.grab={asm:true',' else if(hit&&hit.tower!=null)towerGrab(tr,hit.tower);\n else if(hit)tr.grab={asm:true')
# move a held tower
rep(' var dx=tr.px-g.sx,dy=tr.py-g.sy;\n if(g.orbit)',' if(g.tower!=null){towerMove(tr,g);return;}\n var dx=tr.px-g.sx,dy=tr.py-g.sy;\n if(g.orbit)')
# two hands: on one tower -> resize/turn that tower; on the Core -> as before; a tower and something else -> no pair
rep('  if(!pair&&(a.grab||b.grab||pick(a.px,a.py)||pick(b.px,b.py))){',
    '  var ha=a.grab&&a.grab.tower!=null?{tower:a.grab.tower}:pick(a.px,a.py),hb=b.grab&&b.grab.tower!=null?{tower:b.grab.tower}:pick(b.px,b.py),ta=ha&&ha.tower!=null?ha.tower:-1,tb=hb&&hb.tower!=null?hb.tower:-1;\n'
    '  if(!pair&&ta>=0&&ta===tb){[a,b].forEach(function(t){if(t.grab&&t.grab.tower!=null)TWS[t.grab.tower].held=Math.max(0,TWS[t.grab.tower].held-1);t.grab=null;t.blocked=true;});\n'
    '   var q=TWS[ta];q.held++;pair={tw:ta,a:a,b:b,dist:dist,ang:ang,mul:q.mul,yaw:q.yawAdd,x:q.off.x,y:q.off.y,mx:(a.px+b.px)/2,my:(a.py+b.py)/2};}\n'
    '  if(!pair&&ta<0&&tb<0&&(a.grab||b.grab||ha||hb)){')
rep('  if(pair&&pair.a===a&&pair.b===b){S.spread=','  if(pair&&pair.tw!=null){if(pair.a===a&&pair.b===b)towerPair(pair,a,b,dist,ang);}\n  else if(pair&&pair.a===a&&pair.b===b){S.spread=')
rep(' }else if(pair)pair=null;',' }else if(pair){if(pair.tw!=null)TWS[pair.tw].held=Math.max(0,TWS[pair.tw].held-1);pair=null;}')
# hints
rep(' hint(mode==="preview"?(held&&held.grab.node!=null?',' hint(mode==="preview"?(held&&held.grab.tower!=null?"Moving the screen tower. Scroll over it to resize. A quick tap on a screen lights it.":held&&held.grab.node!=null?')
rep('  :pair?"Hands apart to open. Together to close.":held?(',
    '  :pair&&pair.tw!=null?"Both hands on the tower: apart to grow, together to shrink, twist to turn.":pair?"Hands apart to open. Together to close.":held&&held.grab.tower!=null?"Holding the screen tower. Move it, push or pull to resize, turn your wrist to turn it.":held?(')
# wheel over a tower resizes it
rep('cv.addEventListener("wheel",function(e){if(!isCore())return;e.preventDefault();',
    'cv.addEventListener("wheel",function(e){if(!isCore())return;e.preventDefault();var twi=towerAt(e.clientX,e.clientY);if(twi>=0){TWS[twi].mul=cl(TWS[twi].mul*(1-cl(e.deltaY,-100,100)*.0016),.45,2);return;}')
# frame: towers update before render
rep(' if(composer)composer.render();else renderer.render(scene,camera);',' towersFrame(dt,t);\n if(composer)composer.render();else renderer.render(scene,camera);')
# expose
rep('RIG:RIG};','RIG:RIG,lens:lens,bloom:bloom,OPT:OPT,get camVideo(){return camVideo;},get pair(){return pair;},\n towers:{light:towerLight,setVisible:function(v){towersOn=!!v;},get on(){return towersOn;},at:towerAt,list:TWS}};')
rep('</script>\n</body>','</script>\n'+js+'</body>')
open(out,'w',encoding='utf8').write(t);print('written',len(t))
