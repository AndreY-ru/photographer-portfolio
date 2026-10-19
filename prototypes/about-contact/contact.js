// ПРОТОТИП блока «Готовы создавать?» на «Обо мне».
// window.CT_V: a — список, b — рамка фокуса, c — большая почта, d — меню камеры.
// Данные берём со страницы: соцсети — из окна «Связаться» (там есть иконки), телефон — из старого блока.
// Почта на тестовом сайте выдуманная — на настоящем возьмётся из профиля в админке.
(function () {
  const V = window.CT_V || 'a';
  const sec = document.querySelector('#contact');
  if (!sec) return;
  const EMAIL = 'photo@andreygrugoriev.ru';
  const phoneA = sec.querySelector('.contact-phone a');
  const phone = phoneA ? { href: phoneA.getAttribute('href'), text: phoneA.textContent.trim() } : null;
  const handle = href => { try { const u = new URL(href); return (u.hostname.replace(/^www\./, '') + u.pathname).replace(/\/$/, ''); } catch (e) { return href; } };
  const socials = [...document.querySelectorAll('.contact-modal__item[target=_blank]')].map(a => ({
    href: a.getAttribute('href'),
    name: a.querySelector('.contact-modal__name').textContent.trim(),
    icon: a.querySelector('.contact-modal__icon-glyph').style.getPropertyValue('--icon-url'),
    value: (() => { const h = handle(a.getAttribute('href')); return h.startsWith('t.me/') ? '@' + h.slice(5) : h; })(),
  }));
  const PHONE_ICON = "url('/static/icons/phone.svg')";
  const MAIL_SVG = '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>';
  const ARROW = '<svg class="ct-arrow" viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8"/></svg>';
  const ico = c => c.icon ? `<span class="ct-ico" style="--icon-url: ${c.icon}"></span>` : `<span class="ct-ico ct-ico--svg">${MAIL_SVG}</span>`;

  // Все каналы одним списком. kind: link — открыть, copy — на ПК копирует (телефон и почта)
  const CH = [
    ...socials.map(s => ({ ...s, kind: 'link', hint: 'Написать' })),
    ...(phone ? [{ name: 'Телефон', value: phone.text, href: phone.href, icon: PHONE_ICON, kind: 'copy', copy: phone.text, done: 'Номер скопирован', hint: 'Позвонить' }] : []),
    { name: 'Почта', value: EMAIL, href: 'mailto:' + EMAIL, icon: null, kind: 'copy', copy: EMAIL, done: 'Почта скопирована', hint: 'Написать письмо' },
  ];
  const attrs = c => c.kind === 'link' ? `href="${c.href}" target="_blank" rel="noopener"` : `href="${c.href}" data-ct-copy="${c.copy}" data-ct-done="${c.done}"`;
  const title = 'Готовы <em>создавать?</em>';
  const desc = 'Свяжитесь со мной для бронирования даты или обсуждения вашей идеи.';

  sec.classList.add('ct', 'ct-' + V);

  // ---------- А: СПИСОК ----------
  if (V === 'a') {
    sec.innerHTML = `
      <div class="ct-head">
        <p class="ct-kicker"><i></i>Открыт для съёмок</p>
        <h2 class="ct-title">${title}</h2>
        <p class="ct-desc">${desc}</p>
      </div>
      <div class="ct-list">${CH.map(c => `
        <a class="ct-row" ${attrs(c)}>${ico(c)}
          <span class="ct-name">${c.name}</span>
          <span class="ct-val" data-ct-label>${c.value}</span>${ARROW}
        </a>`).join('')}
      </div>`;
  }

  // ---------- Б: РАМКА ФОКУСА ----------
  if (V === 'b') {
    sec.innerHTML = `
      <div class="ct-frame">
        <span class="ct-hud"><b>●</b> REC</span><span class="ct-hud ct-hud--r">[ ${String(CH.length).padStart(2, '0')} ]</span>
        <h2 class="ct-title">${title}</h2>
        <p class="ct-desc">${desc}</p>
        <div class="ct-tiles">${CH.map(c => `
          <a class="ct-tile" ${attrs(c)}>${ico(c)}
            <span class="ct-name">${c.name}</span>
            <span class="ct-val" data-ct-label>${c.value}</span>
          </a>`).join('')}
        </div>
      </div>`;
  }

  // ---------- В: БОЛЬШАЯ ПОЧТА ----------
  if (V === 'c') {
    const mail = CH[CH.length - 1], rest = CH.slice(0, -1);
    sec.innerHTML = `
      <p class="ct-kicker">Готовы создавать?</p>
      <a class="ct-mail" ${attrs(mail)}><span data-ct-label>${EMAIL}</span></a>
      <p class="ct-desc">${desc} Нажмите на почту — она скопируется.</p>
      <div class="ct-pills">${rest.map(c => `
        <a class="ct-pill" ${attrs(c)}>${ico(c)}<span data-ct-label>${c.kind === 'copy' ? c.value : c.name}</span></a>`).join('')}
      </div>`;
  }

  // ---------- Г: МЕНЮ КАМЕРЫ ----------
  if (V === 'd') {
    sec.innerHTML = `
      <div class="ct-head">
        <h2 class="ct-title">${title}</h2>
        <p class="ct-desc">${desc}</p>
      </div>
      <div class="ct-lcd">
        <div class="ct-lcd-tabs" aria-hidden="true"><span class="is-on">СВЯЗЬ</span><span>1</span><span>2</span><span>3</span><span class="ct-lcd-bat">▮▮▮▯</span></div>
        <div class="ct-lcd-list">${CH.map((c, i) => `
          <a class="ct-lcd-row${i === 0 ? ' is-sel' : ''}" ${attrs(c)}>${ico(c)}
            <span class="ct-name">${c.name}</span>
            <span class="ct-val" data-ct-label>${c.value}</span>
          </a>`).join('')}
        </div>
        <div class="ct-lcd-foot" aria-hidden="true"><span>▲▼ выбрать</span><span>● открыть</span></div>
      </div>`;
    // Наведение/фокус двигают подсветку, как в меню камеры
    const rows = [...sec.querySelectorAll('.ct-lcd-row')];
    const sel = r => rows.forEach(x => x.classList.toggle('is-sel', x === r));
    rows.forEach(r => { r.addEventListener('mouseenter', () => sel(r)); r.addEventListener('focus', () => sel(r)); });
  }

  // Телефон и почта: на ПК копируем (звонить и писать с компьютера часто нечем), на телефоне — обычная ссылка
  const fine = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
  sec.querySelectorAll('[data-ct-copy]').forEach(a => {
    const label = a.querySelector('[data-ct-label]'), orig = label.textContent; let t;
    a.addEventListener('click', e => {
      if (!fine()) return;
      e.preventDefault();
      (navigator.clipboard ? navigator.clipboard.writeText(a.dataset.ctCopy) : Promise.resolve()).catch(() => {});
      label.textContent = a.dataset.ctDone + ' ✓'; a.classList.add('is-copied');
      clearTimeout(t); t = setTimeout(() => { label.textContent = orig; a.classList.remove('is-copied'); }, 1800);
    });
  });
})();
