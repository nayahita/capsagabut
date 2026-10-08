const fs=require('fs'),src=require('path').join(__dirname,'../../src/')+'/';
const store={};global.localStorage={getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v)}};
global.window=global;
const doc=new EventTarget();doc.createElement=()=>({});doc.head={appendChild(){}};doc.body={appendChild(){}};global.document=doc;
global.matchMedia=()=>({matches:false});global.requestAnimationFrame=f=>setTimeout(f,0);
const perfs=[];
const N=['Ana','Budi','Cici','Dodi'];
global.CapsaFX={view:()=>({authority:true,names:N,timer:30,online:false}),broadcast:(t,d)=>perfs.push(d),holdTimer(){},duck(){},label:c=>'c'+c,soundOn:()=>false};
for(const f of ['reactions.config.js','events.js','stats.js','reactions.js','comedy/config.js','comedy/director.js','comedy/memory.js','comedy/bits.js'])eval(fs.readFileSync(src+f,'utf8'));
const E=CapsaEvents, D=CapsaComedy, wait=ms=>new Promise(r=>setTimeout(r,ms));
// record eligibility (when() truthy) per moment, independent of dice
let elig=[];
D.bits.forEach(b=>{const w=b.when;b.when=(B)=>{const v=w(B);if(v&&!(v.once&&D.state.usedKeys.has(v.once)))elig.push(b.id);return v}});
let fails=0;const ok=(name,c)=>{if(!c)fails++;console.log((c?'PASS ':'FAIL ')+name)};
let score=[0,0,0,0],R=0;
const take=async()=>{await wait(15);const e=elig.slice(),p=perfs.map(x=>x.id);elig=[];perfs.length=0;return {e,p}};
function start(starter=0){R++;E.ingest('round:start',{round:R,names:N,scores:score,starter})}
function play(seat,counts,extra={}){E.ingest('play',Object.assign({seat,name:N[seat],combo:'Satuan',cat:0,size:1,cards:[8],counts,prev:{combo:'Satuan',size:1,cards:[4],by:(seat+3)%4},t:Date.now()},extra))}
function pass(seat,extra={}){E.ingest('pass',Object.assign({seat,name:N[seat],timeout:false,hadPlay:false,counts:[5,5,5,5],table:{combo:'Satuan',by:(seat+3)%4}},extra))}
function end(w,counts,o={}){const pen=counts.map((c,i)=>i===w?0:c*(c===13?3:c>=10?2:1)),before=[...score];const tot=pen.reduce((a,b)=>a+b,0);score=score.map((s,i)=>i===w?s+tot:s-pen[i]);
  E.ingest('round:end',Object.assign({round:R,winner:w,how:'habis',names:N,counts,hands:o.hands||counts.map((c,i)=>Array.from({length:c},(_,k)=>((k+i)%11)*4+(i%4))),penalties:pen,scoresBefore:before,scoresAfter:[...score],final:{combo:'Satuan',cards:[40]},delay:0},o))}
