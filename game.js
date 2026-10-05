(() => {
const c=document.getElementById('game'),ctx=c.getContext('2d');
const W=c.width,H=c.height;
const keys={};
const player={x:300,y:280,w:22,h:28,hp:100,maxHp:100,mana:50,maxMana:50,level:1,xp:0,next:100,gold:50,damage:18,speed:3.2};
const inventory={Poción:3,'Madera':0,'Hierro':0,'Cristal':0};
const enemies=[
 {x:600,y:180,hp:45,maxHp:45,name:'Slime Verde',damage:5,alive:true,respawn:0},
 {x:720,y:350,hp:60,maxHp:60,name:'Lobo Sombrío',damage:8,alive:true,respawn:0},
 {x:520,y:410,hp:35,maxHp:35,name:'Goblin',damage:7,alive:true,respawn:0}
];
const logs=[];
function log(s){logs.unshift(s);if(logs.length>8)logs.pop();document.getElementById('log').innerHTML=logs.map(x=>`<div class="logline">${x}</div>`).join('')}
function save(){try{localStorage.setItem('etheria_save',JSON.stringify({player,inventory}))}catch{}}
function load(){try{const s=JSON.parse(localStorage.getItem('etheria_save'));if(s){Object.assign(player,s.player);Object.assign(inventory,s.inventory)}}catch{}}
load(); log('Bienvenido a la Aldea de Lumen.');
addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(e.key===' '){e.preventDefault();attack()}if(e.key.toLowerCase()==='i')renderUI();if(e.key.toLowerCase()==='e')interact()});
addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);

function attack(){
 let target=null,dist=999;
 for(const m of enemies){if(!m.alive)continue;const d=Math.hypot(player.x-m.x,player.y-m.y);if(d<75&&d<dist){target=m;dist=d}}
 if(!target){log('No hay enemigo al alcance.');return}
 target.hp-=player.damage; log(`⚔ Golpeas a ${target.name} por ${player.damage}.`);
 if(target.hp<=0){target.alive=false;target.respawn=5000;const gold=8+Math.floor(Math.random()*10);player.gold+=gold;player.xp+=30;inventory.Madera+=Math.random()<.55?1:0;inventory.Hierro+=Math.random()<.25?1:0;log(`☠ ${target.name} derrotado. +${gold} oro, +30 EXP.`);checkLevel()}
 save();renderUI();
}
function checkLevel(){
 while(player.xp>=player.next){player.xp-=player.next;player.level++;player.next=Math.floor(player.next*1.45);player.maxHp+=20;player.hp=player.maxHp;player.maxMana+=8;player.mana=player.maxMana;player.damage+=5;log(`✨ ¡Nivel ${player.level}! Tu poder aumenta.`)}
}
function interact(){
 if(Math.hypot(player.x-180,player.y-250)<70){inventory.Poción++;log('🧪 La curandera te entrega una poción.');renderUI();save();return}
 if(Math.hypot(player.x-400,player.y-120)<70){inventory.Cristal++;log('💎 Encuentras un Cristal de Etheria.');renderUI();save();return}
 log('No hay nada interesante cerca.');
}
function update(){
 let dx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0);
 let dy=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);
 if(dx||dy){const l=Math.hypot(dx,dy);player.x+=dx/l*player.speed;player.y+=dy/l*player.speed}
 player.x=Math.max(25,Math.min(W-25,player.x));player.y=Math.max(55,Math.min(H-25,player.y));
 for(const m of enemies){
  if(!m.alive){m.respawn-=16;if(m.respawn<=0){m.alive=true;m.hp=m.maxHp;log(`👹 ${m.name} ha reaparecido.`)};continue}
  const d=Math.hypot(player.x-m.x,player.y-m.y);
  if(d<130){m.x+=(player.x-m.x)/Math.max(d,1)*.45;m.y+=(player.y-m.y)/Math.max(d,1)*.45}
  if(d<32&&Math.random()<.025){player.hp=Math.max(0,player.hp-m.damage);log(`💥 ${m.name} te golpea por ${m.damage}.`);if(player.hp===0){player.x=300;player.y=280;player.hp=player.maxHp;player.gold=Math.max(0,player.gold-10);log('💀 Has caído. Regresas a la aldea y pierdes 10 oro.')}save()}
 }
 render();renderUI();requestAnimationFrame(update)
}
function rect(x,y,w,h,fill){ctx.fillStyle=fill;ctx.fillRect(x,y,w,h)}
function render(){
 ctx.clearRect(0,0,W,H);
 rect(0,0,W,H,'#17351f');
 // tiles
 for(let x=0;x<W;x+=32)for(let y=40;y<H;y+=32){ctx.strokeStyle='#214a2c';ctx.strokeRect(x,y,32,32)}
 // paths
 rect(0,245,W,70,'#5b513c');rect(350,40,80,H-40,'#5b513c');
 // water
 rect(760,50,160,120,'#214b68');
 // town
 rect(70,150,230,190,'#284b2f');rect(100,175,80,65,'#7a4935');rect(190,180,75,55,'#7a4935');
 ctx.fillStyle='#e5e7eb';ctx.font='bold 14px monospace';ctx.fillText('ALDEA DE LUMEN',105,265);
 // NPC
 drawChar(180,250,'#e7c66a');ctx.fillStyle='#fff';ctx.font='12px monospace';ctx.fillText('Curandera',145,280);
 // crystal
 rect(390,105,20,28,'#8be9fd');rect(396,95,8,12,'#c9f7ff');ctx.fillText('Cristal',378,150);
 // enemies
 for(const m of enemies)if(m.alive){drawMonster(m);bar(m.x-22,m.y-35,44,5,m.hp/m.maxHp,'#ef4444')}
 // player
 drawChar(player.x,player.y,'#60a5fa');ctx.fillStyle='#fff';ctx.font='12px monospace';ctx.fillText('Héroe',player.x-18,player.y-22);
}
function drawChar(x,y,color){rect(x-11,y-16,22,28,color);rect(x-9,y-25,18,12,'#f1c27d');rect(x-8,y-29,16,6,'#3f2b1f');}
function drawMonster(m){rect(m.x-13,m.y-12,26,24,'#86efac');rect(m.x-10,m.y-18,20,8,'#4ade80');rect(m.x-7,m.y-7,4,4,'#111');rect(m.x+3,m.y-7,4,4,'#111')}
function bar(x,y,w,p,color){rect(x,y,w,5,'#111');rect(x,y,w*Math.max(0,p),5,color)}
function renderUI(){
 document.getElementById('playerMini').textContent=`Nivel ${player.level} · ${player.xp}/${player.next} EXP · ${player.hp}/${player.maxHp} HP`;
 document.getElementById('stats').innerHTML=`<div>⚔ Daño: ${player.damage}</div><div>💰 Oro: ${player.gold}</div><div class="bar"><div class="fill hp" style="width:${player.hp/player.maxHp*100}%"></div></div><div>❤️ ${player.hp}/${player.maxHp}</div><div class="bar"><div class="fill xp" style="width:${player.xp/player.next*100}%"></div></div>`;
 document.getElementById('inventory').innerHTML=Object.entries(inventory).map(([k,v])=>`<div class="item"><span>${k}</span><b>${v}</b></div>`).join('');
}
renderUI();requestAnimationFrame(update);
})();