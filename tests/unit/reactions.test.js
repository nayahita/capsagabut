// Node harness: minimal browser stubs, then load the four modules exactly as the page does.
const fs=require('fs'),path=require('path').join(__dirname,'../../src/')+'/';
const store={};global.localStorage={getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v)}};
const shown=[];
function el(){return {className:'',innerHTML:'',isConnected:true,setAttribute(){},classList:{add(){},remove(){}},remove(){},appendChild(c){if(this.className==='rx-layer')shown.push(c)}}}
global.document={createElement:()=>el(),head:{appendChild(){}},body:{appendChild(){}}};
global.window=global;global.requestAnimationFrame=f=>setTimeout(f,0);global.matchMedia=()=>({matches:true});global.innerWidth=400;global.innerHeight=800;
global.CapsaFX={mascotSVG:e=>'',soundOn:()=>false,audio:()=>null,boardCenter:()=>[0,0]};
for(const f of ['reactions.config.js','events.js','stats.js','reactions.js'])eval(fs.readFileSync(path+f,'utf8'));
Object.assign(CapsaReactions.settings,{batchWindowMs:20,displayMs:30,gapMs:5});
const seen=[];CapsaEvents.on('*',e=>seen.push(e.type+':'+e.name));
const N=['Ana','Budi','Cici','Dodi'];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const title=c=>c.innerHTML.match(/rx-title">([^<]*)/)[1]+(c.innerHTML.match(/rx-tag">([^<]*)/g)||[]).map(t=>' ['+t.replace(/.*>/,'')+']').join('');
let score=[0,0,0,0];
function round(r,winner,counts,{passedWinner=false,deficitFor=null}={}){
  CapsaEvents.ingest('round:start',{round:r,names:N,scores:score});
  if(deficitFor!=null){const c=[13,13,13,13];c[deficitFor]=13;N.forEach((_,i)=>{if(i!==deficitFor)c[i]=7});CapsaEvents.ingest('play',{seat:0,counts:c})}
  if(passedWinner)CapsaEvents.ingest('pass',{seat:winner});
  const pen=counts.map((c,i)=>i===winner?0:c*(c===13?3:c>=10?2:1)),before=[...score];
  const tot=pen.reduce((a,b)=>a+b,0);score=score.map((s,i)=>i===winner?s+tot:s-pen[i]);
  CapsaEvents.ingest('round:end',{round:r,winner,how:'habis',names:N,counts,penalties:pen,scoresBefore:before,scoresAfter:[...score],delay:0});
}
const pass=(name,cond)=>console.log((cond?'PASS ':'FAIL ')+name);
(async()=>{
  CapsaEvents.ingest('game:start',{names:N});
  // R1: Ana comes back from 6 cards behind, never passes; Budi stuck on 1 card; Dodi holds 11
  round(1,0,[0,1,6,11],{deficitFor:0});
  await wait(120);
  const r1=seen.splice(0);
  pass('R1 detects WIN, LOSE x3, BAD_BEAT, COMEBACK, PERFECT',['PLAYER_WIN:Ana','BAD_BEAT:Budi','BIG_COMEBACK:Ana','PERFECT_WIN:Ana'].every(x=>r1.includes(x))&&r1.filter(x=>x.startsWith('PLAYER_LOSE')).length===3);
  console.log('   cards R1:',shown.map(title));
  pass('R1 shows 2 cards: comeback (with perfect+win tags) then bad beat',shown.length===2&&/Comeback/.test(title(shown[0]))&&/Perfect/.test(title(shown[0]))&&/Bad beat/.test(title(shown[1])));
  shown.length=0;
  // R2, R3: Ana again (passes, so not perfect) -> win streak 3 on R3; Dodi biggest loser in R3
  round(2,0,[0,4,5,8],{passedWinner:true});await wait(120);seen.length=0;shown.length=0;
  round(3,0,[0,3,4,12],{passedWinner:true});await wait(120);
  const r3=seen.splice(0);
  pass('R3 WIN_STREAK 3 for Ana',r3.includes('WIN_STREAK:Ana'));
  console.log('   cards R3:',shown.map(title));shown.length=0;
  // R4: Dodi (biggest penalty in R3, last on points) wins -> REVENGE + UPSET
  round(4,3,[5,6,7,0],{passedWinner:true});await wait(120);
  const r4=seen.splice(0);
  pass('R4 REVENGE_WIN for Dodi vs Ana',r4.includes('REVENGE_WIN:Dodi'));
  pass('R4 UPSET_WIN for Dodi',r4.includes('UPSET_WIN:Dodi'));
  console.log('   cards R4:',shown.map(title));shown.length=0;
  // R5-R7: Budi keeps losing -> LOSS_STREAK at 7 (lost R1..R7? R4 also) 
  for(let r=5;r<=7;r++){round(r,2,[4,9,0,3],{passedWinner:true});await wait(100)}
  const rl=seen.splice(0);
  pass('LOSS_STREAK fires for Budi',rl.some(x=>x==='LOSS_STREAK:Budi'));
  shown.length=0;
  // Stats counted even for events that never got a card
  const b=CapsaStats.get('Budi'),a=CapsaStats.get('Ana');
  pass(`stats: Ana wins=${a.wins} comebacks=${a.comebacks} perfects=${a.perfects} bestStreak=${a.bestWinStreak}`,a.wins===3&&a.comebacks===1&&a.perfects===1&&a.bestWinStreak===3);
  pass(`stats: Budi badBeats=${b.badBeats} rounds=${b.rounds} worstLoss=${b.worstLossStreak}`,b.badBeats===1&&b.rounds===7&&b.worstLossStreak>=4);
  // Cooldown: PLAYER_WIN with 10s cooldown shows once across two quick batches
  await wait(500);shown.length=0;const W=CAPSA_REACTIONS.events.TEST_CD={priority:20,cooldownMs:10000,title:'cd-test'};
  CapsaEvents.emit('TEST_CD',{name:'Ana'});await wait(60);CapsaEvents.emit('TEST_CD',{name:'Ana'});await wait(120);
  pass('cooldown blocks the repeat card (1 of 2 shown)',shown.filter(c=>/cd-test/.test(title(c))).length===1);shown.length=0;
  W.priority=95;CapsaEvents.emit('TEST_CD',{name:'Ana'});await wait(120);
  pass('priority 90+ overrides cooldown',shown.filter(c=>/cd-test/.test(title(c))).length===1);shown.length=0;
  // Spam: 8 separate batches while cards are slow -> queue capped
  Object.assign(CapsaReactions.settings,{displayMs:400});
  for(let k=0;k<8;k++){CapsaEvents.emit('BAD_BEAT',{name:'P'+k,cardsLeft:1});await wait(25)}
  await wait(400*6);
  pass(`spam capped: ${shown.length} cards shown for 8 bursts (max 1 showing + queue ${CapsaReactions.settings.maxQueue})`,shown.length<=1+CapsaReactions.settings.maxQueue+1&&shown.length<8);
  // Custom detector + reaction without touching the core
  CapsaEvents.defineDetector('round:end',(d,ctx,emit)=>{if(d.counts.every((c,i)=>i===d.winner||c>=8))emit('BLOWOUT',{seat:d.winner})});
  CAPSA_REACTIONS.events.BLOWOUT={priority:99,group:'winner',title:'Bantai!',texts:['{name} ngebantai meja.']};
  Object.assign(CapsaReactions.settings,{displayMs:30});shown.length=0;
  round(8,1,[9,0,10,8]);await wait(150);
  pass('custom BLOWOUT detector + reaction works',shown.some(c=>/Bantai/.test(title(c))));
})();
