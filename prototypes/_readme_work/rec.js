// Помощники записи для README: кадры через CDP screencast (с отметками времени)
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'rec');
const B = 'http://127.0.0.1:5090';

async function newPage(browser, vp, opts = {}) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: opts.dpr || 1, hasTouch: !!opts.mobile, isMobile: !!opts.mobile });
  await ctx.addInitScript(() => { try { localStorage.setItem('grigorievCookieOk', '1'); } catch (e) {} });
  const p = await ctx.newPage();
  p._errs = [];
  p.on('pageerror', e => p._errs.push(e.message));
  return { ctx, p };
}

async function rec(p, name, fn, { maxWidth = 1440, maxHeight = 900 } = {}) {
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const cdp = await p.context().newCDPSession(p);
  const frames = [];
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const file = path.join(dir, String(frames.length).padStart(4, '0') + '.jpg');
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, t: metadata.timestamp });
    try { await cdp.send('Page.screencastFrameAck', { sessionId }); } catch (e) {}
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth, maxHeight, everyNthFrame: 1 });
  await fn();
  await new Promise(r => setTimeout(r, 150));
  await cdp.send('Page.stopScreencast');
  fs.writeFileSync(path.join(dir, 'frames.json'), JSON.stringify({ frames }));
  return frames.length;
}

// Плавное движение мыши по точкам
async function glide(p, pts, stepMs = 16, steps = 30) {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    for (let s = 1; s <= steps; s++) {
      const k = s / steps, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      await p.mouse.move(x0 + (x1 - x0) * e, y0 + (y1 - y0) * e);
      await p.waitForTimeout(stepMs);
    }
  }
}
const wait = (p, ms) => p.waitForTimeout(ms);
module.exports = { newPage, rec, glide, wait, B, OUT };
