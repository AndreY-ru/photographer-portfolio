document.addEventListener("DOMContentLoaded", () => {

    // === 0. ПРЕЛОАДЕР И ИНИЦИАЛИЗАЦИЯ ===
    (() => {
        const preloader = document.getElementById('preloader');
        const typeEl = document.getElementById('preloader-type');
        const vfLayer = document.getElementById('vf-layer');
        
        if (!preloader || !typeEl) {
            document.body.classList.remove('fade-in');
            if (vfLayer) vfLayer.classList.add('vf-line-seeded', 'vf-grid-unfolded');
            return;
        }

        if (sessionStorage.getItem('grigorievPreloaderSeen') === '1') {
            preloader.remove();
            document.body.classList.remove('fade-in');
            if (vfLayer) vfLayer.classList.add('vf-line-seeded', 'vf-grid-unfolded');
            return;
        }

        const HOLD = 2000;         
        const COLLAPSE = 500;      
        const GRID_SETTLE = 950;   
        const GRID_HOLD = 350;     
        const REMOVE_DELAY = 750;  
        
        setTimeout(() => typeEl.classList.add('is-visible'), 150);

        setTimeout(() => {
            typeEl.classList.add('is-collapsing');
            if (vfLayer) vfLayer.classList.add('vf-line-seeded'); 
        }, HOLD);

        setTimeout(() => {
            if (vfLayer) vfLayer.classList.add('vf-grid-unfolded'); 
        }, HOLD + COLLAPSE);

        setTimeout(() => {
            preloader.classList.add('is-hidden');
            document.body.classList.remove('fade-in'); 
            sessionStorage.setItem('grigorievPreloaderSeen', '1');
            setTimeout(() => preloader.remove(), REMOVE_DELAY);
        }, HOLD + COLLAPSE + GRID_SETTLE + GRID_HOLD);
    })();

    // === 1. ЧАСЫ (REC) ===
    const clockEl = document.getElementById('clock');
    if (clockEl) {
        const recStart = Date.now();
        const pad = (n) => String(n).padStart(2, '0');
        setInterval(() => {
            const elapsed = Math.floor((Date.now() - recStart) / 1000);
            const h = pad(Math.floor(elapsed / 3600));
            const m = pad(Math.floor((elapsed % 3600) / 60));
            const s = pad(elapsed % 60);
            clockEl.innerText = `${h}:${m}:${s}`;
        }, 1000);
    }

        const ISO_STEPS = [
        { label: 'ISO 100', opacity: 0.02, size: '150px' }, // как сейчас, ничего не меняется    
        { label: 'ISO 1600', opacity: 0.06, size: '180px' },
        { label: 'ISO 3200', opacity: 0.10, size: '220px' },
        { label: 'ISO 6400', opacity: 0.16, size: '260px' },];

    // === 1.5 УТИЛИТА: ЯРКОСТЬ УЧАСТКА ФОТО ===
    // Общая для героя на главной (секция 3 ниже) и тега категории на
    // карточках галереи (секция 6) — раньше жила только внутри блока
    // "только для главной" и на странице /gallery была вообще недоступна.
    // Меряет среднюю яркость конкретного прямоугольного участка внутри
    // <img> (в процентах от видимой, уже обрезанной object-fit:cover
    // области), чтобы понять, тёмный там кусок фото или светлый — и
    // подобрать под него правильный (светлый/тёмный) цвет текста поверх.
    const LIGHT_SURFACE_THRESHOLD = 140; // выше — участок светлый, текст должен стать тёмным
    const getVisibleRegionLuminance = (img, xPct, yPct, wPct, hPct) => {
        try {
            const containerW = img.clientWidth;
            const containerH = img.clientHeight;
            const imgW = img.naturalWidth || img.width;
            const imgH = img.naturalHeight || img.height;

            const containerRatio = containerW / containerH;
            const imgRatio = imgW / imgH;
            let drawW, drawH, offsetX, offsetY;

            if (imgRatio > containerRatio) {
                drawH = imgH; drawW = imgH * containerRatio;
                offsetX = (imgW - drawW) / 2; offsetY = 0;
            } else {
                drawW = imgW; drawH = imgW / containerRatio;
                offsetX = 0; offsetY = (imgH - drawH) / 2;
            }

            const regionX = offsetX + (drawW * (xPct / 100));
            const regionY = offsetY + (drawH * (yPct / 100));
            const regionW = drawW * (wPct / 100);
            const regionH = drawH * (hPct / 100);

            const canvas = document.createElement('canvas');
            canvas.width = regionW; canvas.height = regionH;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, regionX, regionY, regionW, regionH, 0, 0, regionW, regionH);

            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let rSum = 0, gSum = 0, bSum = 0, count = 0;

            for (let i = 0; i < data.length; i += 16) {
                if (data[i + 3] === 0) continue;
                rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2];
                count++;
            }

            if (count === 0) return 0;
            return ((rSum / count) * 299 + (gSum / count) * 587 + (bSum / count) * 114) / 1000;
        } catch (e) {
            return 0;
        }
    };

    // === 1.8 БУРГЕР-МЕНЮ (мобильная навигация) ===
    // Кнопка и панель вынесены за пределы .header-wrap в разметке (base.html) —
    // здесь просто переключаем их состояние по клику/Esc/переходу по ссылке.
    const burgerToggle = document.getElementById('burger-toggle');
    const mobileNav = document.getElementById('mobile-nav');
    if (burgerToggle && mobileNav) {
        const setMenuOpen = (open) => {
            mobileNav.classList.toggle('is-open', open);
            mobileNav.setAttribute('aria-hidden', String(!open));
            burgerToggle.setAttribute('aria-expanded', String(open));
            // Блокируем скролл страницы под открытой панелью
            document.body.style.overflow = open ? 'hidden' : '';
        };

        burgerToggle.addEventListener('click', () => {
            setMenuOpen(!mobileNav.classList.contains('is-open'));
        });

        // Клик по ссылке — закрываем панель (переход всё равно уводит со
        // страницы, но без этого при переходе на тот же якорь она осталась
        // бы открытой на новой странице до перерисовки)
        mobileNav.querySelectorAll('.mobile-nav__link').forEach(link => {
            link.addEventListener('click', () => setMenuOpen(false));
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mobileNav.classList.contains('is-open')) setMenuOpen(false);
        });

        // Если ширину окна увеличили обратно до десктопной прямо при
        // открытой панели (поворот устройства, ресайз) — закрываем её,
        // иначе .mobile-nav так и останется "открытой" (просто невидимой
        // на десктопе из-за display:none в CSS), скролл страницы при этом
        // остался бы заблокирован через document.body.style.overflow.
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768 && mobileNav.classList.contains('is-open')) setMenuOpen(false);
        });
    }

    // === 1.8 КОПИРОВАНИЕ ТЕЛЕФОНА И ПОЧТЫ НА ПК ===
    // Ссылки tel: с [data-copy-phone] (кнопка "Телефон" в модалке
    // "Связаться" и номер на странице "Обо мне") и mailto: с [data-copy-email]
    // (почта на "Обо мне"). С компьютера звонить нечем, а почтовая программа
    // часто не настроена, поэтому там, где основной указатель — мышь, клик
    // копирует номер/почту в буфер и на пару секунд показывает "…скопирован(а)"
    // в элементе [data-copy-label] (ссылке на это время даётся .is-copied).
    // На телефоне — обычные tel:/mailto:.
    const copyInsteadOfCall = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    const copyText = (text) => {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        }
        // Старый способ — на случай http или старого браузера
        return new Promise((resolve, reject) => {
            const area = document.createElement('textarea');
            area.value = text;
            area.setAttribute('readonly', '');
            area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
            document.body.appendChild(area);
            area.select();
            const ok = document.execCommand('copy');
            area.remove();
            ok ? resolve() : reject(new Error('execCommand copy failed'));
        });
    };

    document.querySelectorAll('[data-copy-phone], [data-copy-email]').forEach(link => {
        const label = link.matches('[data-copy-label]') ? link : link.querySelector('[data-copy-label]');
        const originalLabel = label ? label.textContent : '';
        const isEmail = link.hasAttribute('data-copy-email');
        let restoreTimer = null;

        link.addEventListener('click', (e) => {
            if (!copyInsteadOfCall()) return; // телефон/планшет — пусть звонит или открывает почту
            e.preventDefault();
            copyText(isEmail ? link.dataset.copyEmail : link.dataset.copyPhone)
                .then(() => {
                    if (!label) return;
                    label.textContent = isEmail ? 'Почта скопирована ✓' : 'Номер скопирован ✓';
                    link.classList.add('is-copied');
                    clearTimeout(restoreTimer);
                    restoreTimer = setTimeout(() => { label.textContent = originalLabel; link.classList.remove('is-copied'); }, 1800);
                })
                .catch(() => {
                    // Не дали скопировать — хотя бы номер уже виден на экране
                    if (label) label.textContent = originalLabel;
                });
        });
    });

    // === 1.9 МОДАЛКА "СВЯЗАТЬСЯ" ===
    // Общая для всех кнопок-триггеров [data-contact-trigger]: сейчас это
    // плавающая .mobile-cta на мобильной ширине (на ПК у кнопки «Связаться»
    // своя панель — .cta-dock, см. конец файла). У них у всех есть рабочий href на
    // about.html#contact — это фолбэк на случай, если JS не выполнится;
    // здесь просто перехватываем клик и открываем модалку вместо перехода.
    const contactModal = document.getElementById('contact-modal');
    if (contactModal) {
        const contactTriggers = document.querySelectorAll('[data-contact-trigger]');
        const contactCloseEls = contactModal.querySelectorAll('[data-contact-close]');
        // Ссылки внутри самой модалки (соцсети/телефон/"Другие способы
        // связи") не перехватываем — им дают отработать переход как обычно
        // (в новой вкладке, tel: или на #contact), но заодно закрываем
        // модалку, чтобы она не осталась открытой поверх страницы.
        const contactLinks = contactModal.querySelectorAll('.contact-modal__item, .contact-modal__more');
        let lastFocusedBeforeModal = null;

        const setContactOpen = (open) => {
            contactModal.classList.toggle('is-open', open);
            contactModal.setAttribute('aria-hidden', String(!open));
            document.body.style.overflow = open ? 'hidden' : '';
            if (open) {
                lastFocusedBeforeModal = document.activeElement;
            } else if (lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === 'function') {
                lastFocusedBeforeModal.focus({ preventScroll: true });
            }
        };

        contactTriggers.forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                setContactOpen(true);
            });
        });

        contactCloseEls.forEach(el => {
            el.addEventListener('click', () => setContactOpen(false));
        });

        contactLinks.forEach(link => {
            link.addEventListener('click', () => {
                // Телефон на ПК не уводит со страницы, а копирует номер (см.
                // 1.8) — модалку оставляем открытой, чтобы было видно
                // "Номер скопирован".
                if (link.hasAttribute('data-copy-phone') && copyInsteadOfCall()) return;
                setContactOpen(false);
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && contactModal.classList.contains('is-open')) setContactOpen(false);
        });
    }

    // === 2. ДИНАМИЧЕСКИЙ ВИДОИСКАТЕЛЬ ===
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const vfLayer = document.getElementById('vf-layer');
    const vfFocus = document.getElementById('vf-focus');

    // --- Адаптивный курсор: рамка темнеет над светлыми участками обложки
    // (иначе на ярком фото, с солнцем например, её просто не видно).
    // Дорогая часть — разбор пикселей фото — считается ОДИН РАЗ при смене
    // обложки, в buildCursorLuminanceGrid() ниже (вызывается из
    // extractAndSetColor() в секции 3, своя копия расчёта обрезки
    // object-fit:cover, чтобы не трогать уже рабочий код там). В самом
    // цикле анимации (60 раз/сек) остаётся только дешёвый lookup по уже
    // готовой сетке — ни одного обращения к canvas на кадр. ---
    const CURSOR_GRID_COLS = 20;
    const CURSOR_GRID_ROWS = 12;
    const CURSOR_LIGHT_THRESHOLD = 140; // тот же порог, что и у текста на обложке
    let cursorLuminanceGrid = null; // Float32Array с яркостью каждой ячейки текущего фото, или null

    const heroDisplay = document.querySelector('.showcase-display');
    let heroRectCache = heroDisplay ? heroDisplay.getBoundingClientRect() : null;

    // Общий сэмплер: для точки в координатах viewport возвращает true (светлый
    // участок фото), false (тёмный) или null (точка сейчас не над фото вообще —
    // сетка ещё не готова, либо это другая часть страницы). Раньше им же
    // пользовались и кнопки видоискателя (.vf-data) — теперь они переехали в
    // карточку у лого и в подложке фото больше не участвуют, так что сэмплер
    // остался только курсору (updateCursorContrast ниже).
    const sampleHeroLuminance = (x, y) => {
        if (!cursorLuminanceGrid || !heroRectCache) return null;
        const r = heroRectCache;
        if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
        const col = Math.min(CURSOR_GRID_COLS - 1, Math.max(0, Math.floor(((x - r.left) / r.width) * CURSOR_GRID_COLS)));
        const row = Math.min(CURSOR_GRID_ROWS - 1, Math.max(0, Math.floor(((y - r.top) / r.height) * CURSOR_GRID_ROWS)));
        return cursorLuminanceGrid[row * CURSOR_GRID_COLS + col] > CURSOR_LIGHT_THRESHOLD;
    };

    const refreshHeroRect = () => {
        heroRectCache = heroDisplay ? heroDisplay.getBoundingClientRect() : null;
    };
    window.addEventListener('resize', refreshHeroRect);
    window.addEventListener('scroll', refreshHeroRect, { passive: true });

    const buildCursorLuminanceGrid = (img) => {
        try {
            const containerW = img.clientWidth, containerH = img.clientHeight;
            const imgW = img.naturalWidth || img.width, imgH = img.naturalHeight || img.height;
            const containerRatio = containerW / containerH, imgRatio = imgW / imgH;
            let drawW, drawH, offsetX, offsetY;
            if (imgRatio > containerRatio) {
                drawH = imgH; drawW = imgH * containerRatio; offsetX = (imgW - drawW) / 2; offsetY = 0;
            } else {
                drawW = imgW; drawH = imgW / containerRatio; offsetX = 0; offsetY = (imgH - drawH) / 2;
            }
            const canvas = document.createElement('canvas');
            canvas.width = CURSOR_GRID_COLS; canvas.height = CURSOR_GRID_ROWS;
            const ctx = canvas.getContext('2d');
            // Один drawImage с уменьшением — браузер сам усредняет пиксели при даунскейле,
            // не нужно вручную читать полное разрешение фото
            ctx.drawImage(img, offsetX, offsetY, drawW, drawH, 0, 0, CURSOR_GRID_COLS, CURSOR_GRID_ROWS);
            const data = ctx.getImageData(0, 0, CURSOR_GRID_COLS, CURSOR_GRID_ROWS).data;
            const grid = new Float32Array(CURSOR_GRID_COLS * CURSOR_GRID_ROWS);
            for (let i = 0; i < grid.length; i++) {
                const p = i * 4;
                grid[i] = (data[p] * 299 + data[p + 1] * 587 + data[p + 2] * 114) / 1000;
            }
            cursorLuminanceGrid = grid;
        } catch (e) {
            cursorLuminanceGrid = null; // CORS / страница открыта не через сервер — просто не адаптируем курсор
        }
    };

    // Вызывается каждый кадр из renderDynamics — только арифметика и индекс
    // массива, ни одного обращения к canvas
    const updateCursorContrast = (x, y) => {
        if (!vfFocus) return;
        const isLight = sampleHeroLuminance(x, y);
        vfFocus.classList.toggle('is-over-photo', isLight !== null);
        vfFocus.classList.toggle('is-on-light', isLight === true);
    };
    
    // Рамку запускаем там же, где CSS прячет системный курсор — по
    // (pointer: fine), см. body.home-page в style.css. Раньше условием было
    // "нет тача": на ноутбуке с сенсорным экраном и мышью системный курсор
    // CSS уже скрыл, а рамка не запускалась — курсора не было вовсе.
    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
    if (hasFinePointer && vfLayer && vfFocus) {
        const centerDot = vfFocus.querySelector('.center-dot');
        let mouseX = window.innerWidth / 2;
        let mouseY = window.innerHeight / 2;
        let focusX = mouseX, focusY = mouseY;
        let rafId = null;
        let lastFrameTime = 0;

        // Точка в центре почти без задержки идёт за мышью, а рамка вокруг
        // плавно её догоняет. Раньше точка ехала вместе с рамкой с
        // отставанием (0.15 пути за кадр) — а раз системный курсор скрыт,
        // это и ощущалось как "лагучий курсор". Ровно под мышью (без
        // сглаживания вовсе) тоже плохо: тачпад ноутбука шлёт координаты
        // неравномерно (то два события за кадр, то ни одного), и точка
        // дёргалась — поэтому у неё лёгкое сглаживание (~13 мс), на глаз не
        // заметное. Скорость догона считаем от реального времени между
        // кадрами, иначе на 60 Гц всё было бы вдвое медленнее, чем на 144 Гц.
        const FOLLOW_PER_60HZ_FRAME = 0.3;  // рамка
        const DOT_PER_60HZ_FRAME = 0.7;     // точка
        let dotX = mouseX, dotY = mouseY;

        const renderDynamics = (now) => {
            const dt = lastFrameTime ? Math.min(now - lastFrameTime, 100) : 16.7;
            lastFrameTime = now;
            const follow = 1 - Math.pow(1 - FOLLOW_PER_60HZ_FRAME, dt / 16.7);
            const dotFollow = 1 - Math.pow(1 - DOT_PER_60HZ_FRAME, dt / 16.7);

            // Сетка видоискателя стоит на месте. Раньше она сдвигалась за мышью
            // (параллакс), но заметно грузила видеокарту, а на сам эффект почти
            // никто не обращал внимания — владелец решил убрать его совсем.

            focusX += (mouseX - focusX) * follow;
            focusY += (mouseY - focusY) * follow;
            dotX += (mouseX - dotX) * dotFollow;
            dotY += (mouseY - dotY) * dotFollow;
            // Целые пиксели: при дробном сдвиге браузер каждый кадр заново
            // перерисовывал уголки рамки (у них filter), а при целом — просто двигает слой
            const fx = Math.round(focusX), fy = Math.round(focusY);
            vfFocus.style.transform = `translate(calc(-50% + ${fx}px), calc(-50% + ${fy}px))`;
            if (centerDot) {
                centerDot.style.transform = `translate(calc(-50% + ${Math.round(dotX) - fx}px), calc(-50% + ${Math.round(dotY) - fy}px))`;
            }

            updateCursorContrast(focusX, focusY);

            // Рамка и точка догнали мышь — останавливаем цикл до следующего
            // движения. Раньше он крутился 60+ раз в секунду всегда, даже
            // когда мышь стоит, и браузер впустую пересобирал кадр.
            if (Math.abs(mouseX - focusX) < 0.1 && Math.abs(mouseY - focusY) < 0.1 &&
                Math.abs(mouseX - dotX) < 0.1 && Math.abs(mouseY - dotY) < 0.1) {
                rafId = null;
                lastFrameTime = 0;
                return;
            }
            rafId = requestAnimationFrame(renderDynamics);
        };
        const wakeCursor = () => {
            if (rafId === null) rafId = requestAnimationFrame(renderDynamics);
        };

        window.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            wakeCursor();
        }, { passive: true });
        window.addEventListener('resize', wakeCursor);
        wakeCursor();

        const genericHoverTargets = document.querySelectorAll('.nav__link, .logo, .preview-btn, .wisewolf-seal, .cta-dock__toggle, .cta-dock__row, .cta-dock__more, .display-back, .vf-dial, .contact-modal__item, .contact-modal__more, .contact-modal__close, .cookie-banner__btn, .cookie-banner__text a');
        genericHoverTargets.forEach((el) => {
            el.addEventListener('mouseenter', () => vfFocus.classList.add('focused'));
            el.addEventListener('mouseleave', () => vfFocus.classList.remove('focused'));
        });
    }

    // === 3. ЛОГИКА МЕНЮ, ДИСПЛЕЯ И ХАМЕЛЕОНА ===
    const showcaseDisplay = document.querySelector('.showcase-display');
    
    if (showcaseDisplay) {
        const showcaseItems = document.querySelectorAll('.showcase-item');
        const displayContents = document.querySelectorAll('.display-content');
        const mediaLayers = document.querySelectorAll('.display-media__layer');
        const metaIso = document.getElementById('meta-iso');
        const metaAperture = document.getElementById('meta-aperture');
        const metaCoords = document.getElementById('meta-coords');
        const bgTypo = document.querySelector('.bg-typography');
        const logoLink = document.querySelector('.logo');
        const backBtn = document.getElementById('display-back');

        // === СВАЙП ПО ГЕРОЮ (мобильная замена карточек-категорий под фото) ===
        // "Слайды" — то же самое, что уже переключает showState() ниже:
        // стартовый манифест + превью каждой категории, в порядке из
        // шаблона (см. .display-content в index.html).
        const heroSlideIds = Array.from(displayContents).map(el => el.id);
        let heroIndex = Math.max(0, heroSlideIds.indexOf('state-default'));
        const heroDots = document.getElementById('hero-dots');
        const heroDotEls = heroDots ? Array.from(heroDots.children) : [];


        const DEFAULTS = { iso: 'ISO 400', aperture: 'F/1.8', coords: metaCoords ? metaCoords.innerText : "50°06'N 8°40'E", bgWord: 'VISION' };
        // Слово для фонового "ватермарка" при наведении/клике на категорию.
        // Раньше было жёстко прибито к 4 конкретным id категорий из
        // старой статичной вёрстки — с реальными категориями из БД (id вида
        // "preview-atmosfera-a1b2c3") эти ключи никогда бы не совпали.
        // Теперь просто читаем data-bg-word прямо с HTML-пункта меню.
        const THEME_WORDS = {};
        showcaseItems.forEach(item => {
            if (item.dataset.bgWord) THEME_WORDS[item.dataset.target] = item.dataset.bgWord;
        });

        // ColorThief — своя копия (static/js/vendor, см. базовый шаблон); если
        // файл всё же не загрузится (не залит, ошибка сети и т.п.), скрипт там
        // просто не подключится и window.ColorThief останется undefined.
        // new ColorThief() в этом случае бросает исключение прямо здесь,
        // ДО инициализации всего, что ниже по файлу (бургер уже успел бы
        // отработать, а вот переключатель камеры, галерея и т.д. — нет,
        // потому что это всё синхронный код одного и того же обработчика
        // DOMContentLoaded). Оборачиваем в try/catch и просто отключаем
        // "живое" вычисление акцентного цвета, если библиотеки нет —
        // для фото с готовым color_hex в БД это в любом случае не нужно
        // (см. extractAndSetColor ниже), а для остальных сайт продолжит
        // работать, просто без динамической подсветки фона под них.
        let colorThief = null;
        try {
            colorThief = new ColorThief();
        } catch (e) {
            console.warn('ColorThief недоступен (не загрузился static/js/vendor/color-thief.umd.js) — акцентный цвет из фото работать не будет:', e);
        }
        const root = document.documentElement;

        // LIGHT_SURFACE_THRESHOLD и getVisibleRegionLuminance теперь общие —
        // см. секцию "1.5 УТИЛИТА: ЯРКОСТЬ УЧАСТКА ФОТО" в начале файла
        // (нужны были и карточкам галереи в секции 6, а этот блок целиком
        // пропускается на странице /gallery, там нет .showcase-display).

        // heroPhotoIsLight — светлый ли участок под шапкой у ТЕКУЩЕГО фото
        // в хиро, само по себе, без учёта скролла (обновляется в
        // extractAndSetColor при каждой смене фото/состояния). А фактически
        // применяет её (класс header-on-light-photo на body) — вот эта
        // функция, и только пока мы ещё в пределах героя (< одного экрана
        // высоты): шапка на мобильной ширине прозрачная и лежит на фото
        // только там. Стоит проскроллить ниже — под фиксированными
        // бургером/шестерёнкой уже обычный фон страницы (var(--base-bg)),
        // а не фото, и фото-адаптация там неуместна: например, светлое
        // фото в хиро включило бы тёмный текст, а ниже героя, на тёмном
        // фоне страницы, этот текст просто пропал бы.
        let heroPhotoIsLight = false;
        const applyHeaderPhotoAdaptation = () => {
            const withinHero = window.scrollY < window.innerHeight;
            document.body.classList.toggle('header-on-light-photo', withinHero && heroPhotoIsLight);
        };
        window.addEventListener('scroll', () => requestAnimationFrame(applyHeaderPhotoAdaptation), { passive: true });

        const extractAndSetColor = (img) => {
            try {
                if (img.complete) {
                    // Цвет фона уже посчитан один раз в админке при загрузке
                    // фото (ColorThief там же, см. static/js/admin.js) и лежит
                    // в БД (directions.color_hex / photo_album.color_hex).
                    // Раньше сайт игнорировал готовое значение и на каждом
                    // визите каждого посетителя гонял ColorThief заново —
                    // теперь сначала смотрим на data-color-hex, а сам расчёт
                    // оставляем только как запасной вариант (например, для
                    // аватара — под него отдельного поля в БД пока нет).
                    const presetHex = img.dataset.colorHex;
                    if (presetHex) {
                        root.style.setProperty('--dynamic-bg', `color-mix(in srgb, ${presetHex} 18%, var(--base-bg))`);
                    } else if (colorThief) {
                        const [r, g, b] = colorThief.getColor(img);
                        root.style.setProperty('--dynamic-bg', `color-mix(in srgb, rgb(${r}, ${g}, ${b}) 18%, var(--base-bg))`);
                    }

                    const topLuminance = getVisibleRegionLuminance(img, 0, 0, 30, 25);
                    showcaseDisplay.classList.toggle('is-light-top', topLuminance > LIGHT_SURFACE_THRESHOLD);
                    // То же самое измерение (верхний левый угол фото) решает
                    // и цвет лого в шапке — на главной (мобильная ширина)
                    // шапка прозрачная и лежит прямо на этом же фото (см.
                    // .header-on-light-photo .logo/.logo-subtitle в
                    // мобильном медиа-запросе style.css). Класс — на body,
                    // а не на .showcase-display, потому что сама шапка вне
                    // него в разметке (см. base.html). Само наложение
                    // класса — через applyHeaderPhotoAdaptation() ниже, а
                    // не напрямую: он же следит, что мы ещё не проскроллили
                    // ниже героя (см. её коммент).
                    heroPhotoIsLight = topLuminance > LIGHT_SURFACE_THRESHOLD;
                    applyHeaderPhotoAdaptation();

                    const bottomLuminance = getVisibleRegionLuminance(img, 0, 65, 50, 35);
                    showcaseDisplay.classList.toggle('is-light-bottom', bottomLuminance > LIGHT_SURFACE_THRESHOLD);

                    buildCursorLuminanceGrid(img); // та же смена фото — обновляем карту для курсора
                } else {
                    img.addEventListener('load', () => extractAndSetColor(img), { once: true });
                }
            } catch (e) {
                console.warn("Цвет не извлечен (Открой через Live Server!):", e);
            }
        };

        const switchBgWord = (word) => {
            if (!bgTypo || bgTypo.textContent === word) return;
            bgTypo.classList.add('is-switching');
            setTimeout(() => {
                bgTypo.textContent = word;
                bgTypo.classList.remove('is-switching');
            }, 260);
        };

        const showState = (stateId) => {
            showcaseItems.forEach(el => el.classList.toggle('is-selected', el.dataset.target === stateId));
            displayContents.forEach(content => content.classList.toggle('active', content.id === stateId));
            heroDotEls.forEach((dot, i) => dot.classList.toggle('is-active', heroSlideIds[i] === stateId));
            heroIndex = Math.max(0, heroSlideIds.indexOf(stateId));

            const mediaId = 'media-' + stateId;
            mediaLayers.forEach(layer => layer.classList.toggle('active', layer.id === mediaId));

            const mediaEl = document.getElementById(mediaId);
            if (mediaEl && mediaEl.tagName === 'IMG') {
                extractAndSetColor(mediaEl);
            } else {
                root.style.setProperty('--dynamic-bg', 'var(--base-bg)');
                if (showcaseDisplay) showcaseDisplay.classList.remove('is-light-top', 'is-light-bottom');
                heroPhotoIsLight = false;
                document.body.classList.remove('header-on-light-photo');
                cursorLuminanceGrid = null;
                if (vfFocus) vfFocus.classList.remove('is-on-light', 'is-over-photo');
            }

            switchBgWord(THEME_WORDS[stateId] || DEFAULTS.bgWord);

            if (stateId !== 'state-default') {
                showcaseDisplay.classList.add('has-selection');
            } else {
                showcaseDisplay.classList.remove('has-selection');
            }
        };

        const resetToManifesto = (e) => {
            if (e) e.preventDefault();
            showState('state-default');
        };

        if (backBtn) backBtn.addEventListener('click', resetToManifesto);
        if (logoLink) logoLink.addEventListener('click', resetToManifesto);
        const homeLink = document.querySelector('.nav__link.active');
        if (homeLink && homeLink.getAttribute('href') === '#') homeLink.addEventListener('click', resetToManifesto);

        showcaseItems.forEach(item => {
            item.addEventListener('mouseenter', () => {
            if (vfFocus) vfFocus.classList.add('focused');
        });
        item.addEventListener('mouseleave', () => {
            if (vfFocus) vfFocus.classList.remove('focused');
        });

            item.addEventListener('click', (e) => {
                // Этот список теперь виден только на десктопе — на мобильной
                // ширине он скрыт (см. .showcase-menu в style.css), категории
                // там листаются свайпом прямо по фото в хиро (ниже). Так что
                // тут снова простая логика "показать превью", без оглядки на
                // ширину экрана — на мобилке до этого клика просто не дойдёт.
                e.preventDefault();
                showState(item.getAttribute('data-target'));
            });
        });

        // Без этого сетка яркости (и для курсора, и для кнопок) строилась бы
        // только после первого клика по категории — стартовое фото так и
        // осталось бы "неадаптированным" до первого взаимодействия.
        showState('state-default');

        // === АВТОПРОЛИСТЫВАНИЕ (только мобильная ширина) ===
        // Категории листаются сами по кругу (после последней — снова стартовый
        // кадр), неспешно: AUTOPLAY_STEP_MS на кадр (владелец попросил медленнее
        // и зациклить). Человек листает сам (свайп или тап по точке) — пауза,
        // через AUTOPLAY_RESUME_MS без касаний листание продолжается. Пока
        // героя не видно (проскроллили ниже) или вкладка свёрнута — ждёт.
        const AUTOPLAY_STEP_MS = 4500;
        const AUTOPLAY_RESUME_MS = 9000;
        let autoplayTimer = null;
        let heroOnScreen = true;
        const autoplayOn = window.innerWidth <= 768 && heroSlideIds.length > 1;
        const scheduleAutoplay = (ms) => {
            if (!autoplayOn) return;
            clearTimeout(autoplayTimer);
            autoplayTimer = setTimeout(() => {
                if (!heroOnScreen || document.hidden) { scheduleAutoplay(1500); return; }
                showState(heroSlideIds[(heroIndex + 1) % heroSlideIds.length]);
                scheduleAutoplay(AUTOPLAY_STEP_MS);
            }, ms);
        };
        // Вызывается при любом листании рукой
        const stopAutoplay = () => scheduleAutoplay(AUTOPLAY_RESUME_MS);
        if (autoplayOn) {
            new IntersectionObserver(entries => entries.forEach(entry => { heroOnScreen = entry.isIntersecting; }),
                { threshold: 0.3 }).observe(showcaseDisplay);
            scheduleAutoplay(AUTOPLAY_STEP_MS);
        }

        // Тап по точке — сразу к этому слайду (и выключает демо-автопролистывание).
        heroDotEls.forEach((dot, i) => {
            dot.addEventListener('click', () => {
                stopAutoplay();
                showState(heroSlideIds[i]);
            });
        });

        // Свайп по фото — мобильная замена текстового меню (то же самое,
        // только жестом). Только тач: на десктопе меню и так рядом с фото,
        // жест там не нужен и мышь его не даёт "случайно" зацепить.
        if (heroSlideIds.length > 1) {
            let touchStartX = 0, touchStartY = 0, touchActive = false, isHorizontalSwipe = false;
            const SWIPE_THRESHOLD = 40; // px — короче считаем случайным дрожанием пальца

            showcaseDisplay.addEventListener('touchstart', (e) => {
                if (e.touches.length !== 1) return;
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                touchActive = true;
                isHorizontalSwipe = false;
            }, { passive: true });

            showcaseDisplay.addEventListener('touchmove', (e) => {
                if (!touchActive) return;
                const dx = e.touches[0].clientX - touchStartX;
                const dy = e.touches[0].clientY - touchStartY;
                // Решаем один раз за жест: как только сдвиг по X заметно
                // обгоняет сдвиг по Y — это свайп по категориям, а не скролл.
                if (!isHorizontalSwipe && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
                    isHorizontalSwipe = true;
                    stopAutoplay(); // человек сам взялся листать — демо больше не нужно
                }
                // preventDefault зовём, только когда уже уверены, что жест
                // горизонтальный — иначе браузер (touch-action: pan-y в
                // style.css) сам ведёт вертикальный скролл, мы в него не
                // вмешиваемся вообще, ни на один кадр.
                if (isHorizontalSwipe) e.preventDefault();
            }, { passive: false });

            const finishTouch = (e) => {
                if (!touchActive) return;
                touchActive = false;
                if (!isHorizontalSwipe) return; // это был обычный вертикальный скролл

                const endX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : touchStartX;
                const dx = endX - touchStartX;
                if (Math.abs(dx) < SWIPE_THRESHOLD) return;

                // влево — следующая категория; по кругу, как и автолистание
                const len = heroSlideIds.length;
                showState(heroSlideIds[(heroIndex + (dx < 0 ? 1 : -1) + len) % len]);
            };

            showcaseDisplay.addEventListener('touchend', finishTouch);
            showcaseDisplay.addEventListener('touchcancel', () => { touchActive = false; });
        }
    }

    // === 4. СЛАЙДЕРЫ ДО/ПОСЛЕ (Ретушь) ===
    document.querySelectorAll('[data-compare]').forEach((el) => {
        const frame = el.querySelector('.compare__frame');
        if (!frame) return;
        let dragging = false;

        const setPos = (clientX) => {
            const rect = frame.getBoundingClientRect();
            const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
            frame.style.setProperty('--pos', pct + '%');
        };

        frame.addEventListener('pointerdown', (e) => {
            // На тач-устройствах начинаем перетаскивание, только если
            // коснулись именно шарика — иначе любой тап по всему кадру
            // "до/после" захватывал жест и не давал прокрутить страницу
            // мимо него. На мыши/пере (десктоп, конфликта со скроллом
            // нет) по-прежнему можно хватать в любом месте кадра.
            if (e.pointerType === 'touch' && !e.target.closest('.compare__handle-grip')) return;

            dragging = true;
            frame.setPointerCapture(e.pointerId);
            setPos(e.clientX);
        });
        frame.addEventListener('pointermove', (e) => {
            if (dragging) setPos(e.clientX);
        });
        frame.addEventListener('pointerup', () => { dragging = false; });
        frame.addEventListener('pointercancel', () => { dragging = false; });
    });

    // === 5. КАМЕРА: ДИАФРАГМА / ISO / БАЛАНС БЕЛОГО ===
    // Настройки диалов должны быть одинаковыми на любой странице и не
    // сбрасываться при переходе/обновлении — храним индекс каждого диала
    // в localStorage. head-скрипт в каждом html (см. <head>) уже применяет
    // сохранённую тему ДО отрисовки, здесь же читаем то же самое хранилище,
    // чтобы инициализировать все три диска синхронно с тем, что видно на экране.
    const VF_STORAGE_KEY = 'grigorievVF';
    const loadVFSettings = () => {
        try {
            return JSON.parse(localStorage.getItem(VF_STORAGE_KEY)) || {};
        } catch (e) {
            return {};
        }
    };
    const saveVFSetting = (key, index) => {
        try {
            const current = loadVFSettings();
            current[key] = index;
            localStorage.setItem(VF_STORAGE_KEY, JSON.stringify(current));
        } catch (e) {
            // localStorage недоступен (приватный режим и т.п.) — просто не сохраняем,
            // диски всё равно останутся рабочими в пределах текущей страницы
        }
    };
    const savedVF = loadVFSettings();

    const CAMERA_DIALS = {
        aperture: {
            el: document.getElementById('meta-aperture'),
            steps: [
                { label: 'F/1.2', theme: 'light' },
                { label: 'F/8',   theme: 'gray'  },
                { label: 'F/16',  theme: 'dark'  },
            ],
            index: typeof savedVF.aperture === 'number' ? savedVF.aperture : 2, // 2 = F/16 = тёмная тема по умолчанию, если ничего не сохранено
            apply(step) { document.documentElement.dataset.theme = step.theme; },
        },
        iso: {
            el: document.getElementById('meta-iso'),
            steps: [
                { label: 'ISO 100',  opacity: 0.02, size: '150px' },
                { label: 'ISO 1600', opacity: 0.06, size: '180px' },
                { label: 'ISO 3200', opacity: 0.10, size: '220px' },
                { label: 'ISO 6400', opacity: 0.16, size: '260px' },
            ],
            index: typeof savedVF.iso === 'number' ? savedVF.iso : 0,
            apply(step) {
                const grain = document.querySelector('.grain-overlay');
                if (!grain) return;
                grain.style.opacity = step.opacity;
                grain.style.backgroundSize = `${step.size}, cover`;
            },
        },
        temp: {
            el: document.getElementById('meta-temp'),
            steps: [
                { label: '3200K', value: '3200' },
                { label: '5600K', value: '5600' },
                { label: '7000K', value: '7000' },
            ],
            index: typeof savedVF.temp === 'number' ? savedVF.temp : 1, // 1 = 5600K = без фильтра по умолчанию
            apply(step) {
                const overlay = document.getElementById('temp-overlay');
                if (overlay) overlay.dataset.temp = step.value;
            },
        },
    };

    Object.entries(CAMERA_DIALS).forEach(([key, dial]) => {
        if (!dial.el) return;
        // На всякий случай подчищаем сохранённый индекс, если он вдруг не
        // укладывается в текущее число шагов (например, если шаги поменяются)
        if (dial.index < 0 || dial.index >= dial.steps.length) dial.index = 0;
        // Значение пишем в отдельный вложенный span (.vf-island__value), а
        // не в textContent самой кнопки — иначе затёрли бы иконку рядом
        // (она добавлена как реальный DOM-узел <svg>, а не через CSS, и
        // textContent = "..." снёс бы её вместе со старым текстом).
        // Если span почему-то не найден (старая разметка без иконок) —
        // используем саму кнопку, как раньше.
        const valueEl = dial.el.querySelector('.vf-island__value') || dial.el;
        const render = () => {
            const step = dial.steps[dial.index];
            valueEl.textContent = step.label;
            dial.apply(step);
        };
        render(); // применяем стартовое (сохранённое или дефолтное) значение сразу, не дожидаясь клика
        dial.el.addEventListener('click', () => {
            dial.index = (dial.index + 1) % dial.steps.length;
            render();
            saveVFSetting(key, dial.index); // запоминаем — переживёт переход на другую страницу и обновление
        });
    });

    // === 5.5. ШЕСТЕРЁНКА + СВОРАЧИВАНИЕ КАРТОЧКИ С ДАННЫМИ КАМЕРЫ ===
    // Две кнопки-переключателя на одну и ту же карточку: #vf-toggle —
    // обычная, внутри .header-left (десктоп), #vf-toggle-mobile — её клон
    // рядом с бургером для мобильной ширины (см. base.html/style.css,
    // почему это отдельный DOM-элемент, а не просто переставленный CSS'ом).
    // Обе слушают клик и держатся в синхронном состоянии.
    const vfToggles = [document.getElementById('vf-toggle'), document.getElementById('vf-toggle-mobile')].filter(Boolean);
    const vfIsland = document.getElementById('vf-island');
    const vfIslandCollapse = document.getElementById('vf-island-collapse');
    const vfIslandPill = vfIsland ? vfIsland.querySelector('.vf-island__pill') : null;

    if (vfToggles.length && vfIsland) {
        const setIslandOpen = (open) => {
            vfIsland.classList.toggle('is-collapsed', !open);
            vfToggles.forEach(btn => {
                btn.classList.toggle('is-active', open);
                btn.setAttribute('aria-expanded', String(open));
            });
            // .is-collapsed в CSS прячет карточку только через opacity/
            // pointer-events — этого достаточно для мыши и тача, но кнопки
            // (ISO/диафрагма/температура) внутри оставались фокусируемыми
            // с клавиатуры (Tab) и доступными скринридеру, даже невидимые.
            // inert одним атрибутом убирает содержимое из таб-порядка и из
            // accessibility-дерева, пока карточка свёрнута.
            if (vfIslandPill) {
                if (open) vfIslandPill.removeAttribute('inert');
                else vfIslandPill.setAttribute('inert', '');
            }
        };

        // manualOverride — как только пользователь САМ кликнул по шестерёнке
        // или стрелке (в любую сторону), скролл больше вообще не трогает
        // карточку — дальше только руками. До этого момента её сворачивает
        // скролл (см. applyScrollCollapse ниже).
        let manualOverride = false;

        // Шестерёнка — переключатель: открыто → закрыть, закрыто → открыть.
        // Новое состояние запоминаем в том же localStorage, что и диски
        // камеры (ключ 'islandOpen' внутри VF_STORAGE_KEY) — переживёт
        // переход на другую страницу и обновление.
        vfToggles.forEach(btn => {
            btn.addEventListener('click', () => {
                const open = vfIsland.classList.contains('is-collapsed');
                setIslandOpen(open);
                saveVFSetting('islandOpen', open);
                manualOverride = true;
            });
        });

        // Стрелка внутри самой карточки — только закрывает
        if (vfIslandCollapse) {
            vfIslandCollapse.addEventListener('click', () => {
                setIslandOpen(false);
                saveVFSetting('islandOpen', false);
                manualOverride = true;
            });
        }

        // Разворачиваем автоматически только при самом первом визите (когда
        // в сохранённых настройках ещё нет islandOpen) — дальше карточка
        // остаётся такой, какой её оставил пользователь. До этого момента
        // <head>-скрипт (см. base.html) уже мог повесить на <html> класс
        // vf-island-precollapsed, чтобы не мелькнуть развёрнутой картой на
        // долю секунды раньше, чем отработает этот скрипт — снимаем его,
        // дальше состоянием управляет .is-collapsed на самой карточке.
        const initialOpen = typeof savedVF.islandOpen === 'boolean' ? savedVF.islandOpen : true;
        setIslandOpen(initialOpen);
        document.documentElement.classList.remove('vf-island-precollapsed');

        // Карточка — position:fixed и сама по себе не знает, какой высоты
        // сейчас шапка (.header), поэтому меряем её реально и кладём в
        // CSS-переменную (--header-h в style.css, у .vf-island: top: calc(...)).
        // Так она переживёт перенос лого на 2 строки на узких экранах и любые
        // случайные различия в px между браузерами/шрифтами — вместо того,
        // чтобы гадать точное число пикселей.
        const headerEl = document.querySelector('.header');
        const updateHeaderHeight = () => {
            if (headerEl) {
                document.documentElement.style.setProperty('--header-h', `${headerEl.offsetHeight}px`);
            }
        };
        updateHeaderHeight();
        window.addEventListener('resize', updateHeaderHeight);

        // Карточка теперь position:fixed (см. коммент у .vf-island в
        // style.css) — держится на экране при скролле так же, как бургер,
        // а не уезжает вместе со страницей. Но в отличие от бургера (три
        // тонкие линии в углу) карточка большая и на мобильной раскладке
        // (вертикальный список из 4 строк) перекрывала бы заголовки и текст
        // ЛЮБОЙ страницы при скролле вниз, если бы просто вечно висела на
        // месте. Поэтому сама сворачивается, как только уезжаем от самого
        // верха страницы.
        //
        // ВАЖНО: скролл только СВОРАЧИВАЕТ, обратно НЕ разворачивает —
        // раньше при возврате наверх карточка сама открывалась заново, и
        // это была не только несостыковка с ручным закрытием (это уже
        // чинили), а более общий баг: пользователь воспринимает "свернулось
        // от скролла" точно так же, как "я его скрыл", и ждёт, что оно
        // останется скрытым, а не вылезет само на полпути обратно наверх.
        // Так что дальше это односторонний рубильник: увидеть карточку
        // снова можно только кликом по шестерёнке/стрелке (см. выше) —
        // и с этого момента, ЛЮБОГО клика, скролл вообще перестаёт что-либо
        // менять (manualOverride), просто чтобы после явного открытия
        // руками её тут же не свернуло следующим тиком скролла, если
        // пользователь всё ещё не наверху.
        let scrollCollapseQueued = false;
        const SCROLL_COLLAPSE_AT = 80; // px до срабатывания — небольшой запас, чтобы не дёргалось на микро-скролле (инерция тача, bounce на iOS)
        const applyScrollCollapse = () => {
            scrollCollapseQueued = false;
            if (manualOverride) return;
            if (window.scrollY > SCROLL_COLLAPSE_AT && !vfIsland.classList.contains('is-collapsed')) {
                // Полноценное закрытие — как по клику: сохраняем в
                // localStorage и дальше передаём управление целиком ручным
                // переключателям (manualOverride), а не только на эту
                // страницу/сессию. Раньше скролл прятал карточку только
                // "на посмотреть", без сохранения — стоило перейти на
                // другую страницу или обновить, и она снова открывалась,
                // хотя пользователь её явно скрыл.
                setIslandOpen(false);
                saveVFSetting('islandOpen', false);
                manualOverride = true;
            }
        };
        window.addEventListener('scroll', () => {
            if (!scrollCollapseQueued) {
                scrollCollapseQueued = true;
                requestAnimationFrame(applyScrollCollapse);
            }
        }, { passive: true });
        applyScrollCollapse(); // на случай если страницу открыли не с самого верха (якорь в URL, восстановление скролла браузером)

        // Лёгкое "плавание" карточки при движении мыши — по всей странице,
        // не только при наведении на саму карточку. На тач-устройствах курсора
        // нет, поэтому только для мыши/трекпада. Сдвиг совсем небольшой
        // (±8px по X, ±5px по Y) и сглажен CSS-transition в style.css —
        // получается плавный дрейф, а не дёрганое слежение 1:1 за курсором.
        if (!isTouchDevice) {
            const FLOAT_MAX_X = 8;
            const FLOAT_MAX_Y = 5;
            let floatQueued = false;
            let lastClientX = window.innerWidth / 2;
            let lastClientY = window.innerHeight / 2;

            const applyFloat = () => {
                floatQueued = false;
                const nx = (lastClientX / window.innerWidth) * 2 - 1;   // -1..1, слева/сверху отрицательный
                const ny = (lastClientY / window.innerHeight) * 2 - 1;
                vfIsland.style.setProperty('--vf-float-x', `${(nx * FLOAT_MAX_X).toFixed(2)}px`);
                vfIsland.style.setProperty('--vf-float-y', `${(ny * FLOAT_MAX_Y).toFixed(2)}px`);
            };

            window.addEventListener('mousemove', (e) => {
                lastClientX = e.clientX;
                lastClientY = e.clientY;
                if (floatQueued) return; // rAF-гейт — считаем максимум раз за кадр
                floatQueued = true;
                requestAnimationFrame(applyFloat);
            }, { passive: true });
        }
    }

    // === 3.5 ГЕРОЙ АЛЬБОМА: адаптация шапки и "Назад в галерею" под фото ===
    // Тот же принцип, что и "Хамелеон" на главной (см. секцию 3 выше —
    // applyHeaderPhotoAdaptation/heroPhotoIsLight), но сильно проще: фото
    // здесь одно и не меняется по клику, поэтому ColorThief не нужен —
    // только определяем, светлый или тёмный верхний левый угол под шапкой
    // (getVisibleRegionLuminance/LIGHT_SURFACE_THRESHOLD — общие утилиты,
    // см. секцию 1.5 в начале файла). На странице альбома этой секции
    // раньше не было вообще — шапка/бургер/шестерёнка/кнопка "Назад"
    // красились фиксированными цветами темы, что на светлой обложке
    // читалось бы плохо. Класс header-on-light-photo — тот же самый, что
    // у главной (см. body.home-page.header-on-light-photo в style.css) —
    // только тут ещё есть body.album-page.header-on-light-photo (см. там
    // же) для шапки и .back-to-gallery (album.css).
    const albumHeroImg = document.querySelector('.album-hero__bg img');
    if (albumHeroImg) {
        let albumHeroIsLight = false;
        const applyAlbumHeroAdaptation = () => {
            const withinHero = window.scrollY < window.innerHeight;
            document.body.classList.toggle('header-on-light-photo', withinHero && albumHeroIsLight);
        };
        const measureAlbumHero = () => {
            const topLuminance = getVisibleRegionLuminance(albumHeroImg, 0, 0, 40, 20);
            albumHeroIsLight = topLuminance > LIGHT_SURFACE_THRESHOLD;
            applyAlbumHeroAdaptation();
        };
        if (albumHeroImg.complete) measureAlbumHero();
        else albumHeroImg.addEventListener('load', measureAlbumHero, { once: true });
        window.addEventListener('scroll', () => requestAnimationFrame(applyAlbumHeroAdaptation), { passive: true });
    }

    // === 6. ЛОГИКА ГАЛЕРЕИ (ФИЛЬТРАЦИЯ И ХАМЕЛЕОН) ===
    const filterBtns = document.querySelectorAll('.filter-btn');
    const galleryCards = document.querySelectorAll('.gallery-card');
    
    if (filterBtns.length > 0 && galleryCards.length > 0) {
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const filterValue = btn.getAttribute('data-filter');

                // Рамку фокуса на активную кнопку ставит скрипт в gallery.html
                filterBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-filter') === filterValue));

                galleryCards.forEach(card => {
                    const category = card.getAttribute('data-category');
                    if (filterValue === 'all' || filterValue === category) {
                        card.classList.remove('hidden');
                        setTimeout(() => card.classList.add('is-visible'), 50);
                    } else {
                        card.classList.remove('is-visible');
                        card.classList.add('hidden');
                    }
                });
            });
        });

        // Та же защита, что и в секции 3 (хиро на главной) — если внешний
        // скрипт ColorThief не подключился, new ColorThief() бросает
        // исключение и вся секция 6, а с ней и всё, что идёт в файле
        // ПОСЛЕ неё, просто не инициализируется. Оборачиваем в try/catch;
        // ниже (в _applyTint) уже есть свой try/catch на сам вызов
        // .getColor(), сюда просто добавляется проверка colorThiefGallery
        // перед обращением к нему.
        let colorThiefGallery = null;
        try {
            colorThiefGallery = new ColorThief();
        } catch (e) {
            console.warn('ColorThief недоступен (не загрузился static/js/vendor/color-thief.umd.js) — акцентный цвет карточек галереи работать не будет:', e);
        }
        const root = document.documentElement;
        
        galleryCards.forEach(card => {
            const img = card.querySelector('img');
            const presetHex = card.dataset.colorHex;

            // Тег категории (верхний левый угол) — единственный текст на
            // карточке, который вообще ничем не прикрыт снизу (у .card-overlay
            // градиент вверху уходит в transparent), поэтому его читаемость
            // целиком зависит от того, светлый там кусок фото или тёмный.
            // Меряем яркость именно этого угла (та же техника, что и у
            // героя на главной — getVisibleRegionLuminance) и переключаем
            // ТОЛЬКО цвет текста через класс is-light-top — само "стекло"
            // тега остаётся тем же полупрозрачным блюром при любом фото
            // (см. .card-tag / .gallery-card.is-light-top в gallery.css).
            const applyTagContrast = () => {
                const topLuminance = getVisibleRegionLuminance(img, 0, 0, 40, 22);
                card.classList.toggle('is-light-top', topLuminance > LIGHT_SURFACE_THRESHOLD);
            };
            if (img.complete) applyTagContrast();
            else img.addEventListener('load', applyTagContrast, { once: true });

            // Заливка фона акцентным цветом фото — общая функция: на
            // десктопе её вызывает mouseenter, на тач-устройствах (см.
            // ниже) — сам скролл, когда карточка доезжает до центра экрана.
            // Вешаем прямо на элемент карточки, чтобы IntersectionObserver
            // ниже мог её переиспользовать, а не пересчитывать всё заново.
            card._applyTint = () => {
                try {
                    // Тот же принцип, что и на главной: сначала готовый
                    // photo_album.color_hex из БД, живой ColorThief — только
                    // как запасной вариант.
                    if (presetHex) {
                        root.style.setProperty('--dynamic-bg', `color-mix(in srgb, ${presetHex} 12%, var(--base-bg))`);
                    } else if (colorThiefGallery && img.complete) {
                        const [r, g, b] = colorThiefGallery.getColor(img);
                        root.style.setProperty('--dynamic-bg', `color-mix(in srgb, rgb(${r}, ${g}, ${b}) 12%, var(--base-bg))`);
                    }
                } catch (e) {}
            };

            card.addEventListener('mouseenter', card._applyTint);
            card.addEventListener('mouseleave', () => {
                root.style.setProperty('--dynamic-bg', 'var(--base-bg)');
            });
        });

        // На тач-устройствах карточки идут одной колонкой и навести мышью
        // на них попросту нечем — эффект "наведения" (подсветка фона,
        // яркость фото) вместо этого включается у той карточки, что сейчас
        // доехала до центра экрана при скролле. Смотрим не только на тип
        // устройства, но и на саму раскладку (≤600px, см. gallery.css) —
        // на широком тач-экране (планшет) в ряд идёт несколько карточек
        // сразу, и полоска по центру экрана задевала бы их все одновременно.
        if (isTouchDevice && window.matchMedia('(max-width: 600px)').matches) {
            const centerObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    entry.target.classList.toggle('is-focused', entry.isIntersecting);
                    if (entry.isIntersecting) entry.target._applyTint();
                });
                // Между карточками (пока следующая ещё не доехала до центра)
                // ни одна не в фокусе — гасим подсветку, как при mouseleave.
                if (!document.querySelector('.gallery-card.is-focused')) {
                    root.style.setProperty('--dynamic-bg', 'var(--base-bg)');
                }
            }, { rootMargin: '-42% 0px -42% 0px', threshold: 0 });

            galleryCards.forEach(card => centerObserver.observe(card));
        }

        const revealElements = document.querySelectorAll('.reveal-up');
        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !entry.target.classList.contains('hidden')) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target); 
                }
            });
        }, { root: null, threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

        revealElements.forEach(el => revealObserver.observe(el));
    }


    // === НАГРАДЫ («Обо мне», «Стопка») ===
    // Дипломы лежат стопкой: сверху текущий, остальные уходят назад со
    // смещением и наклоном. Нажатие на верхний — открыть крупно, на другой —
    // сделать текущим. Стрелки, свайп на телефоне. Текст текущей награды —
    // .aw-slide с тем же data-index (остальные hidden).
    const awardsBox = document.getElementById('awards');
    if (awardsBox) {
        const cards = Array.from(awardsBox.querySelectorAll('.aw-card'));
        const slides = Array.from(awardsBox.querySelectorAll('.aw-slide'));
        const counter = awardsBox.querySelector('.aw-count');
        const viewer = document.getElementById('aw-viewer');
        const n = cards.length;
        let current = 0;

        const renderAwards = () => {
            cards.forEach((card, i) => {
                const k = (i - current + n) % n;   // 0 — верхний
                card.style.zIndex = n - k;
                card.style.transform = `translate(${k * 22}px, ${k * -10}px) rotate(${k ? (k % 2 ? 4 : -3) * Math.min(k, 2) : 0}deg) scale(${1 - k * 0.05})`;
                card.style.opacity = k > 3 ? 0 : 1;
                card.classList.toggle('is-top', k === 0);
                const title = slides[i] ? slides[i].querySelector('.aw-title').textContent : '';
                card.setAttribute('aria-label', k === 0 ? `Открыть диплом «${title}» крупно` : `Показать «${title}»`);
            });
            slides.forEach((slide, i) => { slide.hidden = i !== current; });
            if (counter) counter.textContent = `${current + 1} / ${n}`;
        };
        const step = (d) => { current = (current + d + n) % n; renderAwards(); };

        const openViewer = (i) => {
            const full = cards[i].dataset.full;
            if (!viewer || !full) return;
            viewer.querySelector('img').src = full;
            viewer.querySelector('img').alt = slides[i].querySelector('.aw-title').textContent;
            // Подпись — год, название и ссылка из текста награды
            const cap = viewer.querySelector('.aw-viewer-cap');
            cap.innerHTML = '';
            slides[i].querySelectorAll('.aw-year, .aw-title, .aw-link').forEach(el => cap.appendChild(el.cloneNode(true)));
            viewer.classList.add('is-open');
            document.body.style.overflow = 'hidden';
        };
        const closeViewer = () => {
            viewer.classList.remove('is-open');
            document.body.style.overflow = '';
        };

        cards.forEach((card, i) => card.addEventListener('click', () => {
            if (i === current) openViewer(i);
            else { current = i; renderAwards(); }
        }));
        awardsBox.querySelectorAll('.aw-nav [data-step]').forEach(btn => {
            btn.addEventListener('click', () => step(Number(btn.dataset.step)));
        });
        if (viewer) {
            // Окно — прямо в body: внутри .about-page (у неё z-index: 10, свой слой)
            // даже огромный z-index не поднимал его над бургером и кнопками шапки.
            document.body.appendChild(viewer);
            viewer.addEventListener('click', (e) => {
                if (e.target === viewer || e.target.closest('.aw-viewer-close')) closeViewer();
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && viewer.classList.contains('is-open')) closeViewer();
            });
        }
        // Свайп по стопке на телефоне
        const stack = awardsBox.querySelector('.aw-stack');
        let touchX = null;
        stack.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
        stack.addEventListener('touchend', (e) => {
            if (touchX === null) return;
            const dx = e.changedTouches[0].clientX - touchX;
            touchX = null;
            if (Math.abs(dx) > 40 && n > 1) step(dx < 0 ? 1 : -1);
        });
        renderAwards();
    }
});
// === COOKIE-БАННЕР ===
// Разметка — base.html (#cookie-banner, по умолчанию hidden), стили —
// style.css. Показываем, пока человек не нажал "Продолжить"; нажатие
// запоминаем в localStorage (ключ grigorievCookieOk). Отдельный
// DOMContentLoaded, а не внутри большого выше — чтобы ошибка в любой
// другой секции не оставила сайт без уведомления.
document.addEventListener('DOMContentLoaded', () => {
    const banner = document.getElementById('cookie-banner');
    const okBtn = document.getElementById('cookie-banner-ok');
    if (!banner || !okBtn) return;

    const STORAGE_KEY = 'grigorievCookieOk';
    try {
        if (localStorage.getItem(STORAGE_KEY) === '1') return;
    } catch (e) {
        // localStorage недоступен — просто показываем баннер каждый раз
    }

    // На главной при первом заходе идёт заставка-прелоадер (~4 с, см.
    // секцию 0) — баннер поверх неё смотрелся бы чужеродно, ждём её конца.
    const delay = document.getElementById('preloader') ? 4300 : 800;
    setTimeout(() => {
        banner.hidden = false;
        void banner.offsetWidth; // фиксируем стартовое состояние, иначе transition не сыграет
        banner.classList.add('is-visible');
    }, delay);

    okBtn.addEventListener('click', () => {
        try {
            localStorage.setItem(STORAGE_KEY, '1');
        } catch (e) {
            // не сохранилось — значит, покажем снова при следующем заходе
        }
        banner.classList.remove('is-visible');
        setTimeout(() => { banner.hidden = true; }, 500);
    });
});

