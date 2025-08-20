(() => {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');

    // --- Resize handling ---
    const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    function resize(){
      const w=Math.floor(window.innerWidth*DPR), h=Math.floor(window.innerHeight*DPR);
      canvas.width=w; canvas.height=h;
      canvas.style.width=window.innerWidth+'px'; canvas.style.height=window.innerHeight+'px';
      ctx.setTransform(1,0,0,1,0,0); ctx.scale(DPR,DPR);
      game.w=window.innerWidth; game.h=window.innerHeight;
    }
    window.addEventListener('resize', resize);

    // --- Input ---
    const keys = new Set();
    let mouseLeft=false;
    window.addEventListener('keydown', (e)=>{
      keys.add(e.code);
      if(e.code==='Space'){
        e.preventDefault();
        mouseLeft=true;
      };
      if (e.code==='ShiftLeft') {
        e.preventDefault();
        fireMissile(); // same function your right-click calls
      };
      if(e.code==='KeyP') togglePause();
      if(e.code==='KeyT') runTests();
    });
    window.addEventListener('keyup', (e)=>{ 
      keys.delete(e.code);
      if(e.code==='Space') mouseLeft=false;
    });
    window.addEventListener('mousedown', (e)=>{ if(game.paused) return; if(e.button===0) mouseLeft=true; if(e.button===2) fireMissile(); });
    window.addEventListener('mouseup', (e)=>{ if(e.button===0) mouseLeft=false; });
    window.addEventListener('contextmenu', (e)=>{ e.preventDefault(); });

    // --- Utilities ---
    const TAU=Math.PI*2; const rnd=(a=1,b=0)=>Math.random()*(b-a)+a; const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
    const wrap=(p,max)=> p<0? p+max : (p>max? p-max : p); const dist=(ax,ay,bx,by)=>Math.hypot(ax-bx, ay-by);
    function segPointDist(x1,y1,x2,y2, px,py){ const vx=x2-x1, vy=y2-y1; const wx=px-x1, wy=py-y1; const c1=vx*wx + vy*wy; if(c1<=0) return Math.hypot(px-x1, py-y1); const c2=vx*vx+vy*vy; if(c2<=c1) return Math.hypot(px-x2, py-y2); const b=c1/c2; const bx=x1+b*vx, by=y1+b*vy; return Math.hypot(px-bx, py-by); }

    // --- Audio & Music (tempo control) ---
    let audioEnabled=true, musicEnabled=true; let AC, masterGain, sfxGain, musicGain; let musicInterval=null, bassOsc=null, leadOsc=null;
    const music={ baseStepMs:280, stepMs:280, minStepMs:140 };
    function initAudio(){ if(AC) return; AC=new (window.AudioContext||window.webkitAudioContext)(); masterGain=AC.createGain(); masterGain.gain.value=0.6; masterGain.connect(AC.destination); sfxGain=AC.createGain(); sfxGain.gain.value=0.9; sfxGain.connect(masterGain); musicGain=AC.createGain(); musicGain.gain.value=0.35; musicGain.connect(masterGain); }
    function beep({type='square', freq=440, time=0.05, gain=0.25, pitchDecay=0, startNow=true}){ if(!audioEnabled||!AC) return; const t0=AC.currentTime+(startNow?0:0.001); const o=AC.createOscillator(); o.type=type; const g=AC.createGain(); g.gain.value=gain; g.gain.setTargetAtTime(0.0001, t0+Math.max(0.01,time*0.7), 0.03); o.frequency.setValueAtTime(freq, t0); if(pitchDecay){ o.frequency.exponentialRampToValueAtTime(Math.max(60,freq*pitchDecay), t0+time); } o.connect(g).connect(sfxGain); o.start(t0); o.stop(t0+time+0.05); }
    function noiseSplash(time=0.2, gain=0.3){ if(!audioEnabled||!AC) return; const N=AC.sampleRate*time; const buf=AC.createBuffer(1,N,AC.sampleRate); const d=buf.getChannelData(0); for(let i=0;i<N;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/N,1.5); const src=AC.createBufferSource(); src.buffer=buf; const bp=AC.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=800; bp.Q.value=0.6; const g=AC.createGain(); g.gain.value=gain; src.connect(bp).connect(g).connect(sfxGain); src.start(); }
    function updateMusicLoop(){ if(musicInterval) { clearInterval(musicInterval); musicInterval=null; } if(!musicEnabled || !AC || !bassOsc || !leadOsc) return; const base=110; const scale=[0,3,5,7,10,12,15]; let step=0; musicInterval=setInterval(()=>{ if(!AC || !bassOsc || !leadOsc){ clearInterval(musicInterval); musicInterval=null; return; } const t=AC.currentTime; const bassNote=base*Math.pow(2,(scale[(step%4)*2 % scale.length])/12); try { bassOsc.frequency.setValueAtTime(bassNote,t); } catch {} const bassEnv=AC.createGain(); bassEnv.gain.value=0; bassOsc.connect(bassEnv).connect(musicGain); bassEnv.gain.setValueAtTime(0.0,t); bassEnv.gain.linearRampToValueAtTime(0.28,t+0.01); bassEnv.gain.exponentialRampToValueAtTime(0.0001, t+0.22); const leadNote=base*2*Math.pow(2,(scale[(step*3)%scale.length])/12); try { leadOsc.frequency.setValueAtTime(leadNote,t+0.1); } catch {} const leadEnv=AC.createGain(); leadEnv.gain.value=0; leadOsc.connect(leadEnv).connect(musicGain); leadEnv.gain.setValueAtTime(0.0,t+0.1); leadEnv.gain.linearRampToValueAtTime(0.22,t+0.12); leadEnv.gain.exponentialRampToValueAtTime(0.0001,t+0.35); step++; }, music.stepMs); }
    function startMusic(){ if(!musicEnabled) return; if(!AC) initAudio(); bassOsc=AC.createOscillator(); bassOsc.type='square'; bassOsc.start(); leadOsc=AC.createOscillator(); leadOsc.type='triangle'; leadOsc.start(); updateMusicLoop(); }
    function stopMusic(){ if(musicInterval) clearInterval(musicInterval); musicInterval=null; try{ bassOsc&&bassOsc.stop(); }catch{}; try{ leadOsc&&leadOsc.stop(); }catch{}; bassOsc=leadOsc=null; }
    function resetTempo(){ music.stepMs=music.baseStepMs; updateMusicLoop(); }
    function bumpMusicTempo(){ music.stepMs=Math.max(music.minStepMs, Math.round(music.stepMs*0.85)); updateMusicLoop(); }
    window.music=music; window.__bumpTempo=bumpMusicTempo; window.__resetTempo=resetTempo;

    // --- Entities ---
    class Ship{ constructor(game){ this.g=game; this.x=game.w/2; this.y=game.h/2; this.vx=0; this.vy=0; this.a=-Math.PI/2; this.r=14; this.cool=0; this.inv=2.2; this.alive=true; }
      reset(){ this.x=this.g.w/2; this.y=this.g.h/2; this.vx=this.vy=0; this.a=-Math.PI/2; this.cool=0; this.inv=2.5; this.alive=true; }
      update(dt){
  const ACC=180, ROT=3.0, FRI=0.995, MAXS=600;
  if(keys.has('KeyA')) this.a -= ROT*dt;
  if(keys.has('KeyD')) this.a += ROT*dt;
  if(keys.has('KeyW')){
    this.vx += Math.cos(this.a)*ACC*dt;
    this.vy += Math.sin(this.a)*ACC*dt;
    if(Math.random()<0.4) beep({type:'square',freq:140,time:0.03,gain:0.05});
  }
  const sp=Math.hypot(this.vx,this.vy);
  if(sp>MAXS){ const s=MAXS/sp; this.vx*=s; this.vy*=s; }
  this.vx*=FRI; this.vy*=FRI;
  this.x=wrap(this.x+this.vx*dt,this.g.w);
  this.y=wrap(this.y+this.vy*dt,this.g.h);
  this.cool=Math.max(0,this.cool-dt);
  this.inv=Math.max(0,this.inv-dt);

  // Laser heat cooling
  if (this.g.laserHeat > 0) {
    const cool = this.g.laserOverheated ? 0.15 : 0.3;      // slower when overheated
    this.g.laserHeat = Math.max(0, this.g.laserHeat - cool*dt);
    if (this.g.laserOverheated && this.g.laserHeat <= 0.25) this.g.laserOverheated = false;
  }

  if(mouseLeft) this.tryFire();
}

    tryFire(){
  const activeShots = this.g.bullets.filter(b=>!b.dead).length;
  if(activeShots >= this.g.fireCap) return;

  const stage=this.g.weaponStage;
  const stages=[
    {name:'Peashooter',   rate:0.24, speed:520, count:1, spread:0},
    {name:'Twin Blaster', rate:0.22, speed:540, count:2, spread:0.05},
    {name:'Spread Shot',  rate:0.20, speed:560, count:3, spread:0.10},
    {name:'Rapid Fire',   rate:0.10, speed:620, count:3, spread:0.12},
    {name:'Pulse Laser',  rate:0.07, speed:700, count:4, spread:0.16, laser:true}
  ];
  const cfg=stages[Math.min(stage, stages.length-1)];
  if(this.cool>0) return;

  // Laser overheat
  if (cfg.laser) {
    if (this.g.laserOverheated) { beep({type:'square',freq:120,time:0.04,gain:0.12}); return; }
    const HEAT_PER_SHOT = 0.08;                                    // tune feel here
    this.g.laserHeat = Math.min(1, (this.g.laserHeat||0) + HEAT_PER_SHOT);
    if (this.g.laserHeat >= 1) this.g.laserOverheated = true;
  }

  this.cool = cfg.rate;

  if(cfg.laser){
    this.g.bullets.push(new Bullet(this.g, this.x, this.y, this.a, cfg.speed, 0.2, true));
    beep({type:'triangle',freq:680,time:0.06,gain:0.22});
  } else {
    const n=cfg.count, spr=cfg.spread;
    const start=-spr*(n-1)/2;
    for(let i=0;i<n;i++){
      const ang=this.a + start + spr*i;
      const b=new Bullet(this.g, this.x + Math.cos(this.a)*this.r, this.y + Math.sin(this.a)*this.r, ang, cfg.speed*1.1, 1.6, false);
      this.g.bullets.push(b);
    }
    beep({type:'square',freq:520,time:0.04,gain:0.18});
  }
}

      draw(){ const blink=this.inv>0 && ((Date.now()/120|0)%2===0); ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.a); ctx.lineWidth=2; ctx.strokeStyle= blink? 'rgba(255,255,255,0.3)': '#00ffa6'; ctx.shadowColor='#00ffa6'; ctx.shadowBlur= blink?0:14; ctx.beginPath(); ctx.moveTo(this.r,0); ctx.lineTo(-this.r*0.8, -this.r*0.65); ctx.lineTo(-this.r*0.2, 0); ctx.lineTo(-this.r*0.8, this.r*0.65); ctx.closePath(); ctx.stroke(); if(keys.has('KeyW') && !blink){ ctx.shadowColor='#fffb00'; ctx.shadowBlur=18; ctx.strokeStyle='#fffb00'; ctx.beginPath(); ctx.moveTo(-this.r*0.9,0); const len=8+Math.random()*9; ctx.lineTo(-this.r*0.9-len,0); ctx.stroke(); } ctx.restore(); }
    }

    class Bullet{ constructor(game,x,y,a,speed,lifeSec=1.6,laser=false){ this.g=game; this.x=x; this.y=y; this.vx=Math.cos(a)*speed; this.vy=Math.sin(a)*speed; this.a=a; this.life=lifeSec; this.laser=laser; }
      update(dt){ this.life-=dt; if(this.life<=0){ this.dead=true; return; } if(!this.laser){ this.x=wrap(this.x+this.vx*dt,this.g.w); this.y=wrap(this.y+this.vy*dt,this.g.h);} }
      draw(){ ctx.save(); if(this.laser){ if(!this.g.ship){ ctx.restore(); return; } ctx.lineWidth=3; ctx.strokeStyle='#18f0ff'; ctx.shadowColor='#18f0ff'; ctx.shadowBlur=18; ctx.beginPath(); const L=Math.max(this.g.w,this.g.h); const sx=this.g.ship.x, sy=this.g.ship.y; ctx.moveTo(sx,sy); ctx.lineTo(sx+Math.cos(this.a)*L, sy+Math.sin(this.a)*L); ctx.stroke(); ctx.beginPath(); ctx.arc(sx+Math.cos(this.a)*20, sy+Math.sin(this.a)*20, 3, 0, TAU); ctx.stroke(); } else { ctx.lineWidth=2; ctx.strokeStyle='#18f0ff'; ctx.shadowColor='#18f0ff'; ctx.shadowBlur=12; ctx.beginPath(); ctx.arc(this.x,this.y,2,0,TAU); ctx.stroke(); } ctx.restore(); }
    }

    class Missile{ constructor(game){ this.g=game; this.x=game.ship?game.ship.x:game.w/2; this.y=game.ship?game.ship.y:game.h/2; this.a=game.ship?game.ship.a:0; const sp=420; this.vx=Math.cos(this.a)*sp; this.vy=Math.sin(this.a)*sp; this.life=5.0; }
      update(dt){ this.life-=dt; if(this.life<=0){ this.dead=true; return; } this.x=wrap(this.x+this.vx*dt,this.g.w); this.y=wrap(this.y+this.vy*dt,this.g.h); }
      draw(){ ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.a); ctx.lineWidth=2; ctx.strokeStyle='#fffb00'; ctx.shadowColor='#fffb00'; ctx.shadowBlur=18; ctx.beginPath(); ctx.moveTo(12,0); ctx.lineTo(-10,-6); ctx.lineTo(-4,0); ctx.lineTo(-10,6); ctx.closePath(); ctx.stroke(); ctx.restore(); }
    }

    class EnemyRocket{ constructor(g,x,y,a){ this.g=g; this.x=x; this.y=y; this.a=a; const sp=300; this.vx=Math.cos(a)*sp; this.vy=Math.sin(a)*sp; this.life=6; }
      update(dt){ this.life-=dt; if(this.life<=0){ this.dead=true; return; } this.x=wrap(this.x+this.vx*dt,this.g.w); this.y=wrap(this.y+this.vy*dt,this.g.h); }
      draw(){ ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.a); ctx.lineWidth=2; ctx.strokeStyle='#ff7b00'; ctx.shadowColor='#ff7b00'; ctx.shadowBlur=12; ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(-8,-5); ctx.lineTo(-3,0); ctx.lineTo(-8,5); ctx.closePath(); ctx.stroke(); ctx.restore(); }
    }

    class Particle{ constructor(x,y,a,speed,life,color){ this.x=x; this.y=y; this.vx=Math.cos(a)*speed; this.vy=Math.sin(a)*speed; this.life=life; this.color=color; this.max=life; }
      update(dt){ this.life-=dt; this.x+=this.vx*dt; this.y+=this.vy*dt; this.x=wrap(this.x, game.w); this.y=wrap(this.y, game.h); }
      draw(){ const t=clamp(this.life/this.max,0,1); ctx.save(); ctx.globalAlpha=t; ctx.lineWidth=2; ctx.strokeStyle=this.color; ctx.shadowColor=this.color; ctx.shadowBlur=10; ctx.beginPath(); ctx.moveTo(this.x,this.y); ctx.lineTo(this.x - this.vx*0.02, this.y - this.vy*0.02); ctx.stroke(); ctx.restore(); }
    }

    class Flame{ constructor(x,y,r,life=1.2){ this.x=x; this.y=y; this.r=r; this.life=life; this.max=life; }
      update(dt){ this.life-=dt; }
      draw(){ const t=clamp(this.life/this.max,0,1); ctx.save(); ctx.globalAlpha=0.35*t; ctx.lineWidth=3; ctx.strokeStyle='#ff7b00'; ctx.shadowColor='#ff7b00'; ctx.shadowBlur=18; ctx.beginPath(); ctx.arc(this.x,this.y,this.r*(1+0.15*(1-t)),0,TAU); ctx.stroke(); ctx.globalAlpha=0.15*t; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(this.x,this.y,this.r*0.6,0,TAU); ctx.stroke(); ctx.restore(); }
    }

    class Catroid{ constructor(game,x,y,size=3, speedMul=1){ this.g=game; this.x=x; this.y=y; this.size=size; const sp=(Math.random()*30+30)/size * speedMul; const ang=Math.random()*Math.PI*2; this.vx=Math.cos(ang)*sp; this.vy=Math.sin(ang)*sp; this.rot=(Math.random()*1.2-0.6); this.a=Math.random()*Math.PI*2; this.r= size===3?42: size===2?26:16; this.type='catroid'; }
      update(dt){ this.x=wrap(this.x+this.vx*dt,this.g.w); this.y=wrap(this.y+this.vy*dt,this.g.h); this.a+=this.rot*dt; }
      split(){ if(this.size>1){ return [ new Catroid(this.g,this.x,this.y,this.size-1,1), new Catroid(this.g,this.x,this.y,this.size-1,1) ]; } return []; }
      draw(){ drawCatFace(this.x,this.y,this.r,this.a); }
    }

    class ArmoredCat{ constructor(game,x,y,size=3, speedMul=1, hp=2){ this.g=game; this.x=x; this.y=y; this.size=size; const sp=(Math.random()*26+28)/size * speedMul; const ang=Math.random()*Math.PI*2; this.vx=Math.cos(ang)*sp; this.vy=Math.sin(ang)*sp; this.rot=(Math.random()*1.2-0.6); this.a=Math.random()*Math.PI*2; this.r= size===3?46: size===2?30:18; this.type='armored'; this.hp=hp; this.maxHp=hp; }
      update(dt){ this.x=wrap(this.x+this.vx*dt,this.g.w); this.y=wrap(this.y+this.vy*dt,this.g.h); this.a+=this.rot*dt; }
      split(){ if(this.size>1){ const nhp=Math.max(1, Math.ceil(this.hp/2)); return [ new ArmoredCat(this.g,this.x,this.y,this.size-1,1,nhp), new ArmoredCat(this.g,this.x,this.y,this.size-1,1,nhp) ]; } return []; }
      draw(){ drawCatFace(this.x,this.y,this.r,this.a); const t=this.hp/this.maxHp; ctx.save(); ctx.lineWidth=2; ctx.strokeStyle='#fffb00'; ctx.shadowColor='#fffb00'; ctx.shadowBlur=10; ctx.globalAlpha=0.6; ctx.beginPath(); ctx.arc(this.x,this.y,this.r*0.95,0,TAU); ctx.stroke(); ctx.restore(); }
    }

    class CometCat extends Catroid{ constructor(g,x,y){ super(g,x,y,1,2); this.type='comet'; this.r=14; const mul = 3.5; this.vx *=mul; this.vy *=mul; this.maxSpeed=10;}
      update(dt){ super.update(dt); }
      draw(){ drawCatFace(this.x,this.y,this.r,this.a); ctx.save(); ctx.strokeStyle='#18f0ff'; ctx.shadowColor='#18f0ff'; ctx.shadowBlur=10; ctx.beginPath(); ctx.moveTo(this.x,this.y); ctx.lineTo(this.x-this.vx*0.2,this.y-this.vy*0.2); ctx.stroke(); ctx.restore(); }}

    class ShooterCat extends ArmoredCat{ constructor(g,x,y){ super(g,x,y,2,1.2,2); this.type='shooter'; this.shootTimer=2.5; }
      update(dt){ super.update(dt); this.shootTimer-=dt; if(this.shootTimer<=0){ this.shootTimer=2+Math.random()*2; if(this.g.ship){ const dx=this.g.ship.x-this.x, dy=this.g.ship.y-this.y; const ang=Math.atan2(dy,dx); this.g.enemyBullets.push(new EnemyBullet(this.g,this.x,this.y,ang,280,1.6)); } } }
      draw(){ super.draw(); ctx.save(); ctx.strokeStyle='#8a2be2'; ctx.shadowColor='#8a2be2'; ctx.shadowBlur=12; ctx.beginPath(); ctx.arc(this.x,this.y,this.r*0.4,0,TAU); ctx.stroke(); ctx.restore(); }}

    class EnemyBullet{ constructor(g,x,y,a,speed,life=1.6){ this.g=g; this.x=x; this.y=y; this.vx=Math.cos(a)*speed; this.vy=Math.sin(a)*speed; this.life=life; }
      update(dt){ this.life-=dt; if(this.life<=0){ this.dead=true; return; } this.x=wrap(this.x+this.vx*dt,this.g.w); this.y=wrap(this.y+this.vy*dt,this.g.h); }
      draw(){ ctx.save(); ctx.lineWidth=2; ctx.strokeStyle='#8a2be2'; ctx.shadowColor='#8a2be2'; ctx.shadowBlur=10; ctx.beginPath(); ctx.arc(this.x,this.y,2,0,TAU); ctx.stroke(); ctx.restore(); }
    }

    class HomingCat extends Catroid{ constructor(g,x,y){ super(g,x,y,2,1); this.type='homing'; this.r=22; }
      update(dt){ if(this.g.ship){ const dx=this.g.ship.x-this.x, dy=this.g.ship.y-this.y; const ang=Math.atan2(dy,dx); const accel=40; this.vx += Math.cos(ang)*accel*dt; this.vy += Math.sin(ang)*accel*dt; const max=160; const sp=Math.hypot(this.vx,this.vy); if(sp>max){ this.vx*=max/sp; this.vy*=max/sp; } this.a=ang; } super.update(dt); }
      draw(){ ctx.save(); drawCatFace(this.x,this.y,this.r,this.a); ctx.strokeStyle='#00ffa6'; ctx.shadowColor='#00ffa6'; ctx.shadowBlur=10; ctx.beginPath(); ctx.arc(this.x,this.y,this.r*0.5,0,TAU); ctx.stroke(); ctx.restore(); }}

    class RocketCat extends ArmoredCat{ constructor(g,x,y){ super(g,x,y,2,0.9,3); this.type='rocketcat'; this.shootTimer=3; }
      update(dt){ super.update(dt); this.shootTimer-=dt; if(this.shootTimer<=0){ this.shootTimer=2.5+Math.random()*2; if(this.g.ship){ const dx=this.g.ship.x-this.x, dy=this.g.ship.y-this.y; const ang=Math.atan2(dy,dx); this.g.enemyMissiles.push(new EnemyRocket(this.g,this.x,this.y,ang)); } } }
      draw(){ ctx.save(); drawCatFace(this.x,this.y,this.r,this.a); ctx.strokeStyle='#ff7b00'; ctx.shadowColor='#ff7b00'; ctx.shadowBlur=12; ctx.beginPath(); ctx.arc(this.x,this.y,this.r*0.7,0,TAU); ctx.stroke(); ctx.restore(); }}

    class ShieldCat extends Catroid{ constructor(g,x,y){ super(g,x,y,3,0.9); this.type='shield'; this.shieldAng=Math.random()*TAU; this.arc=TAU/4; this.spin=1.4; }
      update(dt){ super.update(dt); this.shieldAng = (this.shieldAng + this.spin*dt) % TAU; }
      draw(){ drawCatFace(this.x,this.y,this.r,this.a); ctx.save(); ctx.lineWidth=3; ctx.strokeStyle='#18f0ff'; ctx.shadowColor='#18f0ff'; ctx.shadowBlur=16; ctx.beginPath(); ctx.arc(this.x,this.y,this.r*1.05, this.shieldAng-this.arc/2, this.shieldAng+this.arc/2); ctx.stroke(); ctx.restore(); }
    }