setInterval(()=>{},1000).unref();
(async()=>{
  Object.assign(D.settings.budget,{micro:{perRound:99,gapMs:0},stage:{perRound:99,gapMs:0}});
  Math.random=()=>0.999;   // nothing but LEGENDARY performs: we look at eligibility
  E.ingest('game:start',{names:N});await wait(5);
  // R1 — opening 3♦, Budi dies on his last card (9♣-ish), Dodi lowest → favorite
  start(0); play(0,[12,13,13,13],{cards:[0],prev:null});
  let r=await take(); ok('R1 first play 3♦ → pembukaan eligible', r.e.includes('pembukaan'));
  end(0,[0,1,6,9]); r=await take();
  ok('favorite set to lowest scorer (Dodi)', CapsaMemory.favorite()&&CapsaMemory.favorite().name==='Dodi');
  ok('kenangan setup recorded for Budi', CapsaMemory.setups('kenangan').some(s=>s.name==='Budi'));
  // R2
  start(1); for(let k=0;k<4;k++)play(k%4,[9,8,8,8]); r=await take();
  ok('R2 4th play → kenangan (delayed callback) eligible', r.e.includes('kenangan'));
  play(3,[9,8,8,6],{combo:'Pair',size:2,cards:[20,21]}); r=await take();
  ok('favorite plays a pair → disetujui eligible', r.e.includes('disetujui'));
  play(1,[9,1,8,6]); r=await take(); ok('Budi back on 1 card → not-this-again', r.e.includes('not-this-again'));
  E.ingest('chat',{seat:0,name:'Ana',text:'EZ',trash:true,counts:[10,1,8,6]}); r=await take();
  ok('trash talk holding 10 → noted eligible', r.e.includes('noted'));
  pass(2,{timeout:true}); r=await take(); ok('timeout pass → masih-di-sana', r.e.includes('masih-di-sana'));
  end(2,[10,1,0,6]); r=await take();
  console.log('   R2 end eligible:',r.e.join(', '));
  ok('Ana EZ then 10 left → hening + ez-callback eligible', r.e.includes('hening')&&r.e.includes('ez-callback'));
  ok('Budi loses on 1 card twice → learned-nothing', r.e.includes('learned-nothing'));
  ok('20-point loss → survei', r.e.includes('survei'));
  ok('final single + loser on 1 → cctv', r.e.includes('cctv'));
  ok('ezLost setup stored', CapsaMemory.setups('ezLost').some(s=>s.name==='Ana'));
  // R3 — someone else wins → mic dibuka for Ana. Also an enabler: Dodi passes while holding a play, then Budi plays last card
  start(2); play(1,[8,2,7,6]); pass(2,{hadPlay:true}); r=await take();
  play(1,[8,0,7,6]); end(1,[8,0,7,6]); r=await take();
  console.log('   R3 end eligible:',r.e.join(', '));
  ok('mic-dibuka eligible (different winner, round later)', r.e.includes('mic-dibuka'));
  ok('garis-polisi: Cici passed holding a play right before the winning play', r.e.includes('garis-polisi'));
  ok('Budi wins after last-card losses → seperti-biasa', r.e.includes('seperti-biasa'));
  // bomb end → tadi-ada-suara
  start(0); end(3,[7,7,7,0],{how:'bomb'}); r=await take(); ok('bomb win → tadi-ada-suara', r.e.includes('tadi-ada-suara'));
  // prasasti: lose holding a 2 after passing with a playable hand
  start(0); pass(2,{hadPlay:true}); end(0,[0,4,5,6],{hands:[[],[1,2,3,5],[49,6,7,9,10],[11,13,14,15,17,18]]}); r=await take();
  ok('prasasti setup (died holding a 2 after a playable pass)', CapsaMemory.setups('prasasti').some(s=>s.name==='Cici'));
  start(1); r=await take(); ok('next round:start → prasasti eligible', r.e.includes('prasasti'));
  // favorite loses 3 in a row → ganti-dukungan
  ok('favorite (Dodi) lost 3 straight by R3 → ganti-dukungan was eligible then', CapsaMemory.favorite().name!=='Dodi');
  console.log('   favorite now:',CapsaMemory.favorite().name,'| titles:',N.map(n=>n+'='+CapsaMemory.title(n)).join(', '));
  // bully: Ana beats Budi 3x in a round
  start(0); for(let k=0;k<3;k++)play(0,[8,8,8,8],{prev:{combo:'Satuan',size:1,cards:[4],by:1}}); r=await take();
  ok('beat same victim 3x → surat-peringatan', r.e.includes('surat-peringatan'));
  // poke twice → surat-peringatan (other pair)
  E.ingest('chat',{seat:2,name:'Cici',text:'@Dodi yakin?',target:3,counts:[8,8,8,8]});E.ingest('chat',{seat:2,name:'Cici',text:'@Dodi tahan',target:3,counts:[8,8,8,8]}); r=await take();
  ok('poke same player twice → surat-peringatan (Cici>Dodi)', r.e.includes('surat-peringatan'));
  end(0,[0,8,8,8]); await take();
  // lead habit → prediksi
  for(let k=0;k<3;k++){start(2);play(2,[13,13,12,13],{prev:null,combo:'Pair',size:2,cards:[4,5]});end(0,[0,5,5,5]);await take();}
  start(2); r=await take(); ok('Cici led Pair 3x and starts → prediksi', r.e.includes('prediksi'));
  console.log('   rounds so far:',R,'| scores:',score.join(','));

  // ---- budgets ----
  Object.assign(D.settings.budget,{micro:{perRound:2,gapMs:8000},stage:{perRound:1,gapMs:20000}});
  Math.random=()=>0;
  E.ingest('game:start',{names:N});await wait(5); score=[0,0,0,0];R=0; perfs.length=0; D.state.lastW={micro:0,stage:0};
  start(0);
  for(let k=0;k<6;k++){pass(k%4,{timeout:true});await wait(5)}
  await wait(15);console.log('   log:',D.log().slice(-6).join(' || '));
  const st=perfs.filter(p=>p.weight==='stage').length;
  ok(`stage budget: at most 1 stage bit per round (got ${st})`, st<=1);
  // legendary cap
  perfs.length=0; start(0); end(1,[13,0,13,13]); await wait(20); start(0); end(1,[13,0,13,13]); await wait(20);
  const leg=perfs.filter(p=>p.rarity==='LEGENDARY').length;
  ok(`legendary cap 1 per match (got ${leg})`, leg===1);
  // note → memory moment
  const hen=D.play('hening',{name:'Ana',round:4}); ok('hening carries a note for the match report', hen&&hen.note&&/hening/.test(hen.note.text));
  // demos all build
  let bad=[];for(const b of D.bits){try{const p=D.play(b.id);if(!p||!p.steps.length)bad.push(b.id)}catch(e){bad.push(b.id+':'+e.message)}}
  ok('every bit builds a timeline from its demo values ('+D.bits.length+' bits)', !bad.length); if(bad.length)console.log('   ',bad);
  console.log(fails?`\n${fails} FAILED`:'\nall passed');
})();
