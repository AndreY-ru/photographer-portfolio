module.exports = async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto('file:///D:/photo-site/prototypes/_readme_work/preview.html'); await p.waitForTimeout(2500);
  const h = await p.evaluate(() => document.body.scrollHeight);
  const broken = await p.evaluate(() => [...document.images].filter(i => !i.naturalWidth).map(i => i.getAttribute('src')));
  for (let i = 0, y = 0; y < h && i < 9; i++, y += 2400) {
    await p.evaluate(v => window.scrollTo(0, v), y); await p.waitForTimeout(300);
    await p.screenshot({ path: __dirname + '/pv_' + i + '.jpg', type: 'jpeg', quality: 70, fullPage: true, clip: { x: 0, y, width: 1100, height: Math.min(2400, h - y) } }).catch(() => {});
  }
  await ctx.close(); return { h, broken };
};
