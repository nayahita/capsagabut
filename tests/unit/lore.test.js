const fs=require('fs'),src=require('path').join(__dirname,'../../src/')+'/';
const store={};global.localStorage={getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]}};
global.window=global;global.addEventListener=()=>{};
const doc=new EventTarget();doc.createElement=()=>({});doc.head={appendChild(){}};doc.body={appendChild(){}};doc.querySelector=()=>null;doc.querySelectorAll=()=>[];global.document=doc;
global.CustomEvent=class extends Event{constructor(t,o){super(t);this.detail=o&&o.detail}};
global.matchMedia=()=>({matches:false});
// old reputation from v10, to check the migration
store['capsa-rep-v1']=JSON.stringify({ana:{name:'Ana',rounds:20,wins:9,lastCardLosses:3}});
const perfs=[];let N=['Ana','Budi','Cici','Dodi'];let roomInfo=null;const saved=[];
global.CapsaFX={view:()=>({authority:true,names:N,timer:30,online:false}),broadcast:(t,d)=>perfs.push(d),holdTimer(){},duck(){},label:c=>'c'+c,soundOn:()=>false,
  room:()=>roomInfo,fact:(t,d)=>CapsaEvents.ingest(t,d)};
for(const f of ['i18n.js','reactions.config.js','events.js','stats.js','lore.js','reactions.js','comedy/config.js','comedy/director.js','comedy/memory.js','comedy/bits.js'])eval(fs.readFileSync(src+f,'utf8'));
const E=CapsaEvents,D=CapsaComedy,L=CapsaLore,M=CapsaMemory,wait=ms=>new Promise(r=>setTimeout(r,ms));
const sigs=[];E.on('*',ev=>{if(ev&&/^MEM_/.test(ev.type))sigs.push(ev)});
let fails=0;const ok=(n,c,x)=>{if(!c)fails++;console.log((c?'PASS ':'FAIL ')+n+(x&&!c?'  → '+x:''))};
let score=[0,0,0,0],R=0,pids=null;
const has=t=>sigs.some(s=>s.type===t);const take=t=>sigs.filter(s=>s.type===t);
function game(names){N=names;score=names.map(()=>0);R=0;const d=CapsaHooks.gameStart?(()=>{const x={names};CapsaHooks.gameStart(x);return x})():{names};pids=d.pids;E.ingest('game:start',d)}
function start(starter=0){R++;E.ingest('round:start',{round:R,names:N,pids,scores:score,starter})}
function play(seat,counts,extra={}){E.ingest('play',Object.assign({seat,name:N[seat],combo:'Satuan',cat:0,size:1,cards:[8],counts,prev:{combo:'Satuan',size:1,cards:[4],by:(seat+N.length-1)%N.length},t:Date.now(),thinkMs:4000,cancels:0},extra))}
function pass(seat,extra={}){E.ingest('pass',Object.assign({seat,name:N[seat],timeout:false,hadPlay:false,could:[],counts:N.map(()=>5),table:{combo:'Satuan',by:(seat+N.length-1)%N.length},thinkMs:3000,cancels:0},extra))}
function end(w,counts,o={}){const pen=counts.map((c,i)=>i===w?0:c*(c===13?3:c>=10?2:1)),before=[...score];const tot=pen.reduce((a,b)=>a+b,0);score=score.map((s,i)=>i===w?s+tot:s-pen[i]);
  E.ingest('round:end',Object.assign({round:R,winner:w,how:'habis',names:N,counts,hands:counts.map((c,i)=>Array.from({length:c},(_,k)=>((k+i)%11)*4+(i%4))),penalties:pen,scoresBefore:before,scoresAfter:[...score],final:{combo:'Satuan',cards:[40]},delay:0,dealt:N.map(()=>({twos:0,high:1,quad:false,score:50}))},o))}
