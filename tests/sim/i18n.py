# Language: English by default, Indonesian as the second language, chosen per phone.
# Run from anywhere: python3 tests/sim/i18n.py   (needs Playwright + Chromium). Exits 1 if a check fails.
import sys,asyncio,subprocess,time,os,re
from playwright.async_api import async_playwright
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
OUT=os.path.join(ROOT,'tests','sim','out');os.makedirs(OUT,exist_ok=True)
srv=subprocess.Popen([sys.executable,'-m','http.server','8767','--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
FAKE=open(os.path.join(ROOT,'tests','sim','fakefb.js')).read()
URL='http://127.0.0.1:8767/index.html'
# distinctly Indonesian words (none of them are English words or test player names)
ID_WORDS=['yang','dan','kartu','ronde','menang','kalah','pemain','giliran','jalan','habis','pakai','juara','sisa','waktu','meja','bisa',
  'lagi','udah','aja','gak','nunggu','tunggu','buang','pilih','ganti','suara','aturan','mulai','kosong','bikin','gabung','tutup','keluar',
  'lu','gua','dulu','kalau','buat','sama','atau','dengan','untuk','belum','sudah','tidak','kocok','bagi','oper','urut','riwayat','statistik']
RX=re.compile(r'\b('+'|'.join(ID_WORDS)+r')\b',re.I)
fails=[]
def ok(name,cond,extra=''):
  print(('PASS ' if cond else 'FAIL ')+name+('' if cond or not extra else '  → '+str(extra)))
  if not cond:fails.append(name)
async def indo(pg):
  # the comedy test chips in Stats are labelled with internal bit ids, not player-facing text
  t=await pg.evaluate("(()=>{const h=[...document.querySelectorAll('[data-cd-demo]')];h.forEach(e=>e.hidden=true);const t=document.body.innerText;h.forEach(e=>e.hidden=false);return t})()")
  return sorted(set(m.group(0).lower() for m in RX.finditer(t)))
async def ui_attrs(pg):
  return await pg.evaluate("[...document.querySelectorAll('[aria-label],[title],[placeholder]')].map(e=>[e.getAttribute('aria-label'),e.getAttribute('title'),e.getAttribute('placeholder')].filter(Boolean).join(' ')).join(' | ')")

async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    errs=[]
    ctx=await b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    await ctx.add_init_script(FAKE)
    pg=await ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto(URL);await pg.evaluate("localStorage.clear()");await pg.reload()
    ok('default language is English',await pg.evaluate("CapsaI18n.lang()")=='en' and await pg.evaluate("document.documentElement.lang")=='en')
    ok('language button shows EN',(await pg.inner_text('[data-act="lang"]')).strip().endswith('EN'))
    ok('setup (one device) has no Indonesian',not await indo(pg),await indo(pg))
    await pg.click('[data-style="online"]')
    ok('setup (online) has no Indonesian',not await indo(pg),await indo(pg))
    await pg.click('[data-act="rules"]')
    ok('rules have no Indonesian',not await indo(pg),await indo(pg))
    await pg.click('[data-act="rules"]');await pg.click('[data-act="stats"]')
    ok('stats have no Indonesian',not await indo(pg),await indo(pg))
    await pg.click('[data-act="stats"]')
    # a local game in English
    await pg.click('[data-style="local"]');await pg.click('[data-n="3"]');await pg.click('[data-timer="30"]')
    for i,nm in enumerate(['Ana','Budi','Cici']):await pg.fill(f'#name{i}',nm)
    await pg.click('[data-act="start"]');await pg.wait_for_timeout(400)
    ok('handoff screen has no Indonesian',not await indo(pg),await indo(pg))
    await pg.click('[data-act="reveal"]');await pg.wait_for_timeout(300)
    ok('my turn has no Indonesian',not await indo(pg),await indo(pg))
    ok('aria labels / titles / placeholders have no Indonesian',not RX.search(await ui_attrs(pg)),RX.findall(await ui_attrs(pg)))
    await pg.screenshot(path=OUT+'/i18n_en_turn.png')
    await pg.click('[data-social-open]');await pg.wait_for_timeout(200)
    for tab in ['emote','respect','taunt','confidence','reaction','local','set']:
      await pg.click(f'[data-soc-tab="{tab}"]')
      if await indo(pg):break
    ok('emote & quick chat panel has no Indonesian',not await indo(pg),(tab,await indo(pg)))
    await pg.click('[data-soc-close]')
    await pg.click('[data-chat-toggle]');await pg.wait_for_timeout(200)
    ok('chat sheet has no Indonesian',not await indo(pg),await indo(pg))
    await pg.click('[data-chat-close]')
    # play through the round in English
    for k in range(400):
      if await pg.locator('table.result').count():break
      if await pg.locator('[data-act="reveal"]').count():await pg.click('[data-act="reveal"]');continue
      chips=pg.locator('[data-quick]')
      if await chips.count():
        await chips.nth(await chips.count()-1).click();await pg.click('[data-act="play"]')
      else:await pg.click('[data-act="pass"]')
      await pg.wait_for_timeout(20)
    await pg.wait_for_timeout(2500)
    ok('round result has no Indonesian',not await indo(pg),await indo(pg))
    await pg.screenshot(path=OUT+'/i18n_en_result.png')
    # switch to Indonesian mid-game: everything re-renders, the saved log follows
    log_en=await pg.inner_text('.log ol')
    await pg.click('[data-act="lang"]');await pg.wait_for_timeout(300)
    ok('switch to Indonesian',await pg.evaluate("CapsaI18n.lang()")=='id' and (await pg.inner_text('[data-act="lang"]')).strip().endswith('ID'))
    txt=(await pg.evaluate("document.body.innerText")).lower()
    ok('screen re-rendered in Indonesian','hasil ronde' in txt and 'sisa kartu' in txt,txt[:300])
    log_id=await pg.inner_text('.log ol')
    ok('table log follows the language',log_en!=log_id and bool(RX.search(log_id)),[log_en[:80],log_id[:80]])
    await pg.screenshot(path=OUT+'/i18n_id_result.png')
    await pg.click('[data-act="reset"]');await pg.click('[data-act="reset"]');await pg.wait_for_timeout(300)
    await pg.reload();await pg.wait_for_timeout(300)
    ok('choice is saved on this phone',await pg.evaluate("CapsaI18n.lang()")=='id' and 'Kocok' in await pg.evaluate("document.body.innerText"))
    await ctx.close()

    # online: two phones, two languages
    ctx=await b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    await ctx.add_init_script(FAKE)
    A=await ctx.new_page();B=await ctx.new_page()
    for x in (A,B):x.on('pageerror',lambda e:errs.append(str(e)))
    await A.goto(URL);await A.evaluate("localStorage.clear()")
    await B.goto(URL)
    await A.evaluate("CapsaI18n.set('en')");await B.evaluate("CapsaI18n.set('id')")
    for x,nm in ((A,'Ana'),(B,'Budi')):
      await x.click('[data-style="online"]');await x.fill('#my-name',nm)
    await A.click('[data-timer="0"]');await A.click('[data-act="create-room"]');await A.wait_for_selector('.code',timeout=5000)
    code=(await A.inner_text('.code')).replace('\n','').replace(' ','')
    await B.fill('#join-code',code);await B.click('[data-act="join-room"]');await A.wait_for_timeout(600)
    ok('lobby: host English, guest Indonesian',not await indo(A) and 'Nunggu host' in await B.evaluate("document.body.innerText"),await indo(A))
    await A.click('[data-act="host-start"]');await A.wait_for_timeout(800)
    la,lb=await A.inner_text('.lastlog'),await B.inner_text('.lastlog')
    ok('same table log, each in its own language',not RX.search(la) and RX.search(lb),[la,lb])
    await B.evaluate("CapsaSocial.send('qc.belum')");await A.wait_for_timeout(400)
    ba=await A.eval_on_selector_all('.soc-bubble','e=>e.map(x=>x.textContent).join()');bb=await B.eval_on_selector_all('.soc-bubble','e=>e.map(x=>x.textContent).join()')
    ok('quick chat shows in each phone\'s language','Not over yet' in ba and 'Belum selesai' in bb,[ba,bb])
    # a comedy performance carries both languages; each phone plays its own
    perf=await A.evaluate("""(()=>{const D=CapsaComedy,b=D.bits.find(x=>x.demo&&x.id==='kenangan')||D.bits.find(x=>x.demo);
      return {id:b.id,both:CapsaI18n.both(()=>JSON.stringify(b.script(b.demo,{names:['Ana','Budi'],d:{},fact:'play'},D.helpers||{})))}})()""")
    ok('comedy script differs per language',perf['both']['en']!=perf['both']['id'],perf['id'])
    await A.screenshot(path=OUT+'/i18n_online_en.png');await B.screenshot(path=OUT+'/i18n_online_id.png')
    ok('no page errors',not errs,errs)
    await b.close()
  print(f"\n{len(fails)} FAILED: {fails}" if fails else "\nall passed")
  sys.exit(1 if fails else 0)
try:asyncio.run(main())
finally:srv.terminate()