class BlackHole {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.r = 28;
    this.dead = false;
    this.spin = 0;
    this.phase = Math.random() * Math.PI * 2;

    // --- Gravity tuning ---
    this.influence = 440;   // pull radius (px)
    this.strength  = 120000; // inverse-square strength; tuned for dt in SECONDS
    this.swirl     = 0.9;   // 0 = straight in; >0 adds tangential “orbit”
  }

  update(dt) {
    // visuals
    this.spin  += dt * 2.0;
    this.phase += dt * 1.6;
    this.r = 24 + 4 * Math.sin(this.phase * 1.2);

    // apply gravity/pulls
    const W = game.w, H = game.h;

    const pull = (body, factor = 1, isShip = false) => {
      if (!body || body.dead) return;

      // shortest wraparound vector (Asteroids field)
      let dx = this.x - body.x, dy = this.y - body.y;
      if (dx >  W/2) dx -= W; else if (dx < -W/2) dx += W;
      if (dy >  H/2) dy -= H; else if (dy < -H/2) dy += H;

      const d2 = dx*dx + dy*dy;
      if (d2 > this.influence * this.influence) return;

      const r = Math.max(Math.sqrt(d2), 12);               // avoid singularity

      // Event horizon — IMPORTANT: use game’s own death flow for the ship
      if (r <= this.r) {
        if (isShip) {
          if (typeof game.killPlayer === 'function') game.killPlayer();
          // do NOT set ship.dead here — let killPlayer handle respawn/invuln
        } else {
          body.dead = true; if ('hp' in body) body.hp = 0;
        }
        return;
      }

      // Inverse-square acceleration
      const a = (this.strength * factor) / (r * r);
      let ax = (dx / r) * a;
      let ay = (dy / r) * a;

      // Tangential swirl → spiral-in orbits (feels more “gravitationy”)
      if (this.swirl) {
        const tx = -dy / r, ty = dx / r;        // perpendicular unit
        const s = this.swirl * a * 0.35;
        ax += tx * s; ay += ty * s;
      }

      // Integrate: dt is seconds in this tuning.
      body.vx += ax * dt;
      body.vy += ay * dt;
    };

    // Ship (full force), enemies (slightly less), projectiles (lighter)
    if (game?.ship && !game.ship.dead) pull(game.ship, 1.0, true);
    for (const e of (game?.asts || [])) pull(e, 0.9, false);
    for (const b of (game?.bullets || [])) pull(b, 0.6, false);
    for (const r of (game?.rockets || [])) pull(r, 0.8, false);
  }

  draw() {
    const r = this.r; ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.spin * 0.3);
    // Core gradient – darker center
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.95);
    g.addColorStop(0, 'rgba(10,0,20,0.95)'); g.addColorStop(0.6, 'rgba(30,0,60,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 0.95, 0, TAU); ctx.fill();
    // Hazard ring
    ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.strokeStyle = '#b07cff'; ctx.shadowColor = '#8a2be2'; ctx.shadowBlur = 22;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    // Swirling vortex arms (lightweight)
    const arms = 5; ctx.lineWidth = 2;
    for (let k = 0; k < arms; k++) {
      ctx.beginPath(); const armPhase = this.phase + k * (TAU / arms);
      for (let a = 0; a <= TAU * 1.2; a += 0.22) {
        const rr = r * 0.55 + Math.sin(a * 2.1 + armPhase) * r * 0.18;
        const ang = a + this.spin * 0.6 + k * 0.15;
        const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
        if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = 'rgba(138,43,226,0.9)'; ctx.shadowColor = '#8a2be2'; ctx.shadowBlur = 16; ctx.stroke();
    }
    ctx.restore();
  }
}

    class BlackHoleCat extends ArmoredCat{ constructor(g,x,y){ super(g,x,y,2,1.0,3); this.type='blackholecat'; this.spawnBlackHole=true; }
      draw(){ drawCatFace(this.x,this.y,this.r,this.a); ctx.save(); ctx.strokeStyle='#111'; ctx.shadowColor='#8a2be2'; ctx.shadowBlur=14; ctx.beginPath(); ctx.arc(this.x,this.y,this.r*0.55,0,TAU); ctx.stroke(); ctx.restore(); }
    }

    class BossCat extends ArmoredCat {
constructor(g,x,y){
  const tier = Math.max(1, Math.floor(g.level/5));       // L5=1, L10=2, ...
  const hp   = 120 + 80*(tier-1);                         // beefier each tier
  const spd  = 0.6 + 0.05*tier;                           // slight drift scale
  super(g,x,y,3, spd, hp);
  this.type='boss';
  this.r=70;
  this.maxHp=this.hp;
  this.tier=tier;
  this.shootTimer=Math.max(0.9, 1.8 - 0.12*tier);         // shoots faster at higher tiers
  this.pattern=0;
  this.summonTimer=Math.max(3.5, 6.0 - 0.3*tier);         // summons more often
  g.boss=this; g.bossActive=true;
}

  split(){ return []; }                  // no splitting

  update(dt){
    // Face ship + light drift so it doesn't sit still
    if(this.g.ship){
      const dx=this.g.ship.x-this.x, dy=this.g.ship.y-this.y;
      const ang=Math.atan2(dy,dx); this.a=ang;
      const accel=20; this.vx += Math.cos(ang)*accel*dt*0.2; this.vy += Math.sin(ang)*accel*dt*0.2;
      const max=120; const sp=Math.hypot(this.vx,this.vy); if(sp>max){ this.vx*=max/sp; this.vy*=max/sp; }
    }
    super.update(dt);

    // Attack cycle
    this.shootTimer-=dt;
    if(this.shootTimer<=0){
      this.shootTimer=1.8;
      this.pattern=(this.pattern+1)%3;
      if(this.pattern===0) this.ringBurst(16,260);         // radial ring
      else if(this.pattern===1) this.aimedSpread(5,0.08,300); // cone at player
      else this.rocketVolley(2);                           // 2 rockets
    }

    // Summon support
    this.summonTimer-=dt;
    if(this.summonTimer<=0){
      this.summonTimer=8+Math.random()*4;
      for(let i=0;i<2;i++){
        const ang=Math.random()*TAU, d=this.r+80+Math.random()*60;
        const x=this.x+Math.cos(ang)*d, y=this.y+Math.sin(ang)*d;
        const r=Math.random();
        if(r<0.4) this.g.asts.push(new CometCat(this.g,x,y));
        else if(r<0.7) this.g.asts.push(new HomingCat(this.g,x,y));
        else this.g.asts.push(new ShooterCat(this.g,x,y));
      }
    }
  }

ringBurst(n=12,speed=240){
  const mult  = 1 + 0.15*this.tier;
  const count = Math.round(n * (1 + 0.2*this.tier));
  const spd   = speed * mult;
  for(let i=0;i<count;i++){
    const a=(i/count)*TAU;
    this.g.enemyBullets.push(new EnemyBullet(this.g,this.x,this.y,a,spd,2.2));
  }
  beep({type:'square',freq:200,time:0.08,gain:0.2});
}

aimedSpread(count=5,spread=0.08,speed=300){
  if(!this.g.ship) return;
  const c = Math.min(9, 5 + this.tier);
  const s = 0.07 + 0.01*this.tier;
  const v = 300 + 20*this.tier;
  const base=Math.atan2(this.g.ship.y-this.y, this.g.ship.x-this.x);
  const start=-s*(c-1)/2;
  for(let i=0;i<c;i++){
    const a=base+start+s*i;
    this.g.enemyBullets.push(new EnemyBullet(this.g,this.x,this.y,a,v,2.0));
  }
  beep({type:'square',freq:260,time:0.07,gain:0.22});
}

 rocketVolley(n=2){
  if(!this.g.ship) return;
  const count = Math.min(5, 2 + Math.floor((this.tier-1)/2)); // 2..5 rockets
  for(let i=0;i<count;i++){
    const t=Math.atan2(this.g.ship.y-this.y, this.g.ship.x-this.x)+(Math.random()*0.2-0.1);
    this.g.enemyMissiles.push(new EnemyRocket(this.g,this.x,this.y,t));
  }
  noiseSplash(0.12,0.22);
}

  draw(){
    // beefy aura
    drawCatFace(this.x,this.y,this.r,this.a);
    ctx.save();
    ctx.strokeStyle='#c7f5ff'; ctx.shadowColor='#c7f5ff'; ctx.shadowBlur=18; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(this.x,this.y,this.r*1.1,0,TAU); ctx.stroke();
    ctx.restore();
  }
}


    // Rocket Pickup
    class Pickup{ constructor(x,y){ this.x=x; this.y=y; this.r=10; this.life=12; this.spin=Math.random()*TAU; }
      update(dt){ this.life-=dt; this.spin+=dt*4; if(this.life<=0) this.dead=true; }
      draw(){ const t=Math.max(0, Math.min(1, this.life/12)); ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.spin); ctx.globalAlpha=0.7*t; ctx.lineWidth=2; ctx.strokeStyle='#fffb00'; ctx.shadowColor='#fffb00'; ctx.shadowBlur=14; ctx.beginPath(); ctx.moveTo(0,-this.r); ctx.lineTo(this.r*0.7,0); ctx.lineTo(0,this.r); ctx.lineTo(-this.r*0.7,0); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(0,0,3,0,TAU); ctx.stroke(); ctx.restore(); }
    }

    function drawCatFace(x,y,r,rot=0){ ctx.save(); ctx.translate(x,y); ctx.rotate(rot); const color='#ff2f92'; ctx.lineWidth=2; ctx.strokeStyle=color; ctx.shadowColor=color; ctx.shadowBlur=18; ctx.beginPath(); ctx.arc(0,0,r*0.86,0,TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r*0.38,-r*0.35); ctx.lineTo(-r*0.7,-r*0.95); ctx.lineTo(-r*0.08,-r*0.62); ctx.closePath(); ctx.moveTo(r*0.38,-r*0.35); ctx.lineTo(r*0.7,-r*0.95); ctx.lineTo(r*0.08,-r*0.62); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(-r*0.28,-r*0.05,r*0.10,0,TAU); ctx.moveTo(r*0.18,-r*0.05); ctx.arc(r*0.28,-r*0.05,r*0.10,0,TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0,r*0.02); ctx.lineTo(-r*0.06,r*0.12); ctx.lineTo(r*0.06,r*0.12); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r*0.06,r*0.12); ctx.quadraticCurveTo(0,r*0.22,r*0.06,r*0.12); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r*0.86,r*0.04); ctx.lineTo(-r*0.32,r*0.02); ctx.moveTo(-r*0.86,r*0.16); ctx.lineTo(-r*0.32,r*0.12); ctx.moveTo(r*0.86,r*0.04); ctx.lineTo(r*0.32,r*0.02); ctx.moveTo(r*0.86,r*0.16); ctx.lineTo(r*0.32,r*0.12); ctx.stroke(); ctx.restore(); }

    // --- Game state ---
    const game={ w:window.innerWidth, h:window.innerHeight, bullets:[], enemyBullets:[], enemyMissiles:[], missiles:[], flames:[], asts:[], parts:[], pickups:[], blackholes:[], boss:null, bossActive:false, ship:null, score:0, lives:3, missilesLeft:0, weaponStage:0, laserHeat:0, laserOverheated:false, destroyed:0, paused:true, fireCap:6, level:1, blackHoleCatAdded:false };
    window.game=game;

    // Debug helpers — expose spawners to the console
    window.spawnCat = (type='catroid', x=Math.random()*game.w, y=Math.random()*game.h) => {
    // These class names are already defined in the game code
      const map = {
        catroid:    Catroid,
        armored:    ArmoredCat,
        comet:      CometCat,
        shooter:    ShooterCat,
        homing:     HomingCat,
        rocket:     RocketCat,
        shield:     ShieldCat,
        blackhole:  BlackHoleCat,
        boss:       BossCat
      };
    const C = map[(type+'').toLowerCase()];
    if (!C) return console.warn('Unknown type:', type);
    game.asts.push(new C(game, x, y));
    return game.asts[game.asts.length - 1];
    };

