// ПРОТОТИП первого блока «Обо мне» («Здесь творят и хвастаются»).
// window.HR_V: a — кадр, b — профиль, c — проявка, d — раскадровка, e — полароид, f — афиша,
// g — наведи фокус, h — встряхни полароид, i — диафрагма, k — проявитель кистью,
// l — взвод затвора, m — рисуй светом, n — видоискатель → снимок → полароид (связка g + h),
// o — полароид трясёт волчья лапка (отсылка к Хоро), потом зовёт потрясти самому.
(function () {
  const V = window.HR_V || 'a';
  const hero = document.querySelector('.about-hero');
  if (!hero) return;
  const img0 = hero.querySelector('.visual-frame img, .about-shot img');
  const src = img0.getAttribute('src'), alt = img0.getAttribute('alt');
  const name = (alt || '').split(' ')[0] || 'Андрей';
  const contactHref = (document.querySelector('[data-contact-trigger]') || { getAttribute: () => '/about#contact' }).getAttribute('href');
  const BIO = [
    `Привет, я ${name}, и я только начал свой путь в коммерческой съёмке.`,
    'На данный момент я действующий фотограф медиа-центра и имею опыт в репортажной съёмке: снимаю концерты, мероприятия и всё, где бьёт ключом жизнь.',
    'Я с удовольствием приму любые заказы! Будь то сложный косплей-образ, шумный концерт или фото для меню.',
    'А этот сайт — моё портфолио, которое будет пополняться. Заглядывай, вдохновляйся и смело пиши, если хочешь создать что-то вместе.',
  ];
  const title = 'Здесь <em>творят</em> и хвастаются';
  const cta = `<a class="hr-cta" href="${contactHref}" data-contact-trigger>Написать мне<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>`;
  const textCol = (extra = '') => `<div class="hr-text"><h1 class="hr-title">${title}</h1>
      <div class="hr-bio">${BIO.map(t => `<p>${t}</p>`).join('')}</div>${extra}${cta}</div>`;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const year = new Date().getFullYear();
  hero.classList.add('hr', 'hr-' + V);

  // Видоискатель с автофокусом (общий для Ж и Н). onShot(x, y, n) — после спуска.
  function viewfinder(onShot) {
    const fig = hero.querySelector('.hr-focus');
    const st = hero.querySelector('.hr-vf-state'), dist = hero.querySelector('.hr-vf-dist'), shotEl = hero.querySelector('.hr-vf-shot');
    const FACE = { x: 57, y: 20 };   // где лицо на нынешнем портрете, в процентах
    let fx = 30, fy = 70, tx = FACE.x, ty = FACE.y, user = false, shots = 0, raf = null, lockT = null;
    const set = () => {
      fig.style.setProperty('--fx', fx + '%'); fig.style.setProperty('--fy', fy + '%');
      const d = Math.hypot(fx - FACE.x, fy - FACE.y);
      dist.textContent = d < 6 ? '1.4 м' : d < 20 ? '2.1 м' : d < 40 ? '3.5 м' : '∞';
    };
    const lock = () => { clearTimeout(lockT); lockT = setTimeout(() => { fig.classList.add('is-locked'); st.textContent = 'AF ●'; }, 120); };
    const loop = () => {
      fx += (tx - fx) * 0.16; fy += (ty - fy) * 0.16; set();
      if (Math.abs(tx - fx) + Math.abs(ty - fy) > 0.1) raf = requestAnimationFrame(loop); else { raf = null; lock(); }
    };
    const go = (x, y) => { tx = x; ty = y; fig.classList.remove('is-locked'); st.textContent = 'AF-C'; clearTimeout(lockT); if (!raf) raf = requestAnimationFrame(loop); };
    const pos = e => { const r = fig.getBoundingClientRect(); return [Math.max(4, Math.min(96, (e.clientX - r.left) / r.width * 100)), Math.max(4, Math.min(96, (e.clientY - r.top) / r.height * 100))]; };
    fig.addEventListener('pointermove', e => { user = true; go(...pos(e)); });
    fig.addEventListener('pointerleave', () => { if (user) go(FACE.x, FACE.y); });
    fig.addEventListener('click', e => {
      const [x, y] = pos(e); go(x, y);
      shots++; shotEl.textContent = 'кадр ' + String(shots).padStart(2, '0');
      fig.classList.remove('is-shot'); void fig.offsetWidth; fig.classList.add('is-shot');
      if (onShot) onShot(x, y, shots);
    });
    // при появлении: фокус «ищет» и ловит лицо
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; io.disconnect();
      if (reduced) { fx = FACE.x; fy = FACE.y; set(); lock(); return; }
      setTimeout(() => go(78, 60), 300); setTimeout(() => go(35, 35), 900); setTimeout(() => { if (!user) go(FACE.x, FACE.y); }, 1500);
    }), { threshold: .4 });
    set(); io.observe(fig);
  }
  const vfHtml = hint => `
        <figure class="hr-focus">
          <img class="hr-blur" src="${src}" alt="" aria-hidden="true">
          <img class="hr-sharp" src="${src}" alt="${alt}">
          <span class="hr-af2" aria-hidden="true"></span>
          <span class="hr-flash" aria-hidden="true"></span>
          <div class="hr-vf" aria-hidden="true"><span class="hr-vf-state">AF-C</span><span class="hr-vf-dist">∞</span><span class="hr-vf-shot">кадр 00</span></div>
          <figcaption class="hr-hint">${hint}</figcaption>
        </figure>`;

  // Полароид, который можно хватать и трясти: проявляется сам (за ms мс) и быстрее при встряхивании
  function shakeable(card, ms, onDrag) {
    let dev = 0, last = performance.now(), drag = null, lx = 0, ly = 0;
    const paint = () => { card.style.setProperty('--dev', dev.toFixed(3)); card.classList.toggle('is-done', dev >= 1); const b = card._bar; if (b) b.style.width = dev * 100 + '%'; };
    const tick = now => { dev = Math.min(1, dev + (now - last) / ms); last = now; paint(); if (dev < 1) requestAnimationFrame(tick); };
    const start = () => { last = performance.now(); requestAnimationFrame(tick); };
    card.addEventListener('pointerdown', e => {
      drag = { x: e.clientX, y: e.clientY }; lx = e.clientX; ly = e.clientY;
      if (onDrag) onDrag();   // до захвата: перестановка в DOM сбросила бы захват указателя
      card.setPointerCapture(e.pointerId); card.classList.add('is-drag');
    });
    card.addEventListener('pointermove', e => {
      if (!drag) return;
      const vx = e.clientX - lx, sp = Math.hypot(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY;
      dev = Math.min(1, dev + sp / 4000); paint();
      card.style.setProperty('--dx', (e.clientX - drag.x) + 'px'); card.style.setProperty('--dy', (e.clientY - drag.y) + 'px');
      card.style.setProperty('--dr', Math.max(-18, Math.min(18, vx * 0.9)) + 'deg');
    });
    const end = () => { if (!drag) return; drag = null; card.classList.remove('is-drag'); ['--dx', '--dy', '--dr'].forEach(p => card.style.removeProperty(p)); };
    card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
    card._nudge = k => { dev = Math.min(1, dev + k); paint(); };   // проявить чуть-чуть снаружи (лапка О)
    paint();
    return start;
  }

  // ---------- А: КАДР ----------
  if (V === 'a') {
    hero.innerHTML = `
      <figure class="hr-shot">
        <img src="${src}" alt="${alt}">
        <span class="hr-af" aria-hidden="true"></span>
        <div class="hr-hud" aria-hidden="true">
          <span class="hr-hud-l">● REC</span><span>1/250</span><span>F2.0</span><span>ISO 400</span><span class="hr-hud-r">[ 01 ]</span>
        </div>
        <div class="hr-meter" aria-hidden="true"><span>-2</span><i></i><i></i><i></i><b></b><i></i><i></i><i></i><span>+2</span></div>
        <h1 class="hr-title">${title}</h1>
      </figure>
      <div class="hr-bio"><p class="hr-lead">${BIO[0]}</p><div class="hr-cols"><p>${BIO[1]}</p><p>${BIO[2]}</p><p>${BIO[3]}</p></div>${cta}</div>`;
  }

  // ---------- Б: ПРОФИЛЬ ----------
  if (V === 'b') {
    hero.innerHTML = `
      <div class="hr-head">
        <h1 class="hr-title">${title}</h1>
        <p class="hr-lead">${BIO[0]}</p>
      </div>
      <figure class="hr-portrait">
        <img src="${src}" alt="${alt}">
        <figcaption><span>${alt}</span><span>фотограф</span></figcaption>
      </figure>
      <dl class="hr-facts">
        <div><dt>Сейчас</dt><dd>Фотограф медиа-центра</dd></div>
        <div><dt>Снимаю</dt><dd>Концерты, мероприятия, косплей, фото для меню</dd></div>
        <div><dt>Заказы</dt><dd>Принимаю — пиши, придумаем вместе</dd></div>
        <div><dt>Этот сайт</dt><dd>Портфолио, которое пополняется</dd></div>
      </dl>
      <div class="hr-more"><p>${BIO[1]}</p><p>${BIO[3]}</p>${cta}</div>`;
  }

  // ---------- В: ПРОЯВКА ----------
  if (V === 'c') {
    hero.innerHTML = `
      <figure class="hr-develop">
        <img class="hr-neg" src="${src}" alt="" aria-hidden="true">
        <img class="hr-pos" src="${src}" alt="${alt}">
        <span class="hr-tray" aria-hidden="true"></span>
      </figure>
      <div class="hr-text">
        <h1 class="hr-title">${title}</h1>
        <div class="hr-bio">${BIO.map(t => `<p>${t}</p>`).join('')}${cta}</div>
      </div>`;
    const fig = hero.querySelector('.hr-develop');
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { fig.classList.add('is-developed'); io.disconnect(); } }), { threshold: 0.35 });
    io.observe(fig);
  }

  // ---------- Г: РАСКАДРОВКА ----------
  if (V === 'd') {
    const shots = [
      { no: '01', pos: '55% 50%', zoom: 1, cap: 'Общий план' },
      { no: '02', pos: '60% 30%', zoom: 1.7, cap: 'Средний' },
      { no: '03', pos: '57% 20%', zoom: 3, cap: 'Крупный' },
    ];
    hero.innerHTML = `
      <div class="hr-head"><h1 class="hr-title">${title}</h1><p class="hr-lead">${BIO[0]}</p></div>
      <ol class="hr-story">
        ${shots.map((s, i) => `<li class="hr-scene">
          <figure class="hr-frame"><img src="${src}" alt="${i ? '' : alt}" style="object-position:${s.pos};transform:scale(${s.zoom});transform-origin:${s.pos}">
            <figcaption><span>${s.no}</span><span>${s.cap}</span></figcaption></figure>
          <p>${BIO[i + 1]}</p></li>`).join('')}
      </ol>
      <div class="hr-foot">${cta}</div>`;
  }

  // ---------- Д: ПОЛАРОИД ----------
  if (V === 'e') {
    hero.innerHTML = `
      <div class="hr-desk">
        <figure class="hr-polaroid">
          <span class="hr-tape" aria-hidden="true"></span>
          <img src="${src}" alt="${alt}">
          <figcaption>это я, ${year}</figcaption>
        </figure>
        <figure class="hr-polaroid hr-polaroid--back" aria-hidden="true"><img src="${src}" alt=""></figure>
      </div>
      <div class="hr-letter">
        <h1 class="hr-title">${title}</h1>
        <div class="hr-bio">${BIO.map(t => `<p>${t}</p>`).join('')}</div>
        <p class="hr-sign">— ${name}</p>
        ${cta}
      </div>`;
  }

  // ---------- Е: АФИША ----------
  if (V === 'f') {
    hero.innerHTML = `
      <div class="hr-poster">
        <h1 class="hr-title"><span class="hr-l1">Здесь <em>творят</em></span><span class="hr-l2">и хвастаются</span></h1>
        <figure class="hr-strip"><img src="${src}" alt="${alt}"></figure>
      </div>
      <div class="hr-credits">
        <p class="hr-lead">${BIO[0]}</p>
        <div class="hr-cols"><p>${BIO[1]}</p><p>${BIO[2]}</p><p>${BIO[3]}</p></div>
        ${cta}
      </div>`;
  }

  // ---------- Ж: НАВЕДИ ФОКУС ----------
  if (V === 'g') {
    hero.innerHTML = vfHtml('Наведи фокус — и нажми, чтобы сделать кадр') + textCol();
    viewfinder();
  }

  // ---------- З: ВСТРЯХНИ ПОЛАРОИД ----------
  if (V === 'h') {
    hero.innerHTML = `
      <div class="hr-shake-zone">
        <figure class="hr-polaroid hr-shake" aria-label="Полароид — потяни и встряхни, чтобы проявить">
          <span class="hr-tape" aria-hidden="true"></span>
          <span class="hr-shake-img"><img src="${src}" alt="${alt}" draggable="false"></span>
          <figcaption><span class="hr-cap-a">встряхни меня</span><span class="hr-cap-b">это я, ${year}</span></figcaption>
        </figure>
        <div class="hr-dev" aria-hidden="true"><i></i></div>
      </div>${textCol(`<p class="hr-sign">— ${name}</p>`)}`;
    const card = hero.querySelector('.hr-shake');
    card._bar = hero.querySelector('.hr-dev i');
    const start = shakeable(card, 22000);
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.disconnect(); start(); } }), { threshold: .3 });
    io.observe(card);
  }

  // ---------- О: ЛАПКА ХОРО ----------
  // Полароид как в З, но без надписи: снизу выглядывает волчья лапка и трясёт его сама —
  // несколько раз с разной силой, потом уходит и время от времени возвращается позвать.
  if (V === 'o') {
    const PAW = `<svg viewBox="0 0 120 300" aria-hidden="true">
        <defs><linearGradient id="hr-fur" gradientUnits="userSpaceOnUse" x1="0" y1="10" x2="0" y2="300">
          <stop offset="0" stop-color="#dba06a"/><stop offset=".3" stop-color="#bd7c43"/><stop offset="1" stop-color="#7a4620"/></linearGradient></defs>
        <g fill="url(#hr-fur)">
          <path d="M21 92 C17 150 23 230 19 300 L101 300 C97 230 103 150 99 92 Z"/>
          <path d="M21 128 l-8 7 l9 3 Z M19 176 l-9 7 l10 3 Z M99 140 l9 6 l-9 4 Z M102 196 l9 6 l-10 3 Z"/>
          <ellipse cx="60" cy="80" rx="47" ry="38"/>
          <ellipse cx="21" cy="57" rx="14" ry="17" transform="rotate(-22 21 57)"/>
          <ellipse cx="45" cy="37" rx="15" ry="18" transform="rotate(-7 45 37)"/>
          <ellipse cx="75" cy="37" rx="15" ry="18" transform="rotate(7 75 37)"/>
          <ellipse cx="99" cy="57" rx="14" ry="17" transform="rotate(22 99 57)"/>
        </g>
        <g fill="#fff" fill-opacity=".22">
          <ellipse cx="19" cy="47" rx="6" ry="4" transform="rotate(-22 19 47)"/><ellipse cx="44" cy="25" rx="7" ry="4"/>
          <ellipse cx="76" cy="25" rx="7" ry="4"/><ellipse cx="101" cy="47" rx="6" ry="4" transform="rotate(22 101 47)"/>
        </g>
        <g fill="none" stroke="#4a2810" stroke-opacity=".55" stroke-width="2.4" stroke-linecap="round">
          <path d="M33 54 C35 62 37 68 37 74"/><path d="M60 42 C60 52 60 60 60 68"/><path d="M87 54 C85 62 83 68 83 74"/>
        </g>
        <path d="M24 116 q8 -6 14 1 q8 -6 15 0 q8 -6 15 0 q8 -6 15 0 q7 -5 14 -2" fill="none" stroke="#e8b47c" stroke-opacity=".45" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
    hero.innerHTML = `
      <div class="hr-shake-zone hr-paw-zone">
        <figure class="hr-polaroid hr-shake" aria-label="Полароид — потяни и встряхни, чтобы проявить">
          <span class="hr-tape" aria-hidden="true"></span>
          <span class="hr-shake-img"><img src="${src}" alt="${alt}" draggable="false"></span>
          <figcaption><span class="hr-cap-b">это я, ${year}</span></figcaption>
        </figure>
        <div class="hr-dev" aria-hidden="true"><i></i></div>
        <span class="hr-paw">${PAW}</span>
      </div>
      <div class="hr-text"><h1 class="hr-title">${title}</h1>
        <div class="hr-bio">${BIO.map(t => `<p>${t}</p>`).join('')}</div><p class="hr-sign">— ${name}</p></div>`;
    const zone = hero.querySelector('.hr-paw-zone'), card = hero.querySelector('.hr-shake'), paw = hero.querySelector('.hr-paw');
    card._bar = hero.querySelector('.hr-dev i');
    const start = shakeable(card, 22000);

    // Состояние сцены: сдвиг и поворот полароида, насколько лапка спрятана вниз (hide 0…1), её наклон и «сжатие»
    const S = { sx: 0, sy: 0, th: 0, hide: 1, tilt: 0, squash: 1 };
    let run = 0, pawDev = 0, userTouched = false, visible = false, timer = null, patted = false, started = false;
    const render = () => {
      const w = card.offsetWidth, h = card.offsetHeight, pw = w * 0.21, ph = pw * 2.5;
      const phi = (-3 + S.th) * Math.PI / 180;                     // полароид и так наклонён на -3°
      const gx = w * 0.24, gy = h / 2 - Math.max(22, h * 0.05);    // где лапка держит: нижняя белая полоса справа
      const cx = card.offsetLeft + w / 2 + S.sx, cy = card.offsetTop + h / 2 + S.sy;
      const px = cx + gx * Math.cos(phi) - gy * Math.sin(phi), py = cy + gx * Math.sin(phi) + gy * Math.cos(phi);
      const top = py - ph * 0.2, hidden = zone.offsetHeight - top + 8; // насколько опустить, чтобы скрылась целиком
      paw.style.width = pw + 'px';
      paw.style.transform = `translate(${px - pw / 2}px, ${top + hidden * S.hide}px) rotate(${S.tilt + S.th * 0.5 - 3}deg) scaleY(${S.squash})`;
      card.style.setProperty('--dx', S.sx + 'px'); card.style.setProperty('--dy', S.sy + 'px'); card.style.setProperty('--dr', S.th + 'deg');
    };
    const ease = { out: k => 1 - Math.pow(1 - k, 3), in: k => k * k * k, inOut: k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2,
      back: k => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2) };
    // Твин: fn(k) на каждом кадре; если сценку прервали (run сменился) — сразу выходим
    const tween = (id, ms, fn, e = ease.inOut) => new Promise(res => {
      const t0 = performance.now();
      const step = now => { if (id !== run) return res(false); const k = Math.min(1, (now - t0) / ms); fn(e(k)); render(); k < 1 ? requestAnimationFrame(step) : res(true); };
      requestAnimationFrame(step);
    });
    const wait = (id, ms) => tween(id, ms, () => {});
    const to = (id, ms, key, v, e) => { const a = S[key]; return tween(id, ms, k => { S[key] = a + (v - a) * k; }, e); };

    const enter = id => to(id, 520, 'hide', 0, ease.back);
    const leave = id => to(id, 420, 'hide', 1, ease.in);
    const grip = id => tween(id, 200, k => { S.squash = 1 - Math.sin(k * Math.PI) * 0.08; });
    // Встряхнуть: n качаний, сила amp (0…1), частота hz. Полароид раскачивается за лапкой с запаздыванием.
    const shake = async (id, n, amp, hz) => {
      const ok = await tween(id, n / hz * 1000, k => {
        const t = k * n / hz, env = Math.pow(Math.sin(Math.PI * k), 0.6);
        S.sx = Math.sin(2 * Math.PI * hz * t) * 16 * amp * env;
        S.sy = Math.abs(Math.sin(2 * Math.PI * hz * t)) * -4 * amp * env;
        S.th = Math.sin(2 * Math.PI * hz * t - 0.9) * 7 * amp * env;
      }, k => k);
      S.sx = S.sy = S.th = 0;
      if (ok && pawDev < 0.5) { const k = Math.min(0.5 - pawDev, amp * 0.09); pawDev += k; card._nudge(k); }  // лапка проявляет, но не до конца
      return ok;
    };
    const tap = async (id, times) => {                    // тык-тык снизу: полароид подпрыгивает
      for (let i = 0; i < times; i++) {
        if (!await tween(id, 120, k => { S.tilt = -6 * k; S.sy = -7 * k; }, ease.out)) return false;
        if (!await tween(id, 200, k => { S.tilt = -6 * (1 - k); S.sy = -7 * (1 - k); }, ease.back)) return false;
      }
      return true;
    };
    const wiggle = async id => {                          // выглянула и помахала пальчиками
      for (const a of [9, -9, 7, 0]) if (!await to(id, 170, 'tilt', a)) return false;
      return true;
    };

    // Сценки. Каждая сама прячет лапку в конце.
    const SCENES = {
      intro: async id => {
        await enter(id) && await grip(id) && await shake(id, 3, .55, 4.5) && await wait(id, 260)
          && await shake(id, 6, 1, 7) && await wait(id, 420) && await shake(id, 2, .3, 3.5) && await wait(id, 200);
        if (id === run) await leave(id);
      },
      shake: async id => { await enter(id) && await grip(id) && await shake(id, 2 + Math.round(Math.random() * 3), .4 + Math.random() * .5, 5 + Math.random() * 3); if (id === run) await leave(id); },
      double: async id => { await enter(id) && await grip(id) && await shake(id, 2, .5, 6) && await wait(id, 300) && await shake(id, 2, .5, 6); if (id === run) await leave(id); },
      tap: async id => { await enter(id) && await wait(id, 150) && await tap(id, 2); if (id === run) await leave(id); },
      peek: async id => { await to(id, 600, 'hide', .55, ease.out) && await wiggle(id) && await wait(id, 300); if (id === run) await to(id, 500, 'hide', 1); },
      pat: async id => {                                  // проявилось — довольно похлопала и ушла
        await enter(id) && await wait(id, 200) && await tap(id, 3) && await wait(id, 250);
        if (id === run) await leave(id);
      },
    };
    const play = async name => {
      const id = ++run;
      zone.classList.add('is-paw'); card.classList.add('is-pawed');
      await SCENES[name](id);
      if (id !== run) return;
      card.classList.remove('is-pawed'); zone.classList.remove('is-paw');
      schedule();
    };
    // Пока снимок не проявлен и его не трогают — лапка иногда возвращается позвать (случайно, 5–11 с)
    const schedule = (min = 5000, spread = 6000) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!visible || card.classList.contains('is-drag')) return schedule(2000, 2000);
        if (card.classList.contains('is-done')) { if (!patted) { patted = true; play('pat'); } return; }
        const pool = userTouched ? ['tap', 'peek', 'shake'] : ['shake', 'shake', 'double', 'tap', 'peek'];
        play(pool[Math.floor(Math.random() * pool.length)]);
      }, min + Math.random() * spread);
    };
    // Схватили сами — лапка мгновенно прячется и ждёт подольше
    card.addEventListener('pointerdown', () => {
      run++; userTouched = true;
      Object.assign(S, { sx: 0, sy: 0, th: 0, tilt: 0, squash: 1, hide: 1 });
      render();
      card.classList.remove('is-pawed'); zone.classList.remove('is-paw');
      ['--dx', '--dy', '--dr'].forEach(p => card.style.removeProperty(p));
      schedule(8000, 6000);
    });
    addEventListener('resize', () => { if (zone.classList.contains('is-paw')) render(); });
    if (reduced) paw.hidden = true;
    const io = new IntersectionObserver(es => es.forEach(e => {
      visible = e.isIntersecting;
      if (visible && !started) { started = true; start(); if (!reduced) setTimeout(() => play('intro'), 700); }
    }), { threshold: .35 });
    io.observe(card);
  }

  // ---------- И: ДИАФРАГМА ----------
  if (V === 'i') {
    const STOPS = ['16', '11', '8', '5.6', '4', '2.8', '2', '1.8'];
    hero.innerHTML = `
      <figure class="hr-iris">
        <img src="${src}" alt="${alt}">
        <svg class="hr-blades" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path class="hr-blade-fill" fill-rule="evenodd" d=""/><path class="hr-blade-edges" d=""/></svg>
        <div class="hr-fnum" aria-hidden="true">f/<b>16</b></div>
      </figure>${textCol(`
      <div class="hr-ring">
        <label for="hr-ap">Диафрагма — покрути</label>
        <input id="hr-ap" type="range" min="0" max="${STOPS.length - 1}" step="0.01" value="0">
        <div class="hr-ring-stops" aria-hidden="true">${STOPS.map(s => `<span>f/${s}</span>`).join('')}</div>
      </div>`)}`;
    const fig = hero.querySelector('.hr-iris');
    const fill = hero.querySelector('.hr-blade-fill'), edges = hero.querySelector('.hr-blade-edges');
    const fnum = hero.querySelector('.hr-fnum b'), ring = hero.querySelector('#hr-ap');
    let user = false;
    // Отверстие — восьмиугольник радиуса r, повёрнутый на угол; от вершин по касательной — края лепестков
    const draw = p => {   // p: 0 — закрыта (f/16), 1 — открыта (f/1.8)
      const r = 6 + p * 70, rot = (1 - p) * 40 * Math.PI / 180;
      const pts = Array.from({ length: 8 }, (_, i) => { const t = rot + i * Math.PI / 4; return [50 + r * Math.cos(t), 50 + r * Math.sin(t)]; });
      fill.setAttribute('d', `M-20 -20H120V120H-20Z M${pts.map(q => q.join(' ')).join(' L')}Z`);
      edges.setAttribute('d', pts.map(([x, y], i) => { const t = rot + i * Math.PI / 4 + Math.PI / 2 - 0.35; return `M${x} ${y}L${x + 140 * Math.cos(t)} ${y + 140 * Math.sin(t)}`; }).join(''));
      fig.style.setProperty('--open', p.toFixed(3));
      fnum.textContent = STOPS[Math.round(p * (STOPS.length - 1))];
    };
    ring.addEventListener('input', () => { user = true; draw(ring.value / (STOPS.length - 1)); });
    fig.addEventListener('wheel', e => { e.preventDefault(); user = true; ring.value = Math.max(0, Math.min(STOPS.length - 1, +ring.value - e.deltaY / 300)); draw(ring.value / (STOPS.length - 1)); }, { passive: false });
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; io.disconnect();
      const t0 = performance.now();
      const anim = now => { if (user) return; const k = Math.min(1, (now - t0) / 1800); const p = 1 - Math.pow(1 - k, 3); ring.value = p * (STOPS.length - 1) * 0.86; draw(p * 0.86); if (k < 1) requestAnimationFrame(anim); };
      requestAnimationFrame(reduced ? () => { ring.value = (STOPS.length - 1) * .86; draw(.86); } : anim);
    }), { threshold: .4 });
    draw(0); io.observe(fig);
  }

  // ---------- К: ПРОЯВИТЕЛЬ КИСТЬЮ ----------
  if (V === 'k') {
    hero.innerHTML = `
      <figure class="hr-brush">
        <img src="${src}" alt="${alt}">
        <canvas class="hr-emulsion" aria-hidden="true"></canvas>
        <figcaption class="hr-hint">Проведи по фото — проявишь его, как в кювете</figcaption>
      </figure>${textCol()}`;
    const fig = hero.querySelector('.hr-brush'), cv = hero.querySelector('.hr-emulsion'), hint = hero.querySelector('.hr-hint');
    const ctx = cv.getContext('2d');
    let w = 0, h = 0, moves = 0, done = false, lastP = null;
    const r0 = fig.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    w = cv.width = Math.round(r0.width * dpr); h = cv.height = Math.round(r0.height * dpr);
    const g0 = ctx.createLinearGradient(0, 0, w, h); g0.addColorStop(0, '#3a2a1c'); g0.addColorStop(1, '#1d1610');
    ctx.fillStyle = g0; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < w * h / 90; i++) { ctx.fillStyle = `rgba(255,${200 + Math.random() * 55 | 0},170,${Math.random() * .06})`; ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    ctx.fillStyle = 'rgba(255,60,30,.10)'; ctx.fillRect(0, 0, w, h);   // красный свет лаборатории
    const check = () => {
      const d = ctx.getImageData(0, 0, w, h).data; let clear = 0, n = 0;
      for (let y = 0; y < h; y += 12) for (let x = 0; x < w; x += 12) { n++; if (d[(y * w + x) * 4 + 3] < 60) clear++; }
      if (clear / n > .5 && !done) { done = true; fig.classList.add('is-done'); hint.textContent = 'Проявлено. Можно сушить.'; }
    };
    const brush = (x, y) => {
      const R = 70 * (w / fig.getBoundingClientRect().width);
      ctx.globalCompositeOperation = 'destination-out';
      const steps = lastP ? Math.max(1, Math.hypot(x - lastP[0], y - lastP[1]) / (R / 3)) : 1;
      for (let s = 1; s <= steps; s++) {
        const px = lastP ? lastP[0] + (x - lastP[0]) * s / steps : x, py = lastP ? lastP[1] + (y - lastP[1]) * s / steps : y;
        const g = ctx.createRadialGradient(px, py, 0, px, py, R);
        g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, R, 0, Math.PI * 2); ctx.fill();
      }
      lastP = [x, y];
      if (++moves % 25 === 0) check();
    };
    const at = e => { const r = cv.getBoundingClientRect(), k = w / r.width; return [(e.clientX - r.left) * k, (e.clientY - r.top) * k]; };
    cv.addEventListener('pointermove', e => { if (done) return; if (e.pointerType === 'mouse' || e.buttons) brush(...at(e)); });
    cv.addEventListener('pointerdown', e => { lastP = null; brush(...at(e)); });
    cv.addEventListener('pointerleave', () => { lastP = null; });
    cv.addEventListener('pointerup', () => { lastP = null; });
    if (reduced) { fig.classList.add('is-done'); done = true; }
  }

  // ---------- Л: ВЗВОД ЗАТВОРА ----------
  if (V === 'l') {
    const FR = [{ pos: '55% 50%', z: 1 }, { pos: '62% 30%', z: 1.6 }, { pos: '57% 20%', z: 2.6 }, { pos: '45% 60%', z: 1.25 }];
    hero.innerHTML = `
      <figure class="hr-cam">
        <div class="hr-cam-frame"><img src="${src}" alt="${alt}"><span class="hr-curtain" aria-hidden="true"></span>
          <span class="hr-cam-count" aria-hidden="true">1</span></div>
        <div class="hr-cam-ctrl">
          <span class="hr-cam-dial" aria-hidden="true">${FR.map((_, i) => `<i data-i="${i}">${i + 1}</i>`).join('')}</span>
          <button type="button" class="hr-shutter" aria-label="Спуск затвора — следующий кадр"><span></span></button>
        </div>
      </figure>
      <div class="hr-text"><h1 class="hr-title">${title}</h1>
        <div class="hr-story-text" aria-live="polite"><p></p></div>
        <p class="hr-next-hint">Жми на спуск — расскажу дальше</p>${cta}</div>`;
    const img = hero.querySelector('.hr-cam-frame img'), p = hero.querySelector('.hr-story-text p');
    const cnt = hero.querySelector('.hr-cam-count'), dial = hero.querySelectorAll('.hr-cam-dial i'), frame = hero.querySelector('.hr-cam-frame');
    let i = 0;
    const show = (k, anim) => {
      i = k;
      const f = FR[i];
      const apply = () => {
        img.style.objectPosition = f.pos; img.style.transformOrigin = f.pos; img.style.transform = `scale(${f.z})`;
        p.textContent = BIO[i]; cnt.textContent = i + 1;
        dial.forEach(d => d.classList.toggle('is-on', +d.dataset.i === i));
        hero.classList.toggle('is-last', i === FR.length - 1);
      };
      if (!anim || reduced) return apply();
      frame.classList.remove('is-firing'); void frame.offsetWidth; frame.classList.add('is-firing');
      setTimeout(apply, 140);
    };
    hero.querySelector('.hr-shutter').addEventListener('click', () => show((i + 1) % FR.length, true));
    frame.addEventListener('click', () => show((i + 1) % FR.length, true));
    show(0);
  }

  // ---------- М: РИСУЙ СВЕТОМ ----------
  if (V === 'm') {
    hero.innerHTML = `
      <figure class="hr-light">
        <img class="hr-dark" src="${src}" alt="" aria-hidden="true">
        <img class="hr-lit" src="${src}" alt="${alt}">
        <span class="hr-glow" aria-hidden="true"></span>
        <figcaption class="hr-hint">Фотография — это рисование светом. Посвети на меня.</figcaption>
      </figure>${textCol()}`;
    const fig = hero.querySelector('.hr-light');
    let lx = 57, ly = 22, tx = 57, ty = 22, user = false, t0 = performance.now(), raf = null;
    const set = () => { fig.style.setProperty('--lx', lx + '%'); fig.style.setProperty('--ly', ly + '%'); };
    const loop = now => {
      if (!user) { const t = (now - t0) / 1000; tx = 57 + Math.cos(t * .7) * 22; ty = 30 + Math.sin(t * .9) * 16; }
      lx += (tx - lx) * .12; ly += (ty - ly) * .12; set();
      raf = requestAnimationFrame(loop);
    };
    const pos = e => { const r = fig.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width * 100; ty = (e.clientY - r.top) / r.height * 100; };
    fig.addEventListener('pointermove', e => { user = true; pos(e); });
    fig.addEventListener('pointerdown', e => { user = true; pos(e); });
    fig.addEventListener('pointerleave', () => { user = false; t0 = performance.now(); });
    set();
    if (!reduced) {
      const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { if (!raf) raf = requestAnimationFrame(loop); } else { cancelAnimationFrame(raf); raf = null; } }));
      io.observe(fig);
    }
  }

  // ---------- Н: ВИДОИСКАТЕЛЬ → СНИМОК → ПОЛАРОИД ----------
  if (V === 'n') {
    hero.innerHTML = `<div class="hr-vfwrap">${vfHtml('Наведи фокус и нажми — получишь снимок')}
        <div class="hr-prints" aria-live="polite"></div></div>${textCol()}`;
    const prints = hero.querySelector('.hr-prints'), hint = hero.querySelector('.hr-hint');
    // Три места на «столе», чтобы снимки ложились веером
    const SPOTS = [{ x: '58%', y: '58%', r: '-7deg' }, { x: '30%', y: '66%', r: '5deg' }, { x: '64%', y: '76%', r: '-2deg' }];
    viewfinder((x, y, n) => {
      hint.textContent = 'Снимок готов — встряхни его, чтобы проявить';
      setTimeout(() => {
        // на снимке — то, на что навели фокус: кадр крупнее, вокруг точки фокуса
        const card = document.createElement('figure');
        const spot = SPOTS[(n - 1) % SPOTS.length];
        card.className = 'hr-polaroid hr-print';
        card.style.setProperty('--px', spot.x); card.style.setProperty('--py', spot.y); card.style.setProperty('--pr', spot.r);
        card.innerHTML = `<span class="hr-shake-img"><img src="${src}" alt="Снимок ${n}" draggable="false"
            style="object-position:${x}% ${y}%;transform-origin:${x}% ${y}%;transform:scale(1.7)"></span>
          <figcaption><span class="hr-cap-a">встряхни меня</span><span class="hr-cap-b">кадр ${String(n).padStart(2, '0')}</span></figcaption>`;
        prints.appendChild(card);
        [...prints.children].slice(0, -3).forEach(old => old.remove());   // на столе не больше трёх
        requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('is-out')));
        const start = shakeable(card, 14000, () => { if (prints.lastElementChild !== card) prints.appendChild(card); });   // взятый — наверх
        setTimeout(start, 700);
      }, 260);
    });
  }
})();
