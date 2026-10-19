// ПРОТОТИП эмблемы-волчицы в подвале (вместо «А с хвостиком»). Подменяет рисунок в
// .wisewolf-seal (класс .holo-icon остаётся — на него бегут следы) и, где нужно, место.
// window.WV_V: a — профиль, b — колос, c — ушки над чертой, d — яблоко, e — печать-монета, f — глаза.
(function () {
  const V = window.WV_V || 'a';
  const ft = document.querySelector('.footer'), seal = ft && ft.querySelector('.wisewolf-seal');
  if (!seal) return;
  const icon = seal.querySelector('.holo-icon');
  const PAW = '<path d="M20 21c-6 0-11 6-11 10.5 0 3 2.6 4.5 5.5 4.5 2.4 0 3.6-1.4 5.5-1.4s3.1 1.4 5.5 1.4c2.9 0 5.5-1.5 5.5-4.5C31 27 26 21 20 21z"/><ellipse cx="7.5" cy="17" rx="3.4" ry="4.4" transform="rotate(-25 7.5 17)"/><ellipse cx="15" cy="9.5" rx="3.4" ry="4.6" transform="rotate(-8 15 9.5)"/><ellipse cx="25" cy="9.5" rx="3.4" ry="4.6" transform="rotate(8 25 9.5)"/><ellipse cx="32.5" cy="17" rx="3.4" ry="4.4" transform="rotate(25 32.5 17)"/>';
  ft.classList.add('wv', 'wv-' + V);
  const set = (viewBox, html) => { icon.setAttribute('viewBox', viewBox); icon.innerHTML = html; };

  // А: ПРОФИЛЬ ВОЛЧИЦЫ — голова одной линией, уши торчком, глаз, пушистая щека
  if (V === 'a') set('0 0 100 100', `
    <g class="wv-line">
      <path d="M28 90 C25 72 24 56 29 44 L33 12 L43 30 L50 15 L55 33 C62 34 69 39 76 46 C78 48 77 51 74 52 L64 55 C61 59 58 62 54 64 L59 70 L52 70 L56 78 L48 76 C46 81 46 86 48 90"/>
      <path d="M36 22 L40 34" opacity=".5"/>
    </g>
    <path class="wv-eye" d="M55 41 q4 -3.5 8.5 0 q-4.5 2.5 -8.5 0z"/>`);

  // Б: КОЛОС — Хоро живёт в пшенице; изящный колос с остями, стоит рядом с именем, как монограмма
  if (V === 'b') {
    const g = [[80, 5, 9], [68, 4.8, 8.6], [56, 4.4, 8], [44, 4, 7.2], [33, 3.6, 6.4], [23, 3.2, 5.6]];
    const grains = g.map(([y, rx, ry], i) => {
      const x = 50.5 + i * 1.2;
      return `<ellipse cx="${x - 6}" cy="${y - 4}" rx="${rx}" ry="${ry}" transform="rotate(-28 ${x - 6} ${y - 4})"/>
              <ellipse cx="${x + 6}" cy="${y - 4}" rx="${rx}" ry="${ry}" transform="rotate(28 ${x + 6} ${y - 4})"/>
              <path class="wv-awn" d="M${x - 9} ${y - 11} l-7 -12 M${x + 9} ${y - 11} l7 -12"/>`;
    }).join('');
    set('0 0 100 100', `<path class="wv-stem" d="M50 96 C50 72 52 46 58 12"/><g class="wv-grains">${grains}<ellipse cx="58.5" cy="11" rx="3" ry="6"/></g><path class="wv-awn" d="M58.5 5 l0 -5"/>`);
    const name = ft.querySelector('.footer-name');
    const row = document.createElement('div'); row.className = 'wv-row';
    name.before(row); row.append(seal, name);
    row.after(seal.querySelector('.wisewolf-text'));   // надпись — под всей строкой, по центру
  }

  // В: УШКИ НАД ЧЕРТОЙ — над верхней линией подвала выглядывают два уха; дёргаются, когда пришли следы
  if (V === 'c') set('0 0 100 50', `
    <g class="wv-ear wv-ear--l"><path d="M12 50 L25 7 Q28 1 32 7 L47 50 Z"/><path class="wv-in" d="M21 48 L28 17 L38 48 Z"/></g>
    <g class="wv-ear wv-ear--r"><path d="M53 50 L68 7 Q72 1 75 7 L88 50 Z"/><path class="wv-in" d="M62 48 L71 17 L79 48 Z"/></g>`);

  // Г: ЯБЛОКО — любимое лакомство Хоро; листик в форме волчьего уха
  if (V === 'd') set('0 0 100 100', `
    <g class="wv-line">
      <path d="M50 32 C40 23 20 25 18 47 C16 69 32 89 44 87 C47 86 48 85 50 85 C52 85 53 86 56 87 C68 89 84 69 82 47 C80 25 60 23 50 32 Z"/>
      <path d="M50 32 C50 24 52 18 56 13"/>
      <path d="M28 46 C28 39 32 35 37 34" opacity=".5"/>
    </g>
    <path class="wv-leaf" d="M54 24 L70 7 Q72 5 72 8 L68 27 Q62 30 54 24 Z"/>`);

  // Д: ПЕЧАТЬ-МОНЕТА — в углу подвала, как оттиск на письме: лапа в центре, по кругу надпись
  if (V === 'e') set('0 0 100 100', `
    <defs><path id="wv-ring" d="M50 50 m-40 0 a40 40 0 1 1 80 0 a40 40 0 1 1 -80 0"/></defs>
    <circle class="wv-c1" cx="50" cy="50" r="47"/><circle class="wv-c2" cx="50" cy="50" r="33"/>
    <text class="wv-txt"><textPath href="#wv-ring" textLength="248">ВЕЛИКАЯ ВОЛЧИЦА · ЙОЙЦУ · ЖАТВА ·</textPath></text>
    <g class="wv-paw" transform="translate(30 29)">${PAW}</g>`);

  // Е: ГЛАЗА — в темноте подвала янтарные глаза волчицы; открываются, когда следы дошли, и следят за мышью
  if (V === 'f') {
    set('0 0 100 50', `
      <g class="wv-eyes">
        <path class="wv-eye" d="M10 27 Q27 9 44 24 Q28 35 10 27 Z"/><path class="wv-eye" d="M56 24 Q73 9 90 27 Q72 35 56 24 Z"/>
        <ellipse class="wv-pupil" cx="28" cy="24.5" rx="2.2" ry="7"/><ellipse class="wv-pupil" cx="72" cy="24.5" rx="2.2" ry="7"/>
      </g>`);
    const pupils = icon.querySelectorAll('.wv-pupil');
    addEventListener('pointermove', e => {
      const r = icon.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const a = Math.atan2(e.clientY - cy, e.clientX - cx), d = Math.min(1, Math.hypot(e.clientX - cx, e.clientY - cy) / 300);
      pupils.forEach(p => p.style.transform = `translate(${Math.cos(a) * 5 * d}px, ${Math.sin(a) * 2.5 * d}px)`);
    });
  }
})();