window.addLives = (n=1) => {
  game.lives += n;
  document.getElementById('lives').textContent = `Lives: ${game.lives}`;
  return game.lives;
};

    function spawnWave(){
      if (game.level % 5 === 0) {
        let x,y; do{ x=rnd(0,game.w); y=rnd(0,game.h);} while(game.ship && dist(x,y, game.ship.x, game.ship.y) < 300);
        const boss = new BossCat(game,x,y);
        game.asts.push(boss);
        game.bossActive = true;
        game.boss = boss;
        game.blackHoleCatAdded = true; // suppress black-hole cat on boss levels
        return; // no regular spawns this wave
      }
      const diff=game.destroyed; const speedMul = 1 + Math.min(0.6, diff/120);
      const armoredChance = Math.min(0.4, 0.06 + diff/140);
      const shooterChance = Math.min(0.30, 0.05 + diff/160);
      const cometChance = Math.min(0.35, 0.06 + diff/180);
      const homingChance = Math.min(0.30, 0.05 + diff/130);
      const shieldChance = Math.min(0.25, 0.04 + diff/170);
      const rocketChance = Math.min(0.20, 0.03 + diff/180);
      const baseCount=4+Math.floor(diff/25);
      for(let i=0;i<baseCount;i++){
        let x,y; do{ x=rnd(0,game.w); y=rnd(0,game.h);} while(game.ship && dist(x,y, game.ship.x, game.ship.y) < 220);
        let roll=Math.random();
        if((roll-=rocketChance) < 0) game.asts.push(new RocketCat(game,x,y));
        else if((roll-=shieldChance) < 0) game.asts.push(new ShieldCat(game,x,y));
        else if((roll-=homingChance) < 0) game.asts.push(new HomingCat(game,x,y));
        else if((roll-=shooterChance) < 0) game.asts.push(new ShooterCat(game,x,y));
        else if((roll-=cometChance) < 0) game.asts.push(new CometCat(game,x,y));
        else if((roll-=armoredChance) < 0) { const hp = 1 + Math.ceil(diff/40) + (Math.random()<0.4?1:0); game.asts.push(new ArmoredCat(game,x,y,3,speedMul,hp)); }
        else { game.asts.push(new Catroid(game,x,y,3,speedMul)); }
      }
      if(game.level>=4 && !game.blackHoleCatAdded){
        let x,y; do{ x=rnd(0,game.w); y=rnd(0,game.h);} while(game.ship && dist(x,y, game.ship.x, game.ship.y) < 260);
        game.asts.push(new BlackHoleCat(game,x,y));
        game.blackHoleCatAdded=true;
      }
    }

    function explode(x,y,color){ for(let i=0;i<24;i++) game.parts.push(new Particle(x,y, rnd(0,TAU), rnd(80,360), rnd(0.3,0.8), color)); noiseSplash(0.18,0.24); }

    function reset(){ game.bullets.length=0; game.enemyBullets.length=0; game.enemyMissiles.length=0; game.missiles.length=0; game.flames.length=0; game.asts.length=0; game.parts.length=0; game.pickups.length=0; game.blackholes.length=0; game.score=0; game.lives=3; game.missilesLeft=0; game.weaponStage=0; game.destroyed=0; game.level=1; game.blackHoleCatAdded=false; game.ship=new Ship(game); spawnWave(); updateHUD(); resetTempo(); }

    function updateHUD(){
      document.getElementById('score').textContent = `Score: ${game.score}`;
      const levelEl = document.getElementById('level');
      if (levelEl) levelEl.textContent = `Level: ${game.level}`;
      document.getElementById('lives').textContent = `Lives: ${game.lives}`;
      document.getElementById('missiles').textContent = `Rockets: ${game.missilesLeft}`;
      const names=['Peashooter','Twin Blaster','Spread Shot','Rapid Fire','Pulse Laser'];
      document.getElementById('stage').textContent = `Stage: ${names[clamp(game.weaponStage,0,4)]}`;
    }

    function destroyAsteroid(a){ a.dead=true; explode(a.x,a.y,'#ff2f92'); if (a.type === 'boss') { game.score += 3000; game.lives += 2; game.missilesLeft += 6; game.bossActive = false; game.boss = null; updateHUD(); } else { game.score += a.size===3?20 : a.size===2?50 : 100; } game.destroyed++; if(a.spawnBlackHole){ game.blackholes.push(new BlackHole(a.x,a.y)); }  if(Math.random()<0.10){ game.pickups.push(new Pickup(a.x,a.y)); } updateProgression(); updateHUD(); const kids = (a.split? a.split(): []); for(const na of kids) game.asts.push(na);}

    function applyDamage(a,dmg=1){if(a.dead) return; if (typeof a.hp === 'number') { a.hp -= dmg; game.parts.push(new Particle(a.x,a.y, Math.random()*TAU, 120, 0.25, '#fffb00')); if(a.hp <= 0) destroyAsteroid(a); } else { destroyAsteroid(a);  }}

    function shieldBlocks(a, bullet){ if(a.type!=='shield') return false; let ba; if(bullet.laser){ if(!game.ship) return false; ba=bullet.a; } else { ba=Math.atan2(bullet.vy, bullet.vx); } let diff=( (ba - a.shieldAng + TAU) % TAU ); if(diff>Math.PI) diff=TAU-diff; return diff <= a.arc/2; }

    function handleCollisions(){
      for (const b of game.bullets) {if (b.dead) continue; for (const er of game.enemyMissiles) {if (er.dead) continue;if (b.laser) {if (!game.ship) continue;const L = Math.max(game.w, game.h);const sx = game.ship.x, sy = game.ship.y;const ex = sx + Math.cos(b.a) * L, ey = sy + Math.sin(b.a) * L;if (segPointDist(sx, sy, ex, ey, er.x, er.y) <= 8) {b.dead = true; er.dead = true; explode(er.x, er.y, '#ff7b00');continue;}} else {if (dist(b.x, b.y, er.x, er.y) < 10) {b.dead = true; er.dead = true; explode(er.x, er.y, '#ff7b00');continue;}}}

  // B) Bullets vs CAT-ROIDS (existing logic)
  for (const a of game.asts) {
    if (a.dead) continue;
    if (b.laser) {
      if (!game.ship) continue;
      const L = Math.max(game.w, game.h);
      const sx = game.ship.x, sy = game.ship.y;
      const ex = sx + Math.cos(b.a) * L, ey = sy + Math.sin(b.a) * L;
      if (segPointDist(sx, sy, ex, ey, a.x, a.y) <= a.r) {
        if (shieldBlocks(a, b)) { b.dead = true; game.parts.push(new Particle(a.x, a.y, a.shieldAng, 60, 0.25, '#18f0ff')); continue; }
        b.dead = true; applyDamage(a, 2);
      }
    } else {
      if (dist(b.x, b.y, a.x, a.y) < a.r) {
        if (shieldBlocks(a, b)) { b.dead = true; game.parts.push(new Particle(a.x, a.y, a.shieldAng, 60, 0.25, '#18f0ff')); continue; }
        b.dead = true; applyDamage(a, 1);
      }
    }
  }
}

      if(game.ship && game.ship.inv<=0){ for(const eb of game.enemyBullets){ if(eb.dead) continue; if(dist(eb.x,eb.y, game.ship.x, game.ship.y) < game.ship.r){ eb.dead=true; game.lives--; updateHUD(); bumpMusicTempo(); explode(game.ship.x,game.ship.y,'#00ffa6'); if(game.lives<=0) { gameOver(); } else { game.ship.reset(); } } } }
      for (const eb of game.enemyBullets) {if (eb.dead) continue; for (const m of game.missiles) {if (m.dead) continue;if (dist(eb.x, eb.y, m.x, m.y) < 10) {eb.dead = true;m.dead = true;missileExplode(m.x, m.y);}}}
      if(game.ship && game.ship.inv<=0){ for(const er of game.enemyMissiles){ if(er.dead) continue; if(dist(er.x,er.y, game.ship.x, game.ship.y) < game.ship.r+6){ er.dead=true; bumpMusicTempo(); explode(game.ship.x,game.ship.y,'#00ffa6'); game.lives--; updateHUD(); if(game.lives<=0) gameOver(); else game.ship.reset(); } } }
      for (const m of game.missiles) {
        if (m.dead) continue;

          // 1) Rocket vs Black Hole (direct impact)
          let hitBH = false;
            for (const bh of game.blackholes) {
              if (bh.dead) continue;
                // wrap-aware distance
                let dx = Math.abs(m.x - bh.x), dy = Math.abs(m.y - bh.y);
                dx = dx > game.w * 0.5 ? game.w - dx : dx;
                dy = dy > game.h * 0.5 ? game.h - dy : dy;
                if (Math.hypot(dx, dy) < bh.r) {
                  m.dead = true;
                  missileExplode(m.x, m.y);
                  beep({type:'sawtooth',freq:120,time:0.18,gain:0.25,pitchDecay:0.5});
                  hitBH = true;
                  break;
                }
              }
              if (hitBH) continue;

                // 2) Rocket vs Cat-roids (existing)
                for (const a of game.asts) {
                  if (a.dead) continue;
                  if (dist(m.x, m.y, a.x, a.y) < a.r + 8) {
                    m.dead = true;
                    missileExplode(m.x, m.y);
                    beep({type:'sawtooth',freq:120,time:0.18,gain:0.25,pitchDecay:0.5});
                    break;
                  }
                }
        }

      if(game.ship && game.ship.inv<=0){ for(const bh of game.blackholes){ if(bh.dead) continue; if(dist(game.ship.x,game.ship.y,bh.x,bh.y) < (bh.r + game.ship.r*0.4)){ bumpMusicTempo(); explode(game.ship.x,game.ship.y,'#00ffa6'); game.lives--; updateHUD(); if(game.lives<=0){ gameOver(); } else { game.ship.reset(); } } } }
      for(const f of game.flames){ for(const a of game.asts){ if(a.dead) continue; if(dist(f.x,f.y,a.x,a.y) < f.r + a.r*0.2){ applyDamage(a,1); } } }
      if(game.ship){ for(const p of game.pickups){ if(p.dead) continue; if(dist(game.ship.x,game.ship.y,p.x,p.y) < game.ship.r + p.r){ p.dead=true; game.missilesLeft += 2; updateHUD(); }
      }
    }
      if(game.ship && game.ship.inv<=0){ for(const a of game.asts){ if(a.dead) continue; if(dist(game.ship.x,game.ship.y,a.x,a.y) < a.r + game.ship.r*0.6){ applyDamage(a,2); game.lives--; updateHUD(); bumpMusicTempo(); explode(game.ship.x,game.ship.y,'#00ffa6'); if(game.lives<=0){ gameOver(); } else { game.ship.reset(); } break; } } }
    }

    function updateProgression(){ const d=game.destroyed; game.weaponStage = d>=80?4 : d>=50?3 : d>=25?2 : d>=10?1 : 0; }

    function fireMissile(){ if(game.missilesLeft<=0 || !game.ship) return; game.missilesLeft--; updateHUD(); game.missiles.push(new Missile(game)); noiseSplash(0.12,0.2); }

    function missileExplode(x,y){ explode(x,y,'#ff7b00'); aoeDamage(x,y,88); 
for (const bh of game.blackholes) {if (bh.dead) continue;let dx = Math.abs(x - bh.x), dy = Math.abs(y - bh.y);dx = dx > game.w * 0.5 ? game.w - dx : dx;dy = dy > game.h * 0.5 ? game.h - dy : dy;if (Math.hypot(dx, dy) < 88 + bh.r) {bh.dead = true;}}for(let i=0;i<3;i++){ const ang=rnd(0,TAU), d=rnd(10,40); const fx=x+Math.cos(ang)*d, fy=y+Math.sin(ang)*d; game.flames.push(new Flame(fx,fy,rnd(28,46), rnd(0.8,1.6))); } }

    function aoeDamage(x,y,r){ for(const a of game.asts){ if(a.dead) continue; const d=dist(x,y,a.x,a.y); if(d < r){ const scale = 1 + (r - d)/r; applyDamage(a, Math.ceil(scale*2)); } } }

    function gameOver(){ overlay.dataset.state='gameover'; game.paused=true; stopMusic(); overlay.style.display='flex'; titleEl.innerHTML='Game Over — <span style="color:var(--bad)">AstroCats Neon</span>'; subtitleEl.innerHTML=`Final Score: <strong>${game.score}</strong> • Cat-roids destroyed: <strong>${game.destroyed}</strong>`; startBtn.textContent='Play Again'; pauseBtn.setAttribute('aria-pressed','true'); pauseBtn.textContent='Paused';started = false; const pname = JSON.parse(localStorage.getItem(NAME_KEY) || '""') || 'Anonymous';const ts = Date.now();if (game.score > 0) addScore(pname, game.score, game.level, game.destroyed, ts);window._lastScoreTs = ts;renderLeaderboard();}

    // --- Backdrop ---
    function drawBackdrop(){ const w=window.innerWidth, h=window.innerHeight; ctx.save(); ctx.strokeStyle='rgba(138,43,226,0.08)'; ctx.lineWidth=1; ctx.shadowBlur=0; const step=40; ctx.beginPath(); for(let x=0;x<w;x+=step){ ctx.moveTo(x,0); ctx.lineTo(x,h); } for(let y=0;y<h;y+=step){ ctx.moveTo(0,y); ctx.lineTo(w,y); } ctx.stroke(); const t=Date.now()*0.001; for(let i=0;i<60;i++){ const sx=(i*127.1)%w; const y=(i*83.3 + (t*10*i)%h)%h; const glow=(i%7===0)?10:6; ctx.beginPath(); ctx.fillStyle='rgba(24,240,255,0.2)'; ctx.shadowColor='#18f0ff'; ctx.shadowBlur=glow; ctx.arc(sx,y,1,0,TAU); ctx.fill(); } ctx.restore(); }
    function drawBossBar(){if(!game.bossActive || !game.boss || game.boss.dead) return;const b=game.boss, t=Math.max(0, Math.min(1, b.hp/(b.maxHp||1)));const w=Math.min(420, game.w*0.6), h=14, x=(game.w-w)/2, y=64;ctx.save();ctx.globalAlpha=0.95;ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(x,y,w,h);ctx.strokeStyle='rgba(138,43,226,0.6)'; ctx.lineWidth=2; ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);ctx.fillStyle='#ff2f92'; ctx.fillRect(x,y,w*t,h);ctx.shadowColor='#18f0ff'; ctx.shadowBlur=8; ctx.font='12px ui-monospace, monospace'; ctx.fillStyle='#c7f5ff'; ctx.textAlign='center'; ctx.textBaseline='bottom'; ctx.fillText('BOSS', x+w/2, y-2); ctx.restore();}
    function drawLaserHeatBar(){const t = game.laserHeat || 0; const w = 160, h = 8, x = game.w - w - 18, y = 96; ctx.save();ctx.globalAlpha = 0.95; ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x,y,w,h); ctx.strokeStyle='rgba(24,240,255,0.6)'; ctx.lineWidth=2; ctx.strokeRect(x+0.5,y+0.5,w-1,h-1); if (game.laserOverheated) {   ctx.fillStyle = '#ff2f92'; ctx.fillRect(x,y,w,h);   ctx.font='12px ui-monospace, monospace'; ctx.fillStyle='#c7f5ff'; ctx.textAlign='right'; ctx.textBaseline='bottom';   ctx.fillText('OVERHEAT', x+w, y-2); } else {   ctx.fillStyle = '#18f0ff'; ctx.fillRect(x,y,w*t,h);   ctx.font='12px ui-monospace, monospace'; ctx.fillStyle='#c7f5ff'; ctx.textAlign='right'; ctx.textBaseline='bottom';   ctx.fillText('LASER', x+w, y-2); } ctx.restore();}
    
    // --- Leaderboard (LocalStorage) ---
