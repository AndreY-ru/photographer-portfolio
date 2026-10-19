// ПРОТОТИП подвала сайта (общий для всех публичных страниц, base.html).
// window.FT_V: a — подпись, b — полоса данных, c — конец плёнки, d — по центру.
// Данные со страницы: имя — из логотипа, соцсети — из окна «Связаться», правовые ссылки и волк — из старого подвала.
(function () {
  const V = window.FT_V || 'a';
  const ft = document.querySelector('.footer');
  if (!ft) return;
  const name = (document.querySelector('.logo') || {}).textContent || 'Андрей Григорьев';
  const year = new Date().getFullYear();
  const legal = [...ft.querySelectorAll('.footer-legal a')].map(a => ({ href: a.getAttribute('href'), text: a.textContent.trim() }));
  const SHORT = { 'Политика обработки персональных данных': 'Персональные данные', 'Согласие на обработку персональных данных': 'Согласие на обработку ПД', 'Политика cookies': 'Cookies', 'Использование фотографий': 'Использование фото' };
  const wolf = ft.querySelector('.wisewolf-seal').outerHTML;
  const socials = [...document.querySelectorAll('.contact-modal__item[target=_blank]')].map(a => ({
    href: a.getAttribute('href'), name: a.querySelector('.contact-modal__name').textContent.trim(),
    icon: a.querySelector('.contact-modal__icon-glyph').style.getPropertyValue('--icon-url'),
  }));
  const nav = [['/', 'Главная'], ['/gallery', 'Галерея'], ['/about', 'Обо мне']];
  const soc = cls => socials.map(s => `<a class="${cls}" href="${s.href}" target="_blank" rel="noopener" aria-label="${s.name}"><span class="ft-ico" style="--icon-url: ${s.icon}"></span></a>`).join('');
  const legalHtml = (short) => legal.map(l => `<a href="${l.href}">${short ? (SHORT[l.text] || l.text) : l.text}</a>`).join('');
  const up = `<a class="ft-up" href="#top" aria-label="Наверх"><svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg></a>`;

  ft.classList.add('ft', 'ft-' + V);

  // ---------- А: ПОДПИСЬ ----------
  if (V === 'a') {
    ft.innerHTML = `
      <div class="ft-top">
        <div class="ft-brand"><a class="ft-name" href="/">${name}</a><span class="ft-role">Фотограф · концерты, события, косплей</span></div>
        <nav class="ft-nav">${nav.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}</nav>
        <div class="ft-soc">${soc('ft-soc-btn')}${up}</div>
      </div>
      <div class="ft-bottom">
        <span class="ft-copy">© ${year} ${name}</span>
        <nav class="ft-legal" aria-label="Правовая информация">${legalHtml(true)}</nav>
        ${wolf}
      </div>`;
  }

  // ---------- Б: ПОЛОСА ДАННЫХ ----------
  if (V === 'b') {
    ft.innerHTML = `
      <div class="ft-strip">
        <span class="ft-cell"><b class="ft-rec">●</b> © ${year}</span>
        <span class="ft-cell ft-cell--name">${name}</span>
        <span class="ft-cell">SONY α6000</span>
        <span class="ft-cell">10–100 ММ</span>
        <span class="ft-cell ft-cell--soc">${soc('ft-soc-btn')}</span>
        <span class="ft-cell ft-cell--end">${wolf}</span>
      </div>
      <nav class="ft-legal" aria-label="Правовая информация">${legalHtml(false)}</nav>`;
  }

  // ---------- В: КОНЕЦ ПЛЁНКИ ----------
  if (V === 'c') {
    ft.innerHTML = `
      <div class="ft-film" aria-hidden="true"><div class="ft-holes"></div>
        <div class="ft-marks"><span>ISO 400</span><span>34</span><span>▸ 34A</span><span>35</span><span>▸ 35A</span><span>36</span><span>▸ 36A</span><span>КОНЕЦ ПЛЁНКИ</span></div>
        <div class="ft-holes"></div></div>
      <div class="ft-row">
        <div><p class="ft-end">Конец плёнки — <em>спасибо, что досмотрели</em></p>
          <nav class="ft-legal" aria-label="Правовая информация">${legalHtml(true)}</nav></div>
        <div class="ft-side"><div class="ft-soc">${soc('ft-soc-btn')}</div><span class="ft-copy">© ${year} ${name}</span>${wolf}</div>
      </div>`;
  }

  // ---------- Г: ПО ЦЕНТРУ ----------
  if (V === 'd') {
    ft.innerHTML = `
      <div class="ft-center">
        ${wolf}
        <a class="ft-name" href="/">${name}</a>
        <div class="ft-soc">${soc('ft-soc-btn')}</div>
        <nav class="ft-legal" aria-label="Правовая информация">${legalHtml(true)}</nav>
        <span class="ft-copy">© ${year} · Все фотографии защищены авторским правом</span>
      </div>`;
  }

  // ---------- Д…З: развитие Г (всё по центру, у каждого своя изюминка) ----------
  const tail = `
        <div class="ft-soc">${soc('ft-soc-btn')}</div>
        <nav class="ft-legal" aria-label="Правовая информация">${legalHtml(true)}</nav>
        <span class="ft-copy">© ${year} · Все фотографии защищены авторским правом</span>`;

  // Д: ПОДПИСЬ — имя большим курсивом «расписывается» слева направо, под ним росчерк
  if (V === 'e') {
    ft.innerHTML = `
      <div class="ft-center">
        <a class="ft-sign" href="/"><span>${name}</span>
          <svg class="ft-flourish" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true"><path d="M8 26 C 90 6, 170 36, 250 20 S 360 8, 392 22"/></svg></a>
        ${wolf}${tail}
      </div>`;
  }

  // Е: РАМКА ФОКУСА — блок в уголках автофокуса, которые «ловят» его при появлении; волк — точка фокуса
  if (V === 'f') {
    ft.innerHTML = `
      <div class="ft-center">
        <div class="ft-af">
          <span class="ft-af-hud"><b>●</b> AF</span><span class="ft-af-hud ft-af-hud--r">∞</span>
          ${wolf}
          <a class="ft-name" href="/">${name}</a>
        </div>${tail}
      </div>`;
  }

  // Ж: ВОЛЧИЙ СЛЕД — по подвалу к волку тянется цепочка следов, появляются по одному
  if (V === 'g') {
    const PRINT = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 21c-6 0-11 6-11 10.5 0 3 2.6 4.5 5.5 4.5 2.4 0 3.6-1.4 5.5-1.4s3.1 1.4 5.5 1.4c2.9 0 5.5-1.5 5.5-4.5C31 27 26 21 20 21z"/><ellipse cx="7.5" cy="17" rx="3.4" ry="4.4" transform="rotate(-25 7.5 17)"/><ellipse cx="15" cy="9.5" rx="3.4" ry="4.6" transform="rotate(-8 15 9.5)"/><ellipse cx="25" cy="9.5" rx="3.4" ry="4.6" transform="rotate(8 25 9.5)"/><ellipse cx="32.5" cy="17" rx="3.4" ry="4.4" transform="rotate(25 32.5 17)"/></svg>';
    const steps = Array.from({ length: 7 }, (_, i) => `<span class="ft-print" style="--i:${i}; --side:${i % 2 ? 1 : -1}">${PRINT}</span>`).join('');
    ft.innerHTML = `
      <div class="ft-center">
        <div class="ft-trail" aria-hidden="true">${steps}</div>
        ${wolf}
        <a class="ft-name" href="/">${name}</a>${tail}
      </div>`;
  }

  // З: ОБЪЕКТИВ — волк внутри кольца объектива со шкалой фокусных, кольцо крутится при наведении
  if (V === 'h') {
    const marks = [10, 18, 24, 35, 50, 70, 100];
    const ring = marks.map((m, i) => {
      const a = (-120 + i * 40) * Math.PI / 180, x = 60 + Math.sin(a) * 47, y = 60 - Math.cos(a) * 47;
      return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}">${m}</text>`;
    }).join('');
    const ticks = Array.from({ length: 36 }, (_, i) => `<line x1="60" y1="4" x2="60" y2="${i % 3 ? 8 : 11}" transform="rotate(${i * 10} 60 60)"/>`).join('');
    ft.innerHTML = `
      <div class="ft-center">
        <div class="ft-lens">
          <svg class="ft-lens-ring" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="57"/><circle cx="60" cy="60" r="38"/><g class="ft-lens-ticks">${ticks}</g><g class="ft-lens-nums">${ring}</g></svg>
          ${wolf}
        </div>
        <a class="ft-name" href="/">${name}</a>${tail}
      </div>`;
  }

  // ---------- И…М: игры со следами (развитие Ж) ----------
  const PAW = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 21c-6 0-11 6-11 10.5 0 3 2.6 4.5 5.5 4.5 2.4 0 3.6-1.4 5.5-1.4s3.1 1.4 5.5 1.4c2.9 0 5.5-1.5 5.5-4.5C31 27 26 21 20 21z"/><ellipse cx="7.5" cy="17" rx="3.4" ry="4.4" transform="rotate(-25 7.5 17)"/><ellipse cx="15" cy="9.5" rx="3.4" ry="4.6" transform="rotate(-8 15 9.5)"/><ellipse cx="25" cy="9.5" rx="3.4" ry="4.6" transform="rotate(8 25 9.5)"/><ellipse cx="32.5" cy="17" rx="3.4" ry="4.4" transform="rotate(25 32.5 17)"/></svg>';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const layoutG = `<div class="ft-layer" aria-hidden="true"></div>
      <div class="ft-center">${wolf}<a class="ft-name" href="/">${name}</a>${tail}</div>`;
  // Поставить след: x, y — центр в px от подвала, ang — куда смотрят пальцы (0 — вверх, 90 — вправо)
  const print = (layer, x, y, ang, { size = 26, op = 1, life = 0, cls = '' } = {}) => {
    const el = document.createElement('span');
    el.className = 'ft-pr ' + cls; el.innerHTML = PAW;
    el.style.cssText = `left:${x - size / 2}px; top:${y - size / 2}px; width:${size}px; height:${size}px; --ang:${ang}deg; --op:${op}`;
    layer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-on'));
    if (life) setTimeout(() => { el.classList.add('is-off'); setTimeout(() => el.remove(), 900); }, life);
    return el;
  };
  // Шаги по кривой Безье от a к b через c: каждые step px, попеременно левая/правая лапа
  const walk = (a, c, b, step) => {
    const pts = [], P = t => ({ x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y });
    let len = 0, prev = P(0); const samples = [];
    for (let i = 1; i <= 200; i++) { const p = P(i / 200); len += Math.hypot(p.x - prev.x, p.y - prev.y); samples.push({ t: i / 200, len }); prev = p; }
    const n = Math.max(2, Math.floor(len / step));
    for (let k = 0; k <= n; k++) {
      const target = k / n * len, s = samples.find(q => q.len >= target) || samples[samples.length - 1];
      const p = P(s.t), q = P(Math.min(1, s.t + .01)), o = P(Math.max(0, s.t - .01));
      const dir = Math.atan2(q.y - o.y, q.x - o.x), side = k % 2 ? 1 : -1;
      pts.push({ x: p.x - Math.sin(dir) * side * 9, y: p.y + Math.cos(dir) * side * 9, ang: dir * 180 / Math.PI + 90 });
    }
    return pts;
  };
  const wolfBox = () => {
    const f = ft.getBoundingClientRect(), w = ft.querySelector('.holo-icon').getBoundingClientRect();
    return { x: w.left - f.left + w.width / 2, y: w.top - f.top + w.height / 2, f };
  };
  const onScreen = fn => { const o = new IntersectionObserver(es => es.forEach(e => fn(e.isIntersecting)), { threshold: .2 }); o.observe(ft); };

  // И: ТРОПА К ВОЛКУ — следы выходят из-за левого края и по дуге приходят к волку; волк «оживает»
  if (V === 'i') {
    ft.innerHTML = layoutG;
    const layer = ft.querySelector('.ft-layer'); let done = false;
    const go = () => {
      layer.innerHTML = ''; const { x, y, f } = wolfBox();
      const pts = walk({ x: -20, y: f.height * .85 }, { x: x * .45, y: f.height * .05 }, { x: x - 46, y: y + 4 }, f.width < 600 ? 36 : 54);
      pts.forEach((p, i) => setTimeout(() => print(layer, p.x, p.y, p.ang, { op: .25 + .75 * i / pts.length }), reduced ? 0 : i * 170));
      setTimeout(() => ft.classList.add('is-arrived'), reduced ? 0 : pts.length * 170 + 200);
    };
    onScreen(v => { if (v && !done) { done = true; go(); } });
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (done) { ft.classList.remove('is-arrived'); go(); } }, 300); });
    ft.querySelector('.wisewolf-seal').addEventListener('click', () => { ft.classList.remove('is-arrived'); go(); });   // ещё раз — по клику на волка
  }

  // К: СЛЕДЫ ЗА КУРСОРОМ — водишь мышью по подвалу, за ней остаются следы; на телефоне — касание
  if (V === 'j') {
    ft.innerHTML = layoutG;
    const layer = ft.querySelector('.ft-layer'); let last = null, k = 0;
    ft.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const r = ft.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (!last) { last = { x, y }; return; }
      const d = Math.hypot(x - last.x, y - last.y); if (d < 38) return;
      const dir = Math.atan2(y - last.y, x - last.x), side = k++ % 2 ? 1 : -1;
      print(layer, x - Math.sin(dir) * side * 8, y + Math.cos(dir) * side * 8, dir * 180 / Math.PI + 90, { life: 2200, op: .9 });
      last = { x, y };
    });
    ft.addEventListener('pointerleave', () => { last = null; });
    // Касание: от пальца к волку пробегает короткая цепочка
    ft.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' || e.target.closest('a')) return;
      const r = ft.getBoundingClientRect(), s = { x: e.clientX - r.left, y: e.clientY - r.top }, { x, y } = wolfBox();
      walk(s, { x: (s.x + x) / 2, y: Math.min(s.y, y) - 40 }, { x, y: y + 30 }, 34).slice(0, 8)
        .forEach((p, i) => setTimeout(() => print(layer, p.x, p.y, p.ang, { life: 1800, op: .9 }), i * 140));
    });
    // Подсказка при появлении: пара следов сама пробегает поперёк
    let shown = false;
    onScreen(v => {
      if (!v || shown || reduced) return; shown = true;
      const { f } = wolfBox();
      walk({ x: f.width * .15, y: f.height * .7 }, { x: f.width * .3, y: f.height * .3 }, { x: f.width * .42, y: f.height * .55 }, 40)
        .forEach((p, i) => setTimeout(() => print(layer, p.x, p.y, p.ang, { life: 1800, op: .7 }), 400 + i * 160));
    });
  }

  // Л: ВОЛЧИЦА ГУЛЯЕТ — по фону подвала время от времени проходит цепочка следов из края в край
  if (V === 'k') {
    ft.innerHTML = layoutG;
    const layer = ft.querySelector('.ft-layer'); let visible = false, timer = null, walking = false;
    const stroll = () => {
      if (!visible || document.hidden) { timer = setTimeout(stroll, 1500); return; }
      walking = true; const { f } = wolfBox(), ltr = Math.random() < .5, y0 = f.height * (.2 + Math.random() * .6), y1 = f.height * (.2 + Math.random() * .6);
      const a = { x: ltr ? -30 : f.width + 30, y: y0 }, b = { x: ltr ? f.width + 30 : -30, y: y1 }, c = { x: f.width / 2, y: f.height * (Math.random() < .5 ? -.1 : 1.1) };
      const pts = walk(a, c, b, 46);
      pts.forEach((p, i) => setTimeout(() => print(layer, p.x, p.y, p.ang, { life: 2600, op: .45, size: 22 }), i * 260));
      timer = setTimeout(() => { walking = false; stroll(); }, pts.length * 260 + 5000 + Math.random() * 6000);
    };
    onScreen(v => { visible = v; if (v && !walking && !timer && !reduced) timer = setTimeout(stroll, 600); });
  }

  // М: МИНИМАЛ — подвал в две строки, перед волком три маленьких следа
  if (V === 'l') {
    ft.innerHTML = `
      <div class="ft-mini">
        <div class="ft-mini-top"><span class="ft-mini-trail" aria-hidden="true">${[0, 1, 2].map(i => `<span class="ft-mini-pr" style="--i:${i}">${PAW}</span>`).join('')}</span>${wolf}</div>
        <div class="ft-mini-row">
          <a class="ft-mini-name" href="/">${name}</a>
          <span class="ft-mini-soc">${socials.map(s => `<a href="${s.href}" target="_blank" rel="noopener" aria-label="${s.name}"><span class="ft-ico" style="--icon-url: ${s.icon}"></span></a>`).join('')}</span>
        </div>
        <nav class="ft-legal" aria-label="Правовая информация">${legalHtml(true)}<span class="ft-copy">© ${year}</span></nav>
      </div>`;
  }

  // Н: И + К + Л ПО КРУГУ. Появился подвал — следы идут к волку, он загорается.
  // Нажатие на волка: надпись «Великая волчица наблюдает» и следы за курсором →
  // ещё нажатие: волчица гуляет по фону → ещё: снова бежит к волку, потом за курсором → …
  if (V === 'm') {
    ft.innerHTML = layoutG;
    const layer = ft.querySelector('.ft-layer'), seal = ft.querySelector('.wisewolf-seal');
    seal.querySelector('.wisewolf-text').textContent = 'Великая волчица наблюдает';
    seal.setAttribute('role', 'button'); seal.setAttribute('tabindex', '0');
    seal.title = 'Нажми на волчицу';
    let mode = 'idle', run = 0, visible = false, started = false, last = null, k = 0;
    const setMode = m => { mode = m; ft.dataset.mode = m; };
    const fadeAll = () => layer.querySelectorAll('.ft-pr').forEach(el => { el.classList.add('is-off'); setTimeout(() => el.remove(), 900); });
    const later = (id, ms, fn) => setTimeout(() => { if (id === run) fn(); }, ms);

    // Тропа к волку; then — что делать, когда дошла
    const goToWolf = then => {
      const id = ++run; setMode('walking'); fadeAll(); ft.classList.remove('is-arrived', 'is-watching');
      const { x, y, f } = wolfBox();
      const fromLeft = Math.random() < .5 || f.width < 600;   // на ПК — с случайной стороны
      const pts = walk({ x: fromLeft ? -20 : f.width + 20, y: f.height * .85 }, { x: fromLeft ? x * .45 : x + (f.width - x) * .55, y: f.height * .05 },
        { x: x + (fromLeft ? -46 : 46), y: y + 4 }, f.width < 600 ? 36 : 54);
      pts.forEach((p, i) => later(id, reduced ? 0 : i * 150, () => print(layer, p.x, p.y, p.ang, { op: .25 + .75 * i / pts.length })));
      later(id, reduced ? 0 : pts.length * 150 + 200, () => { ft.classList.add('is-arrived'); then(id); });
    };
    // Прогулка по фону (как Л), пока не переключили
    const stroll = id => {
      if (id !== run) return;
      if (!visible || document.hidden) { later(id, 1500, () => stroll(id)); return; }
      const { f } = wolfBox(), ltr = Math.random() < .5;
      const a = { x: ltr ? -30 : f.width + 30, y: f.height * (.2 + Math.random() * .6) }, b = { x: ltr ? f.width + 30 : -30, y: f.height * (.2 + Math.random() * .6) };
      const pts = walk(a, { x: f.width / 2, y: f.height * (Math.random() < .5 ? -.1 : 1.1) }, b, 46);
      pts.forEach((p, i) => later(id, i * 240, () => print(layer, p.x, p.y, p.ang, { life: 2600, op: .45, size: 22 })));
      later(id, pts.length * 240 + 3500 + Math.random() * 4500, () => stroll(id));
    };
    const toCursor = () => { setMode('cursor'); ft.classList.add('is-watching'); };
    const toStroll = () => { const id = ++run; setMode('stroll'); ft.classList.remove('is-arrived', 'is-watching'); fadeAll(); later(id, 500, () => stroll(id)); };

    const next = () => {
      if (mode === 'walking') return;                       // пока бежит — не сбиваем
      if (mode === 'idle') toCursor();                      // первое нажатие: надпись + следы за курсором
      else if (mode === 'cursor') toStroll();
      else goToWolf(() => toCursor());                      // из прогулки — снова к волку, потом за курсором
    };
    seal.addEventListener('click', e => { e.stopPropagation(); next(); });
    seal.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); } });

    // Следы за мышью (только в режиме «за курсором»)
    ft.addEventListener('pointermove', e => {
      if (mode !== 'cursor' || e.pointerType !== 'mouse') return;
      const r = ft.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (!last) { last = { x, y }; return; }
      if (Math.hypot(x - last.x, y - last.y) < 38) return;
      const dir = Math.atan2(y - last.y, x - last.x), side = k++ % 2 ? 1 : -1;
      print(layer, x - Math.sin(dir) * side * 8, y + Math.cos(dir) * side * 8, dir * 180 / Math.PI + 90, { life: 2200, op: .9 });
      last = { x, y };
    });
    ft.addEventListener('pointerleave', () => { last = null; });
    // На телефоне в режиме «за курсором»: касание — от пальца к волку пробегает цепочка
    ft.addEventListener('pointerdown', e => {
      if (mode !== 'cursor' || e.pointerType === 'mouse' || e.target.closest('a, .wisewolf-seal')) return;
      const r = ft.getBoundingClientRect(), s = { x: e.clientX - r.left, y: e.clientY - r.top }, { x, y } = wolfBox();
      walk(s, { x: (s.x + x) / 2, y: Math.min(s.y, y) - 40 }, { x, y: y + 30 }, 34).slice(0, 8)
        .forEach((p, i) => setTimeout(() => print(layer, p.x, p.y, p.ang, { life: 1800, op: .9 }), i * 140));
    });

    onScreen(v => { visible = v; if (v && !started) { started = true; goToWolf(() => setMode('idle')); } });
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (ft.classList.contains('is-arrived')) fadeAll(); }, 300); });
  }

  // Анимации «при появлении» (Д, Е, Ж, М) — класс .is-in, когда подвал попал на экран
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { ft.classList.add('is-in'); io.disconnect(); } }), { threshold: 0.3 });
  io.observe(ft);

  const u = ft.querySelector('.ft-up');
  if (u) u.addEventListener('click', e => { e.preventDefault(); scrollTo({ top: 0, behavior: 'smooth' }); });
})();
