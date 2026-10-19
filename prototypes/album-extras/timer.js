// ПРОТОТИП: новые виды «сколько осталось до удаления» поверх настоящего .expiry-rec.
// ?v=tm&t=a..e. Дни и дата берутся из того, что сайт уже вывел (число и подсказка
// «до ДД.ММ.ГГГГ включительно»); удаление — в полночь после этой даты.
(function () {
  const T = new URLSearchParams(location.search).get('t') || 'a';
  document.body.classList.add('tm-' + T);
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };
  const pad = n => String(n).padStart(2, '0');
  const timers = [];

  document.querySelectorAll('.expiry-rec').forEach(el => {
    const days = parseInt((el.querySelector('.expiry-rec__num') || {}).textContent, 10) || 0;
    const m = (el.title || '').match(/(\d\d)\.(\d\d)\.(\d{4})/);
    const deadline = m ? new Date(+m[3], +m[2] - 1, +m[1] + 1, 0, 0, 0) : new Date(Date.now() + (days + 1) * 864e5);
    const soon = days <= 3, last = days === 0;
    const box = document.createElement('div');
    box.className = `tm tm--${el.closest('.gallery-card') ? 'card' : 'hero'}${soon ? ' is-soon' : ''}${last ? ' is-last' : ''}`;
    box.title = el.title;
    // скорость мигания: чем меньше осталось, тем чаще (как лампа самоспуска перед кадром)
    box.style.setProperty('--blink', `${Math.max(0.35, Math.min(2.4, 0.35 + days * 0.3))}s`);

    if (T === 'a') box.innerHTML = `<b class="tm-dot"></b><span class="tm-rec">REC</span><span class="tm-num">${pad(days)}</span><span>${last ? 'последний день' : plural(days, 'день', 'дня', 'дней') + ' до удаления'}</span>`;
    if (T === 'b') {
      box.innerHTML = `<b class="tm-dot"></b><span class="tm-rec">REC</span><span class="tm-tc">−00:00:00:00</span><span class="tm-cap">до удаления</span>`;
      const tc = box.querySelector('.tm-tc');
      timers.push(() => {
        let s = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
        const d = Math.floor(s / 86400); s %= 86400;
        tc.textContent = `−${pad(d)}:${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
      });
    }
    if (T === 'c') {
      const cells = 5, full = last ? 0 : Math.max(1, Math.min(cells, Math.ceil(days / 2)));
      box.innerHTML = `<span class="tm-bat">${Array.from({ length: cells }, (_, i) => `<i class="${i < full ? 'on' : ''}"></i>`).join('')}</span><span class="tm-num">${last ? '0' : days}</span><span>${last ? 'последний день' : plural(days, 'день', 'дня', 'дней')}</span>`;
    }
    if (T === 'd') box.innerHTML = `<span class="tm-self"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg><b class="tm-dot"></b></span><span>Самоспуск</span><span class="tm-num">${last ? 'сегодня' : days + ' ' + plural(days, 'день', 'дня', 'дней')}</span>`;
    if (T === 'e') box.innerHTML = `<span class="tm-counter"><span>${last ? '0' : days}</span></span><span class="tm-cap2">${last ? 'последний<br>день' : plural(days, 'день', 'дня', 'дней') + '<br>до удаления'}</span>`;
    // --- минималистичные: без иконок и мигания, цвет только в последние дни ---
    const shortDate = deadline => { const d = new Date(deadline - 864e5); return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); };
    if (T === 'f') box.innerHTML = `<span>${last ? 'Последний день' : days === 1 ? 'Ещё 1 день' : `Ещё ${days} ${plural(days, 'день', 'дня', 'дней')}`}</span>`;
    if (T === 'g') box.innerHTML = `<span>${last ? 'Доступен до конца дня' : `Доступен до ${shortDate(deadline)}`}</span>`;
    if (T === 'h') box.innerHTML = last ? `<i class="tm-pin"></i><span>последний день</span>` : `<i class="tm-pin"></i><span class="tm-num">${days}</span><span>${plural(days, 'день', 'дня', 'дней')}</span>`;
    if (T === 'i') box.innerHTML = `<span>${last ? 'Сегодня последний день' : `${days} ${plural(days, 'день', 'дня', 'дней')}`}</span><span class="tm-line"><i style="width:${Math.max(4, Math.min(100, (days + 1) / 30 * 100))}%"></i></span>`;
    const dd = deadline => { const d = new Date(deadline - 864e5); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`; };
    const short = last ? 'последний день' : `ещё ${days} ${plural(days, 'день', 'дня', 'дней')}`;
    if (T === 'j') box.innerHTML = `<span>до ${dd(deadline)}</span>`;
    if (T === 'k') box.innerHTML = `<span class="tm-br">${last ? 'сегодня' : days + ' дн'}</span>`;
    if (T === 'l') box.innerHTML = `<span>${last ? 'Последний день' : days + ' ' + plural(days, 'день', 'дня', 'дней')}</span>`;
    // М — в строке с годом под названием (на обложке — в строке с датой съёмки)
    if (T === 'm') {
      const sub = el.closest('.gallery-card')?.querySelector('.card-subtext') || document.querySelector('.album-hero__date');
      if (sub) {
        const s = document.createElement('span');
        s.className = 'tm-inline' + (soon ? ' is-soon' : '');
        s.textContent = ` · ${short}`;
        s.title = el.title;
        sub.appendChild(s);
        el.remove();
        return;
      }
    }
    // Н — только при наведении на карточку (на обложке — всегда, спокойно)
    if (T === 'n') box.innerHTML = `<span>${last ? 'Последний день' : `Ещё ${days} ${plural(days, 'день', 'дня', 'дней')}`}</span>`;
    el.replaceWith(box);
  });
  if (timers.length) { const tick = () => timers.forEach(f => f()); tick(); setInterval(tick, 1000); }
})();
