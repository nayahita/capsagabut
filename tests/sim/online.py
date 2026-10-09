# Run from anywhere: python3 tests/sim/online.py  (needs Playwright + Chromium)
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
    errs=[]
    pages=[]
    for nm in ['Ana','Budi','Cici']:
      pg=await ctx.new_page();pg.on('pageerror',lambda e,nm=nm:errs.append(nm+': '+str(e)))
      await pg.goto('http://127.0.0.1:8765/index.html');pages.append(pg)
    A,B,C=pages
    await A.evaluate("localStorage.removeItem('__fakedb')")
    for pg,nm in zip(pages,['Ana','Budi','Cici']):
      await pg.click('[data-style="online"]');await pg.fill('#my-name',nm)
    await A.click('[data-timer="0"]')   # no timer for deterministic test
    await A.click('[data-act="create-room"]');await A.wait_for_selector('.code',timeout=5000)
    code=(await A.inner_text('.code')).replace('\n','').replace(' ','')
    print('room code:',code)
    for pg in (B,C):
      await pg.fill('#join-code',code);await pg.click('[data-act="join-room"]')
    await A.wait_for_timeout(600)
    print('lobby players (host view):',await A.eval_on_selector_all('.plist li span:first-of-type','els=>els.map(e=>e.textContent)'))
    await A.screenshot(path=OUT+'/lobby.png')
    for pg in pages: await pg.evaluate("window.__cd=[];document.addEventListener('capsa:mod',e=>{if(e.detail.type==='comedy')__cd.push(e.detail.data.id+':'+JSON.stringify(e.detail.data.steps).length)})")
    await A.evaluate("Object.assign(CapsaComedy.settings,{chance:{COMMON:1,UNCOMMON:1,RARE:1,LEGENDARY:1},minGapMs:0,maxPerRound:9})")
    await A.click('[data-act="host-start"]');await A.wait_for_timeout(700)
    await B.screenshot(path=OUT+'/game_b.png')
    # Emote from Budi should pop on Ana's screen
    await B.click('.emo-btn');await B.click('[data-soc-tab="emote"]');await B.click('[data-social="emo.laugh"]');await A.wait_for_timeout(300)
    print('emote seen on Ana:',await A.locator('.emote-pop').count()>0)
    steps=0;turns=[]
    while steps<160:
      steps+=1
      ended=[await pg.locator('table.result').count()>0 for pg in pages]
      if all(ended):break
      mover=None
      for pg in pages:
        if await pg.locator('.zone.my-turn').count():mover=pg;break
      if not mover:
        await A.wait_for_timeout(250);continue
      # consistency: everyone agrees on whose turn it is
      seats=[await pg.eval_on_selector('.seat.now .nm','e=>e.firstChild.textContent.trim()') if await pg.locator('.seat.now').count() else None for pg in pages]
      turns.append(seats)
      chips=mover.locator('[data-quick]')
      if await chips.count():
        await chips.nth(await chips.count()-1).click()
        await mover.click('[data-act="play"]')
      else:
        await mover.click('[data-act="pass"]')
      await A.wait_for_timeout(350)
    ended=[await pg.locator('table.result').count()>0 for pg in pages]
    print('steps:',steps,'round ended on all phones:',ended)
    await B.evaluate("CapsaChat.send('@Ana yakin? liat aja')")
    await A.wait_for_timeout(1200)
    print('chat in memory per phone:',[await pg.evaluate("JSON.stringify(CapsaMemory.match().chats.map(c=>[c.name,c.text,c.prediction,c.target]))") for pg in pages])
    await A.wait_for_timeout(2600)
    cds=[await pg.evaluate('__cd') for pg in pages]
    print('comedy performances per phone:',[len(c) for c in cds],'| identical on all phones:',cds[0]==cds[1]==cds[2],'|',cds[0][:4])
    print('decided only on host:',await A.evaluate('CapsaComedy.log().filter(l=>l.startsWith("PLAY")).length'),'vs client:',await B.evaluate('CapsaComedy.log().filter(l=>l.startsWith("PLAY")).length'))
    print('memory rounds per phone:',[await pg.evaluate('CapsaMemory.match().rounds.length') for pg in pages])
    await C.screenshot(path=OUT+'/reaction_c.png')
    print('stats rounds recorded per phone:',[await pg.evaluate("CapsaStats.all().map(s=>s.name+':'+s.rounds).join(',')") for pg in pages])
    print('audio decode:',await A.evaluate('''async()=>{const o=CapsaFX.audio();const ab=await (await fetch('audio/bad-beat.wav')).arrayBuffer();const b=await o.ctx.decodeAudioData(ab);return b.duration.toFixed(2)+'s'}'''))
    print('turn views disagreed:',sum(1 for t in turns if len(set(t))>1),'of',len(turns))
    counts=[await pg.eval_on_selector_all('.seat .ct','els=>els.map(e=>e.textContent)') for pg in pages]
    print('card counts per phone:',counts)
    scores=[await pg.eval_on_selector_all('.seat .sc','els=>els.map(e=>e.firstChild.textContent)') for pg in pages]
    print('scores per phone:',scores)
    await C.screenshot(path=OUT+'/end_c.png',full_page=True)
    # next round started by host reaches others
    await A.click('[data-act="next"]');await A.wait_for_timeout(800)
    print('round 2 on Cici:',await C.inner_text('.meta'))
    # client leaves, host closes room -> others see message
    await A.click('[data-act="reset"]');await A.click('[data-act="reset"]');await A.wait_for_timeout(600)
    print('after host closes, Budi sees:',(await B.locator('.netmsg').inner_text()) if await B.locator('.netmsg').count() else 'no message')
    print('errors:',errs)
    await b.close()
try:asyncio.run(main())
finally:srv.terminate()
