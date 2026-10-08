// Minimal in-browser stand-in for the Firebase compat SDK (app/auth/database), shared across tabs via localStorage.
(function(){
  const KEY='__fakedb';
  const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){return {}}};
  const save=d=>localStorage.setItem(KEY,JSON.stringify(d));
  const parts=p=>p.split('/').filter(Boolean);
  const getAt=(d,p)=>{let c=d;for(const k of parts(p)){if(c==null||typeof c!=='object')return null;c=c[k]}return c===undefined?null:c};
  function norm(v){
    if(v&&typeof v==='object'){
      if(v['.sv']==='timestamp')return Date.now();
      const isArr=Array.isArray(v);const out=isArr?[]:{};let any=false;
      for(const k of Object.keys(v)){const n=norm(v[k]);if(n!==null&&n!==undefined){out[k]=n;any=true}}
      if(!any)return null;
      if(isArr){const o={};out.forEach((x,i)=>{if(x!=null)o[i]=x});const ks=Object.keys(o).map(Number);if(ks.length&&ks.every((k,i)=>k===i))return ks.map(k=>o[k]);return o}
      return out;
    }
    return v===undefined?null:v;
  }
  function setAt(d,p,v){
    const ps=parts(p);if(!ps.length)return norm(v)||{};
    let c=d;for(let i=0;i<ps.length-1;i++){if(c[ps[i]]==null||typeof c[ps[i]]!=='object')c[ps[i]]={};c=c[ps[i]]}
    const n=norm(v);if(n===null)delete c[ps[ps.length-1]];else c[ps[ps.length-1]]=n;
    return d;
  }
  function prune(o){if(!o||typeof o!=='object')return o;for(const k of Object.keys(o)){o[k]=prune(o[k]);if(o[k]==null||(typeof o[k]==='object'&&!Object.keys(o[k]).length))delete o[k]}return o}
  const listeners=[];
  let pushN=0;
  const uid='u'+Math.random().toString(36).slice(2,8);
  const disconnects=[];
  function snap(path,val){return {key:parts(path).pop()||null,ref:new Ref(path),val:()=>val==null?null:JSON.parse(JSON.stringify(val)),exists:()=>val!=null,
    forEach(cb){if(val&&typeof val==='object')for(const k of Object.keys(val)){if(cb(snap(path+'/'+k,val[k]))===true)break}}}}
  function notify(){
    const d=load();
    for(const L of [...listeners]){
      if(L.path==='.info/connected'||L.path==='.info/serverTimeOffset')continue;
      let v=getAt(d,L.path);
      if(L.ev==='value'){const j=JSON.stringify(v);if(j!==L.last){L.last=j;setTimeout(()=>L.fn(snap(L.path,v)),0)}}
      else if(L.ev==='child_added'){
        let keys=v&&typeof v==='object'?Object.keys(v):[];
        if(L.limit)keys=keys.sort().slice(-L.limit);
        for(const k of keys)if(!L.seen.has(k)){L.seen.add(k);const cv=v[k];setTimeout(()=>L.fn(snap(L.path+'/'+k,cv)),0)}
      }
    }
  }
  addEventListener('storage',e=>{if(e.key===KEY)notify()});
  function write(fn){const d=load();fn(d);prune(d);save(d);notify();return Promise.resolve()}
  class Query{
    constructor(path,o={}){this.path=path;this.o=o}
    orderByChild(c){return new Query(this.path,{...this.o,order:c})}
    endAt(v){return new Query(this.path,{...this.o,endAt:v})}
    limitToLast(n){return new Query(this.path,{...this.o,limit:n})}
    limitToFirst(n){return new Query(this.path,{...this.o,first:n})}
    _val(){let v=getAt(load(),this.path);if(v&&this.o.endAt!=null&&this.o.order){const o={};const g=x=>this.o.order.split('/').reduce((a,k)=>a==null?a:a[k],x);for(const k of Object.keys(v)){const x=g(v[k]);if(x!=null&&x<=this.o.endAt)o[k]=v[k]}v=o;if(this.o.first){const ks=Object.keys(v).sort((a,b)=>g(v[a])-g(v[b])).slice(0,this.o.first);const o2={};ks.forEach(k=>o2[k]=v[k]);v=o2}}return v}
    once(ev,cb,err){const s=snap(this.path,this._val());if(cb){setTimeout(()=>cb(s),0);return}return Promise.resolve(s)}
    on(ev,fn){
      if(this.path==='.info/connected'){setTimeout(()=>fn(snap(this.path,true)),5);return fn}
      if(this.path==='.info/serverTimeOffset'){setTimeout(()=>fn(snap(this.path,0)),0);return fn}
      const L={path:this.path,ev,fn,last:undefined,seen:new Set(),limit:this.o.limit};listeners.push(L);notify();return fn;
    }
    off(ev,fn){for(let i=listeners.length-1;i>=0;i--)if(listeners[i].path===this.path&&(!ev||listeners[i].ev===ev)&&(!fn||listeners[i].fn===fn))listeners.splice(i,1)}
  }
  class Ref extends Query{
    constructor(path){super(parts(path).join('/'))}
    get key(){return parts(this.path).pop()}
    child(p){return new Ref(this.path+'/'+p)}
    set(v){return write(d=>{const r=setAt(d,this.path,v);if(!parts(this.path).length)Object.assign(d,r)})}
    update(o){return write(d=>{for(const k of Object.keys(o))setAt(d,this.path+'/'+k,o[k])})}
    remove(){return this.set(null)}
    push(v){const k='e'+Date.now().toString(36)+String(++pushN).padStart(4,'0')+uid;const r=this.child(k);if(v!==undefined)r.set(v);return r}
    transaction(fn){const d=load();const cur=getAt(d,this.path);const nv=fn(cur);if(nv===undefined)return Promise.resolve({committed:false,snapshot:snap(this.path,cur)});return write(d2=>setAt(d2,this.path,nv)).then(()=>({committed:true,snapshot:snap(this.path,nv)}))}
    onDisconnect(){const path=this.path;return {set(v){disconnects.push([path,v]);return Promise.resolve()},cancel(){return Promise.resolve()}}}
  }
  const db={ref:p=>new Ref(p||'')};
  window.firebase={apps:[],initializeApp(){this.apps.push({})},auth:()=>({signInAnonymously:()=>Promise.resolve({user:{uid}})}),database:Object.assign(()=>db,{ServerValue:{TIMESTAMP:{'.sv':'timestamp'}}})};
  window.__fakeUid=uid;
})();
