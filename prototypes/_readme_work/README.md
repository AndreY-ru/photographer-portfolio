# Картинки для README

Скриншоты и анимации главного `README.md` (`docs/readme/`) снимаются с тестового
сайта (`prototypes/_server/fake_site.py`, данные витрины — альбомы из локальной
папки `uploads/albums`).

1. Запустить тестовый сайт: `prototypes\.venv\Scripts\python prototypes\_server\fake_site.py`.
2. Анимации: `node pw.js r_all.js` (только некоторые — `ONLY=home,footer`). Кадры
   пишутся в `rec/`, WebP собирает `mkwebp.py <имя> <ширина> ../../docs/readme/<имя>.webp`
   (параметры в начале файла). Зерно плёнки на время записи скрыто: оно меняет каждый
   пиксель, и анимация тяжелеет в разы.
3. Скриншоты: `node pw.js r_shots.js` → `shots/`, затем `python collage.py`
   (подрезка, телефоны в рамках) → `docs/readme/`.
4. Проверить вид: `python preview.py` → открыть `preview.html`.

Playwright: пакет `playwright` или путь к нему в переменной `PW_MODULE`.
Анимации — WebP, а не GIF: при полном цвете в 5–10 раз легче.
