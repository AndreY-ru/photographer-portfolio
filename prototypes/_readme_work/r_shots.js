const fs = require('fs');
const { newPage, wait, B } = require('./rec');
const S = require('path').join(__dirname, 'shots') + '/';
const NOGRAIN = '.grain-overlay{display:none!important}';
const only = (process.env.ONLY || '').split(',').filter(Boolean);
const want = n => !only.length || only.includes(n);

module.exports = async (browser) => {
  fs.mkdirSync(S, { recursive: true });
  const res = {};
  const login = async (p) => {
    await p.goto(B + '/admin/login'); await p.fill('input[name=login]', 'admin'); await p.fill('input[name=password]', 'secret');
    await p.click('button[type=submit]'); await p.waitForLoadState('networkidle'); await wait(p, 1500);
  };

  if (want('site')) {
    const { ctx, p } = await newPage(browser, { width: 1440, height: 900 });
    // Альбом: обложка со сроком и сетка с сердечками
    await p.goto(B + '/album/miku', { waitUntil: 'networkidle' }); await p.addStyleTag({ content: NOGRAIN }); await wait(p, 1800);
    await p.evaluate(() => document.getElementById('vf-island-collapse')?.click()); await wait(p, 500);
    await p.screenshot({ path: S + 'album_cover.jpg', quality: 88 });
    await p.evaluate(() => window.scrollTo(0, document.querySelector('.photo-card').getBoundingClientRect().top + scrollY - 40)); await wait(p, 1200);
    await p.mouse.move(10, 890);
    await p.screenshot({ path: S + 'album_grid.jpg', quality: 88 });
    // Обо мне: «Кадр», оборудование, контакты
    await p.goto(B + '/about', { waitUntil: 'networkidle' }); await p.addStyleTag({ content: NOGRAIN }); await wait(p, 1800);
    await p.screenshot({ path: S + 'about_hero.jpg', quality: 88 });
    await p.evaluate(() => document.getElementById('vf-island-collapse')?.click());
    for (const [sel, name] of [['.about-gear', 'about_gear'], ['.about-contact', 'about_contact']]) {
      // Плавно докручиваем, чтобы сработали появления и подсветка объективов
      const top = await p.evaluate(s => document.querySelector(s).getBoundingClientRect().top + scrollY - 70, sel);
      for (let y = await p.evaluate(() => scrollY); y < top; y += 120) { await p.evaluate(v => window.scrollTo(0, v), y); await wait(p, 40); }
      await p.evaluate(v => window.scrollTo(0, v), top); await wait(p, 1500);
      await p.mouse.move(10, 890);
      await p.screenshot({ path: S + name + '.jpg', quality: 88 });
    }
    res.siteErr = p._errs; await ctx.close();
  }

  if (want('admin')) {
    const { ctx, p } = await newPage(browser, { width: 1440, height: 900 });
    await login(p);
    await p.screenshot({ path: S + 'admin_dark.jpg', quality: 90 });
    await p.locator('.st--side').screenshot({ path: S + 'admin_ring.png' });
    // Светлая тема
    await p.click('.admin-sidebar [data-theme-set="light"]'); await wait(p, 600);
    await p.screenshot({ path: S + 'admin_light.jpg', quality: 90 });
    await p.click('.admin-sidebar [data-theme-set="dark"]'); await wait(p, 400);
    // Редактор альбома: сетка фото
    await p.evaluate(() => document.querySelector('.btn-edit-album[data-id="4"]').click()); await wait(p, 2200);
    await p.screenshot({ path: S + 'admin_photos.jpg', quality: 90 });
    // Дубликаты при загрузке
    const jpg = fs.readFileSync(require('path').join(__dirname, '..', '..', 'scr', 'static', 'img', 'placeholder.jpg'));
    const input = p.locator('#file-input').first();
    res.fileInputs = await p.locator('#file-input').count();
    if (res.fileInputs) {
      await input.setInputFiles([
        { name: 'DSC04349.ARW', mimeType: 'image/jpeg', buffer: jpg },
        { name: 'DSC04351.ARW', mimeType: 'image/jpeg', buffer: jpg },
        { name: 'Новый кадр.jpg', mimeType: 'image/jpeg', buffer: jpg }]);
      await wait(p, 1500);
      await p.screenshot({ path: S + 'admin_dupes.jpg', quality: 90 });
      res.dupModal = await p.locator('.dup-modal.active, .dup-modal').count();
      await p.keyboard.press('Escape'); await wait(p, 600);
    }
    // Выбор клиентов
    await p.evaluate(() => document.querySelector('#album-editor-menu li[data-tab="tab-favorites"]').click()); await wait(p, 1500);
    await p.evaluate(() => document.querySelector('#clients-list li')?.click()); await wait(p, 1200);
    await p.screenshot({ path: S + 'admin_clients.jpg', quality: 90 });
    res.adminErr = p._errs; await ctx.close();
  }

  if (want('phone')) {
    const { ctx, p } = await newPage(browser, { width: 390, height: 844 }, { dpr: 2, mobile: true });
    for (const [u, n, w] of [['/', 'm_home', 5200], ['/gallery', 'm_gallery', 1800], ['/album/miku', 'm_album', 1800], ['/about', 'm_about', 1800]]) {
      await p.goto(B + u, { waitUntil: 'networkidle' }); await p.addStyleTag({ content: NOGRAIN }); await wait(p, w);
      if (n === 'm_gallery') { await p.evaluate(() => document.getElementById('vf-toggle-mobile')?.click()); await wait(p, 700); }
      if (n === 'm_album') { await p.evaluate(() => window.scrollTo(0, document.querySelector('.photo-card').getBoundingClientRect().top + scrollY - 70)); await wait(p, 1000); }
      await p.screenshot({ path: S + n + '.jpg', quality: 90 });
    }
    // Админка на телефоне
    await login(p);
    await p.screenshot({ path: S + 'm_admin.jpg', quality: 90 });
    await p.click('#m-more-btn'); await wait(p, 900);
    await p.screenshot({ path: S + 'm_admin_more.jpg', quality: 90 });
    await p.click('#m-sheet-close'); await wait(p, 500);
    await p.evaluate(() => document.querySelector('.btn-edit-album[data-id="4"]').click()); await wait(p, 2200);
    await p.locator('.photo-edit-card').nth(1).click({ force: true }); await wait(p, 900);
    await p.screenshot({ path: S + 'm_admin_sheet.jpg', quality: 90 });
    res.phoneErr = p._errs; await ctx.close();
  }
  return res;
};
