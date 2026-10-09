const fs=require('fs'),src=require('path').join(__dirname,'../../src/')+'/';
const store={};global.localStorage={getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v)}};
global.window=global;global.addEventListener=()=>{};global.CustomEvent=class extends Event{constructor(t,o){super(t);this.detail=o&&o.detail}};const doc=new EventTarget();doc.createElement=()=>({});doc.head={appendChild(){}};doc.body={appendChild(){}};doc.querySelector=()=>null;doc.querySelectorAll=()=>[];global.document=doc;
global.matchMedia=()=>({matches:false});
const perfs=[];const N=['Ana','Budi','Cici','Dodi'];
global.CapsaFX={view:()=>({authority:true,names:N,timer:30,online:false}),broadcast:(t,d)=>perfs.push(d),holdTimer(){},duck(){},label:c=>'c'+c,soundOn:()=>false};
for(const f of ['i18n.js','reactions.config.js','events.js','stats.js','lore.js','reactions.js','comedy/config.js','comedy/director.js','comedy/memory.js','comedy/bits.js'])eval(fs.readFileSync(src+f,'utf8'));
const LASTMODE=process.argv[2]!=='points';const E=CapsaEvents,D=CapsaComedy,wait=ms=>new Promise(r=>setTimeout(r,ms));
let fake=0;const realNow=Date.now;Date.now=()=>realNow()+fake;
(async()=>{let tot=0,rounds=0;const by={},ids={};
for(let m=0;m<20;m++){E.ingest('game:start',{names:N});await wait(2);let score=[0,0,0,0];
 for(let R=1;R<=12;R++){rounds++;E.ingest('round:start',{round:R,names:N,scores:score,starter:R%4});
  const w=Math.floor(Math.random()*4);const counts=N.map((_,i)=>i===w?0:(Math.random()<.07?1:2+Math.floor(Math.random()*9)));
  for(let p=0;p<14;p++){fake+=7000;const s=p%4;
   if(Math.random()<.55)E.ingest('play',{seat:s,name:N[s],combo:Math.random()<.3?'Pair':'Satuan',cat:0,size:Math.random()<.3?2:1,cards:[Math.floor(Math.random()*52)],counts:counts.map(c=>Math.max(c,1)),prev:Math.random()<.2?null:{combo:'Satuan',size:1,cards:[3],by:(s+3)%4},t:Date.now()});
   else E.ingest('pass',{seat:s,name:N[s],timeout:Math.random()<.04,hadPlay:Math.random()<.4,counts,table:{combo:'Satuan',by:(s+3)%4}});
   if(Math.random()<.015)E.ingest('chat',{seat:s,name:N[s],text:'EZ',trash:true,counts});
   await wait(1);}
  let pen,before=[...score];
  if(LASTMODE){const others=[0,1,2,3].filter(i=>i!==w).sort(()=>Math.random()-.5),loser=others[2],order=[w,others[0],others[1]];
    const c2=counts.map((c,i)=>i===loser?c:0);pen=c2.map((c,i)=>i===loser?c*(c===13?3:c>=10?2:1):0);score=score.map((x,i)=>i===loser?x+1:x);
    E.ingest('round:end',{round:R,winner:w,loser,order:[...order,loser],mode:'last',how:'habis',names:N,counts:c2,hands:c2.map(c=>Array.from({length:c},()=>Math.floor(Math.random()*52))),penalties:pen,scoresBefore:before,scoresAfter:[...score],final:{combo:'Satuan',cards:[40]},delay:0});
  }else{
  pen=counts.map((c,i)=>i===w?0:c*(c===13?3:c>=10?2:1));const t=pen.reduce((a,b)=>a+b,0);score=score.map((x,i)=>i===w?x+t:x-pen[i]);
  E.ingest('round:end',{round:R,winner:w,how:Math.random()<.05?'bomb':'habis',names:N,counts,hands:counts.map((c,i)=>Array.from({length:c},(_,k)=>Math.floor(Math.random()*52))),penalties:pen,scoresBefore:before,scoresAfter:[...score],final:{combo:'Satuan',cards:[40]},delay:0});}
  await wait(3);fake+=8000;}}
perfs.forEach(p=>{by[p.weight]=(by[p.weight]||0)+1;by[p.rarity]=(by[p.rarity]||0)+1;if(p.weight==='stage')ids[p.id]=(ids[p.id]||0)+1});
console.log(`${perfs.length} perf / ${rounds} rounds = ${(perfs.length/rounds).toFixed(2)}/round`,JSON.stringify(by));
console.log(Object.entries(ids).sort((a,b)=>b[1]-a[1]).map(x=>x.join(':')).join('  '));
process.exit(0)})();
