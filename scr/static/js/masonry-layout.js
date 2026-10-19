// =========================================
// ОБЩЕЕ ПРАВИЛО РАСКЛАДКИ ФОТО ПО КОЛОНКАМ
// =========================================
// Одно и то же для страницы альбома (album.js) и превью в админке
// (admin.js) — поэтому как фото расставлены в админке, так они и стоят на
// сайте. Правило: элементы идут по порядку (приоритету) слева направо,
// каждый — в самую короткую на этот момент колонку; при равенстве — в
// левую. Высоту считаем по классу пропорций (ratio-ver/hor/sq), без
// ожидания загрузки картинок, — и потому результат одинаковый при любой
// ширине колонок и отступах. Меняете правило — оно поменяется в обоих местах.
window.MasonryLayout = (function () {
    const RATIO_HEIGHT = { 'ratio-ver': 3 / 2, 'ratio-hor': 2 / 3, 'ratio-sq': 1 };

    // Высота элемента в долях ширины колонки
    function heightOf(el) {
        const cls = Object.keys(RATIO_HEIGHT).find(c => el.classList.contains(c)) || 'ratio-sq';
        return RATIO_HEIGHT[cls];
    }

    // items — элементы в порядке приоритета; возвращает номер колонки для каждого
    function assign(items, columnCount) {
        const heights = new Array(columnCount).fill(0);
        return items.map(el => {
            let shortest = 0;
            for (let i = 1; i < columnCount; i++) {
                if (heights[i] < heights[shortest] - 0.01) shortest = i;
            }
            heights[shortest] += heightOf(el);
            return shortest;
        });
    }

    return { heightOf, assign };
})();
