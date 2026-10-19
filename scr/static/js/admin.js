document.addEventListener('DOMContentLoaded', () => {

    // Иконки для карточек, которые собираются в JS (в разметке — те же SVG)
    const svgIcon = path => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
    const ICONS = {
        trash: svgIcon('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>'),
        info: svgIcon('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
        copy: svgIcon('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
    };

    // Меняет только подпись кнопки, не трогая иконку рядом с ней
    function setButtonLabel(btn, text) {
        const span = btn.querySelector('span');
        if (span) span.textContent = text; else btn.textContent = text;
    }

    // --- ТЕМА: тёмная / светлая, выбор помнит браузер (ключ adminTheme, см. cookies.html) ---
    // Переключателей два (меню слева на ПК и «Ещё» на телефоне), поэтому клик ловим на документе
    const markTheme = () => {
        const current = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
        document.querySelectorAll('[data-theme-set]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeSet === current)));
    };
    document.addEventListener('click', e => {
        const btn = e.target.closest('[data-theme-set]');
        if (!btn) return;
        if (btn.dataset.themeSet === 'light') document.documentElement.dataset.theme = 'light';
        else delete document.documentElement.dataset.theme;
        try { localStorage.setItem('adminTheme', btn.dataset.themeSet); } catch (e) {}
        markTheme();
    });
    markTheme();

    // --- ТЕЛЕФОН: «шторка» снизу (меню «Ещё», панель фото) ---
    const isNarrow = () => window.matchMedia('(max-width: 760px)').matches;
    const mSheet = document.getElementById('m-sheet');
    const mSheetBack = document.getElementById('m-sheet-back');
    function closeMobileSheet() {
        mSheet.classList.remove('is-open');
        mSheetBack.classList.remove('is-open');
    }
    function openMobileSheet(title, body) {
        document.getElementById('m-sheet-title').textContent = title;
        const holder = document.getElementById('m-sheet-body');
        holder.innerHTML = '';
        holder.appendChild(body);
        mSheet.classList.add('is-open');
        mSheetBack.classList.add('is-open');
    }
    if (mSheet) {
        mSheetBack.addEventListener('click', closeMobileSheet);
        document.getElementById('m-sheet-close').addEventListener('click', closeMobileSheet);
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMobileSheet(); });
        document.getElementById('m-more-btn').addEventListener('click', () => {
            openMobileSheet('Ещё', document.getElementById('m-more-template').content.cloneNode(true));
            markTheme();
        });
    }

    // --- ОКНА: кнопка «Отмена» закрывает своё окно ---
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.admin-modal').classList.remove('active'));
    });

    // --- ВЫБОР ФАЙЛА: своя кнопка открывает спрятанный input, рядом имя файла ---
    document.querySelectorAll('.file-pick').forEach(wrap => {
        const input = wrap.querySelector('input[type="file"]');
        const nameEl = wrap.querySelector('.file-name');
        const emptyText = input.required ? 'Файл не выбран' : '';
        const showName = () => { nameEl.textContent = input.files && input.files[0] ? input.files[0].name : emptyText; };
        wrap.querySelector('[data-file-pick]').addEventListener('click', () => input.click());
        input.addEventListener('change', showName);
        showName();
        // При открытии окна обработчики ниже сбрасывают input.value без
        // события change — сбрасываем и подпись.
        const modal = wrap.closest('.admin-modal');
        if (modal) new MutationObserver(showName).observe(modal, { attributes: true, attributeFilter: ['class'] });
    });

    // --- ЦВЕТ: код рядом с «каплей» (значение меняют и руками, и авто-цвет) ---
    document.querySelectorAll('.color-hex[data-color-for]').forEach(hexEl => {
        const picker = document.getElementById(hexEl.dataset.colorFor);
        const sync = () => { hexEl.textContent = picker.value; };
        picker.addEventListener('input', sync);
        picker.addEventListener('change', sync);
        sync();
    });

    function flashSaved(el) {
        const original = el.style.outline;
        el.style.outline = '2px solid var(--accent-wheat)';
        setTimeout(() => el.style.outline = original, 500);
    }

    // Всплывающее уведомление снизу экрана — для фидбека по копированию и
    // прочих быстрых действий, где alert() слишком навязчив.
    function showToast(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = 'position:fixed;left:50%;bottom:32px;transform:translateX(-50%);' +
            'background:rgba(20,20,20,0.92);color:#f5f0e6;padding:10px 18px;border-radius:999px;' +
            'font-size:0.85rem;z-index:100000;opacity:0;transition:opacity .25s ease;pointer-events:none;';
        document.body.appendChild(toast);
        requestAnimationFrame(() => { toast.style.opacity = '1'; });
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 1800);
    }

    // navigator.clipboard требует защищённого контекста (HTTPS/localhost) —
    // на обычном http его просто нет, и копирование молча "не работает".
    // Поэтому сначала пробуем его, а если недоступен/упал — откатываемся
    // на document.execCommand('copy'), который работает и без HTTPS.
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

    // === ГЛОБАЛЬНАЯ НАВИГАЦИЯ (САЙДБАР) ===
    const navBtns = document.querySelectorAll('.sidebar-nav .nav-btn');
    const mainViews = document.querySelectorAll('.admin-main > main');

    // Нижняя панель на телефоне — те же разделы, что в меню слева
    const mobileTabs = document.querySelectorAll('.m-tabbar .m-tab[data-target]');

    function activateTab(targetId) {
        navBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-target') === targetId));
        mobileTabs.forEach(b => b.toggleAttribute('aria-current', b.getAttribute('data-target') === targetId));
        mainViews.forEach(view => {
            view.style.display = (view.id === targetId) ? 'block' : 'none';
        });
    }

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => activateTab(btn.getAttribute('data-target')));
    });
    mobileTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            activateTab(btn.getAttribute('data-target'));
            document.querySelector('.admin-main').scrollTop = 0;
        });
    });
    activateTab(document.querySelector('.sidebar-nav .nav-btn.active').getAttribute('data-target'));

    // Если сервер после редиректа передал ?tab=view-categories — открываем именно её
    const urlParams = new URLSearchParams(window.location.search);
    const requestedTab = urlParams.get('tab');
    if (requestedTab && document.getElementById(requestedTab)) {
        activateTab(requestedTab);
    }

    // === БЫСТРОЕ ИЗМЕНЕНИЕ КАТЕГОРИИ АЛЬБОМА ИЗ СПИСКА ===
    document.querySelectorAll('.album-category-quick-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const albumId = e.target.getAttribute('data-album-id');
            const catId = e.target.value;
            
            // Визуальный фидбек: плашка моргнет золотым, показывая что сохранено
            const originalBg = e.target.style.backgroundColor;
            const originalColor = e.target.style.color;
            e.target.style.backgroundColor = 'var(--accent-wheat)';
            e.target.style.color = '#fff';
            
            setTimeout(() => {
                e.target.style.backgroundColor = originalBg;
                e.target.style.color = originalColor;
            }, 500);

            try {
                await fetch(`/api/admin/album/${albumId}/category`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ category_id: catId })
                });
            } catch (err) {
                console.error('Ошибка сохранения категории', err);
            }
        });
    });

    function getDragAfterElementGrid(container, cardClass, x, y) {
            const elements = [...container.querySelectorAll(`${cardClass}:not(.dragging)`)];
            if (elements.length === 0) return null;

            // Ищем ближайшую по расстоянию карточку (а не "свою строку").
            // Это важно для masonry-раскладок (column-count) и карточек
            // разной высоты (разные форматы фото) — там у элементов из
            // соседних колонок верх/низ не совпадают, и проверка "в той же
            // строке" ломается, из-за чего перетаскивание "залипало" в
            // рамках одной визуальной строки/формата.
            let closest = null;
            let closestDistance = Infinity;

            elements.forEach(child => {
                const box = child.getBoundingClientRect();
                const centerX = box.left + box.width / 2;
                const centerY = box.top + box.height / 2;
                const dx = x - centerX;
                const dy = y - centerY;
                const distance = dx * dx + dy * dy;

                if (distance < closestDistance) {
                    closestDistance = distance;
                    closest = { element: child, centerX, centerY };
                }
            });

            if (!closest) return null;

            // Вставляем ДО ближайшего элемента, если курсор выше/левее его центра,
            // иначе — ПОСЛЕ него (т.е. перед его следующим соседом).
            const insertBefore = y < closest.centerY || (Math.abs(y - closest.centerY) < 1 && x < closest.centerX);
            return insertBefore ? closest.element : closest.element.nextElementSibling;
        }

    // === СОРТИРОВКА (УНИВЕРСАЛЬНЫЙ DRAG & DROP ДЛЯ GRID-СЕТОК) ===
    function setupDragAndDrop(containerId, cardClass, badgeClass, dataIdAttr, reorderApiUrl, singleSortApiUrl, idKeyName) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const draggables = container.querySelectorAll(cardClass);

        // 1. Логика Drag & Drop
        draggables.forEach(draggable => {
            draggable.addEventListener('dragstart', () => draggable.classList.add('dragging'));
            
            draggable.addEventListener('dragend', async () => {
                draggable.classList.remove('dragging');
                
                const cards = container.querySelectorAll(cardClass);
                const ids = [];
                
                cards.forEach((card, index) => {
                    ids.push(card.getAttribute(dataIdAttr));
                    // Визуально переписываем цифры на 0, 1, 2...
                    const badge = card.querySelector(badgeClass);
                    if (badge) badge.innerText = index;
                });

                const payload = {};
                payload[idKeyName] = ids; // Формируем JSON { srv_ids: [1, 2, 3] }

                try {
                    await fetch(reorderApiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                } catch (err) { console.error('Ошибка сортировки:', err); }
            });
        });

        // 2. УМНАЯ ФИЗИКА РАСТАЛКИВАНИЯ (Поддержка Grid-колонок по X и Y)
        container.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = getDragAfterElementGrid(container, cardClass, e.clientX, e.clientY);
            const draggable = document.querySelector(`${cardClass}.dragging`);
            if (draggable) {
                if (afterElement == null) container.appendChild(draggable);
                else container.insertBefore(draggable, afterElement);
            }
        });

        // 3. РУЧНОЕ ИЗМЕНЕНИЕ ЦИФРЫ (Клик по бейджу)
        container.querySelectorAll(badgeClass).forEach(badge => {
            badge.addEventListener('mousedown', (e) => e.stopPropagation());
            badge.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); badge.blur(); }
            });
            badge.addEventListener('blur', async () => {
                const val = parseInt(badge.innerText.trim()) || 0;
                badge.innerText = val;
                const card = badge.closest(cardClass);
                const itemId = card.getAttribute(dataIdAttr);
                
                badge.style.backgroundColor = 'var(--accent-wheat)';
                setTimeout(() => badge.style.backgroundColor = '', 500);

                try {
                    await fetch(`${singleSortApiUrl}${itemId}/sort`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sort_order: val })
                    });
                } catch (err) { console.error('Ошибка ручного сохранения', err); }
            });
        });
    }

    // ПОДКЛЮЧАЕМ ВСЕ СПИСКИ К УМНОМУ DRAG & DROP:
    // Альбомы
    setupDragAndDrop('admin-galleries-grid', '.gallery-card', '.album-sort-badge', 'data-album-id', '/api/admin/albums/reorder', '/api/admin/album/', 'album_ids');
    // Направления
    setupDragAndDrop('directions-list', '.direction-card', '.dir-sort-badge', 'data-dir-id', '/api/admin/directions/reorder', '/api/admin/direction/', 'dir_ids');
    // Услуги
    setupDragAndDrop('services-list', '.service-card', '.srv-sort-badge', 'data-srv-id', '/api/admin/services/reorder', '/api/admin/service/', 'srv_ids');
    // Ретушь
    setupDragAndDrop('retouch-list', '.retouch-card', '.ret-sort-badge', 'data-ret-id', '/api/admin/retouch/reorder', '/api/admin/retouch/', 'ret_ids');
    // Достижения («Обо мне»)
    setupDragAndDrop('achievements-list', '.achievement-card', '.ach-sort-badge', 'data-ach-id', '/api/admin/achievements/reorder', '/api/admin/achievement/', 'ach_ids');

    // === ПАНЕЛЬ ФИЛЬТРАЦИИ И СОРТИРОВКИ ДАШБОРДА ===
    const sortSelect = document.getElementById('sort-albums');
    const filterCatSelect = document.getElementById('filter-category');
    const filterAccessSelect = document.getElementById('filter-access');
    const gridContainer = document.getElementById('admin-galleries-grid');

    if (sortSelect && gridContainer) {
        const updateGrid = () => {
            const cards = Array.from(gridContainer.querySelectorAll('.gallery-card'));
            const sortVal = sortSelect.value;
            const filterCat = filterCatSelect.value;
            const filterAccess = filterAccessSelect.value;

            // 1. ФИЛЬТРАЦИЯ
            cards.forEach(card => {
                let show = true;
                
                if (filterCat !== 'all' && card.getAttribute('data-category') !== filterCat) show = false;
                
                if (filterAccess === 'public' && card.getAttribute('data-private') === '1') show = false;
                if (filterAccess === 'private' && card.getAttribute('data-private') === '0') show = false;

                card.style.display = show ? 'flex' : 'none';
            });

            // 2. СОРТИРОВКА
            cards.sort((a, b) => {
                if (sortVal === 'priority_asc') {
                    return parseInt(a.getAttribute('data-sort')) - parseInt(b.getAttribute('data-sort'));
                }
                if (sortVal === 'priority_desc') {
                    return parseInt(b.getAttribute('data-sort')) - parseInt(a.getAttribute('data-sort'));
                }
                if (sortVal === 'date_added_desc') {
                    return parseFloat(b.getAttribute('data-created')) - parseFloat(a.getAttribute('data-created'));
                }
                if (sortVal === 'date_taken_desc') {
                    return parseInt(b.getAttribute('data-taken')) - parseInt(a.getAttribute('data-taken'));
                }
                return 0;
            });

            // Возвращаем отсортированные элементы в DOM
            cards.forEach(card => gridContainer.appendChild(card));
        };

        sortSelect.addEventListener('change', updateGrid);
        filterCatSelect.addEventListener('change', updateGrid);
        filterAccessSelect.addEventListener('change', updateGrid);
    }

    // ...  код редактора альбома (viewList, viewEdit) ...

    const viewList = document.getElementById('view-albums');
    const viewEdit = document.getElementById('view-edit-album');
    const btnBack = document.getElementById('btn-back');

    // Находим ВСЕ кнопки с карандашиком (редактировать)
    const editButtons = document.querySelectorAll('.btn-edit-album');

    // Глобальная переменная для хранения ID текущего редактируемого альбома
    let currentAlbumId = null;
    let globalGridClasses = []; // <--- ВАЖНО: здесь будем хранить форматы сеток из БД

    const uploadedPhotosGrid = document.getElementById('uploaded-photos-grid');

    // Число фото на вкладке «Фото» (без «пустых мест»)
    const albumPhotoCount = document.getElementById('album-photo-count');
    if (albumPhotoCount) {
        new MutationObserver(() => {
            const n = uploadedPhotosGrid.querySelectorAll('.photo-edit-card:not(.is-spacer)').length;
            albumPhotoCount.textContent = n || '';
        }).observe(uploadedPhotosGrid, { childList: true });
    }

    // === ПРЕВЬЮ АЛЬБОМА = РАСКЛАДКА САЙТА ===
    // Карточки раскладываются по тому же правилу, что и на странице альбома
    // (masonry-layout.js: по порядку, слева направо, в самую короткую
    // колонку), в 4 колонки — как сайт на компьютере (album.js, ширина
    // больше 1200px). Поэтому как фото стоят здесь, так они и встанут на
    // сайте. Карточки остаются в разметке по порядку приоритета (на это
    // опираются перетаскивание и сохранение порядка), а на свои места в
    // колонках их ставят left/top. Пересчёт — при любом изменении сетки
    // (добавили/удалили/перетащили/сменили пропорцию) и ширины.
    // На телефоне — 2 колонки, крупнее (выбор владельца): там важнее разглядеть
    // и попасть пальцем, чем увидеть точную раскладку ПК.
    const ADMIN_PREVIEW_COLUMNS = 4;
    const ADMIN_PREVIEW_COLUMNS_PHONE = 2;
    const ADMIN_GRID_GAP = 15;
    let adminLayoutQueued = false;

    function layoutAdminGrid() {
        adminLayoutQueued = false;
        if (!uploadedPhotosGrid || !window.MasonryLayout) return;
        const cards = [...uploadedPhotosGrid.querySelectorAll(':scope > .photo-edit-card')];
        const width = uploadedPhotosGrid.clientWidth;
        if (!cards.length || !width) {
            uploadedPhotosGrid.style.height = '';
            return;
        }
        uploadedPhotosGrid.classList.add('is-js-layout');
        const count = Math.min(isNarrow() ? ADMIN_PREVIEW_COLUMNS_PHONE : ADMIN_PREVIEW_COLUMNS, cards.length);
        const colWidth = (width - ADMIN_GRID_GAP * (count - 1)) / count;
        const columnOf = window.MasonryLayout.assign(cards, count);
        const tops = new Array(count).fill(0);
        cards.forEach((card, i) => {
            const col = columnOf[i];
            card.style.width = `${colWidth}px`;
            card.style.left = `${col * (colWidth + ADMIN_GRID_GAP)}px`;
            card.style.top = `${tops[col]}px`;
            tops[col] += colWidth * window.MasonryLayout.heightOf(card) + ADMIN_GRID_GAP;
        });
        uploadedPhotosGrid.style.height = `${Math.max(...tops) - ADMIN_GRID_GAP}px`;
    }
    function queueAdminLayout() {
        if (adminLayoutQueued) return;
        adminLayoutQueued = true;
        requestAnimationFrame(layoutAdminGrid);
    }

    if (uploadedPhotosGrid) {
        // Карточки добавили/удалили/переставили или сменили пропорцию (класс)
        new MutationObserver(queueAdminLayout).observe(uploadedPhotosGrid, {
            childList: true, subtree: true, attributes: true, attributeFilter: ['class'],
        });
        // Сменилась ширина (окно, или вкладку с сеткой только что показали)
        new ResizeObserver(queueAdminLayout).observe(uploadedPhotosGrid);
    }

    // Зона сброса для перетаскивания фоток
    if (uploadedPhotosGrid) {
        // После перестановки карточки ~0.2 с переезжают на новые места; если
        // в это время снова переставлять по положению курсора, они могут
        // "прыгать" туда-обратно. Поэтому между перестановками — пауза.
        let lastReorderAt = 0;
        const placeDraggedAt = (x, y) => {
            const draggable = document.querySelector('.photo-edit-card.dragging');
            if (!draggable) return;
            const afterElement = getDragAfterElementGrid(uploadedPhotosGrid, '.photo-edit-card', x, y);
            if (afterElement === draggable || afterElement === draggable.nextElementSibling) return; // место то же
            if (afterElement == null) {
                if (uploadedPhotosGrid.lastElementChild === draggable) return;
                uploadedPhotosGrid.appendChild(draggable);
            } else {
                uploadedPhotosGrid.insertBefore(draggable, afterElement);
            }
            lastReorderAt = performance.now();
        };
        uploadedPhotosGrid.addEventListener('dragover', e => {
            e.preventDefault();
            if (performance.now() - lastReorderAt < 150) return;
            placeDraggedAt(e.clientX, e.clientY);
        });
        // В момент отпускания — всегда точно под курсор, без паузы: иначе при
        // быстром движении последняя позиция попадала в паузу и фото
        // вставало туда, где курсор был чуть раньше.
        uploadedPhotosGrid.addEventListener('drop', e => {
            e.preventDefault();
            placeDraggedAt(e.clientX, e.clientY);
        });
    }

    // Экранирование значения для HTML-атрибута в шаблонной строке ниже.
    // EXIF (камера/объектив и т.д.) берётся из САМОГО ФАЙЛА — в подсунутом
    // файле там может оказаться `" onmouseover="...` и выполниться здесь, в
    // админке. Раньше часть полей не экранировалась вовсе.
    const escAttr = (value) => String(value ?? '')
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Функция рендера одной карточки фото с Drag & Drop
    const createPhotoCard = (photo) => {
        const div = document.createElement('div');
        const fx = photo.focus_x !== null ? photo.focus_x : 50;
        const fy = photo.focus_y !== null ? photo.focus_y : 50;
        const z = photo.zoom !== null ? photo.zoom : 1.0; 
        const s = photo.sort_order !== null ? photo.sort_order : 0; // Получаем приоритет
        
        div.className = `photo-edit-card ${photo.grid_class_slug || 'ratio-sq'}${photo.is_spacer ? ' is-spacer' : ''}`;
        div.setAttribute('data-photo-id', photo.id);
        div.setAttribute('draggable', 'true'); // Разрешаем перетаскивание

        const optionsHtml = globalGridClasses.map(gc => {
            const isSelected = photo.grid_class_id === gc.id ? 'selected' : '';
            return `<option value="${gc.id}" data-slug="${gc.slug}" ${isSelected}>${gc.name}</option>`;
        }).join('');

        // "Пустое место" (заглушка): без картинки, фокуса, зума и EXIF — только
        // приоритет, пропорция и удаление. Перетаскивается как обычное фото.
        // На сайте на её месте пустой блок той же пропорции.
        div.innerHTML = photo.is_spacer ? `
            <span class="sort-badge photo-sort-badge" contenteditable="true" title="Приоритет">${s}</span>
            <div class="photo-spacer-label">Пустое место<small>на сайте здесь будет пусто</small></div>
            <div class="photo-edit-controls">
                <div class="controls-top">
                    <select class="grid-select" data-id="${photo.id}">
                        ${optionsHtml}
                    </select>
                    <button class="btn-delete-photo icon-btn is-danger" data-id="${photo.id}" title="Удалить пустое место" aria-label="Удалить пустое место">${ICONS.trash}</button>
                </div>
            </div>
        ` : `
            <!-- Бейдж сортировки -->
            <span class="sort-badge photo-sort-badge" contenteditable="true" title="Приоритет">${s}</span>
            <img src="/static/${photo.thumb_url}" alt="photo" style="object-position: ${fx}% ${fy}%; transform-origin: ${fx}% ${fy}%; transform: scale(${z});">
            <div class="focal-point" style="left: ${fx}%; top: ${fy}%;"></div>
            
            <div class="photo-edit-controls">
                <div class="controls-top">
                    <select class="grid-select" data-id="${photo.id}">
                        ${optionsHtml}
                    </select>
                    <button class="btn-edit-exif icon-btn" data-id="${photo.id}"
                        data-title="${escAttr(photo.title)}"
                        data-description="${escAttr(photo.description)}"
                        data-camera="${escAttr(photo.exif_camera)}" data-lens="${escAttr(photo.exif_lens)}"
                        data-focal="${escAttr(photo.exif_focal)}" data-speed="${escAttr(photo.exif_speed)}"
                        data-aperture="${escAttr(photo.exif_aperture)}" data-iso="${escAttr(photo.exif_iso)}"
                        data-ev="${escAttr(photo.exif_ev)}" data-flash="${escAttr(photo.exif_flash)}"
                        title="Подпись и данные съёмки (EXIF)" aria-label="Подпись и данные съёмки">${ICONS.info}</button>
                    <button class="btn-delete-photo icon-btn is-danger" data-id="${photo.id}" title="Удалить" aria-label="Удалить">${ICONS.trash}</button>
                </div>
                <div class="zoom-slider-container">
                    <input type="range" class="zoom-slider" data-id="${photo.id}" min="1" max="4" step="0.1" value="${z}">
                    <span class="zoom-value">${z}x</span>
                </div>
            </div>
        `;

        // --- ЛОГИКА DRAG & DROP ДЛЯ ДАННОЙ ФОТКИ ---
        div.addEventListener('dragstart', () => div.classList.add('dragging'));
        
        div.addEventListener('dragend', async () => {
            div.classList.remove('dragging');
            const cards = uploadedPhotosGrid.querySelectorAll('.photo-edit-card');
            const photoIds = [];
            
            cards.forEach((card, index) => {
                photoIds.push(card.getAttribute('data-photo-id'));
                const badge = card.querySelector('.photo-sort-badge');
                if(badge) badge.innerText = index;
            });

            try {
                await fetch('/api/admin/photos/reorder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ photo_ids: photoIds })
                });
            } catch (err) { console.error('Ошибка сортировки:', err); }
        });

        // --- ЛОГИКА РУЧНОГО ИЗМЕНЕНИЯ ЦИФРЫ ---
        const badge = div.querySelector('.photo-sort-badge');
        if (badge) {
            badge.addEventListener('mousedown', (e) => e.stopPropagation());
            badge.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); badge.blur(); } });
            
            badge.addEventListener('blur', async () => {
                const val = parseInt(badge.innerText.trim()) || 0;
                badge.innerText = val;
                badge.style.backgroundColor = 'var(--accent-wheat)';
                setTimeout(() => badge.style.backgroundColor = '', 500);

                try {
                    await fetch(`/api/admin/photo/${photo.id}/sort`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sort_order: val })
                    });
                } catch (err) { console.error('Ошибка ручного сохранения', err); }
            });
        }

        return div;
    };

    let albumFocusX = 50;
    let albumFocusY = 50;
    // То же самое, но для мобильной обложки категорий (см. editDirectionModal)
    let dirMobileFocusX = 50;
    let dirMobileFocusY = 50;
    // То же самое, но для мобильной обложки АЛЬБОМА (полноэкранный герой
    // на странице альбома — см. album.html/<picture> и album-mobile-cover-editor)
    let albumMobileFocusX = 50;
    let albumMobileFocusY = 50;
    // Переход в редактор при клике на карандашик. Открывается вкладка «Фото»;
    // сердечко на карточке (data-open-favorites) просит сразу «Выбор клиентов».
    let pendingAlbumTab = null;
    document.addEventListener('click', (e) => {
        const heart = e.target.closest('[data-open-favorites]');
        if (!heart) return;
        e.preventDefault();
        e.stopPropagation();
        const editBtn = document.querySelector(`.btn-edit-album[data-id="${heart.dataset.openFavorites}"]`);
        if (!editBtn) return;
        pendingAlbumTab = 'tab-favorites';
        editBtn.click();
    });
    document.querySelectorAll('.btn-edit-album').forEach(btn => {
        btn.addEventListener('click', async () => {
            currentAlbumId = btn.getAttribute('data-id');
            // Вкладка, с которой открыть альбом (раньше оставалась прошлая)
            const startTab = pendingAlbumTab || 'tab-photos';
            pendingAlbumTab = null;
            const startTabEl = document.querySelector(`#album-editor-menu li[data-tab="${startTab}"]`);
            if (startTabEl) startTabEl.click();
            document.getElementById('edit-album-title').innerText = "Загрузка...";
            uploadedPhotosGrid.innerHTML = '<p>Загрузка фотографий...</p>';

            viewList.style.display = 'none';
            viewEdit.style.display = 'block';
            
            // Запрашиваем данные альбома
            try {
                const response = await fetch(`/api/admin/album/${currentAlbumId}`);
                const data = await response.json();
                
                // Вспомогательная функция для форматирования даты в YYYY-MM-DD для input[type="date"]
                const formatDateForInput = (dateStr) => {
                    if (!dateStr) return '';
                    const d = new Date(dateStr);
                    if (isNaN(d.getTime())) return '';
                    return d.toISOString().split('T')[0];
                };
                
                // Наполняем поля Оформления и Настроек
                document.getElementById('album-title-input').value = data.album.title || '';
                document.getElementById('album-category-input').value = data.album.category_id || '';
                document.getElementById('album-desc-input').value = data.album.description || '';
                document.getElementById('album-card-caption-input').value = data.album.card_caption || '';
                document.getElementById('form-delete-album').action = `/admin/album/delete/${currentAlbumId}`;
                const albumColorPicker = document.getElementById('album-color-picker');
                albumColorPicker.value = data.album.color_hex || '#080808';
                albumColorPicker.dispatchEvent(new Event('input', { bubbles: true }));
                document.getElementById('album-date-input').value = formatDateForInput(data.album.date_taken); // ДАТА
                
                document.getElementById('album-active-input').checked = !!data.album.is_active;
                document.getElementById('album-private-input').checked = !!data.album.is_private;
                document.getElementById('album-allow-selection-input').checked = !!data.album.allow_selection;
                document.getElementById('album-require-info-input').checked = !!data.album.require_client_info;
                
                document.getElementById('album-watermark-input').checked = !!data.album.is_watermark_enabled; // ВОТЕРМАРКА
                document.getElementById('album-expires-input').value = formatDateForInput(data.album.expires_at); // СРОК
                
                // Формируем ссылку
                const magicLink = `${window.location.origin}/album/${data.album.slug}?token=${data.album.access_token}`;
                document.getElementById('magic-link-input').value = magicLink;
                updateOpenOnSite(data.album);
                document.getElementById('album-allow-selection-input').checked = !!data.album.allow_selection;
                
                // Ставим превью обложки, если она есть
                // Настройки обложки (Формат, фокус, зум)
                albumFocusX = data.album.cover_focus_x ?? 50;
                albumFocusY = data.album.cover_focus_y ?? 50;
                const coverZ = data.album.cover_zoom ?? 1.0;
                const coverRatio = data.album.cover_ratio || 'type-square';
                
                document.getElementById('album-cover-ratio').value = coverRatio;
                syncCoverRatioButtons();
                document.getElementById('album-cover-zoom').value = coverZ;
                document.getElementById('album-cover-zoom-val').innerText = coverZ + 'x';
                
                const coverEditor = document.getElementById('album-cover-editor');
                coverEditor.className = `album-cover-editor ${coverRatio}`;

                // Ставим превью обложки
                const previewImg = document.getElementById('album-cover-preview');
                const focalDot = document.getElementById('album-cover-focal');

                // ИСПОЛЬЗУЕМ cover_source_url (нетронутый оригинал), А НЕ
                // cover_thumb_url — тот же принцип, что и у направлений:
                // фокус в редакторе ставится по чистому оригиналу, чтобы
                // потом кроп под мобилку резался из максимально резкой
                // картинки, а не из уже сжатой миниатюры 1400px.
                const editorSrc = data.album.cover_source_url || data.album.cover_url || data.album.cover_thumb_url;
                if (editorSrc) {
                    previewImg.crossOrigin = "Anonymous";
                    previewImg.src = `/static/${editorSrc}`;
                } else {
                    previewImg.removeAttribute('crossorigin');
                    previewImg.src = `/static/img/placeholder.jpg`; 
                }

                // Применяем зум и фокус
                previewImg.style.transform = `scale(${coverZ})`;
                previewImg.style.objectPosition = `${albumFocusX}% ${albumFocusY}%`;
                previewImg.style.transformOrigin = `${albumFocusX}% ${albumFocusY}%`;
                focalDot.style.left = `${albumFocusX}%`;
                focalDot.style.top = `${albumFocusY}%`;

                // --- Мобильная обложка альбома (полноэкранный герой) ---
                albumMobileFocusX = data.album.cover_mobile_focus_x ?? 50;
                albumMobileFocusY = data.album.cover_mobile_focus_y ?? 50;
                const albumMobileZ = data.album.cover_mobile_zoom ?? 1.0;

                const mobilePreviewImg = document.getElementById('album-mobile-cover-preview');
                const mobileFocalDot = document.getElementById('album-mobile-cover-focal');
                const mobileZoomInput = document.getElementById('album-mobile-cover-zoom');
                const mobileZoomVal = document.getElementById('album-mobile-cover-zoom-val');

                if (editorSrc) {
                    mobilePreviewImg.crossOrigin = "Anonymous";
                    mobilePreviewImg.src = `/static/${editorSrc}`;
                } else {
                    mobilePreviewImg.removeAttribute('crossorigin');
                    mobilePreviewImg.src = `/static/img/placeholder.jpg`;
                }
                mobileZoomInput.value = albumMobileZ;
                mobileZoomVal.innerText = `${albumMobileZ}x`;
                mobilePreviewImg.style.transform = `scale(${albumMobileZ})`;
                mobilePreviewImg.style.objectPosition = `${albumMobileFocusX}% ${albumMobileFocusY}%`;
                mobilePreviewImg.style.transformOrigin = `${albumMobileFocusX}% ${albumMobileFocusY}%`;
                mobileFocalDot.style.left = `${albumMobileFocusX}%`;
                mobileFocalDot.style.top = `${albumMobileFocusY}%`;

                document.getElementById('edit-album-title').innerText = data.album.title;
                uploadedPhotosGrid.innerHTML = ''; 
                
                globalGridClasses = data.grid_classes || [];
                
                data.photos.forEach(photo => {
                    uploadedPhotosGrid.appendChild(createPhotoCard(photo));
                });
            } catch (error) {
                console.error('Ошибка загрузки альбома:', error);
                uploadedPhotosGrid.innerHTML = '<p style="color:red;">Ошибка загрузки</p>';
            }
        });
    });

    // "+ Пустое место": добавляет заглушку в конец альбома (дальше её
    // перетаскивают куда нужно и выбирают пропорцию, как у фото).
    const btnAddSpacer = document.getElementById('btn-add-spacer');
    if (btnAddSpacer) {
        btnAddSpacer.addEventListener('click', async () => {
            if (!currentAlbumId) return;
            btnAddSpacer.disabled = true;
            try {
                const res = await fetch(`/api/admin/album/${currentAlbumId}/spacer`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ grid_class_slug: 'ratio-sq' }),
                });
                if (!res.ok) throw new Error('request failed: ' + res.status);
                const spacer = await res.json();
                const card = createPhotoCard(spacer);
                uploadedPhotosGrid.appendChild(card);
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch (err) {
                console.error('Ошибка добавления пустого места:', err);
                alert('Не удалось добавить пустое место');
            } finally {
                btnAddSpacer.disabled = false;
            }
        });
    }

    const btnRecomputeExif = document.getElementById('btn-recompute-exif');
    if (btnRecomputeExif) {
        btnRecomputeExif.addEventListener('click', async () => {
            if (!currentAlbumId) return;
            if (!confirm('Дозаполнить данные съёмки из файлов для фото этого альбома?\n\nЗаполнятся только ПУСТЫЕ поля (в том числе новые — экспокоррекция и вспышка). То, что уже заполнено (авто или вручную), не тронется.\n\nВнимание: поле, которое вы специально очистили вручную, снова заполнится, если в файле для него есть данные.')) {
                return;
            }
            btnRecomputeExif.disabled = true;
            setButtonLabel(btnRecomputeExif, 'Считаю…');

            try {
                const res = await fetch(`/api/admin/album/${currentAlbumId}/recompute-exif`, { method: 'POST' });
                const result = await res.json();
                if (!res.ok) throw new Error('request failed');

                // Перерисовываем сетку, чтобы кнопки ⓘ показывали свежие данные
                const albumRes = await fetch(`/api/admin/album/${currentAlbumId}`);
                const albumData = await albumRes.json();
                globalGridClasses = albumData.grid_classes || [];
                uploadedPhotosGrid.innerHTML = '';
                albumData.photos.forEach(photo => {
                    uploadedPhotosGrid.appendChild(createPhotoCard(photo));
                });

                alert(`Готово. Обновлено фото: ${result.updated}, пропущено (всё уже заполнено или в файле нет недостающих данных): ${result.skipped}.`);
            } catch (err) {
                console.error('Ошибка пересчёта EXIF:', err);
                alert('Не удалось пересчитать EXIF');
            } finally {
                btnRecomputeExif.disabled = false;
                setButtonLabel(btnRecomputeExif, 'Дозаполнить EXIF из файлов');
            }
        });
    }

    const openAlbumId = document.body.dataset.openAlbum;
    if (openAlbumId) {
        const targetBtn = document.querySelector(`.btn-edit-album[data-id="${openAlbumId}"]`);
        if (targetBtn) targetBtn.click();
    }

    // Возврат к списку
    btnBack.addEventListener('click', () => {
        viewEdit.style.display = 'none';
        viewList.style.display = 'block';
        currentAlbumId = null;
    });

    // --- ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ВНУТРИ АЛЬБОМА ---
    const albumTabs = document.querySelectorAll('#album-editor-menu li');
    const albumPanels = document.querySelectorAll('.album-tab');

    albumTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            albumTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const targetId = tab.getAttribute('data-tab');
            albumPanels.forEach(panel => {
                // '' — вид задаёт CSS (у «Оформления» это сетка в две колонки)
                panel.style.display = panel.id === targetId ? '' : 'none';
            });

            // МАГИЯ ДЛЯ ВКЛАДКИ "ИЗБРАННОЕ"
            if (targetId === 'tab-favorites' && currentAlbumId) {
                loadFavoritesData();
            }
        });
    });

    // Функция загрузки и отрисовки отбора клиентов
    let currentClientPhotos = []; // Храним фотки текущего клиента для экспорта

    async function loadFavoritesData() {
        const clientsList = document.getElementById('clients-list');
        const photosGrid = document.getElementById('client-photos-grid');
        const clientNameEl = document.getElementById('selected-client-name');
        const clientConsentEl = document.getElementById('selected-client-consent');
        const btnExport = document.getElementById('btn-export-links');
        const btnDownload = document.getElementById('btn-download-selection');

        clientsList.innerHTML = '<p style="font-size:0.85rem; color:gray;">Загрузка...</p>';
        photosGrid.innerHTML = '';
        btnExport.style.display = 'none';
        btnDownload.style.display = 'none';
        clientNameEl.innerText = 'Выберите клиента';
        if (clientConsentEl) clientConsentEl.innerText = '';

        try {
            const response = await fetch(`/api/admin/album/${currentAlbumId}/favorites`);
            const data = await response.json();

            if (!data.clients || data.clients.length === 0) {
                clientsList.innerHTML = '<p style="font-size:0.85rem; color:gray;">Пока никто не отобрал фото.</p>';
                return;
            }

            clientsList.innerHTML = '';
            
            data.clients.forEach((client, index) => {
                const li = document.createElement('li');
                const displayName = client.client_name ? client.client_name : 'Анонимный клиент';
                
                li.innerHTML = `
                    <span>
                        <span class="client-name"></span>
                        <span class="client-count">${client.photos.length} фото</span>
                    </span>
                    <button type="button" class="client-delete-btn" title="Удалить эту подборку">✕</button>
                `;
                // Имя вводит ПОСЕТИТЕЛЬ сайта — только как текст, никогда через
                // innerHTML: иначе "имя" вида <img onerror=...> выполнилось бы
                // здесь, в админке, с правами администратора.
                li.querySelector('.client-name').textContent = displayName;
                
                // Обработка клика по клиенту
                li.addEventListener('click', () => {
                    // Подсветка активного
                    document.querySelectorAll('.clients-list li').forEach(el => el.classList.remove('active'));
                    li.classList.add('active');

                    // Обновляем шапку
                    clientNameEl.innerText = displayName;
                    if (clientConsentEl) {
                        // Анонимная подборка (без имени) — согласие и не нужно
                        const version = client.pd_consent_version ? ` (редакция ${client.pd_consent_version})` : '';
                        clientConsentEl.innerText = client.pd_consent_at
                            ? `Согласие на обработку ПД: ${client.pd_consent_at}${version}`
                            : (client.client_name ? 'Согласие на обработку ПД не зафиксировано (подборка создана до галочки согласия)' : '');
                    }
                    
                    // Отрисовываем фотки
                    photosGrid.innerHTML = '';
                    currentClientPhotos = client.photos;
                    
                    if (client.photos.length === 0) {
                        photosGrid.innerHTML = '<p style="color:gray;">Клиент ничего не выбрал.</p>';
                        btnExport.style.display = 'none';
                        btnDownload.style.display = 'none';
                        return;
                    }

                    btnExport.style.display = 'inline-flex';
                    btnDownload.style.display = 'inline-flex';
                    btnDownload.href = `/api/admin/client-session/${client.session_uuid}/download`;

                    client.photos.forEach((photo, photoIndex) => {
                        const div = document.createElement('div');
                        div.className = 'client-photo-card';
                        div.innerHTML = `
                            <div class="client-photo-card__img">
                                <img src="/static/${escAttr(photo.thumb_url)}" alt="${escAttr(photo.title || photo.original_name || 'photo')}">
                            </div>
                            <button type="button" class="client-photo-card__name" title="Скопировать название">
                                <span></span>${ICONS.copy}
                            </button>
                        `;
                        // Имя файла — как у RAW: по нему фото находится поиском
                        const name = photoDisplayName(photo);
                        div.querySelector('.client-photo-card__name span').textContent = name;
                        div.querySelector('.client-photo-card__name').addEventListener('click', (e) => {
                            e.stopPropagation();
                            copyPhotoName(name);
                        });
                        div.querySelector('.client-photo-card__img').addEventListener('click', () => openAdminPhotoLightbox(client.photos, photoIndex));
                        photosGrid.appendChild(div);
                    });
                });

                // Удаление подборки этого клиента целиком (не открывая её)
                li.querySelector('.client-delete-btn').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!confirm(`Удалить подборку клиента "${displayName}"? Лайки на телефоне/ПК клиента тоже перестанут отображаться.`)) return;

                    try {
                        const resp = await fetch(`/api/admin/client-session/${client.session_uuid}`, { method: 'DELETE' });
                        if (!resp.ok) throw new Error('Ошибка сервера');
                        showToast('Подборка удалена');
                        loadFavoritesData(); // Перерисовываем список целиком
                    } catch (err) {
                        console.error(err);
                        showToast('Не удалось удалить подборку');
                    }
                });

                clientsList.appendChild(li);

                // Автоматически "кликаем" по первому клиенту в списке для удобства
                if (index === 0) li.click();
            });

        } catch (error) {
            console.error('Ошибка загрузки избранного:', error);
            clientsList.innerHTML = '<p style="color:red;">Ошибка сервера</p>';
        }
    }

    // --- Просмотр фото целиком (лайтбокс во вкладке "Избранное") ---
    const adminLightbox = document.getElementById('admin-photo-lightbox');
    const adminLightboxImg = document.getElementById('admin-photo-lightbox-img');
    const adminLightboxTitle = document.getElementById('admin-photo-lightbox-title');
    let adminLightboxPhotos = [];
    let adminLightboxIndex = 0;

    const adminLightboxCount = document.getElementById('admin-photo-lightbox-count');
    const adminLightboxStage = document.getElementById('admin-photo-lightbox-stage');
    const adminLightboxStrip = document.getElementById('admin-photo-lightbox-strip');

    function renderAdminLightboxPhoto() {
        const photo = adminLightboxPhotos[adminLightboxIndex];
        if (!photo) return;
        // В лайтбоксе — оригинал (file_url), не миниатюра: это внутренний
        // инструмент фотографа, тут нужно видеть фото в полном качестве.
        adminLightboxImg.src = `/static/${photo.file_url}`;
        adminLightboxTitle.querySelector('span').textContent = photoDisplayName(photo);
        adminLightboxCount.textContent = `${adminLightboxIndex + 1} / ${adminLightboxPhotos.length}`;
        [...adminLightboxStrip.children].forEach((thumb, i) => thumb.toggleAttribute('aria-current', i === adminLightboxIndex));
        const current = adminLightboxStrip.children[adminLightboxIndex];
        if (current) current.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }

    function openAdminPhotoLightbox(photos, index) {
        adminLightboxPhotos = photos;
        adminLightboxIndex = index;
        // Лента миниатюр — весь отбор клиента, переход в одно нажатие
        adminLightboxStrip.innerHTML = '';
        photos.forEach((photo, i) => {
            const thumb = document.createElement('button');
            thumb.type = 'button';
            thumb.className = 'lbx-thumb';
            thumb.setAttribute('aria-label', photoDisplayName(photo));
            thumb.innerHTML = `<img src="/static/${escAttr(photo.thumb_url)}" alt="">`;
            thumb.addEventListener('click', () => {
                adminLightboxIndex = i;
                renderAdminLightboxPhoto();
            });
            adminLightboxStrip.appendChild(thumb);
        });
        adminLightbox.classList.add('active');
        renderAdminLightboxPhoto();
    }

    function closeAdminPhotoLightbox() {
        adminLightbox.classList.remove('active');
        adminLightboxImg.src = '';
    }

    document.getElementById('admin-photo-lightbox-close')?.addEventListener('click', closeAdminPhotoLightbox);
    // Нажатие на тёмное поле вокруг фото закрывает просмотр
    adminLightboxStage?.addEventListener('click', (e) => {
        if (e.target === adminLightboxStage) closeAdminPhotoLightbox();
    });
    adminLightboxTitle?.addEventListener('click', () => {
        const photo = adminLightboxPhotos[adminLightboxIndex];
        if (photo) copyPhotoName(photoDisplayName(photo));
    });
    // Свайп влево/вправо на телефоне
    let lightboxTouchX = null;
    adminLightboxStage?.addEventListener('touchstart', (e) => { lightboxTouchX = e.touches[0].clientX; }, { passive: true });
    adminLightboxStage?.addEventListener('touchend', (e) => {
        if (lightboxTouchX === null) return;
        const dx = e.changedTouches[0].clientX - lightboxTouchX;
        lightboxTouchX = null;
        if (Math.abs(dx) > 50) document.getElementById(dx > 0 ? 'admin-photo-lightbox-prev' : 'admin-photo-lightbox-next').click();
    });
    document.getElementById('admin-photo-lightbox-prev')?.addEventListener('click', () => {
        adminLightboxIndex = (adminLightboxIndex - 1 + adminLightboxPhotos.length) % adminLightboxPhotos.length;
        renderAdminLightboxPhoto();
    });
    document.getElementById('admin-photo-lightbox-next')?.addEventListener('click', () => {
        adminLightboxIndex = (adminLightboxIndex + 1) % adminLightboxPhotos.length;
        renderAdminLightboxPhoto();
    });
    document.addEventListener('keydown', (e) => {
        if (!adminLightbox || !adminLightbox.classList.contains('active')) return;
        if (e.key === 'Escape') closeAdminPhotoLightbox();
        if (e.key === 'ArrowLeft') document.getElementById('admin-photo-lightbox-prev').click();
        if (e.key === 'ArrowRight') document.getElementById('admin-photo-lightbox-next').click();
    });

    // Название фото для фотографа: исходное имя файла (DSC01234), как у RAW.
    // Если имя потерялось при загрузке (старый баг) — заголовок или номер.
    function photoDisplayName(photo) {
        return photo.original_name || photo.title || `Фото ${photo.id}`;
    }

    function copyPhotoName(name) {
        copyToClipboard(name)
            .then(() => showToast(`Скопировано: ${name}`))
            .catch(() => showToast('Не удалось скопировать — выделите название вручную'));
    }

    // Все названия отбора разом, через пробел — чтобы вставить в поиск по имени файла
    document.getElementById('btn-export-links')?.addEventListener('click', () => {
        if (currentClientPhotos.length === 0) return;
        const names = currentClientPhotos.map(photoDisplayName).join(' ');
        copyToClipboard(names).then(() => {
            showToast(`Скопировано названий: ${currentClientPhotos.length}`);
        }).catch(err => {
            console.error('Ошибка копирования:', err);
            showToast('Не удалось скопировать названия');
        });
    });

    // --- ЗАГРУЗКА ОБЛОЖКИ (Моментальная отправка на сервер) ---
    const albumCoverInput = document.getElementById('album-cover-input');

    albumCoverInput.addEventListener('change', async function() {
        if (!currentAlbumId || !this.files[0]) return;

        // Сразу показываем выбранное фото в ОБОИХ редакторах фокуса (общем
        // и мобильном), не дожидаясь ответа сервера — тот же приём, что и
        // у направлений (см. editCoverFileInput ниже), иначе фокус для
        // мобильной обложки пришлось бы ставить по старому фото, пока
        // страница не перезагрузится.
        const file = this.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            const desktopPreview = document.getElementById('album-cover-preview');
            const mobilePreview = document.getElementById('album-mobile-cover-preview');
            [desktopPreview, mobilePreview].forEach(img => {
                if (!img) return;
                img.removeAttribute('crossorigin');
                img.src = e.target.result;
            });
        };
        reader.readAsDataURL(file);

        // Отправляем файл на сервер
        const formData = new FormData();
        formData.append('cover_file', this.files[0]);

        try {
            const response = await fetch(`/api/admin/album/${currentAlbumId}/cover`, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) alert('Ошибка загрузки обложки на сервер');
        } catch (err) {
            console.error('Ошибка сети:', err);
        }
    });

    // --- «ОТКРЫТЬ НА САЙТЕ»: приватный альбом — сразу ссылкой с ключом ---
    function updateOpenOnSite(album) {
        const link = document.getElementById('btn-open-album-site');
        if (!link || !album || !album.slug) return;
        link.href = `/album/${album.slug}` + (album.is_private ? `?token=${album.access_token}` : '');
    }

    // --- СОХРАНЕНИЕ НАСТРОЕК АЛЬБОМА ---
    // Возвращает true, если сервер всё принял. Её же вызывает кнопка
    // водяного знака: сначала сохраняем галочку, потом пересобираем знаки.
    const btnSaveAlbum = document.getElementById('btn-save-album');
    // На телефоне подпись короче, чтобы в шапке помещалось название альбома
    const saveAlbumLabel = () => (isNarrow() ? 'Сохранить' : 'Сохранить настройки');
    btnSaveAlbum.innerText = saveAlbumLabel();

    async function saveAlbumSettings() {
        if (!currentAlbumId) return false;
        btnSaveAlbum.innerText = "Сохранение...";

        const payload = {
            title: document.getElementById('album-title-input').value,
            category_id: document.getElementById('album-category-input').value,
            description: document.getElementById('album-desc-input').value,
            card_caption: document.getElementById('album-card-caption-input').value,
            color_hex: document.getElementById('album-color-picker').value, 
            date_taken: document.getElementById('album-date-input').value || null, 
            is_active: document.getElementById('album-active-input').checked ? 1 : 0,
            is_private: document.getElementById('album-private-input').checked ? 1 : 0,
            allow_selection: document.getElementById('album-allow-selection-input').checked ? 1 : 0,
            require_client_info: document.getElementById('album-require-info-input').checked ? 1 : 0,
            is_watermark_enabled: document.getElementById('album-watermark-input').checked ? 1 : 0, 
            expires_at: document.getElementById('album-expires-input').value || null,
            
            cover_ratio: document.getElementById('album-cover-ratio').value,
            cover_focus_x: albumFocusX,
            cover_focus_y: albumFocusY,
            cover_zoom: parseFloat(document.getElementById('album-cover-zoom').value),

            cover_mobile_focus_x: albumMobileFocusX,
            cover_mobile_focus_y: albumMobileFocusY,
            cover_mobile_zoom: parseFloat(document.getElementById('album-mobile-cover-zoom').value)
        };

        try {
            const response = await fetch(`/api/admin/album/${currentAlbumId}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                document.getElementById('edit-album-title').innerText = payload.title;
                btnSaveAlbum.innerText = "Сохранено ✓";
                setTimeout(() => btnSaveAlbum.innerText = saveAlbumLabel(), 2000);
                // Название и приватность могли поменять ссылку на альбом
                fetch(`/api/admin/album/${currentAlbumId}`)
                    .then(r => r.json())
                    .then(d => updateOpenOnSite(d.album))
                    .catch(() => {});
                return true;
            }
            alert('Ошибка при сохранении');
            btnSaveAlbum.innerText = saveAlbumLabel();
            return false;
        } catch (error) {
            console.error('Ошибка:', error);
            btnSaveAlbum.innerText = saveAlbumLabel();
            return false;
        }
    }

    btnSaveAlbum.addEventListener('click', saveAlbumSettings);

    // === ИНТЕРАКТИВНОСТЬ РЕДАКТОРА ОБЛОЖКИ АЛЬБОМА ===
    const albumCoverEditor = document.getElementById('album-cover-editor');
    const albumCoverPreview = document.getElementById('album-cover-preview');
    const albumCoverFocal = document.getElementById('album-cover-focal');
    const albumCoverRatio = document.getElementById('album-cover-ratio');
    const albumCoverZoom = document.getElementById('album-cover-zoom');
    const albumCoverZoomVal = document.getElementById('album-cover-zoom-val');

    // Клик по фото: установка фокуса
    if (albumCoverEditor) {
        albumCoverEditor.addEventListener('click', (e) => {
            const rect = albumCoverEditor.getBoundingClientRect();
            let x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
            let y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
            
            albumFocusX = Math.max(0, Math.min(100, x));
            albumFocusY = Math.max(0, Math.min(100, y));

            albumCoverPreview.style.objectPosition = `${albumFocusX}% ${albumFocusY}%`;
            albumCoverPreview.style.transformOrigin = `${albumFocusX}% ${albumFocusY}%`;
            albumCoverFocal.style.left = `${albumFocusX}%`;
            albumCoverFocal.style.top = `${albumFocusY}%`;
        });
    }

    // Ползунок зума
    if (albumCoverZoom) {
        albumCoverZoom.addEventListener('input', (e) => {
            const z = e.target.value;
            albumCoverPreview.style.transform = `scale(${z})`;
            albumCoverZoomVal.innerText = `${z}x`;
        });
    }

    // Смена формата (сразу меняет пропорции рамки)
    if (albumCoverRatio) {
        albumCoverRatio.addEventListener('change', (e) => {
            albumCoverEditor.className = `album-cover-editor ${e.target.value}`;
            syncCoverRatioButtons();
        });
    }

    // Формат обложки выбирается кнопками; значение по-прежнему хранит
    // скрытый select #album-cover-ratio (его читает сохранение альбома)
    function syncCoverRatioButtons() {
        const select = document.getElementById('album-cover-ratio');
        document.querySelectorAll('#album-cover-ratio-seg [data-value]').forEach(b => {
            b.setAttribute('aria-pressed', String(b.dataset.value === select.value));
        });
    }
    document.querySelectorAll('#album-cover-ratio-seg [data-value]').forEach(b => {
        b.addEventListener('click', () => {
            albumCoverRatio.value = b.dataset.value;
            albumCoverRatio.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });
    syncCoverRatioButtons();

    // === Редактор МОБИЛЬНОЙ обложки альбома (полноэкранный герой на
    // странице альбома) — тот же принцип, что у dirCoverEditor ниже,
    // формат фиксированный (9:16), без выбора формата и без своей
    // загрузки файла (фото то же самое, что и у общей обложки выше). ===
    const albumMobileCoverEditor = document.getElementById('album-mobile-cover-editor');
    const albumMobileCoverPreview = document.getElementById('album-mobile-cover-preview');
    const albumMobileCoverFocal = document.getElementById('album-mobile-cover-focal');
    const albumMobileCoverZoom = document.getElementById('album-mobile-cover-zoom');
    const albumMobileCoverZoomVal = document.getElementById('album-mobile-cover-zoom-val');

    if (albumMobileCoverEditor) {
        albumMobileCoverEditor.addEventListener('click', (e) => {
            const rect = albumMobileCoverEditor.getBoundingClientRect();
            let x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
            let y = Math.round(((e.clientY - rect.top) / rect.height) * 100);

            albumMobileFocusX = Math.max(0, Math.min(100, x));
            albumMobileFocusY = Math.max(0, Math.min(100, y));

            albumMobileCoverPreview.style.objectPosition = `${albumMobileFocusX}% ${albumMobileFocusY}%`;
            albumMobileCoverPreview.style.transformOrigin = `${albumMobileFocusX}% ${albumMobileFocusY}%`;
            albumMobileCoverFocal.style.left = `${albumMobileFocusX}%`;
            albumMobileCoverFocal.style.top = `${albumMobileFocusY}%`;
        });
    }

    if (albumMobileCoverZoom) {
        albumMobileCoverZoom.addEventListener('input', (e) => {
            const z = e.target.value;
            albumMobileCoverPreview.style.transform = `scale(${z})`;
            albumMobileCoverZoomVal.innerText = `${z}x`;
        });
    }

    // === Редактор мобильной обложки категорий (тот же принцип, что у
    // альбома выше, только формат фиксированный и без drag&drop-загрузки —
    // файл выбирается обычным <input type="file"> чуть выше в форме). ===
    const dirCoverEditor = document.getElementById('dir-cover-editor');
    const dirCoverPreview = document.getElementById('dir-cover-preview');
    const dirCoverFocal = document.getElementById('dir-cover-focal');
    const dirCoverZoom = document.getElementById('dir-cover-zoom');
    const dirCoverZoomVal = document.getElementById('dir-cover-zoom-val');

    if (dirCoverEditor) {
        dirCoverEditor.addEventListener('click', (e) => {
            const rect = dirCoverEditor.getBoundingClientRect();
            let x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
            let y = Math.round(((e.clientY - rect.top) / rect.height) * 100);

            dirMobileFocusX = Math.max(0, Math.min(100, x));
            dirMobileFocusY = Math.max(0, Math.min(100, y));

            dirCoverPreview.style.objectPosition = `${dirMobileFocusX}% ${dirMobileFocusY}%`;
            dirCoverPreview.style.transformOrigin = `${dirMobileFocusX}% ${dirMobileFocusY}%`;
            dirCoverFocal.style.left = `${dirMobileFocusX}%`;
            dirCoverFocal.style.top = `${dirMobileFocusY}%`;
            document.getElementById('dir-mobile-focus-x').value = dirMobileFocusX;
            document.getElementById('dir-mobile-focus-y').value = dirMobileFocusY;
        });
    }

    // Крупный ползунок (.zoom-wide__range) закрашен до текущего значения —
    // доля хранится в CSS-переменной --p
    function paintRange(range) {
        const min = parseFloat(range.min) || 0, max = parseFloat(range.max) || 1;
        range.style.setProperty('--p', `${((parseFloat(range.value) - min) / (max - min)) * 100}%`);
    }

    if (dirCoverZoom) {
        dirCoverZoom.addEventListener('input', (e) => {
            const z = e.target.value;
            dirCoverPreview.style.transform = `scale(${z})`;
            dirCoverZoomVal.innerText = `${z}x`;
            document.getElementById('dir-mobile-zoom').value = z;
            paintRange(dirCoverZoom);
        });
        paintRange(dirCoverZoom);
    }

    // Новый файл обложки в форме направления — обновляем и обычное превью
    // (это уже делает setupColorThief выше), и картинку в редакторе
    // мобильной обложки, чтобы фокус/зум ставились сразу по новому фото,
    // а не по старому.
    const editCoverFileInput = document.getElementById('edit-cover-file');
    if (editCoverFileInput && dirCoverPreview) {
        editCoverFileInput.addEventListener('change', function () {
            const file = this.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                dirCoverPreview.removeAttribute('crossorigin');
                dirCoverPreview.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // --- Логика Drag & Drop зоны ---
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');

    uploadZone.addEventListener('click', () => fileInput.click());

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, preventDefaults, false);
    });
    function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

    ['dragenter', 'dragover'].forEach(eventName => uploadZone.classList.add('dragover'));
    ['dragleave', 'drop'].forEach(eventName => uploadZone.classList.remove('dragover'));

    uploadZone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
    fileInput.addEventListener('change', function() { handleFiles(this.files); });

    // ДУБЛИКАТЫ ПРИ ЗАГРУЗКЕ (выбрано владельцем по прототипу prototypes/album-extras,
    // «А — Список»). Перед загрузкой спрашиваем сервер, какие файлы уже есть в
    // альбоме (по имени, см. api_check_duplicates). Если есть — одно окно со всеми
    // совпадениями: у каждого «Заменить / Копия / Пропустить», сверху «для всех»,
    // внизу «Отмена» (ничего не грузим) и «Продолжить загрузку».
    // Заменить — то же фото (место в сетке, фокус, сердечки клиентов), новый снимок.
    const DUP_ACTIONS = { replace: 'Заменить', copy: 'Копия', skip: 'Пропустить' };
    const askDuplicates = (plan) => new Promise((resolve) => {
        const dups = plan.filter(item => item.match);
        const others = plan.length - dups.length;
        const word = n => (n % 10 === 1 && n % 100 !== 11) ? 'файл уже есть' : 'файла уже есть';
        const segHtml = (act) => Object.entries(DUP_ACTIONS)
            .map(([key, label]) => `<button type="button" data-act="${key}" aria-pressed="${key === act}">${label}</button>`).join('');
        const modal = document.createElement('div');
        modal.className = 'admin-modal dup-modal';
        modal.innerHTML = `
            <div class="admin-modal__content" role="dialog" aria-modal="true" aria-labelledby="dup-title">
                <div class="admin-modal__header">
                    <h2 id="dup-title">${dups.length} ${word(dups.length)} в альбоме</h2>
                    <button type="button" class="close-btn icon-btn" data-dup="cancel" aria-label="Отмена" title="Отмена"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
                </div>
                <form class="dup-form" onsubmit="return false">
                <p class="dup-sub">${others === 1 ? 'Ещё 1 файл загрузится как обычно. ' : others ? `Остальные ${others} загрузятся как обычно. ` : ''}Выберите, что сделать с совпадениями.</p>
                ${dups.length > 1 ? `<div class="dup-all">Для всех: <div class="seg" data-dup-all>${segHtml('')}</div></div>` : ''}
                <div class="dup-list">
                    ${dups.map((item, i) => `
                    <div class="dup-row">
                        <img src="/static/${escAttr(item.match.thumb_url)}" alt="">
                        <div class="dup-name"><b>${escAttr(item.file.name)}</b><small>в альбоме с таким же именем</small></div>
                        <div class="seg" data-dup-row="${i}">${segHtml(item.act)}</div>
                    </div>`).join('')}
                </div>
                <p class="dup-hint"><b>Заменить</b> — фото останется на своём месте, с фокусом и сердечками клиентов, сменится только снимок. <b>Копия</b> — загрузится ещё одним фото в конец. <b>Пропустить</b> — этот файл не загружать.</p>
                <div class="modal-foot">
                    <button type="button" class="btn-secondary" data-dup="cancel">Отмена</button>
                    <button type="button" class="btn-primary" data-dup="ok">Продолжить загрузку</button>
                </div>
                </form>
            </div>`;
        const sync = () => modal.querySelectorAll('[data-dup-row]').forEach(seg => {
            const act = dups[seg.dataset.dupRow].act;
            seg.querySelectorAll('button').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.act === act)));
        });
        const done = (ok) => {
            document.removeEventListener('keydown', onKey);
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
            resolve(ok);
        };
        const onKey = (e) => { if (e.key === 'Escape') done(false); };
        modal.addEventListener('click', (e) => {
            const rowBtn = e.target.closest('[data-dup-row] button');
            const allBtn = e.target.closest('[data-dup-all] button');
            const ctrl = e.target.closest('[data-dup]');
            if (rowBtn) { dups[rowBtn.parentElement.dataset.dupRow].act = rowBtn.dataset.act; sync(); }
            else if (allBtn) { dups.forEach(item => { item.act = allBtn.dataset.act; }); sync(); }
            else if (ctrl) done(ctrl.dataset.dup === 'ok');
            else if (e.target === modal) done(false);   // клик мимо окна — как «Отмена»
        });
        document.addEventListener('keydown', onKey);
        document.body.appendChild(modal);
        requestAnimationFrame(() => modal.classList.add('active'));
        modal.querySelector('[data-dup="ok"]').focus();
    });

    // РЕАЛЬНАЯ ЗАГРУЗКА ФАЙЛОВ
    async function handleFiles(fileList) {
        const files = [...(fileList || [])];
        if (!currentAlbumId || files.length === 0) return;

        // 1. Какие файлы уже есть в альбоме. Сервер не ответил — грузим как раньше.
        let matches = {};
        try {
            const res = await fetch(`/api/admin/album/${currentAlbumId}/check-duplicates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ names: files.map(f => f.name) }),
            });
            if (res.ok) matches = (await res.json()).matches || {};
        } catch (error) {
            console.error('Не удалось проверить дубликаты:', error);
        }
        const plan = files.map(file => ({ file, match: matches[file.name] || null, act: matches[file.name] ? 'replace' : 'new' }));
        if (plan.some(item => item.match) && !(await askDuplicates(plan))) {
            fileInput.value = '';
            return;   // «Отмена» — ничего не загружаем
        }

        uploadZone.querySelector('span').innerText = 'Загрузка…';

        // 2. Грузим файлы по одному, чтобы не перегрузить сервер
        for (const item of plan) {
            if (item.act === 'skip') continue;
            const formData = new FormData();
            formData.append('file', item.file);
            if (item.act === 'replace') formData.append('replace_photo_id', item.match.id);

            try {
                const response = await fetch(`/api/admin/album/${currentAlbumId}/upload`, {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const photo = await response.json();
                    const oldCard = photo.replaced
                        ? uploadedPhotosGrid.querySelector(`.photo-edit-card[data-photo-id="${photo.id}"]`) : null;
                    if (oldCard) {
                        // Замена: карточка остаётся на своём месте, меняется снимок
                        oldCard.replaceWith(createPhotoCard(photo));
                    } else {
                        // В КОНЕЦ сетки: сервер даёт новому фото следующий номер
                        // приоритета (последний), и на сайте оно тоже в конце —
                        // превью должно совпадать с сайтом (раньше было в начале).
                        uploadedPhotosGrid.appendChild(createPhotoCard(photo));
                    }
                } else {
                    console.error('Ошибка загрузки файла', item.file.name);
                }
            } catch (error) {
                console.error('Ошибка сети:', error);
            }
        }

        uploadZone.querySelector('span').innerText = 'Загрузите фото';
        fileInput.value = ''; // Сбрасываем input
    }

    // --- ДЕЛЕГИРОВАНИЕ СОБЫТИЙ ДЛЯ СЕТКИ ФОТО ---
    
    // 1. Изменение формата сетки (селект)
    uploadedPhotosGrid.addEventListener('change', async (e) => {
        // A) Сохранение формата сетки
        if (e.target.classList.contains('grid-select')) {
            const select = e.target;
            const photoId = select.getAttribute('data-id');
            const newGridClassId = select.value;
            const selectedOption = select.options[select.selectedIndex];
            const newSlug = selectedOption.getAttribute('data-slug');

            const card = select.closest('.photo-edit-card');
            card.classList.remove('ratio-sq', 'ratio-hor', 'ratio-ver');
            if (newSlug) card.classList.add(newSlug);

            try {
            await fetch(`/api/admin/photo/${photoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ grid_class_id: newGridClassId })
            });
            flashSaved(select);   // ← добавить эту строку
        } catch (err) { console.error('Ошибка сохранения сетки:', err); }
    }

        // B) Сохранение зума (при отпускании ползунка)
        if (e.target.classList.contains('zoom-slider')) {
            const slider = e.target;
            const photoId = slider.getAttribute('data-id');
            const zoomVal = parseFloat(slider.value);

            try {
            await fetch(`/api/admin/photo/${photoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ zoom: zoomVal })
            });
            flashSaved(slider);   // ← добавить эту строку
        } catch (err) { console.error('Ошибка сохранения зума:', err); } 
    }
    });

    // === ТЕЛЕФОН: ПАНЕЛЬ ФОТО ПО КАСАНИЮ ===
    // Наведения мышью на телефоне нет, а кнопки на карточке в 2 колонки не
    // помещаются. Поэтому касание фото открывает снизу панель. Она ничего не
    // сохраняет сама: управляет теми же элементами карточки (select, ползунок,
    // кнопки), и сохранение идёт через обычные обработчики ниже.
    let photoSheetPassthrough = false;
    document.addEventListener('click', (e) => {
        if (photoSheetPassthrough || !isNarrow()) return;
        const card = e.target.closest('#uploaded-photos-grid .photo-edit-card');
        if (!card) return;
        e.stopPropagation();
        e.preventDefault();
        openPhotoSheet(card);
    }, true);

    // Клик по элементу карточки «как будто пользователем», мимо перехвата выше
    function clickThrough(el, init) {
        photoSheetPassthrough = true;
        try {
            if (init) el.dispatchEvent(new MouseEvent('click', Object.assign({ bubbles: true }, init)));
            else el.click();
        } finally {
            photoSheetPassthrough = false;
        }
    }

    function openPhotoSheet(card) {
        const img = card.querySelector('img');
        const select = card.querySelector('.grid-select');
        const slider = card.querySelector('.zoom-slider');
        const titleOf = () => (img ? 'Фото ' : 'Пустое место ') + card.querySelector('.photo-sort-badge').textContent.trim();
        const body = document.createElement('div');

        // Превью — копия кадра карточки: та же пропорция, масштаб и фокус.
        // Обновляется после каждого действия, чтобы было видно, что попадёт в кадр.
        let syncPreview = () => {};
        if (img) {
            const focal = card.querySelector('.focal-point');
            body.innerHTML = `
                <div class="m-photo__preview"><span class="m-photo__frame">
                    <img src="${escAttr(img.src)}" alt=""><span class="m-photo__dot"></span>
                </span></div>
                <p class="m-photo__hint">Коснитесь фото, чтобы задать фокус</p>`;
            const frame = body.querySelector('.m-photo__frame');
            const dot = body.querySelector('.m-photo__dot');
            const preview = frame.querySelector('img');
            syncPreview = () => {
                const ratio = ['ratio-sq', 'ratio-hor', 'ratio-ver'].find(c => card.classList.contains(c)) || 'ratio-sq';
                frame.className = `m-photo__frame ${ratio}`;
                preview.style.objectPosition = img.style.objectPosition;
                preview.style.transformOrigin = img.style.transformOrigin;
                preview.style.transform = img.style.transform;
                dot.style.left = focal.style.left;
                dot.style.top = focal.style.top;
            };
            syncPreview();
            // Тап по превью = клик по фото в карточке в той же точке (в процентах),
            // дальше работает обычная установка фокуса
            frame.addEventListener('click', (ev) => {
                const r = preview.getBoundingClientRect();
                const x = (ev.clientX - r.left) / r.width;
                const y = (ev.clientY - r.top) / r.height;
                const cr = img.getBoundingClientRect();
                clickThrough(img, { clientX: cr.left + x * cr.width, clientY: cr.top + y * cr.height });
                syncPreview();
            });
        } else {
            body.innerHTML = '<p class="m-photo__hint">На сайте здесь будет пусто (только на ПК и планшете).</p>';
        }

        // Пропорция
        const ratioRow = document.createElement('div');
        ratioRow.className = 'm-photo__row';
        ratioRow.innerHTML = '<span>Пропорция</span><div class="seg"></div>';
        const seg = ratioRow.querySelector('.seg');
        const markRatio = () => seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === select.value)));
        [...select.options].forEach(opt => {
            const b = document.createElement('button');
            b.type = 'button';
            b.dataset.value = opt.value;
            b.textContent = opt.textContent.trim();
            b.addEventListener('click', () => {
                select.value = opt.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                markRatio();
                syncPreview();
            });
            seg.appendChild(b);
        });
        markRatio();
        body.appendChild(ratioRow);

        // Масштаб
        if (slider) {
            const zoomRow = document.createElement('div');
            zoomRow.className = 'm-photo__row';
            zoomRow.innerHTML = `<span>Масштаб</span><input type="range" min="1" max="4" step="0.1" value="${escAttr(slider.value)}"><span class="zoom-value">${escAttr(slider.value)}x</span>`;
            const range = zoomRow.querySelector('input');
            const val = zoomRow.querySelector('.zoom-value');
            range.addEventListener('input', () => {
                slider.value = range.value;
                val.textContent = `${range.value}x`;
                slider.dispatchEvent(new Event('input', { bubbles: true }));
                syncPreview();
            });
            range.addEventListener('change', () => slider.dispatchEvent(new Event('change', { bubbles: true })));
            body.appendChild(zoomRow);
        }

        // Порядок: перетаскивать пальцем неудобно — двигаем на одно место
        // и сохраняем тем же кодом, что и после перетаскивания (dragend)
        const orderRow = document.createElement('div');
        orderRow.className = 'm-photo__row';
        orderRow.innerHTML = `<span>Порядок</span><div class="m-photo__order">
            <button type="button" class="btn-secondary" data-step="-1"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>Раньше</button>
            <button type="button" class="btn-secondary" data-step="1">Позже<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>
        </div>`;
        orderRow.addEventListener('click', (ev) => {
            const b = ev.target.closest('[data-step]');
            if (!b) return;
            const earlier = b.dataset.step === '-1';
            const sibling = earlier ? card.previousElementSibling : card.nextElementSibling;
            if (!sibling) return;
            if (earlier) sibling.before(card); else sibling.after(card);
            card.dispatchEvent(new Event('dragend'));
            document.getElementById('m-sheet-title').textContent = titleOf();
        });
        body.appendChild(orderRow);

        // Действия
        const actions = document.createElement('div');
        actions.className = 'm-photo__actions';
        if (img) {
            const exif = document.createElement('button');
            exif.type = 'button';
            exif.className = 'btn-secondary';
            exif.innerHTML = ICONS.info + 'Подпись и EXIF';
            exif.addEventListener('click', () => {
                closeMobileSheet();
                clickThrough(card.querySelector('.btn-edit-exif'));
            });
            actions.appendChild(exif);
        }
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'btn-danger';
        del.innerHTML = ICONS.trash + 'Удалить';
        del.addEventListener('click', () => {
            clickThrough(card.querySelector('.btn-delete-photo'));
            if (!card.isConnected || card.style.opacity) closeMobileSheet();
        });
        actions.appendChild(del);
        body.appendChild(actions);

        openMobileSheet(titleOf(), body);
    }

    // ОБРАБОТЧИК КЛИКОВ (Удаление + Точка фокуса + EXIF)
    uploadedPhotosGrid.addEventListener('click', async (e) => {
        // 0. РЕДАКТИРОВАНИЕ EXIF
        const exifBtn = e.target.closest('.btn-edit-exif');
        if (exifBtn) {
            const modal = document.getElementById('editExifModal');
            document.getElementById('editExifForm').setAttribute('data-photo-id', exifBtn.getAttribute('data-id'));
            document.getElementById('edit-exif-title').value = exifBtn.getAttribute('data-title') || '';
            document.getElementById('edit-exif-description').value = exifBtn.getAttribute('data-description') || '';
            document.getElementById('edit-exif-camera').value = exifBtn.getAttribute('data-camera') || '';
            document.getElementById('edit-exif-lens').value = exifBtn.getAttribute('data-lens') || '';
            document.getElementById('edit-exif-focal').value = exifBtn.getAttribute('data-focal') || '';
            document.getElementById('edit-exif-speed').value = exifBtn.getAttribute('data-speed') || '';
            document.getElementById('edit-exif-aperture').value = exifBtn.getAttribute('data-aperture') || '';
            document.getElementById('edit-exif-iso').value = exifBtn.getAttribute('data-iso') || '';
            document.getElementById('edit-exif-ev').value = exifBtn.getAttribute('data-ev') || '';
            document.getElementById('edit-exif-flash').value = exifBtn.getAttribute('data-flash') || '';
            modal.classList.add('active');
            return;
        }

        // 1. УДАЛЕНИЕ ФОТО
        const deleteBtn = e.target.closest('.btn-delete-photo');
        if (deleteBtn) {
            const card = deleteBtn.closest('.photo-edit-card');
            if (!confirm(card.classList.contains('is-spacer') ? 'Удалить пустое место?' : 'Точно удалить это фото?')) return;
            const photoId = deleteBtn.getAttribute('data-id');
            card.style.opacity = '0.5';
            
            try {
                const response = await fetch(`/api/admin/photo/${photoId}`, { method: 'DELETE' });
                if (response.ok) card.remove();
                else { card.style.opacity = '1'; alert('Ошибка при удалении'); }
            } catch (error) { console.error('Ошибка сети:', error); card.style.opacity = '1'; }
        }

        // 2. КЛИК ПО КАРТИНКЕ (Установка фокуса)
        if (e.target.tagName === 'IMG') {
            const card = e.target.closest('.photo-edit-card');
            const photoId = card.getAttribute('data-photo-id');
            const img = e.target;
            const focalDot = card.querySelector('.focal-point');
            
            // Вычисляем проценты клика (от 0 до 100)
            const rect = img.getBoundingClientRect();
            let x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
            let y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
            
            // Ограничиваем, чтобы не вылезло за края
            x = Math.max(0, Math.min(100, x));
            y = Math.max(0, Math.min(100, y));

            // Визуально сразу смещаем картинку и точку
            img.style.objectPosition = `${x}% ${y}%`;
            img.style.transformOrigin = `${x}% ${y}%`;
            focalDot.style.left = `${x}%`;
            focalDot.style.top = `${y}%`;

            // Отправляем в БД
            try {
                await fetch(`/api/admin/photo/${photoId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ focus_x: x, focus_y: y })
                });
            } catch (error) {
                console.error('Ошибка сохранения фокуса:', error);
            }
        }
    });

    // Реал-тайм зум (без сохранения)
    uploadedPhotosGrid.addEventListener('input', (e) => {
        if (e.target.classList.contains('zoom-slider')) {
            const slider = e.target;
            const card = slider.closest('.photo-edit-card');
            const img = card.querySelector('img');
            const valueDisplay = card.querySelector('.zoom-value');

            img.style.transform = `scale(${slider.value})`;
            valueDisplay.innerText = `${slider.value}x`;
        }
    });

    
    // === АВТО-ОПРЕДЕЛЕНИЕ ЦВЕТА (УНИВЕРСАЛЬНОЕ) ===
    function setupColorThief(inputId, pickerId, resetBtnId, previewImgId) {
        const coverInput = document.getElementById(inputId);
        const colorPicker = document.getElementById(pickerId);
        const btnResetColor = document.getElementById(resetBtnId);
        const colorPreviewImg = document.getElementById(previewImgId);
        
        if (coverInput && colorPicker && colorPreviewImg) {
            // Та же защита, что и в script.js (см. коммент там): если
            // внешний CDN-скрипт ColorThief не подключился, new ColorThief()
            // бросает исключение — а поскольку setupColorThief() вызывается
            // трижды подряд (см. вызовы ниже) без try/catch снаружи, первый
            // же провал уронил бы и остальные два, и всё, что идёт в файле
            // после них. Оборачиваем и просто отключаем авто-определение
            // цвета, если библиотеки нет — руками через color-picker всё
            // равно можно выставить цвет.
            let ctAdmin = null;
            try {
                ctAdmin = new ColorThief();
            } catch (e) {
                console.warn('ColorThief недоступен (не загрузился скрипт с CDN) — авто-определение цвета обложки работать не будет:', e);
            }

            const extractColor = () => {
                try {
                    // Убеждаемся, что картинка загружена и имеет размеры
                    if (ctAdmin && colorPreviewImg.src && colorPreviewImg.complete) {
                        const [r, g, b] = ctAdmin.getColor(colorPreviewImg);
                        // Корректная конвертация в HEX
                        const hex = "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).padStart(6, '0');
                        colorPicker.value = hex;
                        colorPicker.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                } catch (e) {
                    console.log("Ошибка ColorThief:", e);
                }
            };

            // Когда юзер выбирает новый файл с ПК
            coverInput.addEventListener('change', function() {
                const file = this.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        // Убираем crossOrigin, т.к. это локальный base64
                        colorPreviewImg.removeAttribute('crossorigin');
                        colorPreviewImg.onload = extractColor;
                        colorPreviewImg.src = e.target.result;
                        colorPreviewImg.style.display = 'block';
                    }
                    reader.readAsDataURL(file);
                }
            });

            // Кнопка сброса цвета (читает текущую отображаемую картинку)
            if (btnResetColor) {
                btnResetColor.addEventListener('click', () => {
                    if (colorPreviewImg.src && colorPreviewImg.style.display !== 'none') {
                        extractColor();
                    } else {
                        alert("Сначала выберите фотографию!");
                    }
                });
            }
        }
    }

    // Подключаем авто-цвет четко по ID:
    setupColorThief('create-cover-file', 'direction-color-picker', 'btn-reset-color', 'create-cover-preview');
    setupColorThief('edit-cover-file', 'edit-direction-color-picker', 'edit-btn-reset-color', 'edit-cover-preview');
    setupColorThief('album-cover-input', 'album-color-picker', 'btn-album-reset-color', 'album-cover-preview');


    // === РЕДАКТИРОВАНИЕ КАТЕГОРИЙ И НАПРАВЛЕНИЙ ===
    
    // Редактирование Категории
    document.querySelectorAll('.btn-edit-cat').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const name = btn.getAttribute('data-name');
            const tagline = btn.getAttribute('data-tagline');
            const desc = btn.getAttribute('data-desc');

            document.getElementById('edit-cat-name').value = name;
            document.getElementById('edit-cat-tagline').value = tagline;
            document.getElementById('edit-cat-desc').value = desc;
            document.getElementById('editCategoryForm').action = `/admin/category/edit/${id}`;
            document.getElementById('editCategoryModal').classList.add('active');
        });
    });

    // --- ДОСТИЖЕНИЯ: заполняем модалку редактирования данными из карточки ---
    document.querySelectorAll('.btn-edit-achievement').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');

            document.getElementById('edit-ach-year').value = btn.getAttribute('data-year');
            document.getElementById('edit-ach-title').value = btn.getAttribute('data-title');
            document.getElementById('edit-ach-desc').value = btn.getAttribute('data-description');
            document.getElementById('edit-ach-link').value = btn.getAttribute('data-link');
            document.getElementById('editAchievementForm').action = `/admin/achievement/edit/${id}`;
            document.getElementById('editAchievementModal').classList.add('active');
        });
    });

    // Редактирование Направления
    document.querySelectorAll('.btn-edit-dir').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const catId = btn.getAttribute('data-cat-id');
            const color = btn.getAttribute('data-color');
            const fileUrl = btn.getAttribute('data-file'); // Забрали картинку из HTML

            document.getElementById('edit-dir-cat').value = catId;
            document.getElementById('edit-direction-color-picker').value = color;
            document.getElementById('edit-cover-file').value = ""; // Очищаем input файла
            
            // Настраиваем превью картинки
            const previewImg = document.getElementById('edit-cover-preview');
            if (fileUrl && fileUrl !== 'None') {
                previewImg.crossOrigin = "Anonymous"; // Нужно для ColorThief при чтении с сервера
                previewImg.src = fileUrl;
                previewImg.style.display = 'block';
            } else {
                previewImg.src = "";
                previewImg.style.display = 'none';
            }

            // Редактор мобильной обложки — та же картинка, что и превью
            // выше, просто отдельная копия под фиксированный портретный
            // формат (см. .type-mobile-dir), плюс уже сохранённые фокус/
            // зум из data-атрибутов кнопки (пришли из dir.mobile_focus_x/y
            // и dir.mobile_zoom).
            dirMobileFocusX = parseFloat(btn.getAttribute('data-mobile-focus-x')) || 50;
            dirMobileFocusY = parseFloat(btn.getAttribute('data-mobile-focus-y')) || 50;
            const dirZoom = parseFloat(btn.getAttribute('data-mobile-zoom')) || 1.0;

            const dirPreview = document.getElementById('dir-cover-preview');
            const dirFocal = document.getElementById('dir-cover-focal');
            if (fileUrl && fileUrl !== 'None') {
                dirPreview.crossOrigin = "Anonymous";
                dirPreview.src = fileUrl;
            } else {
                dirPreview.removeAttribute('crossorigin');
                dirPreview.src = '/static/img/placeholder.jpg';
            }
            dirPreview.style.objectPosition = `${dirMobileFocusX}% ${dirMobileFocusY}%`;
            dirPreview.style.transform = `scale(${dirZoom})`;
            dirPreview.style.transformOrigin = `${dirMobileFocusX}% ${dirMobileFocusY}%`;
            dirFocal.style.left = `${dirMobileFocusX}%`;
            dirFocal.style.top = `${dirMobileFocusY}%`;
            document.getElementById('dir-cover-zoom').value = dirZoom;
            paintRange(document.getElementById('dir-cover-zoom'));
            document.getElementById('dir-cover-zoom-val').innerText = `${dirZoom}x`;
            document.getElementById('dir-mobile-focus-x').value = dirMobileFocusX;
            document.getElementById('dir-mobile-focus-y').value = dirMobileFocusY;
            document.getElementById('dir-mobile-zoom').value = dirZoom;

            document.getElementById('editDirectionForm').action = `/admin/direction/edit/${id}`;
            document.getElementById('editDirectionModal').classList.add('active');
        });
    });

    // === РЕДАКТИРОВАНИЕ УСЛУГ И РЕТУШИ ===
    
    // Редактирование Услуги
    document.querySelectorAll('.btn-edit-service').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            document.getElementById('edit-srv-title').value = btn.getAttribute('data-title');
            document.getElementById('edit-srv-desc').value = btn.getAttribute('data-desc');
            document.getElementById('edit-srv-badge').value = btn.getAttribute('data-badge');
            document.getElementById('edit-srv-price').value = btn.getAttribute('data-price'); // Новое поле: ЦЕНА
            document.getElementById('edit-srv-highlight').checked = btn.getAttribute('data-highlight') === 'True' || btn.getAttribute('data-highlight') === '1';
            
            document.getElementById('editServiceForm').action = `/admin/service/edit/${id}`;
            document.getElementById('editServiceModal').classList.add('active');
        });
    });

    // Редактирование Слайдера Ретуши
    document.querySelectorAll('.btn-edit-retouch').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            document.getElementById('edit-ret-tab').value = btn.getAttribute('data-tab');
            document.getElementById('edit-ret-caption').value = btn.getAttribute('data-caption');

            // Показываем, что сейчас реально загружено — чтобы не казалось,
            // что для сохранения обязательно нужно выбрать оба файла заново.
            document.getElementById('edit-ret-before-preview').src = btn.getAttribute('data-before') || '';
            document.getElementById('edit-ret-after-preview').src = btn.getAttribute('data-after') || '';
            document.getElementById('edit-ret-before-file').value = '';
            document.getElementById('edit-ret-after-file').value = '';

            document.getElementById('editRetouchForm').action = `/admin/retouch/edit/${id}`;
            document.getElementById('editRetouchModal').classList.add('active');
        });
    });

    // Если выбрали новый файл — сразу подменяем превью на него (просто
    // локально в браузере, ничего никуда не загружается до сабмита формы)
    const retBeforeFile = document.getElementById('edit-ret-before-file');
    if (retBeforeFile) {
        retBeforeFile.addEventListener('change', () => {
            if (retBeforeFile.files[0]) {
                document.getElementById('edit-ret-before-preview').src = URL.createObjectURL(retBeforeFile.files[0]);
            }
        });
    }
    const retAfterFile = document.getElementById('edit-ret-after-file');
    if (retAfterFile) {
        retAfterFile.addEventListener('change', () => {
            if (retAfterFile.files[0]) {
                document.getElementById('edit-ret-after-preview').src = URL.createObjectURL(retAfterFile.files[0]);
            }
        });
    }

    // === КОПИРОВАНИЕ И СБРОС ССЫЛКИ ===
    const btnCopyLink = document.getElementById('btn-copy-link');
    if (btnCopyLink) {
        btnCopyLink.addEventListener('click', () => {
            const linkInput = document.getElementById('magic-link-input');
            copyToClipboard(linkInput.value).then(() => {
                setButtonLabel(btnCopyLink, 'Скопировано');
                showToast('Ссылка скопирована');
                setTimeout(() => setButtonLabel(btnCopyLink, 'Скопировать'), 2000);
            }).catch((err) => {
                console.error('Ошибка копирования ссылки:', err);
                showToast('Не удалось скопировать — выделите ссылку вручную');
            });
        });
    }

    const btnResetToken = document.getElementById('btn-reset-token');
    if (btnResetToken) {
        btnResetToken.addEventListener('click', async () => {
            if (!currentAlbumId) return;
            if (!confirm('ВНИМАНИЕ! Старая ссылка перестанет работать. Все текущие лайки клиентов в этом альбоме будут удалены. Продолжить?')) return;
            
            setButtonLabel(btnResetToken, 'Сброс…');
            try {
                const response = await fetch(`/api/admin/album/${currentAlbumId}/regenerate_token`, { method: 'POST' });
                const data = await response.json();
                
                if (data.status === 'success') {
                    // Обновляем ссылку в поле
                    const currentSlug = document.getElementById('magic-link-input').value.split('/album/')[1].split('?')[0];
                    document.getElementById('magic-link-input').value = `${window.location.origin}/album/${currentSlug}?token=${data.new_token}`;
                    updateOpenOnSite({
                        slug: currentSlug, access_token: data.new_token,
                        is_private: document.getElementById('album-private-input').checked,
                    });
                    
                    // Очищаем интерфейс (так как старые лайки удалены)
                    document.getElementById('clients-list').innerHTML = '<p style="font-size:0.85rem; color:gray;">Пока никто не отобрал фото.</p>';
                    document.getElementById('client-photos-grid').innerHTML = '';
                    document.getElementById('btn-export-links').style.display = 'none';
                    document.getElementById('selected-client-name').innerText = 'Выберите клиента';
                }
            } catch (err) {
                alert('Ошибка при сбросе ссылки');
            } finally {
                setButtonLabel(btnResetToken, 'Сбросить ссылку');
            }
        });
    }

    // === ПРЕВЬЮ АВАТАРКИ В НАСТРОЙКАХ ===
    const avatarInput = document.getElementById('avatar-file-input');
    const avatarPreview = document.getElementById('avatar-preview');
    
    if (avatarInput && avatarPreview) {
        avatarInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    avatarPreview.src = e.target.result;
                }
                reader.readAsDataURL(this.files[0]);
            }
        });
    }

    // === ФОТО ОБО МНЕ: точка фокуса для ПК и телефона ===
    // Нажатие на фото ставит точку (в процентах от фото) для выбранного экрана.
    // Превью ниже кадрируют фото так же, как сайт (about.css): object-position
    // равен точке, и рамка стоит в тех же процентах. Значения уходят в
    // скрытые поля и сохраняются кнопкой «Сохранить профиль».
    const aboutSet = document.getElementById('about-photo-set');
    if (aboutSet) {
        const picker = document.getElementById('about-picker');
        const fields = {
            desk: [document.getElementById('about-focus-x'), document.getElementById('about-focus-y')],
            mobile: [document.getElementById('about-mobile-focus-x'), document.getElementById('about-mobile-focus-y')],
        };
        const vars = { desk: ['--fx', '--fy'], mobile: ['--mfx', '--mfy'] };
        let target = 'desk';
        const paint = () => {
            Object.keys(fields).forEach(k => {
                aboutSet.style.setProperty(vars[k][0], fields[k][0].value + '%');
                aboutSet.style.setProperty(vars[k][1], fields[k][1].value + '%');
            });
            aboutSet.dataset.target = target;
        };
        aboutSet.querySelectorAll('.about-photo-set__seg [data-target]').forEach(btn => {
            btn.addEventListener('click', () => {
                target = btn.dataset.target;
                aboutSet.querySelectorAll('.about-photo-set__seg [data-target]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
                paint();
            });
        });
        picker.addEventListener('click', (e) => {
            const img = picker.querySelector('img');
            if (!img) return;
            const r = img.getBoundingClientRect();
            const x = Math.round(Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100)));
            const y = Math.round(Math.max(0, Math.min(100, (e.clientY - r.top) / r.height * 100)));
            fields[target][0].value = x;
            fields[target][1].value = y;
            paint();
        });
        // Выбрали новый файл — сразу показываем его во всех трёх местах
        document.getElementById('about-photo-input').addEventListener('change', function () {
            if (!this.files || !this.files[0]) return;
            const url = URL.createObjectURL(this.files[0]);
            aboutSet.querySelectorAll('.about-prev__frame').forEach(frame => {
                let img = frame.querySelector('img');
                if (!img) { img = document.createElement('img'); img.alt = ''; frame.prepend(img); }
                img.src = url;
            });
            let pimg = picker.querySelector('img');
            if (!pimg) { pimg = document.createElement('img'); pimg.id = 'about-picker-img'; pimg.alt = ''; picker.prepend(pimg); }
            pimg.src = url;
        });
        paint();
    }

    // === СИНХРОНИЗАЦИЯ ВОДЯНЫХ ЗНАКОВ ===
    const btnSyncWatermarks = document.getElementById('btn-sync-watermarks');
    if (btnSyncWatermarks) {
        btnSyncWatermarks.addEventListener('click', async () => {
            if (!currentAlbumId) return;
            
            const isEnabled = document.getElementById('album-watermark-input').checked;
            const actionText = isEnabled ? 'НАЛОЖИТЬ водяные знаки на все фото альбома?' : 'УДАЛИТЬ водяные знаки со всех фото альбома?';

            if (!confirm(`${actionText}\n\nНастройки альбома сначала сохранятся.`)) return;

            btnSyncWatermarks.disabled = true;
            setButtonLabel(btnSyncWatermarks, 'Сохраняю настройки…');

            try {
                // Сервер берёт галочку знака из БД — без сохранения применилось бы старое значение
                if (!(await saveAlbumSettings())) return;
                setButtonLabel(btnSyncWatermarks, 'Обработка… (это может занять время)');
                const response = await fetch(`/api/admin/album/${currentAlbumId}/sync_watermarks`, { method: 'POST' });
                if (response.ok) {
                    alert('Успешно выполнено!');
                } else {
                    alert('Произошла ошибка при обработке.');
                }
            } catch (error) {
                console.error('Ошибка:', error);
                alert('Сбой сети.');
            } finally {
                setButtonLabel(btnSyncWatermarks, 'Сохранить и применить ко всем фото');
                btnSyncWatermarks.disabled = false;
            }
        });
    }


    // Сохранение формы EXIF (модалка на карточке фото в админке)
    const editExifForm = document.getElementById('editExifForm');
    if (editExifForm) {
        editExifForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const photoId = editExifForm.getAttribute('data-photo-id');
            const payload = {
                title: document.getElementById('edit-exif-title').value,
                description: document.getElementById('edit-exif-description').value,
                exif_camera: document.getElementById('edit-exif-camera').value,
                exif_lens: document.getElementById('edit-exif-lens').value,
                exif_focal: document.getElementById('edit-exif-focal').value,
                exif_speed: document.getElementById('edit-exif-speed').value,
                exif_aperture: document.getElementById('edit-exif-aperture').value,
                exif_iso: document.getElementById('edit-exif-iso').value,
                exif_ev: document.getElementById('edit-exif-ev').value,
                exif_flash: document.getElementById('edit-exif-flash').value,
            };

            const submitBtn = editExifForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;

            try {
                const res = await fetch(`/api/admin/photo/${photoId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error('request failed: ' + res.status);

                // Обновляем данные на самой кнопке, чтобы при повторном
                // открытии модалки (без перезагрузки страницы) были свежие значения
                const btn = uploadedPhotosGrid.querySelector(`.btn-edit-exif[data-id="${photoId}"]`);
                if (btn) {
                    btn.setAttribute('data-title', payload.title);
                    btn.setAttribute('data-description', payload.description);
                    btn.setAttribute('data-camera', payload.exif_camera);
                    btn.setAttribute('data-lens', payload.exif_lens);
                    btn.setAttribute('data-focal', payload.exif_focal);
                    btn.setAttribute('data-speed', payload.exif_speed);
                    btn.setAttribute('data-aperture', payload.exif_aperture);
                    btn.setAttribute('data-iso', payload.exif_iso);
                    btn.setAttribute('data-ev', payload.exif_ev);
                    btn.setAttribute('data-flash', payload.exif_flash);
                }

                document.getElementById('editExifModal').classList.remove('active');
            } catch (err) {
                console.error('Ошибка сохранения EXIF:', err);
                alert('Не удалось сохранить данные съёмки');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    const socialIconSelect = document.getElementById('social-icon-select');
    const socialIconPreview = document.getElementById('social-icon-preview');
    if (socialIconSelect && socialIconPreview) {
        socialIconSelect.addEventListener('change', () => {
            const opt = socialIconSelect.options[socialIconSelect.selectedIndex];
            const iconUrl = opt.getAttribute('data-icon');
            if (iconUrl) {
                socialIconPreview.src = iconUrl;
                socialIconPreview.style.display = 'block';
            } else {
                socialIconPreview.style.display = 'none';
            }
        });
    }

    // ==========================================
    // ПАМЯТЬ НА СЕРВЕРЕ: кольцо в боковой панели (на телефоне — в «Ещё»
    // и строка над списком галерей) и вес на карточке каждого альбома.
    // Считается отдельным запросом, чтобы не задерживать открытие админки.
    // ==========================================
    const STORAGE_PARTS = [
        ['albums', 'Альбомы'], ['images', 'Картинки сайта'], ['site', 'Сайт и программы'], ['db', 'База данных'],
    ];
    const GB = 1024 ** 3, MB = 1024 ** 2;
    const fmtSize = b => b >= GB ? `${(b / GB).toFixed(1).replace('.', ',')} ГБ`
        : b >= MB ? `${Math.round(b / MB)} МБ` : b > 0 ? `${Math.max(1, Math.round(b / 1024))} КБ` : '0 МБ';
    const STORAGE_ICO = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h8l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M10 3v4M13 3v4M16 4v3"/></svg>';

    function renderStorage(data) {
        const used = STORAGE_PARTS.reduce((s, [key]) => s + (data.parts[key] || 0), 0);
        const limit = data.limit;
        const free = limit ? Math.max(0, limit - used) : null;
        const level = !limit ? '' : free / limit < 0.05 ? 'is-danger' : free / limit < 0.15 ? 'is-warn' : '';

        // Кольцо: без лимита показывает только из чего состоит занятое место
        const r = 26, C = 2 * Math.PI * r, scale = limit ? Math.max(limit, used) : used || 1;
        let offset = 0;
        const arcs = STORAGE_PARTS.map(([key]) => {
            const bytes = data.parts[key] || 0;
            if (!bytes) return '';
            const len = Math.max(1.5, bytes / scale * C);
            const arc = `<circle class="st-arc st-c--${key}" cx="32" cy="32" r="${r}" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}"/>`;
            offset += len;
            return arc;
        }).join('');
        const center = limit ? `${Math.min(100, Math.round(used / limit * 100))}%` : '—';
        const summary = limit
            ? `<b>${fmtSize(free)}</b><small>${level === 'is-danger' ? 'осталось' : 'свободно'} из ${fmtSize(limit)}</small>`
            : `<b>${fmtSize(used)}</b><small>занято · <button type="button" class="st-link" data-storage-settings>указать объём тарифа</button></small>`;
        const top = [...data.albums].filter(a => a.bytes > 0).sort((a, b) => b.bytes - a.bytes).slice(0, 3);

        const widgetHtml = `
            <div class="st-ring-row">
                <svg class="st-ring" viewBox="0 0 64 64" aria-hidden="true">
                    <circle class="st-track" cx="32" cy="32" r="${r}"/>
                    <g transform="rotate(-90 32 32)">${arcs}</g>
                    <text x="32" y="35.5" text-anchor="middle">${center}</text>
                </svg>
                <div class="st-summary">${summary}</div>
            </div>
            <ul class="st-legend">${STORAGE_PARTS.map(([key, name]) => `
                <li><i class="st-dot st-c--${key}"></i><span>${name}</span><b>${fmtSize(data.parts[key] || 0)}</b></li>`).join('')}
            </ul>
            ${top.length ? `<div class="st-top"><p>Самые тяжёлые</p>${top.map(a => `
                <button type="button" class="st-top-row" data-storage-album="${a.id}">
                    <span>${escAttr(a.title)}</span><b>${fmtSize(a.bytes)}</b>
                </button>`).join('')}</div>` : ''}`;

        // Боковая панель и копия для «Ещё» (шторка берёт содержимое из <template>)
        const moreTpl = document.getElementById('m-more-template');
        [...document.querySelectorAll('[data-storage]'), ...(moreTpl ? moreTpl.content.querySelectorAll('[data-storage]') : [])]
            .forEach(el => {
                el.innerHTML = widgetHtml;
                el.className = `st ${el.classList.contains('st--more') ? 'st--more' : 'st--side'} ${level}`.trim();
                el.setAttribute('aria-label', limit
                    ? `Место на сервере: занято ${fmtSize(used)} из ${fmtSize(limit)}, свободно ${fmtSize(free)}`
                    : `Место на сервере: занято ${fmtSize(used)}`);
                el.hidden = false;
            });

        const chip = document.getElementById('storage-chip');
        if (chip) {
            chip.className = `st-chip ${level}`.trim();
            chip.innerHTML = `${STORAGE_ICO}<span>${limit ? `${fmtSize(free)} свободно из ${fmtSize(limit)}` : `Занято ${fmtSize(used)}`}</span>
                <span class="st-bar">${limit ? STORAGE_PARTS.map(([key]) => `<i class="st-c--${key}" style="width:${Math.max(0.6, (data.parts[key] || 0) / scale * 100)}%"></i>`).join('') : ''}</span>`;
            chip.title = 'Подробнее — в «Ещё»';
            chip.hidden = false;
        }

        // Вес на карточке альбома
        data.albums.forEach(a => {
            const meta = document.querySelector(`.gallery-card[data-album-id="${a.id}"] .info-meta`);
            if (!meta) return;
            meta.querySelectorAll('.st-album, .st-album-dot').forEach(el => el.remove());
            const dot = document.createElement('span');
            dot.className = 'dot st-album-dot';
            dot.textContent = '•';
            const size = document.createElement('span');
            size.className = 'st-album';
            size.textContent = fmtSize(a.bytes);
            size.title = 'Сколько места альбом занимает на сервере: фото, миниатюры, водяные знаки, обложки';
            meta.append(dot, size);
        });
    }

    function loadStorage() {
        fetch('/api/admin/storage')
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data) renderStorage(data); })
            .catch(err => console.error('Не удалось посчитать место на сервере:', err));
    }
    loadStorage();

    // Через document: копия из <template> в шторке «Ещё» приходит без обработчиков
    document.addEventListener('click', (e) => {
        const albumBtn = e.target.closest('[data-storage-album]');
        const settingsBtn = e.target.closest('[data-storage-settings]');
        const chip = e.target.closest('#storage-chip');
        if (!albumBtn && !settingsBtn && !chip) return;
        if (chip) { document.getElementById('m-more-btn')?.click(); return; }
        document.getElementById('m-sheet-close')?.click();
        if (albumBtn) {
            document.querySelector(`.btn-edit-album[data-id="${albumBtn.dataset.storageAlbum}"]`)?.click();
        } else {
            document.querySelector('.nav-btn[data-target="view-settings"]')?.click();
            const form = document.getElementById('storage-settings');
            if (form) {
                form.scrollIntoView({ behavior: 'smooth', block: 'center' });
                document.getElementById('storage-limit-input')?.focus({ preventScroll: true });
            }
        }
    });
});

// Глаз «показать пароль»: открытый — пароль скрыт, перечёркнутый — пароль виден
// (те же иконки в login.html)
const EYE_OPEN = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_CLOSED = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

document.querySelectorAll('input[type="password"]').forEach(input => {
    const wrap = document.createElement('div');
    wrap.className = 'password-field-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'password-toggle-btn';
    toggleBtn.innerHTML = EYE_OPEN;
    toggleBtn.setAttribute('aria-label', 'Показать пароль');
    wrap.appendChild(toggleBtn);

    toggleBtn.addEventListener('click', () => {
        const isHidden = input.type === 'password';
        input.type = isHidden ? 'text' : 'password';
        toggleBtn.innerHTML = isHidden ? EYE_CLOSED : EYE_OPEN;
        toggleBtn.setAttribute('aria-label', isHidden ? 'Скрыть пароль' : 'Показать пароль');
    });
});