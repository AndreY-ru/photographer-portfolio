// ПРОТОТИП кнопки «Связаться» на ПК (на телефоне не трогаем — там уже своя в углу).
// window.CK_V: a — как на телефоне, b — затвор, c — карточка «открыт для съёмок», d — язычок сбоку.
// Кнопка открывает то же окно «Связаться» (data-contact-trigger) — обработчик script.js
// навешивается на DOMContentLoaded, а этот скрипт выполняется раньше, так что кнопку он подхватит.
(function () {
  const V = window.CK_V || 'a';
  const old = document.querySelector('.nav__cta');
  const href = old ? old.getAttribute('href') : '/about#contact';
  document.body.classList.add('ck-on', 'ck-' + V);
  const PLANE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
  const a = document.createElement('a');
  a.href = href; a.setAttribute('data-contact-trigger', ''); a.className = 'ck';
  if (V === 'a') a.innerHTML = `${PLANE}<span>Связаться</span>`;
  if (V === 'b') { a.setAttribute('aria-label', 'Связаться'); a.innerHTML = `<span class="ck-label">Связаться</span><span class="ck-shutter"><span class="ck-ring"></span><span class="ck-disc">${PLANE}</span></span>`; }
  if (V === 'c') a.innerHTML = `<span class="ck-status"><i></i>Открыт для съёмок</span><span class="ck-go">Связаться <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>`;
  if (V === 'd') a.innerHTML = `<span class="ck-tab">${PLANE}<span>Связаться</span></span>`;
  // --- И…М: панель контактов открывается ОТТУДА, где нажал (а не окном по центру) ---
  if ('ijlm'.includes(V)) {
    const PAW_I = '<svg viewBox="0 0 40 40" aria-hidden="true" class="ck-paw"><path d="M20 21c-6 0-11 6-11 10.5 0 3 2.6 4.5 5.5 4.5 2.4 0 3.6-1.4 5.5-1.4s3.1 1.4 5.5 1.4c2.9 0 5.5-1.5 5.5-4.5C31 27 26 21 20 21z"/><ellipse cx="7.5" cy="17" rx="3.4" ry="4.4" transform="rotate(-25 7.5 17)"/><ellipse cx="15" cy="9.5" rx="3.4" ry="4.6" transform="rotate(-8 15 9.5)"/><ellipse cx="25" cy="9.5" rx="3.4" ry="4.6" transform="rotate(8 25 9.5)"/><ellipse cx="32.5" cy="17" rx="3.4" ry="4.4" transform="rotate(25 32.5 17)"/></svg>';
    // Каналы — те же, что в окне «Связаться» (иконки из БД, телефон на ПК копируется)
    const chans = [...document.querySelectorAll('.contact-modal__list .contact-modal__item')].map(it => ({
      icon: it.querySelector('.contact-modal__icon-glyph').style.getPropertyValue('--icon-url'),
      name: it.querySelector('.contact-modal__name').textContent.trim(),
      hint: it.querySelector('.contact-modal__hint').textContent.trim(),
      attrs: [...it.attributes].filter(x => ['href', 'target', 'rel', 'data-copy-phone'].includes(x.name)).map(x => `${x.name}="${x.value}"`).join(' '),
    }));
    const list = cls => chans.map(c => `<a class="${cls}" ${c.attrs}><span class="ck-ico" style="--icon-url:${c.icon}"></span><span class="ck-txt"><b>${c.name}</b><small${c.attrs.includes('data-copy-phone') ? ' data-copy-label' : ''}>${c.hint}</small></span></a>`).join('');
    const more = `<a class="ck-more" href="/about#contact">Все способы связи →</a>`;
    const box = document.createElement('div');
    box.className = 'ck ck-box';
    if (V === 'i') box.innerHTML = `<button type="button" class="ck-toggle ck-tab" aria-expanded="false">${PAW_I}<span>Связаться</span></button>
        <div class="ck-drawer"><p class="ck-ph">Напиши мне</p><p class="ck-sub">Обсудим дату и идею съёмки</p>${list('ck-row')}${more}</div>`;
    if (V === 'j') box.innerHTML = `<div class="ck-fan">${chans.map((c, k) => `<a class="ck-fan-item" style="--k:${chans.length - 1 - k}" ${c.attrs}><span class="ck-fan-label">${c.name}</span><span class="ck-fan-dot"><span class="ck-ico" style="--icon-url:${c.icon}"></span></span></a>`).join('')}</div>
        <button type="button" class="ck-toggle ck-pawbtn" aria-expanded="false" aria-label="Связаться">${PAW_I}<svg class="ck-x" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
    if (V === 'l') box.innerHTML = `<div class="ck-card"><div class="ck-card-in"><p class="ck-ph">Напиши мне</p>${list('ck-row')}${more}</div>
        <button type="button" class="ck-toggle ck-pill" aria-expanded="false">${PLANE}<span class="ck-pill-open">Связаться</span><span class="ck-pill-close">Свернуть</span></button></div>`;
    if (V === 'm') box.innerHTML = `<div class="ck-pol"><div class="ck-pol-photo"><p class="ck-ph">Напиши мне</p>${list('ck-row')}</div><div class="ck-pol-cap">${more}</div></div>
        <button type="button" class="ck-toggle ck-polbtn" aria-expanded="false"><span class="ck-polbtn-img"></span><span class="ck-polbtn-cap">Связаться</span></button>`;
    document.body.appendChild(box);
    const tgl = box.querySelector('.ck-toggle');
    const set = open => { box.classList.toggle('is-open', open); tgl.setAttribute('aria-expanded', String(open)); };
    tgl.addEventListener('click', e => { e.stopPropagation(); set(!box.classList.contains('is-open')); });
    document.addEventListener('click', e => { if (!box.contains(e.target)) set(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
    const f = document.getElementById('vf-focus');
    if (f) box.querySelectorAll('a, button').forEach(el => { el.addEventListener('mouseenter', () => f.classList.add('focused')); el.addEventListener('mouseleave', () => f.classList.remove('focused')); });
    return;
  }

  // --- Д…З: развитие «язычка» ---
  const PAW = '<svg viewBox="0 0 40 40" aria-hidden="true" class="ck-paw"><path d="M20 21c-6 0-11 6-11 10.5 0 3 2.6 4.5 5.5 4.5 2.4 0 3.6-1.4 5.5-1.4s3.1 1.4 5.5 1.4c2.9 0 5.5-1.5 5.5-4.5C31 27 26 21 20 21z"/><ellipse cx="7.5" cy="17" rx="3.4" ry="4.4" transform="rotate(-25 7.5 17)"/><ellipse cx="15" cy="9.5" rx="3.4" ry="4.6" transform="rotate(-8 15 9.5)"/><ellipse cx="25" cy="9.5" rx="3.4" ry="4.6" transform="rotate(8 25 9.5)"/><ellipse cx="32.5" cy="17" rx="3.4" ry="4.4" transform="rotate(25 32.5 17)"/></svg>';
  // Д: ЯЗЫЧОК-МЕНЮ — при наведении выдвигается панель с быстрыми каналами (без лишнего окна)
  if (V === 'e') {
    const items = [...document.querySelectorAll('.contact-modal__list .contact-modal__item')].map(it => {
      const g = it.querySelector('.contact-modal__icon-glyph'), nm = it.querySelector('.contact-modal__name').textContent.trim();
      const attrs = [...it.attributes].filter(x => ['href', 'target', 'rel', 'data-copy-phone'].includes(x.name)).map(x => `${x.name}="${x.value}"`).join(' ');
      return `<a class="ck-ch" ${attrs}><span class="ck-ico" style="--icon-url:${g.style.getPropertyValue('--icon-url')}"></span><span>${nm}</span></a>`;
    }).join('');
    const wrap = document.createElement('div'); wrap.className = 'ck ck-menu';
    wrap.innerHTML = `<div class="ck-panel"><p class="ck-ph">Написать мне</p>${items}<a class="ck-ch ck-ch--all" href="${href}" data-contact-trigger>Все способы связи →</a></div><span class="ck-tab">${PLANE}<span>Связаться</span></span>`;
    document.body.appendChild(wrap);
    return;
  }
  // Е: ТОНКИЙ ЯЗЫЧОК — тёмный, золотой текст; при наведении выезжает и заливается золотом
  if (V === 'f') a.innerHTML = `<span class="ck-tab">${PLANE}<span>Связаться</span></span>`;
  // Ж: ЯЗЫЧОК С ЛАПКОЙ — вместо самолётика лапка Хоро; при наведении она «машет»
  if (V === 'g') a.innerHTML = `<span class="ck-tab">${PAW}<span>Связаться</span></span>`;
  // З: ЗАКЛАДКА — золотая лента свисает сверху справа, как закладка в книге; при наведении вытягивается
  if (V === 'h') a.innerHTML = `<span class="ck-ribbon">${PLANE}<span>Связаться</span></span>`;
  document.body.appendChild(a);
  // на главной системный курсор скрыт — рамка-курсор «фокусируется» на кнопке, как на других ссылках
  const f = document.getElementById('vf-focus');
  if (f) { a.addEventListener('mouseenter', () => f.classList.add('focused')); a.addEventListener('mouseleave', () => f.classList.remove('focused')); }
  // Б: щелчок затвора при нажатии
  if (V === 'b') a.addEventListener('pointerdown', () => { a.classList.remove('is-click'); void a.offsetWidth; a.classList.add('is-click'); });
})();
