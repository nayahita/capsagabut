# Social interaction system (quick chat, emotes, voice lines) on three phones + one pass-and-play phone.
# Run from anywhere: python3 tests/sim/social.py   (needs Playwright + Chromium). Exits 1 if a check fails.
import sys,asyncio,subprocess,time,os
from playwright.async_api import async_playwright
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
OUT=os.path.join(ROOT,'tests','sim','out');os.makedirs(OUT,exist_ok=True)
srv=subprocess.Popen([sys.executable,'-m','http.server','8766','--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
FAKE=open(os.path.join(ROOT,'tests','sim','fakefb.js')).read()
URL='http://127.0.0.1:8766/index.html'
fails=[]
def ok(name,cond,extra=''):
  print(('PASS ' if cond else 'FAIL ')+name+('' if cond or not extra else '  → '+str(extra)))
  if not cond:fails.append(name)

async def bubbles(pg,who=None):
  sel='.soc-bubble' if who is None else '.soc-bubble'
  els=await pg.eval_on_selector_all(sel,'els=>els.map(e=>e.textContent)')
  return [t for t in els if who is None or who.upper() in t.upper()]
async def vlog(pg):return await pg.evaluate("CapsaSocial.voice.log()")
async def send_ui(pg,id,tab=None):
  await pg.click('[data-social-open]')
  if tab:await pg.click(f'[data-soc-tab="{tab}"]')
  await pg.click(f'[data-social="{id}"]')

async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx=await b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
    await ctx.add_init_script(FAKE)
    errs=[];pages=[]
    for nm in ['Ana','Budi','Cici']:
      pg=await ctx.new_page();pg.on('pageerror',lambda e,nm=nm:errs.append(nm+': '+str(e)))
      await pg.goto(URL);pages.append(pg)
    A,B,C=pages
    await A.evaluate("localStorage.removeItem('__fakedb');localStorage.removeItem('capsa.social')")
    for pg,nm in zip(pages,['Ana','Budi','Cici']):
      await pg.click('[data-style="online"]');await pg.fill('#my-name',nm)
    await A.click('[data-timer="0"]')
    await A.click('[data-act="create-room"]');await A.wait_for_selector('.code',timeout=5000)
    code=(await A.inner_text('.code')).replace('\n','').replace(' ','')
    for pg in (B,C):
      await pg.fill('#join-code',code);await pg.click('[data-act="join-room"]')
    await A.wait_for_timeout(700)
    await A.click('[data-act="host-start"]');await A.wait_for_timeout(900)
    for pg in pages: await pg.evaluate("window.__soc=[];CapsaEvents.on('fact:social',e=>__soc.push(e));CapsaFX.audio()")
    seat={nm:await pg.evaluate("CapsaFX.view().me") for nm,pg in zip('ABC',pages)}

    # 1 quick chat reaches everyone, from the right player; the panel closes after sending
    await send_ui(B,'qc.gg');await A.wait_for_timeout(400)
    ok('1 quick chat seen on Ana and Cici',bool(await bubbles(A,'Budi')) and bool(await bubbles(C,'Budi')),[await bubbles(A),await bubbles(C)])
    ok('1 bubble text is the catalog line',any('GG' in t for t in await bubbles(A)))
    ok('1 panel closed after sending',await B.locator('.soc-panel').count()==0)
    # 13 narrow phone: panel fits and stays above the hand
    await B.click('[data-social-open]');await B.wait_for_timeout(250)
    pb=await B.locator('.soc-panel').bounding_box();hb=await B.locator('.zone .hand').bounding_box()
    await B.screenshot(path=OUT+'/social_panel.png')
    ok('13 panel inside a 390px screen',pb and pb['x']>=0 and pb['x']+pb['width']<=390,pb)
    ok('13 panel does not cover the hand',pb and hb and pb['y']+pb['height']<=hb['y']+1,(pb,hb))
    # 2 emote from the full emote tab
    await B.click('[data-soc-tab="emote"]');await B.click('[data-social="emo.smirk"]');await A.wait_for_timeout(400)
    ok('2 emote seen on Ana with the right face',await A.locator('.soc-pop .m-smirk').count()==1)
    ok('2 emote seen on Cici',await C.locator('.soc-pop .m-smirk').count()==1)
    await A.screenshot(path=OUT+'/social_emote.png')
    # 3 + 4 voice line: no file shipped → placeholder plays, quick chat still shows
    await B.wait_for_timeout(5200)
    before=len(await vlog(A))
    await send_ui(B,'qc.belum','confidence');await A.wait_for_timeout(500)
    la=await vlog(A)
    ok('3 voice line played on Ana (placeholder for the missing file)',any('underdog.belum' in x and ('placeholder' in x or 'file' in x) for x in la[before:]),la)
    ok('4 missing audio does not break the quick chat',any('Belum selesai' in t for t in await bubbles(A)))
    # 5 Ana mutes Budi (only on her phone); 6 Cici turns voice lines off
    await A.click('[data-social-open]');await A.click('[data-soc-tab="set"]');await A.click(f'[data-soc-mute="{seat["B"]}"]')
    ok('5 mute button shows muted',await A.locator(f'[data-soc-mute="{seat["B"]}"][aria-pressed="true"]').count()==1)
    await A.click('[data-soc-close]')
    await C.click('[data-social-open]');await C.click('[data-soc-tab="set"]');await C.uncheck('[data-soc-set="voice"]');await C.click('[data-soc-close]')
    await B.wait_for_timeout(5200)
    la0,lc0=len(await vlog(A)),len(await vlog(C))
    await send_ui(B,'qc.yakin','local');await A.wait_for_timeout(500)
    ok('5 muted player: no voice on Ana',len(await vlog(A))==la0,(await vlog(A))[la0:])
    ok('5 muted player: no bubble on Ana',not await bubbles(A,'Budi'))
    ok('5 mute is local: Budi sees his own line',bool(await bubbles(B,'Budi')))
    ok('6 voice off on Cici: no voice',len(await vlog(C))==lc0,(await vlog(C))[lc0:])
    ok('6 voice off on Cici: quick chat still visible',any('Yakin' in t for t in await bubbles(C)))
    ok('5 Ana still remembers the line (history)',any(e['id']=='qc.yakin' for e in await A.evaluate("__soc")))
    await A.evaluate(f"CapsaSocial.setMuted({seat['B']},false)");await C.evaluate("CapsaSocial.set('voice',true)")
    # 7 cooldowns: sender side, then a client that skips them is throttled by every receiver
    await B.wait_for_timeout(1600)
    r=await B.evaluate("[CapsaSocial.send('emo.laugh'),CapsaSocial.send('emo.laugh'),CapsaSocial.send('qc.santai')]")
    ok('7 second emote within the cooldown is refused',r[0]['ok'] and not r[1]['ok'] and r[1]['why']=='cooldown',r)
    ok('7 quick chat has its own cooldown',r[2]['ok'],r)
    await B.wait_for_timeout(1600)
    n0=len(await A.evaluate("__soc"))
    await B.evaluate("for(let i=0;i<12;i++)CapsaFX.social({id:'emo.cry',n:'spam'+i})");await A.wait_for_timeout(500)
    got=len(await A.evaluate("__soc"))-n0
    ok('7 a spamming client is throttled on receivers',got<=1,got)
    ok('7 one emote slot per seat on screen',await A.locator('.soc-pop').count()<=3)
    # 8 + 9 unknown ids and injected fields
    await B.wait_for_timeout(1200)
    n0=len(await A.evaluate("__soc"))
    await B.evaluate("CapsaFX.social({id:'qc.hacked',n:'bad1'})")
    await B.evaluate(f"""firebase.database().ref('rooms/{code}/events').push({{t:'social',id:'qc.gg',uid:CapsaFX.view().uid,n:'inj1',
        text:'<img src=x onerror=window.__pwn=1>',audio:'http://evil.example/x.mp3',data:{{html:'<b>x</b>'}},ts:firebase.database.ServerValue.TIMESTAMP}})""")
    await B.evaluate(f"""firebase.database().ref('rooms/{code}/events').push({{t:'social',id:'qc.gg',uid:'not-in-room',n:'inj2',ts:firebase.database.ServerValue.TIMESTAMP}})""")
    await A.wait_for_timeout(500)
    ev=(await A.evaluate("__soc"))[n0:]
    ok('8 unknown action id rejected',not any(e['id']=='qc.hacked' for e in ev),ev)
    ok('8 receiver says why',(await A.evaluate("CapsaSocial.receive({t:'social',id:'emo.nope',n:'x',uid:CapsaFX.view().uids[1]}).why"))=='unknown-id')
    ok('9 injected text/audio fields are ignored',await A.evaluate("!window.__pwn&&!document.querySelector('.soc-bubble img')") and all(set(e.keys())<={'type','at','t','round','seat','name','who','to','toName','id','kind','tone','repeat','voiced'} for e in ev),ev)
    ok('9 sender not in the room rejected',len([e for e in ev if e['id']=='qc.gg'])<=1,ev)
    ok('9 no request to the injected audio URL',not any('evil.example' in x for x in await vlog(A)))
    # 10 two players at the same time
    await A.wait_for_timeout(1600)
    # (the fake database lives in shared localStorage, so two tabs writing in the very same instant can lose one write;
    #  real Firebase doesn't. Sends are 40 ms apart here, and same-timestamp delivery is checked directly below.)
    await A.evaluate("CapsaSocial.send('qc.hah')");await C.wait_for_timeout(40);await C.evaluate("CapsaSocial.send('qc.serius')")
    await B.wait_for_timeout(500)
    bb=await bubbles(B)
    ok('10 simultaneous lines from two players both shown',any('Ana' in t.title() or 'ANA' in t for t in bb) and any('CICI' in t.upper() for t in bb),bb)
    same=await B.evaluate("""(()=>{const v=CapsaFX.view(),t=CapsaFX.serverNow();
      return [CapsaSocial.receive({t:'social',id:'emo.shock',uid:v.uids[0],n:'same-a',ts:t}).ok,CapsaSocial.receive({t:'social',id:'emo.shock',uid:v.uids[2],n:'same-c',ts:t}).ok,
        document.querySelectorAll('.soc-pop .m-shock').length]})()""")
    ok('10 same server timestamp from two players: both accepted and drawn',same==[True,True,2],same)
    # 11 duplicate and late events leave nothing behind
    dup=await A.evaluate("""(()=>{const v=CapsaFX.view(),u=v.uids[2],now=CapsaFX.serverNow();
      const e={t:'social',id:'qc.waduh',uid:u,n:'dup1',ts:now};
      return [CapsaSocial.receive(e).why||'ok',CapsaSocial.receive(Object.assign({},e)).why,
        CapsaSocial.receive({t:'social',id:'qc.sabar',uid:u,n:'late1',ts:now-10000}).why,
        CapsaSocial.receive({t:'social',id:'qc.sabar',uid:u,n:'old1',ts:now-60000}).why]})()""")
    ok('11 duplicate dropped, late not drawn, old ignored',dup[1]=='duplicate' and dup[2] in ('late','rate') and dup[3]=='stale',dup)
    await A.wait_for_timeout(4200)
    ok('11/18 nothing left on screen after expiry',await A.locator('.soc-bubble,.soc-pop').count()==0)
    # 16 autoplay blocked: quick chat shows, voice is skipped (not queued for later)
    await C.evaluate("CapsaFX.audio().ctx.suspend()");await C.wait_for_timeout(100)
    await C.evaluate("(()=>{const a=CapsaFX.audio;CapsaFX.audio=()=>{const o=a();return o&&{ctx:{state:'suspended',resume(){}} ,out:o.out}}})()")
    lc0=len(await vlog(C))
    await B.wait_for_timeout(1000);await B.evaluate("CapsaSocial.send('qc.gg')");await C.wait_for_timeout(500)
    ok('16 autoplay blocked: voice skipped',any('blocked' in x for x in (await vlog(C))[lc0:]),await vlog(C))
    ok('16 autoplay blocked: bubble still shown',any('GG' in t for t in await bubbles(C)))
    # 14 a tap outside the panel closes it and never picks a card
    mover=None
    for pg in pages:
      if await pg.locator('.zone.my-turn').count():mover=pg;break
    await mover.click('[data-social-open]');await mover.wait_for_timeout(200)
    await mover.locator('.hand [data-card]').last.tap()
    await mover.wait_for_timeout(250)
    ok('14 panel closed by the outside tap',await mover.locator('.soc-panel').count()==0)
    ok('14 the tap did not select a card',await mover.locator('.hand [data-card][aria-pressed="true"]').count()==0)
    await mover.locator('.hand [data-card]').last.tap();await mover.wait_for_timeout(200)
    ok('14 next tap selects normally',await mover.locator('.hand [data-card][aria-pressed="true"]').count()==1)
    await mover.click('[data-act="clear"]')
    # 15 a whole round with social traffic; turns stay in sync
    steps=0;k=0;desync=0
    while steps<200:
      steps+=1
      if all([await pg.locator('table.result').count()>0 for pg in pages]):break
      turns=[await pg.evaluate("CapsaFX.view().turn") for pg in pages]
      mover=None
      for pg in pages:
        if await pg.locator('.zone.my-turn').count():mover=pg;break
      if not mover:
        await A.wait_for_timeout(200);continue
      if steps%3==0:
        k+=1;await pages[k%3].evaluate("CapsaSocial.send(['emo.laugh','qc.ez','emo.salute','qc.kokbisa'][%d%%4])"%k)
      if len(set(turns))>1:desync+=1
      chips=mover.locator('[data-quick]')
      if await chips.count():
        await chips.nth(await chips.count()-1).click();await mover.click('[data-act="play"]')
      else: await mover.click('[data-act="pass"]')
      await A.wait_for_timeout(300)
    ok('15 round finished with social traffic',all([await pg.locator('table.result').count()>0 for pg in pages]),steps)
    ok('15 turn never disagreed between phones for long',desync<=3,desync)
    # comedy memory heard the quick chat as chat on every phone
    # (Ana and Budi also got hand-made test events above, so compare the real traffic only)
    hs=[await pg.evaluate("CapsaSocial.history.all().filter(h=>h.id!=='emo.shock'&&h.id!=='qc.waduh'&&h.id!=='qc.sabar').map(h=>h.id+':'+h.seat+'@'+h.t).join(' ')") for pg in pages]
    ok('history is the same on every phone',len(set(hs))==1,hs)
    ok('comedy memory got quick chat as chat',await A.evaluate("CapsaMemory.match().chats.some(c=>c.text==='EZ')"))
    # 18 bounded state
    st=await A.evaluate("CapsaSocial._state()")
    ok('18 bounded state',st['seen']<=300 and st['history']<=200,st)
    # 12 a player drops out while their emote is on screen
    await A.wait_for_timeout(300)
    await B.evaluate("CapsaSocial.send('emo.villain')");await A.wait_for_timeout(300)
    had=await A.locator('.soc-pop .m-villain').count()
    await B.evaluate(f"firebase.database().ref('rooms/{code}/players/'+CapsaFX.view().uid+'/online').set(false)")
    await A.wait_for_timeout(400)
    ok('12 disconnecting player: emote removed right away',had==1 and await A.locator('.soc-pop .m-villain').count()==0,had)
    ok('no page errors',not errs,errs)
    await ctx.close()

    # pass-and-play: the seat's mascot opens the panel as that player
    ctx=await b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    pg=await ctx.new_page();pg.on('pageerror',lambda e:errs.append('local: '+str(e)))
    await pg.goto(URL)
    await pg.evaluate("localStorage.clear()");await pg.reload()
    await pg.click('[data-style="local"]');await pg.click('[data-n="3"]');await pg.click('[data-timer="0"]')
    for i,nm in enumerate(['Dodi','Eka','Fani']):await pg.fill(f'#name{i}',nm)
    await pg.click('[data-act="start"]');await pg.wait_for_timeout(600)
    if await pg.locator('[data-act="reveal"]').count():await pg.click('[data-act="reveal"]')
    await pg.wait_for_timeout(300)
    await pg.click('#seat-2 [data-emote-open]');await pg.wait_for_timeout(200)
    ok('local: seat button opens the panel as that player',await pg.locator('.soc-panel [data-soc-who="2"][aria-pressed="true"]').count()==1)
    await pg.click('[data-soc-tab="emote"]');await pg.click('[data-social="emo.clap"]');await pg.wait_for_timeout(300)
    box=await pg.locator('.soc-pop').bounding_box();seat2=await pg.locator('#seat-2').bounding_box()
    ok('local: emote shows under that seat',box and seat2 and abs((box['x']+box['width']/2)-(seat2['x']+seat2['width']/2))<60,(box,seat2))
    await pg.screenshot(path=OUT+'/social_local.png')
    ok('local: no page errors',not errs,errs)
    await b.close()
  print(f"\n{len(fails)} FAILED: {fails}" if fails else "\nall passed")
  sys.exit(1 if fails else 0)
try:asyncio.run(main())
finally:srv.terminate()