const LB_KEY = 'acn_highscores_v1';
const NAME_KEY = 'acn_player_name';

function _lsGet(key, fallback=null){
  try{ const v = localStorage.getItem(key); return v==null? fallback : JSON.parse(v); }
  catch(e){ return fallback; }
}
function _lsSet(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); } catch(e){}
}
function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

function loadScores(){ return _lsGet(LB_KEY, []); }
function saveScores(arr){ _lsSet(LB_KEY, arr.slice(0, 20)); }

function addScore(name, score, level, destroyed, ts){
  const arr = loadScores();
  const entry = {
    name: (name||'Anonymous').slice(0,16),
    score: Number(score)||0,
    level: Number(level)||1,
    destroyed: Number(destroyed)||0,
    ts: (typeof ts === 'number' ? ts : Date.now())

  };
  arr.push(entry);
  arr.sort((a,b)=> (b.score - a.score) || (a.ts - b.ts)); // score desc, older first on ties
  saveScores(arr);
  return arr;
}

function renderLeaderboard(){
  const el = document.getElementById('leaderboard');
  if(!el) return;
  const list = loadScores().slice(0, 10);
  if(list.length===0){
    el.innerHTML = '<div class="bottomhelp">No scores yet — be the first!</div>';
    return;
  }
  el.innerHTML =
    '<ol style="margin:0;padding-left:18px;">' +
      list.map((r,i)=> `
        <li class="lb-item">
          <span class="lb-name">${escapeHtml(r.name)}</span>
          <span class="lb-score">${r.score}</span>
          <span class="lb-meta">L${r.level}&nbsp;•&nbsp;${r.destroyed} KOs</span>
        </li>`).join('') +
    '</ol>';
}
    
    // --- UI wiring ---
    const toggleAudioBtn=document.getElementById('toggleAudio'); const toggleMusicBtn=document.getElementById('toggleMusic'); const pauseBtn=document.getElementById('pauseBtn'); const testStatus=document.getElementById('testStatus');
    const overlay=document.getElementById('startOverlay'); const startBtn=document.getElementById('startBtn'); const titleEl=overlay.querySelector('h1'); const subtitleEl=overlay.querySelector('.subtitle');
    overlay.dataset.state = 'start';

