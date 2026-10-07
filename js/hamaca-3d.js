/* Modelo geométrico didáctico de la referencia. Sin cálculo estructural. */
(() => {
  'use strict';
  const canvas = document.getElementById('hammock-canvas');
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  const zoom = document.getElementById('hammock-zoom');
  const spinButton = document.getElementById('hammock-spin');
  const viewButtons = [...document.querySelectorAll('[data-hammock-view]')];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let yaw = .68, pitch = .32, magnification = 1;
  let width = 1000, height = 550, spin = !reduceMotion.matches, visible = true, previousTime = 0, frame = null;
  let drag = null;
  const faces = [], cords = [];
  const add = (a,b) => a.map((v,i) => v+b[i]);
  const sub = (a,b) => a.map((v,i) => v-b[i]);
  const mul = (a,s) => a.map(v => v*s);
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const dot = (a,b) => a.reduce((s,v,i) => s+v*b[i],0);
  const unit = a => mul(a,1/(Math.hypot(...a)||1));
  const light = unit([-.35,.85,.55]);
  function face(vertices, color, fabric = false) {
    const normal = unit(cross(sub(vertices[1],vertices[0]),sub(vertices[2],vertices[0])));
    const brightness = fabric ? .68+.32*Math.abs(dot(normal,light)) : .58+.42*Math.max(0,dot(normal,light));
    faces.push({vertices,color:`rgb(${color.map(c=>Math.round(c*brightness)).join(',')})`,fabric});
  }
  function tube(a,b,r=.016) {
    const axis=unit(sub(b,a));
    const u=unit(cross(axis,Math.abs(axis[1])>.9?[1,0,0]:[0,1,0]));
    const v=cross(axis,u), rings=[[],[]], count=12;
    for(let i=0;i<count;i++) {
      const angle=2*Math.PI*i/count;
      const delta=add(mul(u,Math.cos(angle)*r),mul(v,Math.sin(angle)*r));
      rings[0].push(add(a,delta));rings[1].push(add(b,delta));
    }
    for(let i=0;i<count;i++)face([rings[0][i],rings[0][(i+1)%count],rings[1][(i+1)%count],rings[1][i]],[216,228,225]);
    face(rings[0].slice().reverse(),[152,174,171]);face(rings[1],[152,174,171]);
  }
  // Dimensiones generales de la referencia: 2,25 m × 1,20 m × 1,35 m.
  tube([-1.109,.035,-.584],[1.109,.035,.584]);
  tube([-1.109,.055,.584],[1.109,.055,-.584]);
  for(const sign of [-1,1]) {
    tube([sign*.74,.074,-.39],[sign*.74,.074,.39]);
    tube([sign*.74,.074,0],[sign*1.085,1.334,0]);
    tube([sign*.737,.074,0],[sign*.753,.14,0],.023);
    for(const z of [-.52,.52]) cords.push({a:[sign*1.077,1.305,0],b:[sign*.99,.07,z],color:'#d0a58d',thickness:1.6});
    for(const z of [-.065,0,.065]) cords.push({a:[sign*1.077,1.305,0],b:[sign*.87,1.045,z],color:'#d7b496',thickness:1.8});
  }
  function fabricPoint(u,v) {
    const curve=Math.max(0,Math.sin(Math.PI*u));
    const x=(u-.5)*1.74;
    const halfWidth=.065+.335*Math.pow(curve,.64);
    return [x,1.045-.585*Math.pow(curve,.77)+.11*v*v*curve+.009*Math.cos(v*15)*curve,v*halfWidth];
  }
  const lengthSegments=36,widthSegments=16;
  for(let i=0;i<lengthSegments;i++) for(let j=0;j<widthSegments;j++) {
    const u=i/lengthSegments,nextU=(i+1)/lengthSegments,v=-1+2*j/widthSegments,nextV=-1+2*(j+1)/widthSegments;
    const color=j%4===0?[96,137,130]:[89,128,122];
    face([fabricPoint(u,v),fabricPoint(nextU,v),fabricPoint(nextU,nextV),fabricPoint(u,nextV)],color,true);
  }
  for(const v of [-1,1]) for(let i=0;i<lengthSegments;i++) cords.push({a:fabricPoint(i/lengthSegments,v),b:fabricPoint((i+1)/lengthSegments,v),color:'#b1ccc0',thickness:1});

  function project([x,y,z]) {
    y-=.66;
    const side=x*Math.sin(yaw)+z*Math.cos(yaw);
    const horizontal=x*Math.cos(yaw)-z*Math.sin(yaw);
    const vertical=y*Math.cos(pitch)-side*Math.sin(pitch);
    const depth=-y*Math.sin(pitch)-side*Math.cos(pitch);
    const perspective=5/(5+depth);
    const scale=Math.min(width/3.25,height/2.6)*magnification;
    return {x:width/2+horizontal*scale*perspective,y:height*.49-vertical*scale*perspective,z:depth};
  }
  function stroke3d(a,b,color,lineWidth=1,dash=[]) {
    const p=project(a),q=project(b);
    context.beginPath();context.moveTo(p.x,p.y);context.lineTo(q.x,q.y);
    context.strokeStyle=color;context.lineWidth=lineWidth;context.setLineDash(dash);context.stroke();context.setLineDash([]);
  }
  function label(text,point) {
    const p=project(point),font=width<500?10:12;
    context.font=`500 ${font}px Arial, sans-serif`;
    const textWidth=context.measureText(text).width;
    context.fillStyle='#132c2af0';context.fillRect(p.x-textWidth/2-7,p.y-font/2-5,textWidth+14,font+10);
    context.textAlign='center';context.textBaseline='middle';context.fillStyle='#d0e3d8';context.fillText(text,p.x,p.y);
  }
  function render() {
    context.clearRect(0,0,width,height);
    for(let i=-6;i<=6;i++) {
      const position=i*.25;
      stroke3d([-1.5,0,position],[1.5,0,position],'#9ec4b013',.8);
      stroke3d([position,0,-1.5],[position,0,1.5],'#9ec4b013',.8);
    }
    // Una sombra ayuda a distinguir la base y la tela suspendida.
    const shadow=project([0,.015,0]);
    context.save();context.translate(shadow.x,shadow.y);context.scale(1,Math.max(.08,Math.sin(pitch)*.5));
    const shadowRadius=Math.min(width/3.3,height/2.6)*magnification;
    const gradient=context.createRadialGradient(0,0,0,0,0,shadowRadius);
    gradient.addColorStop(0,'#00141666');gradient.addColorStop(1,'#00141600');context.fillStyle=gradient;
    context.beginPath();context.arc(0,0,shadowRadius,0,Math.PI*2);context.fill();context.restore();
    const items=faces.map(f=>{const points=f.vertices.map(project);return{points,z:points.reduce((s,p)=>s+p.z,0)/points.length,color:f.color,fabric:f.fabric};});
    cords.forEach(c=>{const a=project(c.a),b=project(c.b);items.push({points:[a,b],z:(a.z+b.z)/2,color:c.color,cord:true,thickness:c.thickness});});
    items.sort((a,b)=>b.z-a.z).forEach(item=>{
      const points=item.points;
      context.beginPath();context.moveTo(points[0].x,points[0].y);points.slice(1).forEach(p=>context.lineTo(p.x,p.y));
      if(item.cord){context.strokeStyle=item.color;context.lineWidth=item.thickness;context.stroke();}
      else {context.closePath();context.fillStyle=item.color;context.fill();context.strokeStyle=item.color;context.lineWidth=.45;context.stroke();}
    });
    // Cotas informativas de conjunto; no representan longitudes de piezas.
    const dimensionColor='#a9c9b783';
    stroke3d([-1.125,.015,.77],[1.125,.015,.77],dimensionColor,1,[4,4]);
    stroke3d([-1.125,0,.72],[-1.125,0,.82],dimensionColor);stroke3d([1.125,0,.72],[1.125,0,.82],dimensionColor);
    label('LARGO 2,25 m',[0,.015,.77]);
    if(Math.abs(Math.sin(yaw))>.25||pitch>1) {
      stroke3d([1.30,0,-.6],[1.30,0,.6],dimensionColor,1,[4,4]);label('ANCHO 1,20 m',[1.30,0,0]);
    }
    if(pitch<1.3) {
      stroke3d([-1.30,0,-.1],[-1.30,1.35,-.1],dimensionColor,1,[4,4]);label('ALTO 1,35 m',[-1.30,.68,-.1]);
    }
  }
  function resize() {
    const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;
    if(!width||!height)return;
    const dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    context.setTransform(dpr,0,0,dpr,0,0);render();
  }
  function selectView(key) {
    const views={iso:[.68,.32],front:[0,.035],side:[Math.PI/2,.035],top:[0,Math.PI/2]};
    [yaw,pitch]=views[key];
    viewButtons.forEach(b=>{const selected=b.dataset.hammockView===key;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
    stopSpin();render();
  }
  function freeView() {viewButtons.forEach(b=>{b.classList.remove('selected');b.setAttribute('aria-pressed','false');});}
  function stopSpin() {spin=false;spinButton.setAttribute('aria-pressed','false');spinButton.textContent='Giro automático';syncAnimation();}
  function animate(time) {
    frame=null;
    if(!spin||!visible||document.hidden){previousTime=0;return;}
    // Giro lento: una vuelta completa en aproximadamente tres minutos.
    if(previousTime)yaw+=Math.min(time-previousTime,80)*.000035;
    previousTime=time;render();frame=requestAnimationFrame(animate);
  }
  function syncAnimation() {
    if(frame!==null)cancelAnimationFrame(frame);frame=null;previousTime=0;
    if(spin&&visible&&!document.hidden)frame=requestAnimationFrame(animate);
  }
  viewButtons.forEach(button=>button.addEventListener('click',()=>selectView(button.dataset.hammockView)));
  zoom.addEventListener('input',()=>{magnification=Number(zoom.value)/100;render();});
  spinButton.addEventListener('click',()=>{spin=!spin;spinButton.setAttribute('aria-pressed',String(spin));spinButton.textContent=spin?'Pausar giro':'Giro automático';if(spin)freeView();syncAnimation();});
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;stopSpin();freeView();
    drag={x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove',event=>{
    if(!drag)return;
    yaw+=(event.clientX-drag.x)*.007;pitch=Math.max(-.1,Math.min(Math.PI/2,pitch+(event.clientY-drag.y)*.006));
    drag={x:event.clientX,y:event.clientY};render();
  });
  const endDrag=()=>{drag=null;canvas.classList.remove('dragging');};
  canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);canvas.addEventListener('lostpointercapture',endDrag);
  canvas.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return;
    event.preventDefault();stopSpin();freeView();
    if(event.key==='ArrowLeft')yaw-=.10;if(event.key==='ArrowRight')yaw+=.10;
    if(event.key==='ArrowUp')pitch=Math.min(Math.PI/2,pitch+.08);if(event.key==='ArrowDown')pitch=Math.max(-.1,pitch-.08);
    if(event.key==='Home')selectView('iso');render();
  });
  reduceMotion.addEventListener('change',event=>{if(event.matches)stopSpin();});
  document.addEventListener('visibilitychange',syncAnimation);
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;syncAnimation();}).observe(canvas);
  if('ResizeObserver' in window)new ResizeObserver(resize).observe(canvas);else window.addEventListener('resize',resize);
  spinButton.setAttribute('aria-pressed',String(spin));
  spinButton.textContent=spin?'Pausar giro':'Giro automático';
  if(spin)freeView();
  resize();
  syncAnimation();
})();
