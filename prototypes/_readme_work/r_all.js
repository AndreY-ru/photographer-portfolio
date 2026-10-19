// Сценарии анимаций для README. ONLY=home,dials,... — записать только эти.
const { newPage, rec, glide, wait, B } = require('./rec');
const NOGRAIN = '.grain-overlay{display:none!important}';   // зерно меняет каждый пиксель — анимация тяжелеет в разы
const only = (process.env.ONLY || '').split(',').filter(Boolean);
const want = n => !only.length || only.includes(n);

module.exports = async (browser) => {
  const res = {};
  const center = async (p, sel, i = 0) => { const b = await p.locator(sel).nth(i).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  const open = async (url, pre = 1500) => {
    const { ctx, p } = await newPage(browser, { width: 1440, height: 900 });
    await p.goto(B + url, { waitUntil: 'networkidle' }); await p.addStyleTag({ content: NOGRAIN });
    await wait(p, pre);
    return { ctx, p };
  };

  // 1. Главная: направления — фото героя и цвет страницы меняются
  if (want('home')) {
    const { ctx, p } = await open('/', 4800);
    await p.evaluate(() => window.scrollTo(0, 150)); await wait(p, 400);
    let pos = [880, 330];
    await p.mouse.move(...pos);
    res.home = await rec(p, 'home', async () => {
      await glide(p, [pos, [640, 460], [1000, 380]], 16, 26); pos = [1000, 380];
      for (let i = 0; i < 3; i++) {
        const c = await center(p, '.showcase-item', i);
        await glide(p, [pos, c], 16, 22); pos = c;
        await p.mouse.click(...c); await wait(p, 1500);
      }
    });
    res.homeErr = p._errs; await ctx.close();
  }

  // 2. Панель камеры: диафрагма = тема, температура = оттенок (на галерее)
  if (want('dials')) {
    const { ctx, p } = await open('/gallery', 1800);
    const ap = await center(p, '#meta-aperture'), tp = await center(p, '#meta-temp');
    await p.mouse.move(700, 120);
    res.dials = await rec(p, 'dials', async () => {
      await glide(p, [[700, 120], ap], 16, 22);
      await p.mouse.click(...ap); await wait(p, 1100);
      await p.mouse.click(...ap); await wait(p, 1100);
      await p.mouse.click(...ap); await wait(p, 800);
      await glide(p, [ap, tp], 16, 12);
      await p.mouse.click(...tp); await wait(p, 1000);
      await p.mouse.click(...tp); await wait(p, 1000);
      await p.mouse.click(...tp); await wait(p, 600);
    });
    res.dialsErr = p._errs; await ctx.close();
  }

  // 3. Галерея: рамка автофокуса на фильтрах и окраска страницы в цвет альбома
  if (want('gallery')) {
    const { ctx, p } = await open('/gallery', 1200);
    await p.evaluate(() => document.getElementById('vf-island-collapse')?.click()); await wait(p, 500);
    await p.mouse.move(700, 160);
    res.gallery = await rec(p, 'gallery', async () => {
      const f = i => center(p, '.filter-btn', i);
      await glide(p, [[700, 160], await f(1), await f(2), await f(3), await f(1)], 16, 16);
      await p.mouse.click(...(await f(1))); await wait(p, 1200);
      await p.mouse.click(...(await f(0))); await wait(p, 1000);
      await glide(p, [await f(0), [300, 420], [760, 430], [1180, 420]], 16, 26);
      await wait(p, 900);
      await glide(p, [[1180, 420], [760, 430]], 16, 22);
      await wait(p, 900);
    });
    res.galleryErr = p._errs; await ctx.close();
  }

  // 4. Альбом: открыть фото, листать, данные съёмки
  if (want('album')) {
    const { ctx, p } = await open('/album/kosplei-miku-fb8b9d', 1500);
    await p.evaluate(() => window.scrollTo(0, document.querySelector('.photo-card').getBoundingClientRect().top + scrollY - 90)); await wait(p, 600);
    await p.mouse.move(700, 500);
    res.album = await rec(p, 'album', async () => {
      const c = await center(p, '.photo-card', 3);
      await glide(p, [[700, 500], c], 16, 24); await wait(p, 300);
      await p.mouse.click(...c); await wait(p, 1300);
      const nx = await center(p, '#lb-next');
      await glide(p, [c, nx], 16, 18);
      await p.mouse.click(...nx); await wait(p, 1100);
      await p.mouse.click(...nx); await wait(p, 1100);
      const info = await center(p, '#lb-info');
      await glide(p, [nx, info], 16, 18);
      await p.mouse.click(...info); await wait(p, 1500);
    });
    res.albumErr = p._errs; await ctx.close();
  }

  // 5. Подвал «Волчий след»: следы к колосу, затем «Великая волчица наблюдает» и следы за курсором
  if (want('footer')) {
    const { ctx, p } = await open('/about', 1000);
    await p.evaluate(() => document.getElementById('vf-island-collapse')?.click());
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight - innerHeight - 420)); await wait(p, 800);
    await p.mouse.move(700, 300);
    res.footer = await rec(p, 'footer', async () => {
      for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, 60); await wait(p, 30); }
      await wait(p, 3200);
      const seal = await center(p, '.wisewolf-seal');
      await glide(p, [[700, 300], seal], 16, 26);
      await p.mouse.click(...seal); await wait(p, 900);
      await glide(p, [seal, [1100, 420], [400, 300], [800, 200]], 16, 34);
      await wait(p, 900);
    });
    res.footerErr = p._errs; await ctx.close();
  }

  // 6. «Связаться»: язычок с лапкой выдвигает шторку
  if (want('contact')) {
    const { ctx, p } = await open('/gallery', 1600);
    await p.mouse.move(1100, 500);
    res.contact = await rec(p, 'contact', async () => {
      const t = await center(p, '.cta-dock button');
      await glide(p, [[1100, 500], t], 16, 24);
      await p.mouse.click(...t); await wait(p, 1600);
      await p.mouse.click(...(await center(p, '.cta-dock button'))); await wait(p, 1000);
    });
    res.contactErr = p._errs; await ctx.close();
  }

  // 7. Страница 404 «Нет фокуса»
  if (want('e404')) {
    const { ctx, p } = await open('/album/net-takogo', 600);
    await p.evaluate(() => document.getElementById('vf-island-collapse')?.click());
    await wait(p, 800);
    res.e404 = await rec(p, 'e404', async () => { await wait(p, 3300); });
    res.e404Err = p._errs; await ctx.close();
  }
  return res;
};