// === АРСЕНАЛ ("Обо мне": камера + шкала фокусных) ===
// Разметка и стили — about.html / about.css (.gear-*).
// ПК: наведение на подпись объектива подсвечивает его метку на линейке.
// Телефон: объектив, доехавший до середины экрана, проявляется, и его
// метка на липкой вертикальной линейке загорается. Без скрипта всё просто
// видно сразу (притухание включается классом .is-live).
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-gear-scale]').forEach(scale => {
        scale.querySelectorAll('.gear-label').forEach(label => {
            const mark = scale.querySelector(`.gear-mark[data-i="${label.dataset.i}"]`);
            label.addEventListener('mouseenter', () => {
                scale.classList.add('has-hover');
                if (mark) mark.classList.add('is-on');
            });
            label.addEventListener('mouseleave', () => {
                scale.classList.remove('has-hover');
                if (mark) mark.classList.remove('is-on');
            });
        });
    });

    document.querySelectorAll('[data-gear-vr]').forEach(vr => {
        if (!('IntersectionObserver' in window)) return;
        const cards = vr.querySelectorAll('.gear-vr__card');
        const marks = vr.querySelectorAll('.gear-vr__mark');
        vr.classList.add('is-live');
        // "В центре экрана" = карточка пересекает узкую полосу посередине
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const i = entry.target.dataset.i;
                cards.forEach(c => c.classList.toggle('is-on', c === entry.target));
                marks.forEach(m => m.classList.toggle('is-on', m.dataset.i === i));
            });
        }, { rootMargin: '-45% 0px -45% 0px' });
        cards.forEach(c => observer.observe(c));
    });
});

