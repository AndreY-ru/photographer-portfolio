// =========================================
// ОБЩЕЕ ДЛЯ ОКОН .site-notice (перед скачиванием, имя клиента)
// =========================================
// Эти окна открываются в том числе поверх лайтбокса, а лайтбокс умеет
// уходить в полноэкранный режим ОС — тогда браузер рисует ТОЛЬКО его
// содержимое, и окно, лежащее в <body>, было бы невидимо. Поэтому при
// открытии переносим окно внутрь текущего fullscreen-элемента.
function setSiteNoticeOpen(modal, open) {
    if (open) {
        const host = document.fullscreenElement || document.body;
        if (modal.parentElement !== host) host.appendChild(modal);
    }
    modal.classList.toggle('is-open', open);
    modal.setAttribute('aria-hidden', String(!open));
}

// Пока окно открыто — Escape закрывает именно его, а стрелки ничего не
// делают. Слушаем на window в фазе захвата, чтобы клавиша не долетела до
// обработчика лайтбокса (он на document) и не закрыла/не перелистнула его.
window.addEventListener('keydown', (e) => {
    const openNotice = document.querySelector('.site-notice.is-open');
    if (!openNotice) return;
    if (e.key === 'Escape' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.stopPropagation();
        if (e.key === 'Escape') {
            const closeEl = openNotice.querySelector('[data-notice-close]');
            if (closeEl) closeEl.click();
        }
    }
}, true);

// =========================================
// ОКНО ПЕРЕД СКАЧИВАНИЕМ (условия использования фото)
// =========================================
// При первом клике на любую кнопку скачивания в альбоме (весь альбом zip,
// иконка на карточке, кнопка в лайтбоксе) показываем условия. После
// "Понятно" запоминаем согласие для ЭТОГО альбома и запускаем то самое
// скачивание, на которое нажали. Крестик/фон/Escape — отмена: ничего не
// скачиваем, при следующем клике окно покажется снова.
document.addEventListener('DOMContentLoaded', () => {
    const notice = document.getElementById('download-notice');
    const okBtn = document.getElementById('download-notice-ok');
    const albumGrid = document.getElementById('album-grid');
    if (!notice || !okBtn || !albumGrid) return;

    const storageKey = `dlNotice_${albumGrid.dataset.albumId}`;
    let accepted = false;
    try {
        accepted = localStorage.getItem(storageKey) === '1';
    } catch (e) {
        // localStorage недоступен (приватный режим и т.п.) — просто
        // покажем окно, согласие будет жить до перезагрузки страницы.
    }
    let pendingLink = null;

    const DOWNLOAD_SELECTOR = '#album-download-btn, .photo-actions a[download], #lb-download';

    // Фаза захвата на document — срабатывает раньше обработчиков на самих
    // кнопках (например, тоста "Собираем архив…" у #album-download-btn),
    // так что до согласия их не зовём вовсе.
    document.addEventListener('click', (e) => {
        if (accepted) return;
        const link = e.target.closest(DOWNLOAD_SELECTOR);
        if (!link) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        pendingLink = link;
        setSiteNoticeOpen(notice, true);
        okBtn.focus();
    }, true);

    okBtn.addEventListener('click', () => {
        accepted = true;
        try {
            localStorage.setItem(storageKey, '1');
        } catch (e) {
            // см. выше — без localStorage помним только до перезагрузки
        }
        setSiteNoticeOpen(notice, false);
        const link = pendingLink;
        pendingLink = null;
        if (link) link.click(); // повторяем клик — теперь он пройдёт как обычно
    });

    notice.querySelectorAll('[data-notice-close]').forEach(el => {
        el.addEventListener('click', () => {
            pendingLink = null;
            setSiteNoticeOpen(notice, false);
        });
    });
});

