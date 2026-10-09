# Run from anywhere: python3 tests/sim/rooms-lore-showhand.py  (needs Playwright + Chromium)
import sys,asyncio,subprocess,time,json
from playwright.async_api import async_playwright
import os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
OUT=os.path.join(ROOT,'tests','sim','out');os.makedirs(OUT,exist_ok=True)
D=ROOT
srv=subprocess.Popen([sys.executable,'-m','http.server','8765','--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
FAKE=open(os.path.join(ROOT,'tests','sim','fakefb.js')).read()
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    ctx=await b.new_context(viewport={'width':420,'height':900})
    await ctx.add_init_script(FAKE)
    errs=[];pages=[]
    for nm in ['Ana','Budi','Cici']:
      pg=await ctx.new_page();pg.on('pageerror',lambda e,nm=nm:errs.append(nm+': '+str(e)))
      await pg.goto('http://127.0.0.1:8765/index.html');pages.append(pg)
    A,B,C=pages
    await A.evaluate("localStorage.removeItem('__fakedb')")
    # a stale room from "last year" to check the sweep
    await A.evaluate("""(()=>{const d=JSON.parse(localStorage.getItem('__fakedb')||'{}');d.rooms=d.rooms||{};d.rooms.OLDX={meta:{status:'closed',lastOpen:Date.now()-400*864e5},lore:{v:1}};localStorage.setItem('__fakedb',JSON.stringify(d))})()""")
    for pg,nm in zip(pages,['Ana','Budi','Cici']):
      await pg.click('[data-style="online"]');await pg.fill('#my-name',nm)
    await A.click('[data-timer="0"]')
    await A.click('[data-act="create-room"]');await A.wait_for_selector('.code',timeout=5000)
    code=(await A.inner_text('.code')).replace('\n','').replace(' ','')
    print('room',code,'| old room swept:',await A.evaluate("!(JSON.parse(localStorage.getItem('__fakedb')).rooms||{}).OLDX"))
    for pg in (B,C):
      await pg.fill('#join-code',code);await pg.click('[data-act="join-room"]')
    await A.wait_for_timeout(700)
    await A.click('[data-act="host-start"]');await A.wait_for_timeout(900)
    pids=[await pg.evaluate("JSON.stringify(CapsaFX.view().pids)") for pg in pages]
    print('pids same on all phones:',len(set(pids))==1 and pids[0]!='null',pids[0][:40])
    # show hand: Budi holds the button
    btn=B.locator('[data-showhand]');print('show-hand button on Budi:',await btn.count()==1)
    box=await btn.bounding_box()
    await B.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);await B.mouse.down();await A.wait_for_timeout(900)
    seenA=await A.locator('.showhand .sh-cards .card').count();seenC=await C.locator('.showhand .sh-cards .card').count()
    print('holding: Ana sees',seenA,'cards, Cici sees',seenC)
    await A.screenshot(path=OUT+'/sh_ana.png')
    await B.mouse.up();await A.wait_for_timeout(700)
    print('released: overlay gone on Ana:',await A.locator('.showhand').count()==0)
    print('reveal remembered on every phone:',[await pg.evaluate("!!(CapsaMemory.round()&&Object.keys(CapsaMemory.round().revealed||{}).length)") for pg in pages])
    print('no cooldown (button enabled):',await B.locator('[data-showhand][disabled]').count()==0)
    # tap = latch open (PUBG scope style), tap again = close
    await btn.click();await A.wait_for_timeout(900)
    print('tap: Budi state',await B.evaluate("CapsaShowHand.state()"),'| Ana sees overlay',await A.locator('.showhand').count()==1)
    await A.wait_for_timeout(8000)
    print('tap: still open after 8.9s (keepalive):',await A.locator('.showhand').count()==1)
    await btn.click();await A.wait_for_timeout(700)
    print('tap again closes:',await A.locator('.showhand').count()==0,await B.evaluate("CapsaShowHand.state()"))
    # latched then the sender vanishes: receivers expire it by themselves
    await btn.click();await A.wait_for_timeout(700)
    await B.evaluate("window.__bc=CapsaFX.broadcast;CapsaFX.broadcast=()=>{}")  # simulate a dropped phone: no keepalive, no end message
    await A.wait_for_timeout(8200)
    print('dropped sender: overlay expired on Ana:',await A.locator('.showhand').count()==0)
    await B.evaluate("CapsaFX.broadcast=window.__bc");await btn.click();await A.wait_for_timeout(400)
    # play a full round
    steps=0
    while steps<160:
      steps+=1
      if all([await pg.locator('table.result').count()>0 for pg in pages]):break
      mover=None
      for pg in pages:
        if await pg.locator('.zone.my-turn').count():mover=pg;break
      if not mover:
        await A.wait_for_timeout(200);continue
      chips=mover.locator('[data-quick]')
      if await chips.count():
        await chips.nth(await chips.count()-1).click();await mover.click('[data-act="play"]')
      else: await mover.click('[data-act="pass"]')
      await A.wait_for_timeout(300)
    print('round finished:',steps)
    await A.wait_for_timeout(1500)
    print('think time in facts (Ana memory):',await A.evaluate("JSON.stringify(Object.values(CapsaMemory.match().think).map(x=>x.n))"))
    # host closes the room
    await A.click('[data-act="leave-room"]');await A.wait_for_timeout(1500)
    db=await A.evaluate("JSON.parse(localStorage.getItem('__fakedb')).rooms['%s']"%code)
    lore=db.get('lore') or {}
    print('closed room kept:',db['meta']['status']=='closed','| players/state gone:',not db.get('players') and not db.get('state'),'| lore profiles:',len(lore.get('profiles',{})),'| table matches:',(lore.get('table') or {}).get('matches'))
    print('Budi sees:',await B.locator('.netmsg').inner_text() if await B.locator('.netmsg').count() else None)
    # Budi reopens the room with the same code
    await B.fill('#join-code',code);await B.click('[data-act="join-room"]');await B.wait_for_timeout(1200)
    print('Budi is host now:',await B.locator('[data-act="host-start"]').count()==1,'| note:',await B.locator('.lobby .netmsg').inner_text() if await B.locator('.lobby .netmsg').count() else None)
    print('lore on Budi:',await B.evaluate("CapsaLore.mode()+' '+Object.keys(CapsaLore.data().profiles).length"))
    for pg in (A,C):
      await pg.click('[data-style="online"]') if await pg.locator('[data-style="online"]').count() else None
      await pg.fill('#join-code',code);await pg.click('[data-act="join-room"]')
    await B.wait_for_timeout(900)
    print('Ana recognized in lobby:',await A.locator('.plist .lore-ok').inner_text() if await A.locator('.plist .lore-ok').count() else None)
    await B.click('[data-act="host-start"]');await B.wait_for_timeout(900)
    pids2=await B.evaluate("JSON.stringify(CapsaFX.view().pids)")
    print('same pids in the reopened room:',sorted(json.loads(pids2))==sorted(json.loads(pids[0])))
    await B.wait_for_timeout(500)
    rets=[await pg.evaluate("CapsaMemory.match().once?Object.keys(CapsaMemory.match().once).filter(k=>k.startsWith('ret:')).length:0") for pg in pages]
    print('returning players noticed on each phone:',rets)
    print('titles same on all phones:',len(set([await pg.evaluate("CapsaFX.view().names.map(n=>CapsaMemory.title(n)).join(',')") for pg in pages]))==1)
    print('errors:',errs)
    await b.close()
try:asyncio.run(main())
finally:srv.terminate()