// === ПОДВАЛ: ВОЛЧИЙ СЛЕД ===
// Выбран владельцем по прототипу (prototypes/site-footer, вариант Н). Следы
// лапок в слое .footer-trail. Режимы (data-mode у .footer) идут по кругу:
//   walking — следы бегут из-за края к волчице, дошли → она загорается (.is-arrived);
//   idle    — первый раз после прихода: ждёт нажатия, мягко «дышит»;
//   cursor  — надпись «Великая волчица наблюдает» (.is-watching), следы идут
//             за мышью; на телефоне касание пускает цепочку от пальца к волчице;
//   stroll  — волчица «гуляет»: по фону иногда проходят бледные цепочки.
// Нажатие на колос (.wisewolf-seal): idle → cursor → stroll → (walking → cursor) → stroll → …
// Отдельный DOMContentLoaded — по той же причине, что у cookie-баннера.
document.addEventListener('DOMContentLoaded', () => {
    const footer = document.querySelector('.footer');
    const layer = footer && footer.querySelector('.footer-trail');
    const seal = footer && footer.querySelector('.wisewolf-seal');
    if (!layer || !seal) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const PAW = '<svg viewBox="0 0 40 40"><path d="M20 21c-6 0-11 6-11 10.5 0 3 2.6 4.5 5.5 4.5 2.4 0 3.6-1.4 5.5-1.4s3.1 1.4 5.5 1.4c2.9 0 5.5-1.5 5.5-4.5C31 27 26 21 20 21z"/><ellipse cx="7.5" cy="17" rx="3.4" ry="4.4" transform="rotate(-25 7.5 17)"/><ellipse cx="15" cy="9.5" rx="3.4" ry="4.6" transform="rotate(-8 15 9.5)"/><ellipse cx="25" cy="9.5" rx="3.4" ry="4.6" transform="rotate(8 25 9.5)"/><ellipse cx="32.5" cy="17" rx="3.4" ry="4.4" transform="rotate(25 32.5 17)"/></svg>';

    let mode = '', run = 0, visible = false, started = false, last = null, step = 0;
    const setMode = m => { mode = m; footer.dataset.mode = m; };
    // Отложенный вызов, который отменяется сменой режима (run меняется)
    const later = (id, ms, fn) => setTimeout(() => { if (id === run) fn(); }, ms);

    // Слой для следов за курсором: они идут по всей странице, а не только по
    // подвалу. Слой нулевой высоты в начале документа (следы торчат из него
    // вниз), обрезан только по бокам — см. .footer-cursor-trail в style.css.
    const pageLayer = document.createElement('div');
    pageLayer.className = 'footer-cursor-trail';
    pageLayer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(pageLayer);

    // Поставить след: x, y — центр в px от слоя (подвала или страницы), ang — куда смотрят пальцы (0 — вверх)
    const print = (x, y, ang, { size = 26, op = 1, life = 0, into = layer } = {}) => {
        const el = document.createElement('span');
        el.className = 'footer-print';
        el.innerHTML = PAW;
        el.style.cssText = `left:${x - size / 2}px; top:${y - size / 2}px; width:${size}px; height:${size}px; --ang:${ang}deg; --op:${op}`;
        into.appendChild(el);
        requestAnimationFrame(() => el.classList.add('is-on'));
        if (life) setTimeout(() => { el.classList.add('is-off'); setTimeout(() => el.remove(), 900); }, life);
        return el;
    };
    const fadeAll = () => [layer, pageLayer].forEach(l => l.querySelectorAll('.footer-print:not(.is-off)').forEach(el => {
        el.classList.add('is-off'); setTimeout(() => el.remove(), 900);
    }));
    // Шаги по кривой Безье a → b (через c) каждые gap px, левая/правая лапа по очереди
    const walk = (a, c, b, gap) => {
        const P = t => ({
            x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
            y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
        });
        const samples = []; let len = 0, prev = P(0);
        for (let i = 1; i <= 200; i++) { const p = P(i / 200); len += Math.hypot(p.x - prev.x, p.y - prev.y); samples.push({ t: i / 200, len }); prev = p; }
        const n = Math.max(2, Math.floor(len / gap)), pts = [];
        for (let k = 0; k <= n; k++) {
            const s = samples.find(q => q.len >= k / n * len) || samples[samples.length - 1];
            const p = P(s.t), q = P(Math.min(1, s.t + 0.01)), o = P(Math.max(0, s.t - 0.01));
            const dir = Math.atan2(q.y - o.y, q.x - o.x), side = k % 2 ? 1 : -1;
            pts.push({ x: p.x - Math.sin(dir) * side * 9, y: p.y + Math.cos(dir) * side * 9, ang: dir * 180 / Math.PI + 90 });
        }
        return pts;
    };
    // Где волчица (центр значка) и размеры подвала
    const wolfBox = () => {
        const f = footer.getBoundingClientRect(), w = seal.querySelector('.holo-icon').getBoundingClientRect();
        return { x: w.left - f.left + w.width / 2, y: w.top - f.top + w.height / 2, f };
    };

    // Тропа к волчице; then() — что делать, когда дошла
    const goToWolf = then => {
        const id = ++run;
        setMode('walking'); fadeAll(); footer.classList.remove('is-arrived', 'is-watching');
        const { x, y, f } = wolfBox();
        // Всегда слева: колос стоит слева от имени, и справа следы прошли бы по буквам
        const pts = walk(
            { x: -20, y: f.height * 0.85 },
            { x: x * 0.45, y: f.height * 0.05 },
            { x: x - 46, y: y + 4 },
            f.width < 600 ? 36 : 54);
        const pace = reduced ? 0 : 150;
        pts.forEach((p, i) => later(id, i * pace, () => print(p.x, p.y, p.ang, { op: 0.25 + 0.75 * i / pts.length })));
        later(id, pts.length * pace + 200, () => { footer.classList.add('is-arrived'); then(); });
    };
    // Прогулка: из края в край по случайной дуге, потом пауза 3,5–8 с
    const stroll = id => {
        if (id !== run) return;
        if (!visible || document.hidden) { later(id, 1500, () => stroll(id)); return; }
        const { f } = wolfBox(), ltr = Math.random() < 0.5;
        const pts = walk(
            { x: ltr ? -30 : f.width + 30, y: f.height * (0.2 + Math.random() * 0.6) },
            { x: f.width / 2, y: f.height * (Math.random() < 0.5 ? -0.1 : 1.1) },
            { x: ltr ? f.width + 30 : -30, y: f.height * (0.2 + Math.random() * 0.6) }, 46);
        pts.forEach((p, i) => later(id, i * 240, () => print(p.x, p.y, p.ang, { life: 2600, op: 0.45, size: 22 })));
        later(id, pts.length * 240 + 3500 + Math.random() * 4500, () => stroll(id));
    };
    // За курсором — тропу к волчице убираем, чтобы на экране были только следы за мышью
    const toCursor = () => { setMode('cursor'); footer.classList.add('is-watching'); fadeAll(); };
    const toStroll = () => {
        const id = ++run;
        setMode('stroll'); footer.classList.remove('is-arrived', 'is-watching'); fadeAll();
        if (!reduced) later(id, 500, () => stroll(id));
    };
    const next = () => {
        if (mode === 'walking') return;                  // пока бежит — не сбиваем
        if (mode === 'idle') toCursor();
        else if (mode === 'cursor') toStroll();
        else goToWolf(toCursor);                         // из прогулки — к волчице, потом за курсором
    };
    seal.addEventListener('click', next);
    seal.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); } });

    // Следы за мышью — только в режиме «за курсором», по ВСЕЙ странице (слой
    // pageLayer, координаты от начала документа), а не только по подвалу.
    // Редко и бледно (владелец: при частых следах «рябит в глазах»): шаг
    // CURSOR_STEP, живут CURSOR_LIFE, на экране не больше CURSOR_MAX — лишние
    // самые старые сразу тают.
    const CURSOR_STEP = 90, CURSOR_LIFE = 1000, CURSOR_MAX = 5;
    const cursorPrints = [];
    document.addEventListener('pointermove', e => {
        if (mode !== 'cursor' || e.pointerType !== 'mouse') return;
        const x = e.pageX, y = e.pageY;
        if (!last) { last = { x, y }; return; }
        if (Math.hypot(x - last.x, y - last.y) < CURSOR_STEP) return;
        const dir = Math.atan2(y - last.y, x - last.x), side = step++ % 2 ? 1 : -1;
        cursorPrints.push(print(x - Math.sin(dir) * side * 10, y + Math.cos(dir) * side * 10, dir * 180 / Math.PI + 90,
            { life: CURSOR_LIFE, op: 0.55, size: 22, into: pageLayer }));
        while (cursorPrints.length > CURSOR_MAX) cursorPrints.shift().classList.add('is-off');
        last = { x, y };
    });
    document.documentElement.addEventListener('pointerleave', () => { last = null; });
    // Телефон, режим «за курсором»: касание — от пальца к волчице пробегает цепочка
    footer.addEventListener('pointerdown', e => {
        if (mode !== 'cursor' || e.pointerType === 'mouse' || e.target.closest('a, .wisewolf-seal')) return;
        const r = footer.getBoundingClientRect(), s = { x: e.clientX - r.left, y: e.clientY - r.top }, { x, y } = wolfBox();
        walk(s, { x: (s.x + x) / 2, y: Math.min(s.y, y) - 40 }, { x, y: y + 30 }, 34).slice(0, 8)
            .forEach((p, i) => setTimeout(() => print(p.x, p.y, p.ang, { life: 1800, op: 0.9 }), i * 140));
    });

    // Старт — когда подвал попал на экран
    new IntersectionObserver(entries => entries.forEach(entry => {
        visible = entry.isIntersecting;
        if (visible && !started) { started = true; goToWolf(() => setMode('idle')); }
    }), { threshold: 0.2 }).observe(footer);
    // Ширина поменялась — тропа к волчице уже не там, где была: убираем её
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { if (footer.classList.contains('is-arrived')) fadeAll(); }, 300);
    });
});

// === КНОПКА «СВЯЗАТЬСЯ» НА ПК (.cta-dock) ===
// Язычок с лапкой у правого края; нажатие выдвигает шторку с контактами
// (язычок едет вместе с ней). Закрыть — ещё раз по язычку, мимо или Esc.
// На телефоне .cta-dock скрыт стилями (там .mobile-cta).
document.addEventListener('DOMContentLoaded', () => {
    const dock = document.getElementById('cta-dock');
    if (!dock) return;
    const toggle = dock.querySelector('.cta-dock__toggle');
    const setOpen = (open) => {
        dock.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        setOpen(!dock.classList.contains('is-open'));
    });
    document.addEventListener('click', (e) => { if (!dock.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
});
