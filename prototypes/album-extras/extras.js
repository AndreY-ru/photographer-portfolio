// ПРОТОТИП: срок до удаления альбома (галерея + обложка) и счётчики лайков в альбоме.
// Варианты берутся из адреса: ?v=x&exp=a|b|c&like=a|b|c (v=x — просто чтобы тестовый сайт подключил этот файл).
// Данные выдуманные: сколько дней осталось — по названию альбома, сколько лайков — по номеру фото.
(function () {
  const q = new URLSearchParams(location.search);
  const EXP = q.get('exp') || 'a', LIKE = q.get('like') || 'a';
  document.body.classList.add('ex-exp-' + EXP, 'ex-like-' + LIKE);

  const DAYS = { 'Косплей Мику': 5, 'Закат на пирсе': 1, 'У фонтана': 0, miku: 5, zakat: 1, fontan: 0 };
  const TOTAL = 30;   // на сколько дней альбом выкладывали — для полоски в варианте В
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };
  const dateIn = d => { const t = new Date(); t.setDate(t.getDate() + d); return t.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); };
  const CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  const level = d => d <= 0 ? 'is-last' : d <= 3 ? 'is-soon' : '';

  // Текст про срок: «Ещё 5 дней», «Остался 1 день», «Последний день»
  const words = d => d <= 0 ? 'Последний день' : d === 1 ? 'Остался 1 день' : `Ещё ${d} ${plural(d, 'день', 'дня', 'дней')}`;

  function expiryBadge(d, where) {
    const el = document.createElement('div');
    el.className = `ex-exp ex-exp--${where} ${level(d)}`;
    el.setAttribute('title', d <= 0 ? 'Альбом удалится сегодня в полночь' : `Альбом удалится ${dateIn(d + 1)}`);
    if (EXP === 'a') el.innerHTML = `${CLOCK}<span>${words(d)}</span>`;
    if (EXP === 'b') el.innerHTML = `<b>●</b><span class="ex-num">${d <= 0 ? '00' : String(d).padStart(2, '0')}</span><span>${d <= 0 ? 'последний день' : plural(d, 'день', 'дня', 'дней') + ' до удаления'}</span>`;
    if (EXP === 'c') {
      el.innerHTML = `<span class="ex-cap">${d <= 0 ? 'Удалится сегодня в полночь' : `Удалится ${dateIn(d + 1)} · ${words(d).toLowerCase()}`}</span><span class="ex-bar"><i style="width:${Math.max(3, Math.min(100, (d + 1) / TOTAL * 100))}%"></i></span>`;
    }
    return el;
  }

  // Галерея: на карточку
  document.querySelectorAll('.gallery-card').forEach(card => {
    const t = (card.querySelector('.card-title') || {}).textContent;
    if (t in DAYS) card.appendChild(expiryBadge(DAYS[t], 'card'));
  });
  // Обложка альбома
  const hero = document.querySelector('.album-hero');
  const slug = location.pathname.split('/')[2];
  if (hero && slug in DAYS) {
    const b = expiryBadge(DAYS[slug], 'hero');
    const date = hero.querySelector('.album-hero__date');
    if (EXP === 'c') hero.appendChild(b); else (date || hero.querySelector('.album-hero__title')).after(b);
  }

  // ---------- Лайки других людей ----------
  const COUNTS = [3, 0, 1, 0, 5, 2, 0, 0, 1, 4, 0, 2, 0, 1, 0, 0, 6, 1];
  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 00-7.7 0l-1.1 1-1.1-1a5.5 5.5 0 00-7.8 7.8l1 1 7.9 8 7.8-7.9 1-1a5.5 5.5 0 000-7.8z"/></svg>';
  document.querySelectorAll('.photo-card').forEach((card, i) => {
    const btn = card.querySelector('.like-btn');
    if (!btn) return;
    let others = COUNTS[i % COUNTS.length];
    const total = () => others + (btn.classList.contains('is-liked') ? 1 : 0);
    let badge, inline;
    if (LIKE === 'a') {                       // цифра рядом с сердечком + метка в углу, видна всегда
      inline = document.createElement('span'); inline.className = 'ex-like-num';
      btn.appendChild(inline);
      badge = document.createElement('span'); badge.className = 'ex-like-chip';
      card.appendChild(badge);
    }
    if (LIKE === 'b') { badge = document.createElement('span'); badge.className = 'ex-like-heart'; card.appendChild(badge); }
    if (LIKE === 'c') { badge = document.createElement('span'); badge.className = 'ex-like-mark'; card.appendChild(badge); }
    const paint = () => {
      const n = total(), mine = btn.classList.contains('is-liked');
      card.classList.toggle('ex-has-likes', n > 0);
      if (inline) inline.textContent = n || '';
      if (LIKE === 'a') badge.innerHTML = n ? `${HEART}<span>${n}</span>` : '';
      if (LIKE === 'b') badge.innerHTML = n ? `${HEART}<span>${n}</span>` : '';
      if (LIKE === 'c') badge.innerHTML = n ? `<svg class="ex-ring" viewBox="0 0 60 44" aria-hidden="true"><path d="M8 24c0-12 14-18 26-17s20 8 18 17-12 14-24 13S6 33 9 21"/></svg><span>${n}</span>` : '';
      if (badge) { badge.title = mine && n === 1 ? 'Вы отметили' : (mine ? `Вы и ещё ${n - 1}` : `Отметили: ${n}`); badge.classList.toggle('is-mine', mine); }
    };
    // В прототипе лайк не уходит на сервер — просто переключаем вид
    btn.addEventListener('click', e => {
      e.stopImmediatePropagation(); e.preventDefault();
      btn.classList.toggle('is-liked'); btn.setAttribute('aria-pressed', String(btn.classList.contains('is-liked')));
      paint();
    }, true);
    paint();
  });
})();