// Leaderboard wiring
const nameInput   = document.getElementById('playerName');
const saveNameBtn = document.getElementById('saveNameBtn');
const clearLbBtn  = document.getElementById('clearLbBtn');

if (nameInput)  nameInput.value = (_lsGet(NAME_KEY, null) ?? localStorage.getItem(NAME_KEY) ?? '') || '';
if (saveNameBtn) saveNameBtn.addEventListener('click', ()=>{
  const v = (nameInput?.value || '').trim().slice(0,16);
  // persist preferred name for future runs
  try { localStorage.setItem(NAME_KEY, JSON.stringify(v)); } catch(e){}
  // if we just finished a game, also rename the most recent submitted score
  if (window._lastScoreTs) {
    const arr = loadScores();
    const i = arr.findIndex(r => r.ts === window._lastScoreTs);
    if (i !== -1) {
      arr[i].name = v || 'Anonymous';
      saveScores(arr);
    }
  }
  renderLeaderboard();
});
if (clearLbBtn) clearLbBtn.addEventListener('click', ()=>{
  try { localStorage.removeItem(LB_KEY); } catch(e){}
  renderLeaderboard();
});

// initial render on load
renderLeaderboard();

    function togglePause(){ game.paused=!game.paused; pauseBtn.setAttribute('aria-pressed', game.paused?'true':'false'); pauseBtn.textContent= game.paused? 'Paused':'Pause'; }

    toggleAudioBtn.addEventListener('click',()=>{ audioEnabled=!audioEnabled; toggleAudioBtn.setAttribute('aria-pressed', audioEnabled?'true':'false'); toggleAudioBtn.textContent=`Audio: ${audioEnabled?'On':'Off'}`; if(audioEnabled){ initAudio(); if(musicEnabled) startMusic(); } else { stopMusic(); } });
    toggleMusicBtn.addEventListener('click',()=>{ musicEnabled=!musicEnabled; toggleMusicBtn.setAttribute('aria-pressed', musicEnabled?'true':'false'); toggleMusicBtn.textContent=`Music: ${musicEnabled?'On':'Off'}`; if(musicEnabled){ if(!AC) initAudio(); startMusic(); } else { stopMusic(); } });
    pauseBtn.addEventListener('click',()=>{ togglePause(); });

    // --- Start flow ---
    let started=false;
    function startGame(){
      if(started) return; started=true;
      overlay.style.display='none';
      window._lastScoreTs = null;
      overlay.dataset.state = 'start';
      try {
        if(!AC) initAudio();
        if(AC && AC.state==='suspended') { AC.resume().catch(()=>{}); }
        if(musicEnabled) { try{ startMusic(); }catch(e){ console.warn('startMusic failed', e); } }
      } catch(err){ console.warn('Audio init/start error', err); }
      try{ reset(); }catch(e){ console.error('reset() failed', e); }
      game.paused=false;
      pauseBtn.setAttribute('aria-pressed','false');
      pauseBtn.textContent='Pause';
      last=performance.now();
      console.log('Game started');
    }
    startBtn.addEventListener('click', startGame);
    window.addEventListener('keydown',(e)=>{ if(overlay.style.display!=='none' && (e.code==='Enter'||e.code==='Space')) startGame(); });

    // --- Loop ---
    let last=performance.now();
    function tick(now){ const dt=Math.min(0.033,(now-last)/1000); last=now; if(!game.paused && game.ship){
        game.ship.update(dt);
        for(const b of game.bullets) b.update(dt);
        for(const eb of game.enemyBullets) eb.update(dt);
        for(const er of game.enemyMissiles) er.update(dt);
        for(const m of game.missiles) m.update(dt);
        for(const f of game.flames) f.update(dt);
        for(const a of game.asts) a.update(dt);
        for(const bh of game.blackholes) bh.update(dt);
        for(const p of game.parts) p.update(dt);
        for(const pk of game.pickups) pk.update(dt);
        game.bullets=game.bullets.filter(b=>!b.dead);
        game.enemyBullets=game.enemyBullets.filter(b=>!b.dead);
        game.enemyMissiles=game.enemyMissiles.filter(r=>!r.dead);
        game.missiles=game.missiles.filter(m=>!m.dead);
        game.flames=game.flames.filter(f=>f.life>0);
        game.asts=game.asts.filter(a=>!a.dead);
        const hasBoss = game.asts.some(a=>a.type==='boss' && !a.dead);
        if(!hasBoss){ game.bossActive=false; game.boss=null; }
        game.blackholes=game.blackholes.filter(bh=>!bh.dead);
        game.parts=game.parts.filter(p=>p.life>0);
        game.pickups=game.pickups.filter(p=>!p.dead);
        if(game.asts.length===0){ game.level++; game.blackHoleCatAdded=false; spawnWave(); updateHUD(); }
        handleCollisions();
      }
      ctx.clearRect(0,0,canvas.width,canvas.height);
      drawBackdrop();
      for(const p of game.parts) p.draw();
      for(const bh of game.blackholes) bh.draw();
      for(const a of game.asts) a.draw();
      for(const b of game.bullets) b.draw();
      for(const eb of game.enemyBullets) eb.draw();
      for(const er of game.enemyMissiles) er.draw();
      for(const m of game.missiles) m.draw();
      for(const f of game.flames) f.draw();
      for(const pk of game.pickups) pk.draw();
      if(game.ship) game.ship.draw();
      if (game.bossActive && game.boss && !game.boss.dead) drawBossBar();
      drawLaserHeatBar();
      requestAnimationFrame(tick);
    }
    // Boot
    resize();
    requestAnimationFrame(tick);
  })();