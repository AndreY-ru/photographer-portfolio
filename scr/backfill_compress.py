"""
Разовый скрипт: сжимает УЖЕ ЗАГРУЖЕННЫЕ фото направлений (категорий) и
обложек альбомов, и нарезает для них реальный мобильный кроп 9:16
(для направлений — герой на главной, для альбомов — герой на странице
альбома).

До этой правки "полная" версия (file_url / cover_url) сохранялась как
есть — то есть прямо с камеры, без какой-либо обработки. Новый код в
__init__.py уже сжимает всё, что загружается ЗАНОВО, но старые, уже
загруженные фото сами по себе не пересоберутся — для них и нужен этот
скрипт (запустить один раз, можно перезапускать повторно — идемпотентен).

Как запустить (на хостинге, там же где лежит venv):
    cd photo-site/scr
    source ../venv/bin/activate   (или как у вас называется venv)
    python backfill_compress.py

Ничего не удаляет из source_url/cover_source_url — только пересобирает
"десктопную" сжатую версию + миниатюру + мобильный кроп, и обновляет на
них ссылки в БД. Старые (несжатые) file_url/cover_url файлы после
успешной пересборки удаляются с диска, ЕСЛИ они не совпадают с
source_url/cover_source_url (то есть исходник не трогаем никогда).

Порядок миграций ДО запуска этого скрипта:
    1. migration_mobile_crop.sql   (source_url/mobile_url для directions,
                                     cover_source_url для photo_album)
    2. migration_cover_mobile.sql  (cover_mobile_focus_x/y/zoom,
                                     cover_mobile_url для photo_album)
"""
import os
import sys
import uuid

import pymysql
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import host, user, password, port, db_name  # тот же config.py, что у сайта

STATIC_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')


def get_connection():
    return pymysql.connect(
        host=host, user=user, password=password, port=port, db=db_name,
        charset='utf8mb4', cursorclass=pymysql.cursors.DictCursor
    )


def make_desktop_and_thumb(source_path, target_dir, prefix,
                            full_max_size=(2200, 2200), full_quality=82,
                            thumb_size=(400, 400), thumb_quality=85):
    os.makedirs(target_dir, exist_ok=True)
    img = Image.open(source_path)
    if img.mode != 'RGB':
        img = img.convert('RGB')

    desktop_name = f"{prefix}_{uuid.uuid4().hex[:8]}.jpg"
    desktop_img = img.copy()
    desktop_img.thumbnail(full_max_size)
    desktop_img.save(os.path.join(target_dir, desktop_name), 'JPEG', optimize=True, quality=full_quality)

    thumb_name = f"thumb_{desktop_name}"
    thumb_img = img.copy()
    thumb_img.thumbnail(thumb_size)
    thumb_img.save(os.path.join(target_dir, thumb_name), 'JPEG', optimize=True, quality=thumb_quality)

    return desktop_name, thumb_name


def make_mobile_crop(source_path, target_dir, prefix, focus_x=50, focus_y=50, zoom=1.0,
                      target_ratio=(9, 16), out_width=900, quality=80):
    img = Image.open(source_path)
    if img.mode != 'RGB':
        img = img.convert('RGB')
    W, H = img.size
    ratio_w, ratio_h = target_ratio

    if W / H > ratio_w / ratio_h:
        crop_h = H
        crop_w = H * ratio_w / ratio_h
    else:
        crop_w = W
        crop_h = W * ratio_h / ratio_w

    zoom = max(float(zoom), 1.0)
    crop_w /= zoom
    crop_h /= zoom

    cx = W * (float(focus_x) / 100.0)
    cy = H * (float(focus_y) / 100.0)

    left = min(max(cx - crop_w / 2, 0), max(W - crop_w, 0))
    top = min(max(cy - crop_h / 2, 0), max(H - crop_h, 0))

    cropped = img.crop((int(left), int(top), int(left + crop_w), int(top + crop_h)))
    if cropped.width > out_width:
        out_height = round(out_width * ratio_h / ratio_w)
        cropped = cropped.resize((out_width, out_height), Image.LANCZOS)

    os.makedirs(target_dir, exist_ok=True)
    name = f"{prefix}_{uuid.uuid4().hex[:8]}.jpg"
    cropped.save(os.path.join(target_dir, name), 'JPEG', optimize=True, quality=quality)
    return name


def _remove_if_safe(rel_url, protected_rel_url):
    """Удаляет файл, только если это не тот же файл, что источник."""
    if not rel_url or rel_url == protected_rel_url:
        return
    path = os.path.join(STATIC_ROOT, rel_url)
    if os.path.exists(path):
        os.remove(path)


