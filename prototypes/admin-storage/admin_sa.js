// ПРОТОТИП: сколько места занято на сервере и сколько весит каждый альбом.
// ?v=sa|sb|sc (вид), &full=1 — показать «почти заполнено». Числа выдуманные.
(function () {
  const V = (new URLSearchParams(location.search).get('v') || 'sa').slice(1);
  const FULL = new URLSearchParams(location.search).get('full') === '1';
  document.body.classList.add('st-' + V);
  const GB = 1024 ** 3, MB = 1024 ** 2;
  const LIMIT = 10 * GB;
  const PARTS = [
    { key: 'albums', name: 'Альбомы', bytes: (FULL ? 8.6 : 3.4) * GB },
    { key: 'images', name: 'Обложки и картинки', bytes: 0.31 * GB },
    { key: 'site', name: 'Сайт и программы', bytes: 0.58 * GB },
    { key: 'db', name: 'База данных', bytes: 24 * MB },
  ];
  const USED = PARTS.reduce((s, p) => s + p.bytes, 0), FREE = Math.max(0, LIMIT - USED);
  const level = FREE / LIMIT < 0.05 ? 'is-danger' : FREE / LIMIT < 0.15 ? 'is-warn' : '';
  const fmt = b => b >= GB ? `${(b / GB).toFixed(1).replace('.', ',')} ГБ` : `${Math.max(1, Math.round(b / MB))} МБ`;
  const pct = b => Math.max(0.6, b / LIMIT * 100);

  // Вес альбомов — по карточкам в списке
  const cards = [...document.querySelectorAll('#admin-galleries-grid .gallery-card')];
  const SIZES = [1.84, 0.62, 0.71, 0.23, 0.12].map(x => x * GB * (FULL ? 2.5 : 1));
  const albums = cards.map((c, i) => ({ id: c.dataset.albumId, card: c, title: c.querySelector('h2').childNodes[2]?.textContent.trim() || c.querySelector('h2').textContent.trim().split('\n')[0], bytes: SIZES[i % SIZES.length] }));
  const maxAlbum = Math.max(...albums.map(a => a.bytes));
  const top = [...albums].sort((a, b) => b.bytes - a.bytes).slice(0, 3);

  const DISK = '<svg class="st-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h8l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M10 3v4M13 3v4M16 4v3"/></svg>';
  const bar = () => `<div class="st-bar" role="img" aria-label="Занято ${fmt(USED)} из ${fmt(LIMIT)}">${PARTS.map(p => `<i class="st-seg st-seg--${p.key}" style="width:${pct(p.bytes)}%"></i>`).join('')}</div>`;
  const legend = () => `<ul class="st-legend">${PARTS.map(p => `<li><i class="st-dot st-seg--${p.key}"></i><span>${p.name}</span><b>${fmt(p.bytes)}</b></li>`).join('')}</ul>`;
  const topList = () => `<div class="st-top"><p>Самые тяжёлые</p>${top.map(a => `<button type="button" class="st-top-row" data-st-album="${a.id}"><span>${a.title}</span><b>${fmt(a.bytes)}</b></button>`).join('')}</div>`;

  function widget(where) {
    const el = document.createElement('section');
    el.className = `st st--${where} ${level}`;
    el.setAttribute('aria-label', 'Место на сервере');
    if (V === 'a') el.innerHTML = `
      <div class="st-head">${DISK}<span>Память</span><b>${fmt(USED)} / ${fmt(LIMIT)}</b></div>
      ${bar()}
      <p class="st-free">${level === 'is-danger' ? 'Почти не осталось места: ' : ''}свободно ${fmt(FREE)}</p>
      <details class="st-more"><summary>Подробнее</summary>${legend()}${topList()}</details>`;
    if (V === 'b') {
      const fill = Math.min(100, USED / LIMIT * 100);
      el.innerHTML = `
        <button type="button" class="st-sd" aria-expanded="false">
          <span class="st-card"><svg viewBox="0 0 40 52" aria-hidden="true"><path class="st-card-shape" d="M4 2h22l10 10v36a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><clipPath id="st-clip-${where}"><path d="M4 2h22l10 10v36a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/></clipPath><rect class="st-card-fill" clip-path="url(#st-clip-${where})" x="0" y="${52 - 52 * fill / 100}" width="40" height="52"/><path class="st-card-pins" d="M9 2v8M14 2v8M19 2v8M24 2v8"/></svg></span>
          <span class="st-sd-text"><b>${fmt(FREE)}</b><small>свободно из ${fmt(LIMIT)}</small></span>
          <svg class="st-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="st-drop" hidden>${bar()}${legend()}${topList()}</div>`;
    }
    if (V === 'c') {
      const r = 26, C = 2 * Math.PI * r; let off = 0;
      const arcs = PARTS.map(p => { const len = Math.max(1.5, p.bytes / LIMIT * C); const s = `<circle class="st-arc st-seg--${p.key}" cx="32" cy="32" r="${r}" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}"/>`; off += len; return s; }).join('');
      el.innerHTML = `
        <div class="st-ring-row">
          <svg class="st-ring" viewBox="0 0 64 64" aria-hidden="true"><circle class="st-track" cx="32" cy="32" r="${r}"/><g transform="rotate(-90 32 32)">${arcs}</g>
            <text x="32" y="35" text-anchor="middle">${Math.round(USED / LIMIT * 100)}%</text></svg>
          <div><b>${fmt(FREE)}</b><small>свободно из ${fmt(LIMIT)}</small></div>
        </div>
        ${legend()}${topList()}`;
    }
    return el;
  }

  // Через document: копия из <template> («Ещё» на телефоне) приходит без обработчиков
  document.addEventListener('click', e => {
    const sd = e.target.closest('.st-sd');
    if (sd) { const drop = sd.nextElementSibling; drop.hidden = !drop.hidden; sd.setAttribute('aria-expanded', String(!drop.hidden)); }
    const b = e.target.closest('[data-st-album]');
    if (b) { document.getElementById('m-sheet-close')?.click(); document.querySelector(`.btn-edit-album[data-id="${b.dataset.stAlbum}"]`)?.click(); }
  });

  // ПК — в боковую панель над переключателем темы
  const side = document.querySelector('.admin-sidebar .theme-switch');
  if (side) side.before(widget('side'));
  // Телефон — в меню «Ещё» (его содержимое берётся из <template>) и тонкой строкой в шапке «Галерей»
  const tpl = document.getElementById('m-more-template');
  if (tpl) tpl.content.querySelector('.m-more')?.prepend(widget('more'));
  const head = document.querySelector('#view-albums .dashboard-header');
  if (head) {
    const chip = document.createElement('button');
    chip.type = 'button'; chip.className = `st-chip ${level}`;
    chip.innerHTML = `${DISK}<span>${fmt(FREE)} свободно</span>${bar()}`;
    chip.title = 'Подробнее — в «Ещё»';
    chip.addEventListener('click', () => document.getElementById('m-more-btn')?.click());
    head.after(chip);
  }

  // Вес на карточке альбома
  albums.forEach(a => {
    const meta = a.card.querySelector('.info-meta');
    if (!meta) return;
    const s = document.createElement('span');
    s.className = 'st-album';
    s.innerHTML = V === 'b'
      ? `<span class="st-album-bar"><i style="width:${Math.max(6, a.bytes / maxAlbum * 100)}%"></i></span>${fmt(a.bytes)}`
      : fmt(a.bytes);
    s.title = 'Сколько места занимает альбом на сервере (фото, миниатюры, водяные знаки, обложки)';
    const dot = document.createElement('span'); dot.className = 'dot'; dot.textContent = '•';
    meta.append(dot, s);
  });
})();
