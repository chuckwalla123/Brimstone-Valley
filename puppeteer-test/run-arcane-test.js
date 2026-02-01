const puppeteer = require('puppeteer');

(async () => {
  const url = 'http://127.0.0.1:5173';
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE:', msg.text()));

  await page.goto(url, { waitUntil: 'networkidle2' });
  console.log('Page loaded');

  // Wait for Run Round button and click it
  await page.waitForSelector('button');
  // Click the first "Run Round" button
  const buttons = await page.$$('button');
  let runBtn = null;
  for (const b of buttons) {
    const txt = await (await b.getProperty('textContent')).jsonValue();
    if (txt && txt.trim().toLowerCase() === 'run round') { runBtn = b; break; }
  }
  if (!runBtn) {
    console.error('Run Round button not found');
    await browser.close();
    process.exit(2);
  }
  // Observe mutations in body for animation elements
  await page.exposeFunction('reportEvent', e => console.log('EVENT:', e));

  await page.evaluate(() => {
    window.__animEvents = [];
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const n of Array.from(m.addedNodes)) {
          try {
            if (n && n.nodeType === 1) {
              if (n.matches && (n.matches('.bp-spell-sprite') || n.matches('canvas.bp-spell-sprite') || n.querySelector && (n.querySelector('.bp-spell-sprite') || n.querySelector('canvas.bp-spell-sprite')))) {
                const t = Date.now();
                window.__animEvents.push({ type: 'anim-added', at: t, outer: n.outerHTML ? n.outerHTML.substring(0,200) : n.tagName });
              }
              // generic canvas additions (our animators render canvases)
              if (n.tagName === 'CANVAS') {
                const t = Date.now();
                window.__animEvents.push({ type: 'canvas-added', at: t, w: n.width, h: n.height });
              }
            }
          } catch (e) {}
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    window.__animObserver = obs;
  });

  console.log('Clicking Run Round');
  await runBtn.click();

  // Wait up to 5s for animations to appear
  await page.waitForTimeout(5000);

  const events = await page.evaluate(() => window.__animEvents.slice(0,50));
  console.log('Captured events count:', events.length);
  for (const e of events) console.log('EV', e);

  // As a heuristic, check that there is at least one canvas added, and if multiple canvases, they are separated in time
  if (events.length === 0) {
    console.error('No animation events observed');
  } else {
    // find first two canvas or anim-added events
    const canv = events.filter(x => x.type === 'canvas-added' || x.type === 'anim-added');
    if (canv.length >= 2) {
      console.log('First two anim timestamps:', canv[0].at, canv[1].at, 'delta:', canv[1].at - canv[0].at);
    } else {
      console.log('Not enough anim events to compare sequencing');
    }
  }

  await browser.close();
  console.log('Done');
})();
