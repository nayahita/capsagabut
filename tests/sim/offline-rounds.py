# Run from anywhere: python3 tests/sim/offline-rounds.py  (needs Playwright + Chromium)
import sys,asyncio,subprocess,time
from playwright.async_api import async_playwright
import os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
OUT=os.path.join(ROOT,'tests','sim','out');os.makedirs(OUT,exist_ok=True)
D=ROOT
srv=subprocess.Popen([sys.executable,'-m','http.server','8766','--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch();pg=await b.new_page(viewport={'width':420,'height':900});errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://127.0.0.1:8766/index.html');await pg.wait_for_timeout(300)
    await pg.evaluate("localStorage.clear()");await pg.reload();await pg.wait_for_timeout(300)
    await pg.click('[data-style="local"]');await pg.click('[data-n="4"]');await pg.click('[data-timer="0"]')
    for i,n in enumerate(['Ana','Budi','Cici','Dodi']):await pg.fill(f'#name{i}',n)
    await pg.evaluate("CapsaComedy.settings.enabled=false")
    await pg.click('[data-act="start"]')
    for rnd in range(3):
      finishes=[]
      for k in range(400):
        if await pg.locator('table.result').count():break
        if await pg.locator('[data-act="reveal"]').count():await pg.click('[data-act="reveal"]');continue
        chips=pg.locator('[data-quick]')
        # prefer playing big combos (last chip), sometimes pass
        if await chips.count():
          await chips.nth(await chips.count()-1).click();await pg.click('[data-act="play"]')
        else:await pg.click('[data-act="pass"]')
        await pg.wait_for_timeout(30)
        d=await pg.locator('.pill.done').count()
        if d>len(finishes):finishes.append(d)
      res=await pg.eval_on_selector_all('table.result tbody tr','rs=>rs.map(r=>r.innerText.replace(/\\s+/g," ").trim())')
      print('round',rnd+1,'| finishes seen mid-round:',finishes,'| result:',res)
      await pg.screenshot(path=f'{OUT}/rules_{rnd}.png')
      await pg.wait_for_timeout(2500);await pg.click('[data-act="next"]')
    print('scores:',await pg.eval_on_selector_all('.seat .sc','e=>e.map(x=>x.innerText.replace(/\\s+/g," "))'))
    print('errors:',errs);await b.close()
try:asyncio.run(main())
finally:srv.terminate()
