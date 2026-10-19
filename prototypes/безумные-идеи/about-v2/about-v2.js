// =========================================
// «ОБО МНЕ» v2 — демо-страница /about-v2 (только по ссылке, для показа)
// Первый блок: непроявленный полароид. Его можно схватить и потрясти —
// проявится быстрее (сам проявляется за PAW_DEVELOP_MS). Снизу выглядывает
// волчья лапка (отсылка к Хоро): сначала сама трясёт снимок несколько раз
// с разной силой, потом прячется и время от времени возвращается позвать.
// Когда снимок проявился — довольно хлопает по нему и дальше просто живёт:
// машет, гладит снимок, прячется, стучит — бесконечно, с паузами.
// =========================================
(function () {
    const zone = document.querySelector('.paw-zone');
    if (!zone) return;
    const card = zone.querySelector('.paw-polaroid');
    const paw = zone.querySelector('.paw-paw');
    const bar = zone.querySelector('.paw-dev i');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const PAW_DEVELOP_MS = 22000;   // за сколько проявится сам, если не трогать
    const PAW_MAX_DEV = 0.5;        // лапка проявляет не больше половины — остальное посетителю
    const PAW_WIDTH = 0.21;         // ширина лапки от ширины полароида
    const PAW_RATIO = 569 / 320;    // пропорции картинки holo-paw.webp
    const PAW_GRIP = 0.22;          // где на картинке «хват» (доля высоты сверху) — ложится на белую полосу

    // ---------- Проявка и перетаскивание ----------
    let dev = 0, last = 0;
    const paint = () => {
        card.style.setProperty('--dev', dev.toFixed(3));
        card.classList.toggle('is-done', dev >= 1);
        if (bar) bar.style.width = dev * 100 + '%';
    };
    const develop = k => { dev = Math.min(1, dev + k); paint(); };
    const tick = now => { develop((now - last) / PAW_DEVELOP_MS); last = now; if (dev < 1) requestAnimationFrame(tick); };

    let drag = null, lx = 0, ly = 0;
    card.addEventListener('pointerdown', e => {
        drag = { x: e.clientX, y: e.clientY }; lx = e.clientX; ly = e.clientY;
        card.setPointerCapture(e.pointerId); card.classList.add('is-drag');
        pawAway();
    });
    card.addEventListener('pointermove', e => {
        if (!drag) return;
        const vx = e.clientX - lx, sp = Math.hypot(e.clientX - lx, e.clientY - ly);
        lx = e.clientX; ly = e.clientY;
        develop(sp / 4000);                       // чем сильнее трясёшь — тем быстрее
        card.style.setProperty('--dx', (e.clientX - drag.x) + 'px');
        card.style.setProperty('--dy', (e.clientY - drag.y) + 'px');
        card.style.setProperty('--dr', Math.max(-18, Math.min(18, vx * 0.9)) + 'deg');
    });
    const release = () => {
        if (!drag) return;
        drag = null; card.classList.remove('is-drag');
        ['--dx', '--dy', '--dr'].forEach(p => card.style.removeProperty(p));
    };
    card.addEventListener('pointerup', release);
    card.addEventListener('pointercancel', release);

    // ---------- Лапка ----------
    // Состояние сцены: сдвиг и поворот полароида, насколько лапка спрятана вниз (hide 0…1),
    // её наклон, «сжатие» и собственный сдвиг относительно точки хвата (lx, ly)
    const S = { sx: 0, sy: 0, th: 0, hide: 1, tilt: 0, squash: 1, lx: 0, ly: 0 };
    let run = 0, pawDev = 0, userTouched = false, visible = false, timer = null, patted = false, lastScene = '';

    // Лапка держит полароид за нижнюю белую полосу справа. Считаем, где эта точка
    // после поворота полароида (он и так наклонён на -3°), и ставим лапку туда.
    const render = () => {
        const w = card.offsetWidth, h = card.offsetHeight, pw = w * PAW_WIDTH, ph = pw * PAW_RATIO;
        const phi = (-3 + S.th) * Math.PI / 180;
        const gx = w * 0.24, gy = h / 2 - Math.max(22, h * 0.05);
        const cx = card.offsetLeft + w / 2 + S.sx, cy = card.offsetTop + h / 2 + S.sy;
        const px = cx + gx * Math.cos(phi) - gy * Math.sin(phi), py = cy + gx * Math.sin(phi) + gy * Math.cos(phi);
        const top = py - ph * PAW_GRIP, hidden = zone.offsetHeight - top + 8;   // столько вниз — и её не видно
        paw.style.width = pw + 'px';
        paw.style.transform = `translate(${px - pw / 2 + S.lx}px, ${top + S.ly + hidden * S.hide}px) rotate(${S.tilt + S.th * 0.5 - 3}deg) scaleY(${S.squash})`;
        card.style.setProperty('--dx', S.sx + 'px');
        card.style.setProperty('--dy', S.sy + 'px');
        card.style.setProperty('--dr', S.th + 'deg');
    };

    const ease = {
        out: k => 1 - Math.pow(1 - k, 3),
        in: k => k * k * k,
        inOut: k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2,
        back: k => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2),
    };
    // Твин: fn(k) на каждом кадре. Если сценку прервали (run сменился) — выходим с false.
    const tween = (id, ms, fn, e = ease.inOut) => new Promise(res => {
        const t0 = performance.now();
        const step = now => {
            if (id !== run) return res(false);
            const k = Math.min(1, (now - t0) / ms);
            fn(e(k)); render();
            if (k < 1) requestAnimationFrame(step); else res(true);
        };
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
        if (ok && pawDev < PAW_MAX_DEV) { const k = Math.min(PAW_MAX_DEV - pawDev, amp * 0.09); pawDev += k; develop(k); }
        return ok;
    };
    const tap = async (id, times) => {                    // тык снизу: полароид подпрыгивает
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

    const wave = async id => {                            // «привет»: приподнялась и помахала
        if (!await to(id, 260, 'ly', -22, ease.out)) return false;
        for (const a of [14, -14, 12, -12, 0]) if (!await to(id, 190, 'tilt', a)) return false;
        return to(id, 220, 'ly', 0);
    };
    const scratch = async id => {                         // поскребла коготками по полоске
        for (let i = 0; i < 7; i++) {
            if (!await tween(id, 70, k => { S.ly = -5 * k; S.tilt = (i % 2 ? 3 : -3) * k; }, ease.out)) return false;
            if (!await tween(id, 70, k => { S.ly = -5 * (1 - k); }, ease.in)) return false;
        }
        S.tilt = 0;
        return true;
    };
    const tug = async id => {                             // потянула снимок вниз и отпустила — он пружинит
        if (!await tween(id, 380, k => { S.sy = 16 * k; S.th = 2.5 * k; S.squash = 1 - 0.06 * k; })) return false;
        if (!await wait(id, 180)) return false;
        S.squash = 1;
        return tween(id, 520, k => { S.sy = 16 * (1 - k); S.th = 2.5 * (1 - k); }, ease.back);
    };
    const pet = async id => {                             // погладила снимок вдоль полоски туда-обратно
        const far = -card.offsetWidth * 0.32;
        for (const x of [far, 0, far * 0.6, 0]) if (!await tween(id, 520, k => { S.lx += (x - S.lx) * k; S.tilt = Math.sin(k * Math.PI) * -5; })) return false;
        S.lx = 0; S.tilt = 0;
        return true;
    };
    const drum = async id => {                            // нетерпеливо постучала: тук-тук-тук-тук
        for (let i = 0; i < 4; i++) {
            const a = i % 2 ? 5 : -5;
            if (!await tween(id, 90, k => { S.ly = -9 * k; S.tilt = a * k; }, ease.out)) return false;
            if (!await tween(id, 130, k => { S.ly = -9 * (1 - k); S.sy = Math.sin(k * Math.PI) * -3; }, ease.in)) return false;
        }
        S.tilt = 0; S.sy = 0;
        return true;
    };

    // Сценки. Каждая сама прячет лапку в конце.
    const SCENES = {
        intro: async id => {                              // первое появление: средне, сильно, совсем слабо
            await enter(id) && await grip(id) && await shake(id, 3, 0.55, 4.5) && await wait(id, 260)
                && await shake(id, 6, 1, 7) && await wait(id, 420) && await shake(id, 2, 0.3, 3.5) && await wait(id, 200);
            if (id === run) await leave(id);
        },
        shake: async id => {
            await enter(id) && await grip(id) && await shake(id, 2 + Math.round(Math.random() * 3), 0.4 + Math.random() * 0.5, 5 + Math.random() * 3);
            if (id === run) await leave(id);
        },
        double: async id => {
            await enter(id) && await grip(id) && await shake(id, 2, 0.5, 6) && await wait(id, 300) && await shake(id, 2, 0.5, 6);
            if (id === run) await leave(id);
        },
        tap: async id => {
            await enter(id) && await wait(id, 150) && await tap(id, 2);
            if (id === run) await leave(id);
        },
        peek: async id => {
            await to(id, 600, 'hide', 0.55, ease.out) && await wiggle(id) && await wait(id, 300);
            if (id === run) await to(id, 500, 'hide', 1);
        },
        pat: async id => {                                // проявилось — довольно похлопала
            await enter(id) && await wait(id, 200) && await tap(id, 3) && await wait(id, 250);
            if (id === run) await leave(id);
        },
        wave: async id => { await enter(id) && await wave(id) && await wait(id, 150); if (id === run) await leave(id); },
        scratch: async id => { await enter(id) && await scratch(id) && await wait(id, 200); if (id === run) await leave(id); },
        tug: async id => { await enter(id) && await grip(id) && await tug(id) && await wait(id, 150); if (id === run) await leave(id); },
        pet: async id => { await enter(id) && await pet(id) && await wait(id, 150); if (id === run) await leave(id); },
        drum: async id => { await enter(id) && await drum(id) && await wait(id, 200); if (id === run) await leave(id); },
        sneak: async id => {                              // прятки: медленно выглянула, дёрнулась и юркнула вниз
            await to(id, 900, 'hide', 0.6, ease.out) && await wait(id, 600) && await to(id, 260, 'hide', 0.32, ease.out) && await wait(id, 450);
            if (id === run) await to(id, 180, 'hide', 1, ease.in);
        },
    };
    // Что лапка делает в паузах. Пока снимок не проявлен — больше зовёт потрясти, потом просто живёт.
    const POOLS = {
        call: ['shake', 'shake', 'double', 'tap', 'peek', 'tug', 'scratch', 'sneak'],
        touched: ['tap', 'peek', 'shake', 'tug', 'drum'],
        idle: ['wave', 'pet', 'drum', 'sneak', 'scratch', 'peek', 'tug', 'tap', 'wave', 'pet'],
    };
    const pick = pool => {                                // случайная, но не та же, что в прошлый раз
        const list = POOLS[pool].filter(n => n !== lastScene);
        return (lastScene = list[Math.floor(Math.random() * list.length)]);
    };
    const play = async name => {
        const id = ++run;
        zone.classList.add('is-paw'); card.classList.add('is-pawed');
        await SCENES[name](id);
        if (id !== run) return;
        card.classList.remove('is-pawed'); zone.classList.remove('is-paw');
        Object.assign(S, { lx: 0, ly: 0, tilt: 0, squash: 1 });
        if (dev >= 1) schedule(7000, 7000); else schedule();
    };
    // Лапка возвращается сама: пока снимок не проявлен — через 5–11 с, потом — через 7–14 с.
    // Если блок не на экране, вкладка свёрнута или снимок держат — ждёт.
    function schedule(min = 5000, spread = 6000) {
        if (reduced) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
            if (!visible || drag || document.hidden) return schedule(2000, 2000);
            if (dev >= 1 && !patted) { patted = true; lastScene = 'pat'; return play('pat'); }
            play(pick(dev >= 1 ? 'idle' : userTouched ? 'touched' : 'call'));
        }, min + Math.random() * spread);
    }
    // Схватили сами — лапка мгновенно прячется и зовёт пореже
    function pawAway() {
        run++; userTouched = true;
        Object.assign(S, { sx: 0, sy: 0, th: 0, tilt: 0, squash: 1, hide: 1, lx: 0, ly: 0 });
        render();
        card.classList.remove('is-pawed'); zone.classList.remove('is-paw');
        schedule(8000, 6000);
    }
    addEventListener('resize', () => { if (zone.classList.contains('is-paw')) render(); });

    // Старт, когда полароид попал в кадр. Без JS снимок просто проявлен (--dev: 1 в CSS).
    paint();
    let started = false;
    const io = new IntersectionObserver(entries => entries.forEach(e => {
        visible = e.isIntersecting;
        if (!visible || started) return;
        started = true;
        last = performance.now(); requestAnimationFrame(tick);
        if (!reduced) setTimeout(() => play('intro'), 700);
    }), { threshold: 0.35 });
    io.observe(card);
})();