def backfill_directions(conn):
    with conn.cursor() as cur:
        cur.execute("""SELECT id, source_url, file_url, thumb_url, mobile_url,
                              mobile_focus_x, mobile_focus_y, mobile_zoom
                       FROM directions""")
        rows = cur.fetchall()

    for row in rows:
        if not row['source_url']:
            print(f"[directions #{row['id']}] нет source_url, пропуск")
            continue
        src_path = os.path.join(STATIC_ROOT, row['source_url'])
        if not os.path.exists(src_path):
            print(f"[directions #{row['id']}] файл не найден: {src_path}, пропуск")
            continue

        dir_path = os.path.dirname(src_path)
        desktop_name, thumb_name = make_desktop_and_thumb(src_path, dir_path, prefix='dir')
        mobile_name = make_mobile_crop(
            src_path, dir_path, prefix='dirm',
            focus_x=row['mobile_focus_x'] or 50,
            focus_y=row['mobile_focus_y'] or 50,
            zoom=row['mobile_zoom'] or 1.0,
        )

        rel_dir = os.path.relpath(dir_path, STATIC_ROOT).replace('\\', '/')
        new_file_url = f"{rel_dir}/{desktop_name}"
        new_thumb_url = f"{rel_dir}/{thumb_name}"
        new_mobile_url = f"{rel_dir}/{mobile_name}"

        for old_url in [row['file_url'], row['thumb_url'], row['mobile_url']]:
            _remove_if_safe(old_url, row['source_url'])

        with conn.cursor() as cur:
            cur.execute(
                "UPDATE directions SET file_url=%s, thumb_url=%s, mobile_url=%s WHERE id=%s",
                (new_file_url, new_thumb_url, new_mobile_url, row['id'])
            )
        print(f"[directions #{row['id']}] OK -> {new_file_url} / {new_mobile_url}")

    conn.commit()


def backfill_album_covers(conn):
    with conn.cursor() as cur:
        cur.execute("""SELECT id, slug, cover_source_url, cover_url, cover_thumb_url, cover_mobile_url,
                              cover_mobile_focus_x, cover_mobile_focus_y, cover_mobile_zoom
                       FROM photo_album""")
        rows = cur.fetchall()

    for row in rows:
        if not row['cover_source_url']:
            print(f"[album #{row['id']}] нет cover_source_url, пропуск")
            continue
        src_path = os.path.join(STATIC_ROOT, row['cover_source_url'])
        if not os.path.exists(src_path):
            print(f"[album #{row['id']}] файл не найден: {src_path}, пропуск")
            continue

        album_folder = f"{row['slug']}_{row['id']}"
        base_dir = os.path.join(STATIC_ROOT, 'uploads', 'albums', album_folder)
        full_dir = os.path.join(base_dir, 'cover_full')
        thumb_dir = os.path.join(base_dir, 'cover_thumb')
        mobile_dir = os.path.join(base_dir, 'cover_mobile')

        # thumb_size поднят до 1400px (было 800) — тот же фикс "мыльных"
        # обложек в общей "Галерее", что и в живом коде __init__.py.
        desktop_name, thumb_name = make_desktop_and_thumb(
            src_path, full_dir, prefix='cover', thumb_size=(1400, 1400), thumb_quality=87,
        )
        os.makedirs(thumb_dir, exist_ok=True)
        os.replace(os.path.join(full_dir, thumb_name), os.path.join(thumb_dir, thumb_name))

        # Реальный мобильный кроп 9:16 — если у альбома уже стоит свой
        # cover_mobile_focus_x/y/zoom (значит миграция №2 применена и,
        # возможно, админ уже успел один раз что-то там подвинуть),
        # используем именно эти значения; иначе — центр по умолчанию.
        mobile_name = make_mobile_crop(
            src_path, mobile_dir, prefix='covm',
            focus_x=row.get('cover_mobile_focus_x') or 50,
            focus_y=row.get('cover_mobile_focus_y') or 50,
            zoom=row.get('cover_mobile_zoom') or 1.0,
        )

        new_cover_url = f"uploads/albums/{album_folder}/cover_full/{desktop_name}"
        new_cover_thumb_url = f"uploads/albums/{album_folder}/cover_thumb/{thumb_name}"
        new_cover_mobile_url = f"uploads/albums/{album_folder}/cover_mobile/{mobile_name}"

        for old_url in [row['cover_url'], row['cover_thumb_url'], row.get('cover_mobile_url')]:
            _remove_if_safe(old_url, row['cover_source_url'])

        with conn.cursor() as cur:
            cur.execute(
                "UPDATE photo_album SET cover_url=%s, cover_thumb_url=%s, cover_mobile_url=%s WHERE id=%s",
                (new_cover_url, new_cover_thumb_url, new_cover_mobile_url, row['id'])
            )
        print(f"[album #{row['id']}] OK -> {new_cover_url} / {new_cover_mobile_url}")

    conn.commit()


if __name__ == '__main__':
    connection = get_connection()
    try:
        print("== Направления (категории) ==")
        backfill_directions(connection)
        print("== Обложки альбомов ==")
        backfill_album_covers(connection)
    finally:
        connection.close()
    print("Готово.")