setInterval(()=>{},1000).unref();
(async()=>{
  Object.assign(D.settings.budget,{micro:{perRound:99,gapMs:0},stage:{perRound:99,gapMs:0}});Math.random=()=>0.999;
  // ---- identity
  ok('old reputation migrated into a profile', Object.values(L.data().profiles).some(p=>p.name==='Ana'));
  game(['Ana','Budi','Cici','Dodi']);
  ok('Ana resolved to the migrated profile', L.profile(pids[0]).name==='Ana' && /^p_/.test(pids[0]));
  ok('new names are pending (no profile stored before a round ends)', !L.data().profiles[pids[1]] && !!L.profile(pids[1]));
  ok('memory keys players by pid', M.pidOf('Budi')===pids[1]);
  start(0);
  for(let k=0;k<7;k++)play(2,[9,9,9,9],{prev:null,combo:'Pair',size:2,cards:[4,5]});   // Cici always leads a Pair
  E.ingest('chat',{seat:3,name:'Dodi',text:'salah buang gua',confession:true,counts:[9,9,9,9]});
  pass(3,{hadPlay:true,could:['Satuan']});
  ok('confession then the same kind of mistake → MEM_REPEAT_MISTAKE', has('MEM_REPEAT_MISTAKE'));
  pass(1,{thinkMs:26000,cancels:3});
  ok('long think + cancels then pass → MEM_DITHER', take('MEM_DITHER').some(s=>s.secs===26&&s.cancels===3));
  E.ingest('reveal',{seat:3,name:'Dodi',count:9,cards:[1,2,3]});
  ok('show hand → MEM_REVEAL', has('MEM_REVEAL'));
  end(0,[0,9,9,11],{dealt:[{twos:0,high:1,quad:false,score:40},{twos:2,high:4,quad:false,score:70},{twos:0,high:1,quad:false,score:50},{twos:0,high:0,quad:false,score:30}]});
  await wait(10);
  ok('profiles stored after the first round', !!L.data().profiles[pids[1]]);
  ok('strong dealt hand but lost with 9 → MEM_WASTED_HAND', take('MEM_WASTED_HAND').some(s=>s.name==='Budi'));
  ok('showed cards then lost → MEM_REVEAL_RESOLVED lost', take('MEM_REVEAL_RESOLVED').some(s=>s.outcome==='lost'&&s.name==='Dodi'));
  ok('reputation counters live in the lore (Ana rounds 20→21)', L.counters(pids[0]).rounds===21);
  // a few more rounds then end the match
  for(let k=0;k<4;k++){start(0);E.ingest('chat',{seat:1,name:'Budi',text:'EZ',trash:true,counts:[9,9,9,9]});end(0,[0,8,3,4]);await wait(5)}
  E.ingest('match:end',{reason:'setup',rounds:R,names:N,pids,scores:score});
  await wait(10);
  const dB=L.dossier(pids[1]),dC=L.dossier(pids[2]);
  ok('match:end → dossier matches + moments', dB&&dB.matches===1&&dB.moments.length>0, JSON.stringify(dB&&dB.moments));
  ok('trash talk that lost becomes a legend', dB.legends.some(x=>x.text==='EZ'));
  ok('lead habit stored (Cici: Pair x7)', dC.lead.Pair===7);
  ok('head-to-head stored', L.h2h(pids[0],pids[1]).a>=5);
  ok('table notes per group of players', L.table().matches===1);
  ok('moments carry timestamps; embarrassing ones quotable for 24 h', L.quotable(pids[1]).length>0 && L.quotable(pids[1],Date.now()+25*3600e3).filter(m=>m.bad).length===0);
  // ---- second match, Budi renamed to "Budi Santoso"? no: types "Budii" → similar
  ok('similar name → asks', L.resolve('Budii').status==='similar' && L.resolve('Budii').pid===pids[1]);
  const oldB=pids[1];L.decisions['budii']=pids[1];
  sigs.length=0;game(['Ana','Budii','Cici']);
  ok('decision links the new spelling to the old profile', pids[1]===oldB&&L.profile(pids[1]).name==='Budii'&&L.profile(pids[1]).aliases.includes('Budi'));
  start(2);
  ok('returning players → MEM_RETURNING (with title)', take('MEM_RETURNING').length===3 && take('MEM_RETURNING')[0].title);
  play(2,[13,13,12],{prev:null,combo:'Satuan',size:1,cards:[0]});
  ok('Cici breaks her Pair habit → MEM_HABIT_BROKEN', take('MEM_HABIT_BROKEN').some(s=>s.habit==='Pair'&&s.now==='Satuan'));
  // ---- director gating
  Math.random=()=>0;
  Object.assign(D.settings.budget,{micro:{perRound:99,gapMs:0},stage:{perRound:99,gapMs:0}});
  await wait(10);D.state.lastW={micro:0,stage:0};
  // fatigue: Budi gets hit twice in a round window, third time is skipped
  D.state.targets=[{k:pids[1],round:R},{k:pids[1],round:R}];
  perfs.length=0;pass(1,{timeout:true});await wait(10);console.log('   ',D.log().slice(-4).join(' || '),'| perfs',perfs.map(p=>p.id));
  ok('target fatigue: Budi hit twice in 3 rounds → masih-di-sana skipped', !perfs.some(p=>p.id==='masih-di-sana') && D.log().some(l=>/target fatigue/.test(l)));
  D.state.targets=[];
  // busy table: 3 chats in 10 s → micro bits held
  for(let k=0;k<3;k++)E.ingest('chat',{seat:0,name:'Ana',text:'wkwk',counts:[13,9,12]});
  perfs.length=0;E.ingest('chat',{seat:0,name:'Ana',text:'EZ',trash:true,counts:[13,9,12]});await wait(10);
  ok('busy table → micro bit "noted" held back', !perfs.some(p=>p.id==='noted') && D.log().some(l=>/table is busy/.test(l)));
  // ledger written
  ok('bits that played are written to the lore ledger', L.data().ledger.length>0, JSON.stringify(L.data().ledger.slice(-2)));
  // spiral
  N=['Ana','Budii','Cici'];
  for(let k=0;k<6;k++){start(0);end(0,[0,12,2]);await wait(5)}
  ok('Budii 5+ losses, last by far → MEM_SPIRAL + memory.spiral()', has('MEM_SPIRAL') && M.spiral('Budii'));
  perfs.length=0;D.state.targets=[];start(0);pass(1,{timeout:true});await wait(10);
  ok('spiraling player is left alone (no masih-di-sana)', !perfs.some(p=>p.id==='masih-di-sana') && D.log().some(l=>/spiral/.test(l)));
  // feedback: quick dismissals lower the odds
  for(let k=0;k<4;k++)E.ingest('bit:feedback',{kind:'dismiss'});
  ok('quick dismissals are counted', D.state.fb.filter(x=>x.v<0).length===4);
  // ---- room backend: only the host writes
  const before=JSON.stringify(L.data());
  roomInfo={code:'ABCD',isHost:false,saveLore:o=>saved.push(o)};
  document.dispatchEvent(new CustomEvent('capsa:lore',{detail:{code:'ABCD',data:{profiles:{p_x:{name:'Zed',aliases:[],uids:{u1:true},matches:3}},dossier:{p_x:{c:{rounds:30,wins:20}}}}}}));
  ok('room lore loaded', L.mode()==='room' && L.profile('p_x').name==='Zed');
  L.bump('p_x','wins');await wait(800);
  ok('non-host cannot write room lore', L.counters('p_x').wins===20 && saved.length===0);
  roomInfo.isHost=true;L.bump('p_x','wins');await wait(900);
  ok('host writes room lore (debounced)', saved.length===1 && saved[0].dossier.p_x.c.wins===21);
  const ps=L.assign(['Zedd','Yan'],{uids:['u1','u2']});
  ok('online: uid finds the profile even after a rename', ps[0]==='p_x' && L.profile('p_x').name==='Zedd' && L.profile('p_x').aliases.includes('Zed'));
  document.dispatchEvent(new CustomEvent('capsa:lore',{detail:{code:null}}));
  ok('leaving the room switches back to device notes', L.mode()==='local' && JSON.stringify(L.data()).length>=before.length-50);
  console.log(fails?`\n${fails} FAILED`:'\nall passed');process.exit(0);
})();