document.addEventListener("DOMContentLoaded", () => {
    // ИЩЕМ ПРАВИЛЬНЫЙ КЛАСС .photo-card!
    const cards = document.querySelectorAll('.photo-card');
    if (cards.length === 0) return;

    // === 0. РАСКЛАДКА СЕТКИ ПО КОЛОНКАМ ===
    // Раньше сетка была на CSS-колонках (column-count): браузер сам
    // выравнивает их по высоте и раскладывает фото СВЕРХУ ВНИЗ. Из-за этого,
    // например, 1 вертикальное + 2 горизонтальных вставали в 2 колонки
    // (вертикальное по высоте как два горизонтальных), а приоритет фото
    // читался по колонкам, а не слева направо. Теперь раскладываем сами:
    // фото по порядку идут слева направо, каждое — в самую короткую колонку,
    // и колонок не больше, чем фото. Высоту считаем по классу пропорций, без
    // ожидания загрузки картинок. Без JS остаётся прежний CSS-вариант.
    // `cards` выше — статичный список в исходном порядке, так что лайтбокс
    // листает по приоритету, как бы карточки ни разошлись по колонкам.
    const albumGridEl = document.getElementById('album-grid');
    // Всё, что стоит в сетке, в исходном порядке: фото + "пустые места"
    // (.photo-spacer — заглушки из админки для свободной расстановки фото).
    // Заглушки занимают место только при 3+ колонках: на телефоне композиция
    // всё равно другая, и пустоты там только мешали бы.
    const gridItems = Array.from(albumGridEl ? albumGridEl.querySelectorAll('.photo-card, .photo-spacer') : cards);
    const SPACERS_MIN_COLUMNS = 3;
    const columnsForWidth = () => {
        const w = window.innerWidth;   // те же пороги, что в album.css
        if (w <= 480) return 1;
        if (w <= 768) return 2;
        if (w <= 1200) return 3;
        return 4;
    };
    let currentColumns = 0;
    const layoutColumns = () => {
        const widthColumns = columnsForWidth();
        const useSpacers = widthColumns >= SPACERS_MIN_COLUMNS;
        const visibleItems = gridItems.filter(el => useSpacers || !el.classList.contains('photo-spacer'));
        const count = Math.min(widthColumns, visibleItems.length);
        if (!albumGridEl || count === currentColumns) return;
        currentColumns = count;

        const oldColumns = Array.from(albumGridEl.querySelectorAll(':scope > .masonry-col'));
        const columns = Array.from({ length: count }, () => {
            const col = document.createElement('div');
            col.className = 'masonry-col';
            return col;
        });
        // Правило раскладки — общее с превью в админке (masonry-layout.js),
        // поэтому фото стоят там же, куда их поставили в админке.
        const assigned = window.MasonryLayout.assign(visibleItems, count);
        gridItems.forEach(el => {
            el.hidden = !visibleItems.includes(el);
            if (el.hidden) columns[0].appendChild(el); // скрытая заглушка — на раскладку не влияет
        });
        visibleItems.forEach((el, i) => columns[assigned[i]].appendChild(el));
        oldColumns.forEach(col => col.remove()); // карточки из них уже переехали
        columns.forEach(col => albumGridEl.appendChild(col));
        albumGridEl.classList.add('is-js-columns');
    };
    layoutColumns();
    window.addEventListener('resize', layoutColumns);

    // Элементы лайтбокса
    const lightbox = document.getElementById('lightbox');
    const lbImage = document.getElementById('lb-image');
    const lbCounter = document.getElementById('lb-counter');
    const lbDownload = document.getElementById('lb-download');
    const lbLikeBtn = document.getElementById('lb-like');

    // Конфиг альбома (нужен для запросов к серверу при лайке фото)
    const albumGrid = document.getElementById('album-grid');
    const albumSlug = albumGrid ? albumGrid.dataset.albumSlug : null;
    const urlToken = new URLSearchParams(window.location.search).get('token');
    
    // Элементы EXIF
    const exifPill = document.getElementById('lb-exif');
    const lbInfoBtn = document.getElementById('lb-info');
    const elCaption = document.getElementById('exif-caption');
    const exifFieldEls = {
        camera: document.getElementById('exif-camera'),
        lens: document.getElementById('exif-lens'),
        focal: document.getElementById('exif-focal'),
        speed: document.getElementById('exif-speed'),
        aperture: document.getElementById('exif-aperture'),
        iso: document.getElementById('exif-iso'),
        ev: document.getElementById('exif-ev'),
        flash: document.getElementById('exif-flash'),
    };

    // Лента миниатюр всего альбома под фото (выбор владельца по прототипу).
    // Миниатюры те же, что в сетке. Нажатие — сразу на это фото.
    const lbStrip = document.getElementById('lb-strip');
    if (lbStrip) {
        cards.forEach((card, index) => {
            const img = card.querySelector('img');
            const thumb = document.createElement('button');
            thumb.type = 'button';
            thumb.className = 'lb-thumb';
            thumb.setAttribute('aria-label', `Фото ${index + 1}`);
            thumb.innerHTML = `<img src="${img ? img.getAttribute('src') : ''}" alt="" loading="lazy" draggable="false">`;
            thumb.addEventListener('click', () => {
                currentIndex = index;
                updateLightboxData();
                resetZoom();
            });
            lbStrip.appendChild(thumb);
        });
    }

    // Текущее фото подсвечено и стоит по центру ленты. Прокручиваем саму
    // ленту, а не scrollIntoView — тот мог бы сдвинуть и страницу под лайтбоксом.
    function syncLightboxStrip() {
        if (!lbStrip) return;
        [...lbStrip.children].forEach((thumb, i) => thumb.toggleAttribute('aria-current', i === currentIndex));
        const thumb = lbStrip.children[currentIndex];
        if (thumb) {
            lbStrip.scrollTo({ left: thumb.offsetLeft - (lbStrip.clientWidth - thumb.offsetWidth) / 2, behavior: 'smooth' });
        }
    }

    let currentIndex = 0;
    let zoomLevel = 1;
    let isDragging = false;
    let startX, startY, translateX = 0, translateY = 0;

    // 1. Открытие лайтбокса
    cards.forEach((card, index) => {
        card.addEventListener('click', (e) => {
            // Если кликнули по нижней панели (скачать/поделиться) - лайтбокс НЕ открываем
            if (e.target.closest('.photo-actions')) {
                return; 
            }
            // А если кликнули по самой фотке или по кнопке "на весь экран" — открываем!
            openLightbox(index);
        });
    });

    function openLightbox(index) {
        currentIndex = index;
        updateLightboxData();
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden'; 
        resetZoom();
    }

    function updateLightboxData() {
        const item = cards[currentIndex]; 
        const img = item.querySelector('img');
        const highresSrc = item.getAttribute('data-highres');
        const exifRaw = item.getAttribute('data-exif'); // ВЕРНУЛ ЭТУ ПЕРЕМЕННУЮ
        
        lbImage.src = highresSrc || img.src;
        lbDownload.href = highresSrc || img.src;
        lbCounter.innerText = `${currentIndex + 1} / ${cards.length}`;
        syncLightboxStrip();

        // Парсим данные фото (EXIF + подпись). Плашку никогда не открываем
        // автоматически — только готовим содержимое внутри неё; открывает
        // её сам человек кнопкой "i". При переключении на другое фото
        // плашку всегда закрываем заново.
        exifPill.classList.add('hidden');
        let hasAnyInfo = false;
        if (exifRaw) {
            try {
                const data = JSON.parse(exifRaw);

                // Подпись — это уже готовый HTML (отрендерен из markdown на
                // сервере), просто вставляем. Пустая — сама схлопнется (см. CSS).
                elCaption.innerHTML = data.description_html || '';
                if (data.description_html) hasAnyInfo = true;

                // Каждый бейдж — сам по себе: если поля нет, скрываем именно
                // его, а не показываем прочерк рядом с остальными.
                Object.keys(exifFieldEls).forEach((field) => {
                    const value = data[field];
                    const el = exifFieldEls[field];
                    const wrap = el.closest('.exif-item');
                    if (value) {
                        el.innerText = value;
                        wrap.classList.remove('is-empty');
                        hasAnyInfo = true;
                    } else {
                        el.innerText = '';
                        wrap.classList.add('is-empty');
                    }
                });
            } catch (e) {
                console.error("Ошибка парсинга данных фото");
            }
        }
        // Если по этому фото вообще нет ни подписи, ни данных съёмки —
        // кнопку "i" прячем, чтобы не обещать информацию, которой нет.
        if (lbInfoBtn) lbInfoBtn.style.display = hasAnyInfo ? '' : 'none';

        // Синхронизируем сердечко в лайтбоксе с состоянием карточки в сетке
        if (lbLikeBtn) {
            lbLikeBtn.dataset.photoId = item.dataset.photoId || '';
            const cardLikeBtn = item.querySelector('.like-btn');
            lbLikeBtn.classList.toggle('is-liked', !!(cardLikeBtn && cardLikeBtn.classList.contains('is-liked')));
            const lbCount = lbLikeBtn.querySelector('.like-count');
            if (lbCount) lbCount.textContent = Number(item.dataset.likeCount) || '';
        }
    }

    // =========================================
    // ОТБОР ФОТО КЛИЕНТОМ ("СЕРДЕЧКО") И ПОДЕЛИТЬСЯ
    // =========================================
    function showToast(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = 'position:fixed;left:50%;bottom:32px;transform:translateX(-50%);' +
            'background:rgba(20,20,20,0.92);color:#f5f0e6;padding:10px 18px;border-radius:999px;' +
            'font-size:0.85rem;z-index:100001;opacity:0;transition:opacity .25s ease;pointer-events:none;';
        document.body.appendChild(toast);
        requestAnimationFrame(() => { toast.style.opacity = '1'; });
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 1800);
    }

    // count — сколько всего человек отметили фото (приходит с сервера). Число
    // видно у сердечка и в метке в углу фото (.like-chip), без имён.
    function syncLikeUI(photoId, liked, count) {
        document.querySelectorAll(`.like-btn[data-photo-id="${photoId}"]`).forEach(btn => {
            btn.classList.toggle('is-liked', liked);
            btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
        });
        if (lbLikeBtn && lbLikeBtn.dataset.photoId === String(photoId)) {
            lbLikeBtn.classList.toggle('is-liked', liked);
        }
        if (typeof count !== 'number') return;
        const card = document.querySelector(`.photo-card[data-photo-id="${photoId}"]`);
        if (card) {
            card.dataset.likeCount = String(count);
            const chip = card.querySelector('.like-chip');
            if (chip) {
                chip.hidden = count === 0;
                chip.classList.toggle('is-mine', liked);
            }
            card.querySelectorAll('.like-count').forEach(el => { el.textContent = count || ''; });
        }
        if (lbLikeBtn && lbLikeBtn.dataset.photoId === String(photoId)) {
            const lbCount = lbLikeBtn.querySelector('.like-count');
            if (lbCount) lbCount.textContent = count || '';
        }
    }

    // Окно "Как вас зовут?" (album.html, #client-info-modal) вместо prompt():
    // имя — персональные данные, поэтому без галочки согласия (152-ФЗ)
    // кнопка "Продолжить" неактивна. Возвращает Promise с введённым именем
    // или null, если человек закрыл окно.
    const clientInfoModal = document.getElementById('client-info-modal');
    let resolveClientInfo = null;

    function settleClientInfo(name) {
        if (!resolveClientInfo) return;
        const resolve = resolveClientInfo;
        resolveClientInfo = null;
        setSiteNoticeOpen(clientInfoModal, false);
        resolve(name);
    }

    if (clientInfoModal) {
        const form = document.getElementById('client-info-form');
        const nameInput = document.getElementById('client-info-name');
        const consentBox = document.getElementById('client-info-consent');
        const submitBtn = document.getElementById('client-info-submit');

        const syncSubmit = () => {
            submitBtn.disabled = !(nameInput.value.trim() && consentBox.checked);
        };
        nameInput.addEventListener('input', syncSubmit);
        consentBox.addEventListener('change', syncSubmit);

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            syncSubmit();
            if (submitBtn.disabled) return;
            settleClientInfo(nameInput.value.trim());
        });

        clientInfoModal.querySelectorAll('[data-notice-close]').forEach(el => {
            el.addEventListener('click', () => settleClientInfo(null));
        });
    }

    function askClientName() {
        if (!clientInfoModal) return Promise.resolve(null);
        if (resolveClientInfo) settleClientInfo(null); // на всякий случай — не копим висящие окна
        return new Promise((resolve) => {
            resolveClientInfo = resolve;
            setSiteNoticeOpen(clientInfoModal, true);
            document.getElementById('client-info-name').focus();
        });
    }

    async function toggleLike(photoId, clientName) {
        if (!albumSlug) return;
        const wasLiked = document.querySelector(`.like-btn[data-photo-id="${photoId}"]`)?.classList.contains('is-liked')
            || (lbLikeBtn && lbLikeBtn.dataset.photoId === String(photoId) && lbLikeBtn.classList.contains('is-liked'));
        const method = wasLiked ? 'DELETE' : 'POST';
        const qs = urlToken ? `?token=${encodeURIComponent(urlToken)}` : '';

        try {
            const res = await fetch(`/api/album/${encodeURIComponent(albumSlug)}/select/${photoId}${qs}`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_name: clientName || undefined,
                    // Имя приходит только из окна выше, а там без согласия не отправить
                    pd_consent: clientName ? true : undefined,
                    pd_consent_version: clientName
                        ? document.getElementById('client-info-form')?.dataset.consentVersion
                        : undefined,
                    token: urlToken || undefined,
                }),
            });

            if (res.status === 428) {
                const name = await askClientName();
                if (name) await toggleLike(photoId, name);
                return;
            }
            if (!res.ok) throw new Error('request failed: ' + res.status);

            const data = await res.json();
            syncLikeUI(photoId, data.liked, data.count);
        } catch (err) {
            console.error('Не удалось сохранить выбор фото:', err);
            showToast('Не получилось сохранить выбор, попробуйте ещё раз');
        }
    }

    document.querySelectorAll('.like-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleLike(btn.dataset.photoId);
        });
    });

    if (lbLikeBtn) {
        lbLikeBtn.addEventListener('click', () => {
            if (lbLikeBtn.dataset.photoId) toggleLike(lbLikeBtn.dataset.photoId);
        });
    }

    // Clipboard API (navigator.clipboard) требует защищённого контекста
    // (HTTPS или localhost) — на обычном http он просто отсутствует, и
    // копирование молча "не работает". Поэтому всегда пробуем современный
    // способ первым, а если его нет или он падает — откатываемся на
    // старый document.execCommand('copy'), который работает и по http.
    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise((resolve, reject) => {
            try {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.setAttribute('readonly', '');
                textarea.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                textarea.setSelectionRange(0, text.length);
                const ok = document.execCommand('copy');
                document.body.removeChild(textarea);
                ok ? resolve() : reject(new Error('execCommand copy failed'));
            } catch (err) {
                reject(err);
            }
        });
    }

    // Собираем ссылку на КОНКРЕТНОЕ фото: берём текущий адрес (там уже есть
    // ?token=... у приватных альбомов, если он был) и добавляем ?photo=id —
    // именно на неё ведёт кнопка "поделиться", а не просто на альбом.
    function buildShareUrl(photoId) {
        const url = new URL(window.location.href);
        if (photoId) {
            url.searchParams.set('photo', photoId);
        } else {
            url.searchParams.delete('photo');
        }
        return url.toString();
    }

    function shareCurrentLink(photoId) {
        const url = buildShareUrl(photoId);
        if (navigator.share) {
            navigator.share({ title: document.title, url }).catch(() => {});
            return;
        }
        copyToClipboard(url)
            .then(() => showToast('Ссылка скопирована'))
            .catch(() => showToast(url));
    }

    document.querySelectorAll('.share-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const card = btn.closest('.photo-card');
            shareCurrentLink(card ? card.getAttribute('data-photo-id') : null);
        });
    });

    const lbShareBtn = document.getElementById('lb-share');
    if (lbShareBtn) {
        lbShareBtn.addEventListener('click', () => {
            const currentCard = cards[currentIndex];
            shareCurrentLink(currentCard ? currentCard.getAttribute('data-photo-id') : null);
        });
    }


    // 2. Навигация
    document.getElementById('lb-next').addEventListener('click', () => {
        currentIndex = (currentIndex + 1) % cards.length;
        updateLightboxData();
        resetZoom();
    });

    document.getElementById('lb-prev').addEventListener('click', () => {
        currentIndex = (currentIndex - 1 + cards.length) % cards.length;
        updateLightboxData();
        resetZoom();
    });

    // 3. Закрытие
    const closeLightbox = () => {
        if (lightbox.classList.contains('is-immersive')) setLightboxImmersive(false);
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
        resetZoom();
    };
    
    document.getElementById('lb-close').addEventListener('click', closeLightbox);
    document.querySelector('.lightbox-backdrop').addEventListener('click', closeLightbox);
    
    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowRight') document.getElementById('lb-next').click();
        if (e.key === 'ArrowLeft') document.getElementById('lb-prev').click();
    });

    document.getElementById('lb-exif-close').addEventListener('click', () => {
        exifPill.classList.add('hidden');
    });

    if (lbInfoBtn) {
        lbInfoBtn.addEventListener('click', () => {
            exifPill.classList.toggle('hidden');
        });
    }

    // 5. Режим «только фото»: кнопка полного экрана прячет панель, стрелки,
    // ленту и данные съёмки. Где браузер умеет, ещё и разворачивает на весь
    // экран ОС. На iPhone разворачивать элементы страницы нельзя — там
    // работает только скрытие, и раньше кнопка там просто ничего не делала.
    function setLightboxImmersive(on) {
        lightbox.classList.toggle('is-immersive', on);
        lightbox.classList.remove('is-peek');
        if (on && !document.fullscreenElement && typeof lightbox.requestFullscreen === 'function') {
            lightbox.requestFullscreen().catch(() => {});
        }
        if (!on && document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }
    }
    document.getElementById('lb-fullscreen').addEventListener('click', () => {
        setLightboxImmersive(!lightbox.classList.contains('is-immersive'));
    });
    // Вышли из полного экрана Esc-ом — возвращаем и панель
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) lightbox.classList.remove('is-immersive', 'is-peek');
    });
    // В режиме «только фото» движение мыши или касание на пару секунд
    // показывает кнопку выхода
    let immersivePeekTimer = null;
    const peekImmersiveExit = () => {
        if (!lightbox.classList.contains('is-immersive')) return;
        lightbox.classList.add('is-peek');
        clearTimeout(immersivePeekTimer);
        immersivePeekTimer = setTimeout(() => lightbox.classList.remove('is-peek'), 2200);
    };
    lightbox.addEventListener('mousemove', peekImmersiveExit);
    lightbox.addEventListener('touchstart', peekImmersiveExit, { passive: true });

    // =========================================
    // ЗУМ И ПАННОРАМИРОВАНИЕ (Мышь + Колесико + Тач)
    // =========================================
    const container = document.getElementById('lb-img-container');

    function applyTransform() {
        lbImage.style.transform = `translate(${translateX}px, ${translateY}px) scale(${zoomLevel})`;
    }

    function resetZoom() {
        zoomLevel = 1; translateX = 0; translateY = 0;
        applyTransform();
    }

    // --- Зум колесиком (ПК) ---
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomStep = 0.1;
        if (e.deltaY < 0) {
            zoomLevel = Math.min(zoomLevel + zoomStep, 4);
        } else {
            zoomLevel = Math.max(zoomLevel - zoomStep, 1);
        }
        if (zoomLevel === 1) { translateX = 0; translateY = 0; }
        applyTransform();
    });

    // --- Двойной клик / тап ---
    lbImage.addEventListener('dblclick', () => {
        if (zoomLevel > 1) resetZoom();
        else { zoomLevel = 2; applyTransform(); }
    });

    // --- Перетаскивание мышью (ПК) ---
    container.addEventListener('mousedown', (e) => {
        if (zoomLevel <= 1) return;
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        applyTransform();
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    // --- ТАЧ-СОБЫТИЯ (Мобилки: Свайп и Перетаскивание) ---
    let touchStartX = 0, touchStartY = 0;
    let touchEndX = 0, touchEndY = 0;

    container.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) return; // Игнорируем мультитач (щипок)
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;

        // Если картинка уже увеличена (скриптом), готовимся её тягать
        if (zoomLevel > 1) {
            isDragging = true;
            startX = touchStartX - translateX;
            startY = touchStartY - translateY;
        }
    }, {passive: true});

    container.addEventListener('touchmove', (e) => {
        if (!isDragging || e.touches.length > 1 || zoomLevel <= 1) return;
        
        // Тягаем картинку пальцем (если она увеличена)
        translateX = e.touches[0].clientX - startX;
        translateY = e.touches[0].clientY - startY;
        applyTransform();
    }, {passive: true});

    container.addEventListener('touchend', (e) => {
        isDragging = false;
        
        // 1. Проверяем системный зум (увеличил ли юзер экран щипком)
        // visualViewport.scale показывает масштаб экрана на мобилках
        const isNativeZoomed = window.visualViewport && window.visualViewport.scale > 1.05;
        
        // 2. БЛОКИРУЕМ СВАЙП, если есть любой зум (системный или скриптовый)
        if (zoomLevel > 1 || isNativeZoomed) return;

        touchEndX = e.changedTouches[0].clientX;
        touchEndY = e.changedTouches[0].clientY;

        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;

        // 3. Защита от кривых свайпов: срабатывает только если движение было 
        // горизонтальным (по X больше, чем по Y) и достаточно длинным (> 50px)
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
            if (diffX < 0) document.getElementById('lb-next').click(); // Влево -> следующая
            if (diffX > 0) document.getElementById('lb-prev').click(); // Вправо -> предыдущая
        }
    }, {passive: true});

    // Пришли по ссылке "поделиться" на конкретное фото (?photo=id) —
    // сразу открываем лайтбокс на нём, а не просто на странице альбома.
    const requestedPhotoId = new URLSearchParams(window.location.search).get('photo');
    if (requestedPhotoId) {
        const targetIndex = Array.from(cards).findIndex(
            (card) => card.getAttribute('data-photo-id') === requestedPhotoId
        );
        if (targetIndex !== -1) {
            openLightbox(targetIndex);
        }
    }
});