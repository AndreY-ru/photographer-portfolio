// ПРОТОТИП блока «Признание & Опыт». window.AW_V: 'a' — сушилка, 'b' — хронология, 'c' — стопка.
(function () {
  const V = window.AW_V || 'a';
  const sec = document.querySelector('.about-awards');
  if (!sec) return;
  // Два настоящих диплома (тексты с сайта) + два примера, чтобы было видно, как блок ведёт себя, когда наград больше
  const DATA = [
    { year: '2026', title: 'Гран-при', desc: 'Гран-при в личной номинации «Журналистика» (фотопроекты) среди 7 образовательных учреждений', link: 'http://techn.sstu.ru/note/?note=3968', img: '/_proto_asset/about-awards/dipl1.jpg' },
    { year: '2026', title: 'Победитель «Студенческой весны»', desc: 'Победитель районного фестиваля студенческого творчества «Студенческая весна»', link: 'https://vk.ru/wall-223192623_513', img: '/_proto_asset/about-awards/dipl2.jpg' },
    { year: '2025', title: 'Пример: благодарственное письмо', desc: 'Пример для прототипа — так будет выглядеть третья награда', link: 'https://t.me/example', img: '/_proto_asset/about-awards/dipl1.jpg' },
    { year: '2024', title: 'Пример без ссылки', desc: 'Если ссылки нет, строки со ссылкой просто не будет', link: '', img: '/_proto_asset/about-awards/dipl2.jpg' },
  ];
  // Подпись ссылки — по адресу, чтобы было понятно, куда она ведёт
  const linkLabel = url => {
    try {
      const h = new URL(url).hostname.replace(/^www\./, '');
      if (/(^|\.)vk\.(com|ru)$/.test(h)) return 'Пост ВКонтакте';
      if (/(^|\.)t\.me$/.test(h)) return 'Пост в Telegram';
      return `Новость на ${h}`;
    } catch (e) { return 'Подробнее'; }
  };
  const ext = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
  const linkHtml = d => d.link ? `<a class="aw-link" href="${d.link}" target="_blank" rel="noopener">${linkLabel(d.link)}${ext}</a>` : '';
  const textHtml = d => `<span class="aw-year">${d.year}</span><h3 class="aw-title">${d.title}</h3><p class="aw-desc">${d.desc}</p>${linkHtml(d)}`;

  sec.classList.add('aw', 'aw-' + V);
  const wrap = sec.querySelector('.awards-wrapper');
  wrap.innerHTML = '';

  // ---------- Просмотр диплома крупно ----------
  const viewer = document.createElement('div'); viewer.className = 'aw-viewer'; viewer.setAttribute('role', 'dialog');
  viewer.innerHTML = `<button type="button" class="aw-viewer-close" aria-label="Закрыть"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <img alt=""><div class="aw-viewer-cap"></div>`;
  document.body.appendChild(viewer);
  const openViewer = d => {
    viewer.querySelector('img').src = d.img;
    viewer.querySelector('.aw-viewer-cap').innerHTML = `<span class="aw-year">${d.year}</span><span class="aw-viewer-title">${d.title}</span>${linkHtml(d)}`;
    viewer.classList.add('is-open'); document.body.style.overflow = 'hidden';
  };
  const closeViewer = () => { viewer.classList.remove('is-open'); document.body.style.overflow = ''; };
  viewer.addEventListener('click', e => { if (e.target === viewer || e.target.closest('.aw-viewer-close')) closeViewer(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeViewer(); });

  // ---------- А: СУШИЛКА ----------
  if (V === 'a') {
    const line = document.createElement('div'); line.className = 'aw-line';
    DATA.forEach((d, i) => {
      const it = document.createElement('article'); it.className = 'aw-hang';
      it.style.setProperty('--tilt', `${i % 2 ? 1.6 : -1.4}deg`);
      it.innerHTML = `<div class="aw-printbox"><button type="button" class="aw-print" aria-label="Открыть диплом «${d.title}» крупно">
          <span class="aw-clip" aria-hidden="true"></span><img src="${d.img}" alt="${d.title}" loading="lazy"></button></div>
        <div class="aw-text">${textHtml(d)}</div>`;
      it.querySelector('.aw-print').addEventListener('click', () => openViewer(d));
      line.appendChild(it);
    });
    wrap.appendChild(line);
  }

  // ---------- Б: ХРОНОЛОГИЯ ----------
  if (V === 'b') {
    const tl = document.createElement('ol'); tl.className = 'aw-timeline';
    DATA.forEach(d => {
      const li = document.createElement('li'); li.className = 'aw-entry';
      li.innerHTML = `<div class="aw-entry-year">${d.year}</div><span class="aw-dot" aria-hidden="true"></span>
        <div class="aw-entry-body"><div class="aw-text">${textHtml(d).replace(/<span class="aw-year">.*?<\/span>/, '')}</div>
        <button type="button" class="aw-thumb" aria-label="Открыть диплом крупно"><img src="${d.img}" alt="${d.title}" loading="lazy"><span class="aw-zoom">Открыть</span></button></div>`;
      li.querySelector('.aw-thumb').addEventListener('click', () => openViewer(d));
      tl.appendChild(li);
    });
    wrap.appendChild(tl);
  }

  // ---------- Г: КОНТАКТНЫЙ ЛИСТ ----------
  if (V === 'd') {
    let cur = 0;
    const box = document.createElement('div'); box.className = 'aw-contact';
    box.innerHTML = '<div class="aw-film"><div class="aw-film-strip"></div></div><div class="aw-contact-text"></div>';
    const strip = box.querySelector('.aw-film-strip');
    const frames = DATA.map((d, i) => {
      const f = document.createElement('button'); f.type = 'button'; f.className = 'aw-frame';
      f.innerHTML = `<span class="aw-frame-no">${String(i + 1).padStart(2, '0')}A</span><span class="aw-frame-img"><img src="${d.img}" alt="${d.title}" loading="lazy"></span>
        <svg class="aw-mark" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M8 14 Q6 4 30 5 L72 4 Q95 3 95 22 L96 76 Q97 96 74 95 L26 96 Q4 97 5 74 L6 30 Q5 18 12 9"/></svg>`;
      f.addEventListener('click', () => { if (i === cur) openViewer(d); else { cur = i; render(); } });
      strip.appendChild(f); return f;
    });
    const render = () => {
      frames.forEach((f, i) => { f.classList.toggle('is-on', i === cur); f.setAttribute('aria-label', i === cur ? `Открыть диплом «${DATA[i].title}» крупно` : `Выбрать «${DATA[i].title}»`); });
      box.querySelector('.aw-contact-text').innerHTML = `<span class="aw-frame-tag">кадр ${String(cur + 1).padStart(2, '0')}A</span>${textHtml(DATA[cur])}`;
      const f = frames[cur], film = box.querySelector('.aw-film');
      film.scrollTo({ left: f.offsetLeft - (film.clientWidth - f.offsetWidth) / 2, behavior: 'smooth' });
    };
    wrap.appendChild(box); render();
  }

  // ---------- Д: ВЫСТАВКА ----------
  if (V === 'e') {
    const wall = document.createElement('div'); wall.className = 'aw-wall';
    DATA.forEach(d => {
      const it = document.createElement('figure'); it.className = 'aw-exhibit';
      it.innerHTML = `<button type="button" class="aw-frame-mat" aria-label="Открыть диплом «${d.title}» крупно"><img src="${d.img}" alt="${d.title}" loading="lazy"></button>
        <figcaption class="aw-label">${textHtml(d)}</figcaption>`;
      it.querySelector('.aw-frame-mat').addEventListener('click', () => openViewer(d));
      wall.appendChild(it);
    });
    wrap.appendChild(wall);
  }

  // ---------- Е: РАЗВОРОТЫ (аккордеон) ----------
  if (V === 'f') {
    const list = document.createElement('div'); list.className = 'aw-acc';
    DATA.forEach((d, i) => {
      const row = document.createElement('div'); row.className = 'aw-acc-row' + (i === 0 ? ' is-open' : '');
      row.innerHTML = `<button type="button" class="aw-acc-head" aria-expanded="${i === 0}">
          <span class="aw-acc-year">${d.year}</span><span class="aw-acc-title">${d.title}</span>
          <span class="aw-acc-peek"><img src="${d.img}" alt="" loading="lazy"></span>
          <svg class="aw-acc-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
        <div class="aw-acc-body"><div class="aw-acc-inner">
          <button type="button" class="aw-acc-img" aria-label="Открыть диплом крупно"><img src="${d.img}" alt="${d.title}" loading="lazy"></button>
          <div class="aw-text"><p class="aw-desc">${d.desc}</p>${linkHtml(d)}</div></div></div>`;
      row.querySelector('.aw-acc-head').addEventListener('click', () => {
        const open = !row.classList.contains('is-open');
        list.querySelectorAll('.aw-acc-row').forEach(r => { r.classList.remove('is-open'); r.querySelector('.aw-acc-head').setAttribute('aria-expanded', 'false'); });
        if (open) { row.classList.add('is-open'); row.querySelector('.aw-acc-head').setAttribute('aria-expanded', 'true'); }
      });
      row.querySelector('.aw-acc-img').addEventListener('click', () => openViewer(d));
      list.appendChild(row);
    });
    wrap.appendChild(list);
  }

  // ---------- В: СТОПКА ----------
  if (V === 'c') {
    let cur = 0;
    const box = document.createElement('div'); box.className = 'aw-stackbox';
    box.innerHTML = `<div class="aw-stack"></div>
      <div class="aw-side"><div class="aw-count"></div><div class="aw-text"></div>
        <div class="aw-nav"><button type="button" data-step="-1" aria-label="Предыдущая награда"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
        <button type="button" data-step="1" aria-label="Следующая награда"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button></div></div>`;
    const stack = box.querySelector('.aw-stack');
    const cards = DATA.map((d, i) => {
      const c = document.createElement('button'); c.type = 'button'; c.className = 'aw-card';
      c.innerHTML = `<img src="${d.img}" alt="${d.title}" loading="lazy">`;
      c.addEventListener('click', () => { if (i === cur) openViewer(d); else { cur = i; render(); } });
      stack.appendChild(c); return c;
    });
    const render = () => {
      const n = DATA.length;
      cards.forEach((c, i) => {
        const k = (i - cur + n) % n;   // 0 — сверху
        c.style.zIndex = n - k;
        c.style.transform = `translate(${k * 22}px, ${k * -10}px) rotate(${k ? (k % 2 ? 4 : -3) * Math.min(k, 2) : 0}deg) scale(${1 - k * 0.05})`;
        c.style.opacity = k > 3 ? 0 : 1;
        c.classList.toggle('is-top', k === 0);
        c.setAttribute('aria-label', k === 0 ? `Открыть диплом «${DATA[i].title}» крупно` : `Показать «${DATA[i].title}»`);
      });
      box.querySelector('.aw-count').textContent = `${cur + 1} / ${n}`;
      box.querySelector('.aw-text').innerHTML = textHtml(DATA[cur]);
    };
    box.querySelector('.aw-nav').addEventListener('click', e => {
      const b = e.target.closest('[data-step]'); if (!b) return;
      cur = (cur + +b.dataset.step + DATA.length) % DATA.length; render();
    });
    let x0 = null;
    stack.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    stack.addEventListener('touchend', e => {
      if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) { cur = (cur + (dx < 0 ? 1 : -1) + DATA.length) % DATA.length; render(); }
    });
    wrap.appendChild(box);
    render();
  }
})();
