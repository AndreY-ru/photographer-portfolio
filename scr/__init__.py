import os
import json
import re
import zipfile
import tempfile
from flask import Flask, render_template, url_for, session, request, redirect, flash, jsonify, abort, make_response, send_file, after_this_request
import pymysql
from config import host, user, password, port, db_name, secret_key
from werkzeug.utils import secure_filename
import uuid
from unidecode import unidecode # pip install unidecode (если еще не установил)
from PIL import Image, ImageDraw, ImageFont# Подключаем библиотеку для сжатия фото и вотремраок
import math
import time
import threading
from werkzeug.security import generate_password_hash, check_password_hash
import shutil
from datetime import date
from apscheduler.schedulers.background import BackgroundScheduler  # pip install apscheduler
import atexit
import markdown
from markupsafe import Markup

app = Flask(__name__)
app.secret_key = secret_key

# Сайт работает только по HTTPS (http редиректит на https), поэтому куки
# помечаем Secure — браузер не отправит их по незашифрованному соединению.
# Локально (FLASK_DEBUG=1, обычный http://127.0.0.1) Secure-куку браузер
# не сохранил бы, и вход в админку перестал бы работать — там выключаем.
COOKIES_SECURE = os.environ.get("FLASK_DEBUG") != "1"
app.config['SESSION_COOKIE_SECURE'] = COOKIES_SECURE
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# Версии текста согласия на обработку ПД (templates/pd_consent/<версия>.html).
# Опубликованный текст НЕ правится задним числом: меняете смысл — создаёте
# новый файл с новой датой и дописываете её в КОНЕЦ кортежа (последняя =
# текущая). Старые версии остаются доступны по /pd-consent/<версия>, а в
# client_sessions.pd_consent_version пишется та, которую видел человек.
@app.after_request
def add_security_headers(resp):
    # nosniff — браузер не пытается "угадать", что загруженная картинка на
    # самом деле HTML/скрипт. SAMEORIGIN — сайт (и админку) нельзя тайно
    # встроить во фрейм на чужом сайте и подсунуть клики (clickjacking).
    # Referrer-Policy — в адресе приватного альбома есть ?token=..., и он не
    # должен уходить чужим сайтам (Google Fonts, cdnjs, соцсети по ссылкам).
    resp.headers.setdefault('X-Content-Type-Options', 'nosniff')
    resp.headers.setdefault('X-Frame-Options', 'SAMEORIGIN')
    resp.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
    return resp


PD_CONSENT_VERSIONS = ('2026-10-02',)
PD_CONSENT_VERSION = PD_CONSENT_VERSIONS[-1]
app.jinja_env.globals['PD_CONSENT_VERSION'] = PD_CONSENT_VERSION

UPLOAD_FOLDER = os.path.join(app.root_path, 'static', 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Функция для безопасного получения соединения с БД
def get_db_connection():
    return pymysql.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=db_name,
        cursorclass=pymysql.cursors.DictCursor
    )


# ==========================================
# ОБЩИЙ КОНТЕКСТ ДЛЯ ВСЕХ ПУБЛИЧНЫХ ШАБЛОНОВ
# ==========================================
# Данные владельца сайта (имя, аватар, соцсети) нужны в шапке/подвале
# base.html на КАЖДОЙ публичной странице. Чтобы не дублировать один и тот
# же SELECT в index/gallery/about/album, достаём это один раз здесь —
# Flask сам подставит результат в контекст перед рендером любого шаблона.
@app.context_processor
def inject_site_globals():
    # На админ-роутах эти данные не нужны и БД дергать незачем
    if request.path.startswith('/admin') or request.path.startswith('/api/admin'):
        return {}

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE id = 1")
            site_owner = cursor.fetchone()

            social_links = []
            if site_owner:
                cursor.execute("""
                    SELECT sm.link, ism.title, ism.icon
                    FROM social_media sm
                    JOIN icon_social_media ism ON sm.icon_social_media_id = ism.id
                    WHERE sm.users_id = %s
                """, (site_owner['id'],))
                social_links = cursor.fetchall()
    finally:
        connection.close()

    return dict(
        site_owner=site_owner,
        site_socials=social_links,
        current_year=date.today().year,
    )


@app.url_defaults
def _static_cache_bust(endpoint, values):
    """К адресам своих CSS/JS/шрифтов дописываем ?v=<время изменения файла>.
    Без этого браузер после заливки мог часами держать старые style.css или
    script.js (сервер не говорит, сколько их хранить), и новая разметка шла
    со старыми стилями — отсюда «залил, а не поменялось» до Ctrl+F5. Фото из
    uploads/ не трогаем: имена у них и так уникальные, а stat на каждую
    картинку галереи — лишняя работа."""
    if endpoint != 'static' or 'v' in values:
        return
    filename = values.get('filename') or ''
    if not filename or filename.startswith('uploads/'):
        return
    try:
        values['v'] = int(os.stat(os.path.join(app.static_folder, filename)).st_mtime)
    except OSError:
        pass


# Хелпер для шаблонов: безопасно строит URL на файл в static/uploads,
# с фолбэком на плейсхолдер, если картинки еще нет (пустая БД, альбом
# без обложки и т.п.). Заодно подчищает возможный ведущий "/" в путях
# из icon_social_media (в сидовых данных они вида "/icons/vk.png").
@app.template_global()
def media_url(path, fallback='img/placeholder.jpg'):
    clean = (path or '').lstrip('/')
    return url_for('static', filename=clean or fallback)


@app.template_global()
def abs_url(path):
    """Полный адрес https://сайт/путь — для превью ссылок (Open Graph в base.html):
    Telegram и ВК относительные адреса не понимают. За прокси хостинга Flask
    видит http, поэтому на проде схема всегда https."""
    scheme = 'https' if COOKIES_SECURE else request.scheme
    return f"{scheme}://{request.host}{path}"


# Страницы ошибок «Нет фокуса» (error.html, стили css/error.css). API отвечает
# JSON, а отсутствующие картинки и файлы — коротким текстом: незачем ради
# каждой битой картинки ходить в БД за шапкой и подвалом.
def _render_error(code):
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Не найдено' if code == 404 else 'Ошибка сервера'}), code
    if request.path.startswith('/static/'):
        return ('Not Found' if code == 404 else 'Server Error'), code, {'Content-Type': 'text/plain; charset=utf-8'}
    try:
        return render_template('error.html', code=code), code
    except Exception:
        # Сломалась сама база или шаблон — запасная страница без запросов к БД
        # (через jinja_env, в обход context_processor с владельцем сайта)
        return app.jinja_env.get_template('error_static.html').render(code=code), code


@app.errorhandler(404)
def page_not_found(e):
    return _render_error(404)


@app.errorhandler(500)
def server_error(e):
    return _render_error(500)


# Рендер Markdown для описаний альбома/фото (поле заполняется вручную в
# админке — например, подпись под альбомом или указание модели/автора кадра).
# Источник текста — только сам админ сайта, поэтому сырой HTML внутри
# markdown намеренно не экранируется отдельно (это стандартное поведение
# библиотеки Markdown).
@app.template_filter('phone_pretty')
def phone_pretty(phone):
    """Российский номер в читаемом виде: +7 (999) 123-45-67. Всё, что не
    похоже на 11-значный номер с 7/8 в начале, отдаём как есть."""
    digits = re.sub(r'\D', '', phone or '')
    if len(digits) == 11 and digits[0] in '78':
        return f"+7 ({digits[1:4]}) {digits[4:7]}-{digits[7:9]}-{digits[9:]}"
    return phone or ''


@app.template_filter('link_handle')
def link_handle(link):
    """Короткая подпись к ссылке соцсети для блока контактов на «Обо мне»:
    https://t.me/name → @name, https://www.vk.com/name/ → vk.com/name."""
    text = re.sub(r'^[a-z]+://', '', (link or '').strip(), flags=re.I)
    text = re.sub(r'^www\.', '', text, flags=re.I).rstrip('/')
    if re.match(r'^(t\.me|telegram\.me)/', text, flags=re.I):
        return '@' + text.split('/', 1)[1]
    return text


@app.template_filter('markdown')
def render_markdown(text):
    if not text:
        return ''
    html = markdown.markdown(text, extensions=['nl2br', 'fenced_code'])
    return Markup(html)


@app.before_request
def require_admin_login():
    protected = request.path.startswith('/admin') or request.path.startswith('/api/admin')
    if not protected or request.path == '/admin/login':
        return

    if not session.get('admin_id'):
        if request.path.startswith('/api/'):
            return jsonify({'error': 'Требуется авторизация'}), 401
        return redirect(url_for('admin_login', next=request.path))


_ALBUM_ORIGINAL_PATH = re.compile(r'^/static/uploads/albums/[^/]+_(\d+)/(full|thumb)/')


@app.before_request
def _protect_watermarked_originals():
    """В альбоме с водяным знаком (клиент ещё отбирает/не оплатил) оригиналы
    (full/) и чистые миниатюры (thumb/) отдаём только администратору. Иначе
    знак обходился бы прямой ссылкой на файл — посетителю страница альбома
    теперь везде показывает версии со знаком. Альбомы без знака не трогаем."""
    m = _ALBUM_ORIGINAL_PATH.match(request.path)
    if not m or session.get('admin_id'):
        return
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT is_watermark_enabled FROM photo_album WHERE id = %s", (int(m.group(1)),))
            album = cursor.fetchone()
    finally:
        connection.close()
    if album and album['is_watermark_enabled']:
        abort(404)


# Защита от подбора пароля: после LOGIN_MAX_FAILS неудачных попыток за
# LOGIN_LOCK_MINUTES минут вход с этого IP закрыт, пока самая старая из них
# не «отлежится». Попытки лежат в БД (login_attempts), а не в памяти:
# Passenger может держать несколько процессов и перезапускать их.
LOGIN_MAX_FAILS = 5
LOGIN_LOCK_MINUTES = 15


def _client_ip():
    """IP посетителя. За прокси хостинга (nginx перед Apache) remote_addr —
    это сам прокси, тогда настоящий адрес в X-Real-IP / X-Forwarded-For.
    Заголовкам верим только от локального прокси: иначе подборщик подставлял
    бы каждый раз новый «IP» и обходил блокировку."""
    ip = request.remote_addr or ''
    if ip.startswith(('127.', '10.', '192.168.', '::1')) or re.match(r'^172\.(1[6-9]|2\d|3[01])\.', ip):
        forwarded = request.headers.get('X-Real-IP') or request.headers.get('X-Forwarded-For', '').split(',')[-1]
        ip = forwarded.strip() or ip
    return ip[:45]


def _login_lock_minutes(cursor, ip):
    """Сколько минут ещё закрыт вход с этого IP (0 — открыт)."""
    cursor.execute(f"""SELECT COUNT(*) AS n, MIN(attempted_at) AS first_at FROM login_attempts
                       WHERE ip = %s AND attempted_at > NOW() - INTERVAL {LOGIN_LOCK_MINUTES} MINUTE""", (ip,))
    row = cursor.fetchone() or {}
    if (row.get('n') or 0) < LOGIN_MAX_FAILS or not row.get('first_at'):
        return 0
    cursor.execute("SELECT TIMESTAMPDIFF(SECOND, NOW(), %s + INTERVAL %s MINUTE) AS s",
                   (row['first_at'], LOGIN_LOCK_MINUTES))
    seconds = (cursor.fetchone() or {}).get('s') or 0
    return max(1, math.ceil(seconds / 60))


@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    if session.get('admin_id'):
        return redirect(url_for('admin_dashboard'))

    if request.method == 'POST':
        login = request.form.get('login', '').strip()
        password_input = request.form.get('password', '')
        ip = _client_ip()

        connection = get_db_connection()
        try:
            with connection.cursor() as cursor:
                try:
                    lock = _login_lock_minutes(cursor, ip)
                except pymysql.MySQLError:
                    # Нет таблицы login_attempts (не выполнен SQL из db/) — вход не ломаем
                    lock = None
                if lock:
                    # Пароль даже не проверяем — иначе перебор продолжался бы
                    flash(f'Слишком много неудачных попыток. Попробуйте через {lock} '
                          f'{ru_plural(lock, "минуту", "минуты", "минут")}.')
                    return redirect(url_for('admin_login'))
                cursor.execute("SELECT id, hash_password, is_active FROM users WHERE login = %s", (login,))
                user_row = cursor.fetchone()
                ok = bool(user_row and user_row['is_active']
                          and check_password_hash(user_row['hash_password'], password_input))
                if lock is not None:
                    if ok:
                        cursor.execute("DELETE FROM login_attempts WHERE ip = %s", (ip,))
                    else:
                        cursor.execute("INSERT INTO login_attempts (ip) VALUES (%s)", (ip,))
                        cursor.execute("DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL 1 DAY")
                    connection.commit()
        finally:
            connection.close()

        if ok:
            session.clear()
            session['admin_id'] = user_row['id']
            next_url = request.form.get('next') or request.args.get('next') or ''
            # Только путь внутри этого сайта: без проверки ссылка вида
            # /admin/login?next=https://чужой-сайт после входа уводила бы на
            # чужой сайт (подделка страницы входа, фишинг). "//host" и "/\host"
            # браузер тоже понимает как чужой сайт — их отсекаем отдельно.
            if not next_url.startswith('/') or next_url.startswith(('//', '/\\')):
                next_url = url_for('admin_dashboard')
            return redirect(next_url)

        # Пауза после неверного пароля — перебор паролей становится в разы
        # медленнее, а живому человеку секунда не мешает.
        time.sleep(1)
        flash('Неверный логин или пароль')
        return redirect(url_for('admin_login'))

    return render_template('login.html')


@app.route('/admin/logout', methods=['POST'])
def admin_logout():
    session.clear()
    return redirect(url_for('admin_login'))

# Вспомогательная функция для генерации URL
def generate_slug(text):
    base_slug = unidecode(text).lower()
    # Убираем все спецсимволы, заменяем пробелы на тире
    base_slug = ''.join(e for e in base_slug if e.isalnum() or e.isspace()).replace(' ', '-')
    # Добавляем случайные символы, чтобы slug точно был уникальным
    return f"{base_slug}-{uuid.uuid4().hex[:6]}"


# ==========================================
# СКАЧИВАНИЕ АЛЬБОМОМ/ПОДБОРКОЙ ЦЕЛИКОМ (ZIP)
# ==========================================
def _guess_extension_from_file(disk_path, fallback='.jpg'):
    """Определяет реальный формат файла по содержимому (Pillow), а не по
    имени на диске — страховка для уже загруженных файлов, у которых имя
    на диске потеряло расширение (см. _safe_upload_filename — чинит это
    для новых загрузок, а старые файлы на диске уже как есть)."""
    try:
        with Image.open(disk_path) as img:
            fmt = (img.format or '').upper()
        return {
            'JPEG': '.jpg', 'PNG': '.png', 'WEBP': '.webp',
            'GIF': '.gif', 'BMP': '.bmp', 'TIFF': '.tiff', 'HEIF': '.heic',
        }.get(fmt, fallback)
    except Exception:
        return fallback


def _original_photo_name(file_url, original_filename=None):
    """Исходное имя фото без расширения ("DSC01234", "У кафе (1)") — как оно
    было у фотографа на компьютере. Нужно, чтобы найти отобранные клиентом
    фото среди RAW поиском по имени.
    С 2026-10-05 точное имя хранится в photo.original_filename. У фото,
    загруженных раньше, его восстанавливаем из имени файла на сервере
    (api_upload_photo: случайный префикс + имя), но там кириллица уже
    транслитерирована, а пробелы заменены на "_" (_safe_upload_filename).
    Если имя потеряно (старый баг с голым расширением) — None."""
    if original_filename:
        return os.path.splitext(original_filename)[0] or original_filename
    basename = os.path.basename(file_url or '')
    root = os.path.splitext(re.sub(r'^[0-9a-f]{8}_', '', basename))[0]
    if not root or root.lower() in {e.lstrip('.') for e in _ALLOWED_UPLOAD_EXTS}:
        return None
    return root


def _nice_photo_filename(photo, disk_path=None):
    """Человекочитаемое имя файла для zip-архива. Если у фото задан
    заголовок (photo.title) — используем его + расширение. Иначе
    восстанавливаем оригинальное имя, срезая наш случайный 8-значный
    префикс (см. api_upload_photo: unique_name = f"{hex8}_{имя}").
    Для файлов, у которых на диске расширение потерялось (старый баг с
    кириллическими именами — см. _safe_upload_filename), определяем
    формат по содержимому файла, а не по обрубленному имени: иначе имя
    вида "<hash>_jpg" (без точки) превратилось бы в файл без расширения
    в самом архиве, что и было исходной жалобой."""
    url = photo.get('display_url') or photo.get('file_url') or ''
    basename = os.path.basename(url)
    ext = os.path.splitext(basename)[1].lower()
    if ext not in _ALLOWED_UPLOAD_EXTS:
        ext = _guess_extension_from_file(disk_path) if disk_path else '.jpg'

    stripped = re.sub(r'^[0-9a-f]{8}_', '', basename)
    root = os.path.splitext(stripped)[0]
    # Если весь "корень" имени — это на самом деле голое расширение без
    # точки (тот самый баг), то настоящее оригинальное имя потеряно
    # безвозвратно — используем нейтральное "photo" вместо "jpg.jpg".
    if not root or root.lower().lstrip('.') in {e.lstrip('.') for e in _ALLOWED_UPLOAD_EXTS}:
        root = None

    if photo.get('title'):
        # unidecode ДО secure_filename — иначе кириллический заголовок
        # (а вы почти наверняка будете вводить его по-русски) схлопнется
        # в пустую строку, и файл в архиве получится с именем буквально
        # ".jpg" (без основы) — это и была вторая часть бага.
        return (secure_filename(unidecode(photo['title'])) or 'photo') + ext
    if root:
        return f"{secure_filename(root) or 'photo'}{ext}"
    return f"photo{ext}"


def _build_zip_from_photos(photos):
    """Собирает zip во временный файл из списка фото (словари как минимум
    с file_url/display_url, опционально title). Имена внутри архива —
    человекочитаемые (см. _nice_photo_filename), с порядковым префиксом и
    защитой от совпадений. Возвращает путь к .zip — вызывающий код должен
    сам удалить его после отправки (см. after_this_request в роутах)."""
    fd, zip_path = tempfile.mkstemp(suffix='.zip', prefix='album_')
    os.close(fd)
    used_names = set()
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for i, photo in enumerate(photos, start=1):
            rel_url = photo.get('display_url') or photo.get('file_url')
            if not rel_url:
                continue
            disk_path = os.path.join(app.root_path, 'static', rel_url)
            if not os.path.exists(disk_path):
                continue
            name = _nice_photo_filename(photo, disk_path=disk_path)
            arcname = f"{i:03d}_{name}"
            while arcname in used_names:
                arcname = f"{i:03d}_{uuid.uuid4().hex[:4]}_{name}"
            used_names.add(arcname)
            zf.write(disk_path, arcname=arcname)
    return zip_path


def _send_zip_and_cleanup(zip_path, download_name):
    """Отдаёт zip как файл на скачивание и удаляет временный файл сразу
    после того, как ответ ушёл клиенту (after_request-хук — а не сразу
    после send_file, потому что отправка тела идёт уже ПОСЛЕ return)."""
    @after_this_request
    def _cleanup(response):
        try:
            os.remove(zip_path)
        except OSError:
            pass
        return response

    return send_file(zip_path, as_attachment=True, download_name=download_name)


# ==========================================
# НАДЁЖНОЕ ИМЯ ФАЙЛА ПРИ ЗАГРУЗКЕ (сохраняем расширение)
# ==========================================
# werkzeug.secure_filename() выкидывает не-ASCII символы (кириллицу) через
# NFKD-нормализацию. Для файла "Постер.jpg" от него остаётся буквально
# "jpg" — БЕЗ ТОЧКИ (сам werkzeug ещё и режет ведущую точку — защита от
# скрытых файлов). В итоге на диске файл сохранялся без расширения
# вообще. Браузер это в <img> не замечает (сам определяет формат по
# содержимому), но при скачивании zip-архивом файл уезжал без формата —
# это баг, а не особенность. Извлекаем и проверяем расширение ОТДЕЛЬНО,
# до всякой чистки остального имени, и всегда приклеиваем его обратно.
_ALLOWED_UPLOAD_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif', '.bmp', '.tiff', '.tif'}


def _safe_upload_filename(original_filename):
    """Возвращает безопасное имя файла, которое ГАРАНТИРОВАННО не теряет
    расширение — даже если исходное имя было целиком на кириллице.
    unidecode транслитерирует кириллицу в латиницу ("Постер" -> "Poster")
    ДО secure_filename — тот сам по себе просто выкидывает не-ASCII
    символы (см. коммент выше), от "Постер.jpg" в итоге осталось бы
    голое "jpg" без точки. Тот же unidecode уже используется в проекте
    для слагов (см. generate_unique_slug выше), тут просто переиспользуем
    тот же приём для имён файлов."""
    root, ext = os.path.splitext(original_filename or '')
    ext = ext.lower()
    if ext not in _ALLOWED_UPLOAD_EXTS:
        ext = '.jpg'
    safe_root = secure_filename(unidecode(root)) or 'photo'
    return f"{safe_root}{ext}"


# Вспомогательная функция для сохранения файла с миниатюрой
def save_with_thumbnail(file_storage, target_dir, prefix, thumb_size=(400, 400),
                         full_max_size=(2200, 2200), full_quality=82):
    """Сохраняет СЖАТУЮ «полную» версию (не сырой оригинал!) + отдельную
        ещё более сжатую миниатюру для превью. Раньше «полная» версия
        сохранялась как есть (file_storage.save() без обработки) — то есть
        прямо с камеры/телефона, по 8-15 МБ за штуку. Теперь она тоже
        проходит через Pillow: ужимается до full_max_size по длинной
        стороне и пережимается с quality=82 — этого достаточно даже для
        полноэкранного показа на десктопе, а весит в разы меньше.
        Возвращает (имя_полной_версии, имя_миниатюры) — уже без пути к папке."""
    os.makedirs(target_dir, exist_ok=True)
    filename = _safe_upload_filename(file_storage.filename)
    unique = f"{prefix}_{uuid.uuid4().hex[:8]}_{filename}"
    full_path = os.path.join(target_dir, unique)

    img = Image.open(file_storage)
    if img.mode != 'RGB':
        img = img.convert('RGB')
    img.thumbnail(full_max_size)
    img.save(full_path, 'JPEG', optimize=True, quality=full_quality)
    stamp_photo_metadata(full_path)

    thumb_name = f"thumb_{unique}"
    thumb_img = img.copy()
    thumb_img.thumbnail(thumb_size)
    thumb_img.save(os.path.join(target_dir, thumb_name), 'JPEG', optimize=True, quality=85)
    stamp_photo_metadata(os.path.join(target_dir, thumb_name))

    return unique, thumb_name


# ==========================================
# ИСТОЧНИК + ДЕСКТОП-ВЕРСИЯ + МОБИЛЬНЫЙ КРОП
# ==========================================
# Раньше «фокус/зум» под мобилку (mobile_focus_x/y, mobile_zoom,
# cover_focus_x/y и т.д.) были ЧИСТО косметикой на фронте: CSS
# object-position просто сдвигал показ ВСЕГО оригинального файла — то
# есть телефон всё равно скачивал полный ландшафтный кадр целиком, просто
# показывал от него узкую вертикальную полоску. Ниже — набор функций,
# которые реально нарезают под мобилку отдельный маленький файл, а
# исходник при этом хранят вечно и не трогают, чтобы фокус можно было
# сколько угодно раз перенастроить без потери качества («сжатие сжатого»).

def save_original(file_storage, target_dir, prefix):
    """Сохраняет файл ПОЛНОСТЬЮ как есть, без какой-либо обработки — это
        «источник». Он не показывается на сайте напрямую, из него только
        пересобираются десктоп-версия/превью/мобильный кроп. Никогда не
        пережимаем его повторно."""
    os.makedirs(target_dir, exist_ok=True)
    filename = _safe_upload_filename(file_storage.filename)
    unique = f"{prefix}src_{uuid.uuid4().hex[:8]}_{filename}"
    full_path = os.path.join(target_dir, unique)
    file_storage.save(full_path)
    stamp_photo_metadata(full_path)
    return unique, full_path


def make_desktop_and_thumb(source_path, target_dir, prefix,
                            full_max_size=(2200, 2200), full_quality=82,
                            thumb_size=(400, 400), thumb_quality=85):
    """Из «источника» делает сжатую десктоп-версию (то, что раньше было
        просто сырым file_url) + маленькую миниатюру для списков в
        админке. Возвращает (имя_десктоп_версии, имя_миниатюры)."""
    os.makedirs(target_dir, exist_ok=True)
    img = Image.open(source_path)
    if img.mode != 'RGB':
        img = img.convert('RGB')

    desktop_name = f"{prefix}_{uuid.uuid4().hex[:8]}.jpg"
    desktop_img = img.copy()
    desktop_img.thumbnail(full_max_size)
    desktop_img.save(os.path.join(target_dir, desktop_name), 'JPEG', optimize=True, quality=full_quality)
    stamp_photo_metadata(os.path.join(target_dir, desktop_name))

    thumb_name = f"thumb_{desktop_name}"
    thumb_img = img.copy()
    thumb_img.thumbnail(thumb_size)
    thumb_img.save(os.path.join(target_dir, thumb_name), 'JPEG', optimize=True, quality=thumb_quality)
    stamp_photo_metadata(os.path.join(target_dir, thumb_name))

    return desktop_name, thumb_name


def make_mobile_crop(source_path, target_dir, prefix, focus_x=50, focus_y=50, zoom=1.0,
                      target_ratio=(9, 16), out_width=900, quality=80):
    """Реальный кроп под мобильный портрет (по умолчанию 9:16) — берём
        область нужных пропорций из ОРИГИНАЛА (не из десктоп-версии, чтобы
        не терять резкость на уже сжатом кадре), центрированную на
        focus_x/focus_y (%) и уменьшенную в зависимости от zoom (те же
        значения, что крутят в админке слайдером). На выходе — уже узкий
        и лёгкий файл: телефон скачивает только его, а не весь ландшафтный
        оригинал целиком."""
    img = Image.open(source_path)
    if img.mode != 'RGB':
        img = img.convert('RGB')
    W, H = img.size
    ratio_w, ratio_h = target_ratio

    # Самый большой бокс нужного соотношения сторон, который влезает в фото
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
    stamp_photo_metadata(os.path.join(target_dir, name))
    return name


# Вспомогательная функция для сохранения файла с миниатюрой и водяным знаком
def save_compressed_image(file_storage, target_dir, prefix, max_size=(500, 500), quality=85):
    """Сохраняет ТОЛЬКО одну сжатую версию (без отдельного оригинала).
        Для случаев, где полный размер никогда не нужен — например, аватар."""
    os.makedirs(target_dir, exist_ok=True)
    filename = _safe_upload_filename(file_storage.filename)
    unique_name = f"{prefix}_{uuid.uuid4().hex[:8]}_{filename}"

    img = Image.open(file_storage)
    if img.mode != 'RGB':
        img = img.convert('RGB')
    img.thumbnail(max_size)
    img.save(os.path.join(target_dir, unique_name), 'JPEG', optimize=True, quality=quality)
    stamp_photo_metadata(os.path.join(target_dir, unique_name))

    return unique_name


# ==========================================
# EXIF: авто-извлечение метаданных камеры при загрузке
# ==========================================
def _exif_shutter_speed(exposure_time):
    """Превращает время выдержки в человекочитаемый вид: '1/320' или '2s'."""
    try:
        val = float(exposure_time)
    except (TypeError, ValueError, ZeroDivisionError):
        return None
    if val <= 0:
        return None
    if val >= 1:
        return f"{val:g}s"
    denom = round(1 / val)
    if denom <= 0:
        return None
    return f"1/{denom}"


# ==========================================
# МЕТАДАННЫЕ ФАЙЛОВ: автор и удаление геометок
# ==========================================
_EXIF_HEADER = b'Exif\x00\x00'
_XMP_HEADER = b'http://ns.adobe.com/xap/1.0/\x00'


def _photo_author_name():
    """Имя автора для метаданных — из профиля владельца (users.id = 1)."""
    try:
        connection = get_db_connection()
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT name, surname FROM users WHERE id = 1")
                row = cursor.fetchone()
        finally:
            connection.close()
    except Exception:
        return ''
    return f"{row.get('name') or ''} {row.get('surname') or ''}".strip() if row else ''


def stamp_photo_metadata(path, author=None):
    """Правит метаданные JPEG-файла БЕЗ перекодирования картинки (пиксели
    не трогаются — меняются только служебные блоки в начале файла):
    - удаляет геометки: GPS из EXIF и из XMP (туда их пишет Lightroom) —
      иначе с фото с телефона любой посетитель узнал бы место съёмки;
    - прописывает автора: Artist и Copyright (поля EXIF только латиницей —
      имя транслитерируется) и XPAuthor кириллицей — его показывает Windows
      в "Свойства → Подробно → Авторы".
    Вызывается после каждого сохранения картинки. Не-JPEG и нестандартные
    файлы молча пропускает: загрузку это ломать не должно."""
    try:
        with open(path, 'rb') as f:
            data = f.read()
        if data[:2] != b'\xff\xd8':
            return

        # Разбираем начало файла на сегменты до начала самих данных (SOS)
        segments, i = [], 2
        while i + 4 <= len(data) and data[i] == 0xFF:
            marker = data[i + 1]
            if marker == 0xFF:  # байт-заполнитель между сегментами
                i += 1
                continue
            if marker == 0xDA:  # дальше — сжатая картинка, её не трогаем
                break
            seg_len = int.from_bytes(data[i + 2:i + 4], 'big')
            segments.append((marker, data[i:i + 2 + seg_len]))
            i += 2 + seg_len
        else:
            return  # файл не похож на обычный JPEG — не рискуем
        image_data = data[i:]

        with Image.open(path) as img:
            exif = img.getexif()
        if 0x8825 in exif:  # ссылка на блок GPS
            del exif[0x8825]
        if author is None:
            author = _photo_author_name()
        if author:
            # Латиницей — как подписываешься сам (PHOTO_AUTHOR_LATIN в .env /
            # настройках приложения на хостинге), иначе автотранслит имени.
            latin = os.environ.get('PHOTO_AUTHOR_LATIN') or unidecode(author).replace("'", "")
            exif[0x013B] = latin                                            # Artist
            exif[0x8298] = f"(c) {date.today().year} {latin}. All rights reserved."  # Copyright
            exif[0x9C9D] = (author + '\x00').encode('utf-16-le')             # XPAuthor
        new_exif = exif.tobytes()
        if not new_exif.startswith(_EXIF_HEADER):
            new_exif = _EXIF_HEADER + new_exif
        if len(new_exif) + 2 > 0xFFFF:
            return  # огромный EXIF (вшитое превью) в один блок не влезет — не трогаем
        new_app1 = b'\xff\xe1' + (len(new_exif) + 2).to_bytes(2, 'big') + new_exif

        kept = []
        for marker, seg in segments:
            payload = seg[4:]
            if marker == 0xE1 and payload.startswith(_EXIF_HEADER):
                continue  # старый EXIF — заменяем новым
            if marker == 0xE1 and payload.startswith(_XMP_HEADER) and b'GPS' in payload:
                continue  # XMP с координатами — выкидываем целиком
            kept.append((marker, seg))

        # EXIF должен идти сразу после SOI (или после JFIF-заголовка APP0)
        head = [seg for marker, seg in kept[:1] if marker == 0xE0]
        rest = [seg for marker, seg in kept[len(head):]]
        result = b'\xff\xd8' + b''.join(head) + new_app1 + b''.join(rest) + image_data

        tmp_path = path + '.tmp'
        with open(tmp_path, 'wb') as f:
            f.write(result)
        os.replace(tmp_path, path)
    except Exception as e:
        print(f"[stamp_photo_metadata] {path}: {e}")


def _exif_exposure_bias(bias):
    """Экспокоррекция в виде '+0.7 EV' / '-1 EV'. Ноль не показываем —
    это обычный кадр без коррекции, лишний бейдж только шумит."""
    try:
        val = float(bias)
    except (TypeError, ValueError, ZeroDivisionError):
        return None
    if not math.isfinite(val) or abs(val) < 0.05:
        return None
    return f"{val:+.1f}".rstrip('0').rstrip('.') + " EV"


def _exif_flash(flash):
    """Тег Flash — битовая маска: бит 0 = вспышка сработала, бит 5 = у
    камеры нет вспышки вообще. Показываем только факт срабатывания —
    "без вспышки" на каждом втором кадре никому не интересно."""
    try:
        val = int(flash)
    except (TypeError, ValueError):
        return None
    if val & 0x20:
        return None
    return "Со вспышкой" if val & 0x01 else None


def extract_exif_data(image_path):
    """Достаёт camera/lens/focal/speed/aperture/iso/ev/flash из EXIF файла.
    Если поля нет в файле (или EXIF отсутствует вовсе) — просто None
    в соответствующем ключе, ничего не падает и не мешает загрузке фото."""
    result = {'camera': None, 'lens': None, 'focal': None,
              'speed': None, 'aperture': None, 'iso': None,
              'ev': None, 'flash': None}
    try:
        with Image.open(image_path) as img:
            exif = img.getexif()
            if not exif:
                return result

            make = str(exif.get(271, '') or '').strip()
            model = str(exif.get(272, '') or '').strip()
            if model and make and make.lower() not in model.lower():
                result['camera'] = f"{make} {model}"
            else:
                result['camera'] = model or make or None

            exif_ifd = {}
            try:
                exif_ifd = exif.get_ifd(0x8769) or {}  # ExifIFD
            except Exception:
                pass

            lens = exif_ifd.get(42036) or exif_ifd.get(42035)  # LensModel / LensMake
            lens = str(lens or '').strip()
            # Sony с мануальным/адаптированным объективом пишет сюда "----"
            if lens.strip('-'):
                result['lens'] = lens

            focal = exif_ifd.get(37386)  # FocalLength
            if focal:
                try:
                    result['focal'] = f"{float(focal):.0f}mm"
                except (TypeError, ValueError):
                    pass

            exposure = exif_ifd.get(33434)  # ExposureTime
            if exposure:
                speed = _exif_shutter_speed(exposure)
                if speed:
                    result['speed'] = speed

            fnumber = exif_ifd.get(33437)  # FNumber
            if fnumber:
                try:
                    result['aperture'] = f"f/{float(fnumber):g}"
                except (TypeError, ValueError):
                    pass

            iso = exif_ifd.get(34855) or exif_ifd.get(34867)  # ISOSpeedRatings / PhotographicSensitivity
            if iso:
                result['iso'] = f"ISO {iso}"

            result['ev'] = _exif_exposure_bias(exif_ifd.get(37380))  # ExposureBiasValue
            result['flash'] = _exif_flash(exif_ifd.get(37385))  # Flash
    except Exception:
        # Битый/нестандартный EXIF (или файл без него вовсе) не должен
        # ронять загрузку фото — просто возвращаем пустые поля.
        pass
    return result


# ==========================================
# РОУТЫ АДМИНКИ
# ==========================================

_WATERMARK_FONT_PATH = os.path.join(app.root_path, 'fonts', 'Manrope-VariableFont_wght.ttf')


def watermark_thumb_url(watermark_path):
    """Миниатюра со знаком лежит рядом с самим файлом со знаком:
    .../watermarked/wm_<id>.jpg -> .../watermarked/wm_<id>_thumb.jpg.
    Работает и для URL из БД, и для пути на диске."""
    root, ext = os.path.splitext(watermark_path)
    return f"{root}_thumb{ext}"


def _remove_watermark_files(watermark_url):
    """Удаляет с диска файл со знаком и его миниатюру (если есть)."""
    if not watermark_url:
        return
    for rel in (watermark_url, watermark_thumb_url(watermark_url)):
        path = os.path.join(app.root_path, 'static', rel)
        if os.path.exists(path):
            os.remove(path)


def apply_watermark(image_path, watermark_text, output_dir):
    try:
        img = Image.open(image_path).convert("RGBA")
        width, height = img.size
        
        # Шрифт лежит в самом проекте (scr/fonts, Manrope — тот же, что у
        # интерфейса сайта, лицензия OFL — см. fonts/OFL.txt). Раньше тут
        # искался системный arial.ttf: на Linux-хостинге его нет, и Pillow
        # молча брал встроенный шрифт — всегда 10px, какого бы размера ни было
        # фото, и без кириллицы ("ВЕЛИКАЯ ХОРО МУДРАЯ" рисовалось квадратиками).
        font_size = max(14, int(width / 50))  # "средний" — выбран владельцем по образцам (~38px на 1920)
        try:
            font = ImageFont.truetype(_WATERMARK_FONT_PATH, font_size)
            try:
                font.set_variation_by_name('Bold')  # по умолчанию файл — самое тонкое начертание
            except Exception:
                pass
        except OSError:
            font = ImageFont.load_default(size=font_size)
            
        pattern_size = int(math.hypot(width, height))
        pattern = Image.new('RGBA', (pattern_size, pattern_size), (0,0,0,0))
        pattern_draw = ImageDraw.Draw(pattern)
        
        # Получаем размеры текста
        text_bbox = pattern_draw.textbbox((0, 0), watermark_text, font=font)
        tw = text_bbox[2] - text_bbox[0]
        th = text_bbox[3] - text_bbox[1]
        
        step_x = tw + int(width * 0.1)
        step_y = th + int(height * 0.1)
        if step_x < 50: step_x = 150
        if step_y < 20: step_y = 100
        
        for x in range(0, pattern_size, int(step_x)):
            for y in range(0, pattern_size, int(step_y)):
                # МАГИЯ ВИДИМОСТИ: Белый текст (opacity 110) + Черная обводка (opacity 110)
                pattern_draw.text((x, y), watermark_text, font=font,
                                    fill=(255, 255, 255, 110),
                                    stroke_width=2,
                                    stroke_fill=(0, 0, 0, 110))
                
        pattern = pattern.rotate(30, expand=False, resample=Image.BICUBIC)
        
        transparent = Image.new('RGBA', (width, height), (0,0,0,0))
        offset_x = (width - pattern_size) // 2
        offset_y = (height - pattern_size) // 2
        transparent.paste(pattern, (offset_x, offset_y), mask=pattern)
        
        watermarked = Image.alpha_composite(img, transparent).convert("RGB")

        # Имя — СЛУЧАЙНОЕ. Раньше было wm_<имя исходника>, и по адресу
        # картинки с водяным знаком (он виден любому посетителю) угадывался
        # адрес оригинала без знака в соседней папке full/.
        wm_filename = f"wm_{uuid.uuid4().hex}.jpg"

        # Сохраняем в переданную папку альбома
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, wm_filename)

        watermarked.save(output_path, "JPEG", optimize=True, quality=80)
        stamp_photo_metadata(output_path)

        # Миниатюра для сетки альбома — тоже со знаком: обычная thumb/ (1000px)
        # без знака, и её можно было просто сохранить вместо оригинала.
        thumb = watermarked.copy()
        thumb.thumbnail((1000, 1000))
        thumb_path = watermark_thumb_url(output_path)  # wm_<…>.jpg -> wm_<…>_thumb.jpg
        thumb.save(thumb_path, "JPEG", optimize=True, quality=85)
        stamp_photo_metadata(thumb_path)

        # Возвращаем относительный путь
        relative_dir = os.path.relpath(output_dir, app.config['UPLOAD_FOLDER']).replace('\\', '/')
        return f"uploads/{relative_dir}/{wm_filename}"
    except Exception as e:
        print("Ошибка наложения водяного знака:", e)
        return None

    
# 1. Дашборд (Главный экран админки)
@app.route('/admin')
def admin_dashboard():
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Альбомы
            sql_albums = """
                SELECT a.*, c.name as category_name,
                        (SELECT COUNT(*) FROM photo WHERE album_id = a.id AND is_spacer = 0) as photo_count,
                        (SELECT COUNT(*) FROM client_selections cs
                        JOIN photo p ON cs.photo_id = p.id
                        WHERE p.album_id = a.id) as total_likes
                FROM photo_album a
                LEFT JOIN category c ON a.category_id = c.id
                ORDER BY a.sort_order ASC, a.created_at DESC
            """
            cursor.execute(sql_albums)
            albums = cursor.fetchall()
            
            # --- НОВОЕ: Считаем, сколько дней осталось до удаления ---
            today = date.today()
            for album in albums:
                if album['expires_at']:
                    delta = (album['expires_at'] - today).days
                    album['days_left'] = delta if delta > 0 else 0
                else:
                    album['days_left'] = None

            # Категории
            cursor.execute("SELECT * FROM category ORDER BY is_active DESC, id ASC")
            categories = cursor.fetchall()

            # Направления
            sql_directions = """
                SELECT d.*, c.name as category_name 
                FROM directions d
                LEFT JOIN category c ON d.category_id = c.id
                ORDER BY d.sort_order
            """
            cursor.execute(sql_directions)
            directions = cursor.fetchall()

            # Услуги
            cursor.execute("SELECT * FROM services ORDER BY sort_order ASC, id ASC")
            services = cursor.fetchall()

            # Слайдеры ретуши
            cursor.execute("SELECT * FROM retouch_sliders ORDER BY sort_order ASC, id ASC")
            retouch_sliders = cursor.fetchall()
            
            # Данные профиля
            cursor.execute("SELECT * FROM users WHERE id = 1")
            admin_user = cursor.fetchone()
            
            # Мои привязанные соцсети
            cursor.execute("""
                SELECT sm.id, sm.link, ism.title, ism.icon 
                FROM social_media sm 
                JOIN icon_social_media ism ON sm.icon_social_media_id = ism.id 
                WHERE sm.users_id = 1
            """)
            social_links = cursor.fetchall()
            
            # Справочник соцсетей
            cursor.execute("SELECT * FROM icon_social_media")
            social_icons = cursor.fetchall()

            # Достижения (для вкладки "Настройки профиля")
            cursor.execute("SELECT * FROM achievements WHERE users_id = 1 ORDER BY sort_order ASC, id ASC")
            achievements = cursor.fetchall()

    finally:
        connection.close()

    return render_template('admin.html',
                        albums=albums, categories=categories, directions=directions,
                        services=services, retouch_sliders=retouch_sliders,
                        admin_user=admin_user, social_links=social_links, social_icons=social_icons,
                        achievements=achievements,
                        open_album_id=request.args.get('album_id', type=int))


# API: Получить данные альбома, фото и СПРАВОЧНИК СЕТОК
@app.route('/api/admin/album/<int:album_id>', methods=['GET'])
def api_get_album(album_id):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM photo_album WHERE id = %s", (album_id,))
            album = cursor.fetchone()
            
            # ДОБАВИЛ p.sort_order В ВЫБОРКУ
            cursor.execute("""
                SELECT p.id, p.file_url, p.thumb_url, p.grid_class_id, gc.slug as grid_class_slug, p.focus_x, p.focus_y, p.zoom, p.sort_order,
                       p.title, p.description, p.exif_camera, p.exif_lens, p.exif_focal, p.exif_speed, p.exif_aperture, p.exif_iso,
                       p.exif_ev, p.exif_flash, p.is_spacer
                FROM photo p
                LEFT JOIN grid_class gc ON p.grid_class_id = gc.id
                WHERE p.album_id = %s
                ORDER BY p.sort_order ASC, p.id DESC
            """, (album_id,))
            photos = cursor.fetchall()
            
            cursor.execute("SELECT id, slug, name FROM grid_class")
            grid_classes = cursor.fetchall()
            
            return jsonify({'album': album, 'photos': photos, 'grid_classes': grid_classes})
    finally:
        connection.close()

# API: Массовое обновление сортировки альбомов (Drag & Drop)
@app.route('/api/admin/albums/reorder', methods=['POST'])
def api_reorder_albums():
    data = request.json
    album_ids = data.get('album_ids', []) # Массив ID в новом порядке
    
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Переназначаем приоритеты от 0 до N в зависимости от их места на экране
            for index, a_id in enumerate(album_ids):
                cursor.execute("UPDATE photo_album SET sort_order = %s WHERE id = %s", (index, a_id))
            connection.commit()
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        connection.close()

# API: Точечное обновление сортировки альбома (Ручной ввод цифры)
@app.route('/api/admin/album/<int:album_id>/sort', methods=['PUT'])
def api_update_album_sort(album_id):
    data = request.json
    sort_order = data.get('sort_order', 0)
    
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("UPDATE photo_album SET sort_order = %s WHERE id = %s", (sort_order, album_id))
            connection.commit()
        return jsonify({'status': 'success'})
    finally:
        connection.close()



# API: Загрузка новых фотографий в альбом с АВТООПРЕДЕЛЕНИЕМ СЕТКИ И ВОДЯНЫМ ЗНАКОМ
# API: какие из выбранных к загрузке файлов уже есть в альбоме (по имени).
# Сравниваем с точным исходным именем (photo.original_filename), а у фото,
# загруженных до 2026-10-05, — с именем файла на сервере без случайного
# префикса: оно получается из исходного тем же _safe_upload_filename, так что
# находятся и старые фото с кириллицей. Окно выбора «заменить / копия /
# пропустить» — admin.js, handleFiles.
@app.route('/api/admin/album/<int:album_id>/check-duplicates', methods=['POST'])
def api_check_duplicates(album_id):
    names = [str(n)[:255] for n in ((request.get_json(silent=True) or {}).get('names') or [])][:500]
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id, file_url, thumb_url, original_filename FROM photo "
                           "WHERE album_id = %s AND is_spacer = 0 ORDER BY sort_order ASC, id ASC", (album_id,))
            photos = cursor.fetchall()
    finally:
        connection.close()

    by_original, by_disk = {}, {}
    for ph in photos:
        if ph['original_filename']:
            by_original.setdefault(ph['original_filename'].lower(), ph)
        disk = re.sub(r'^[0-9a-f]{8}_', '', os.path.basename(ph['file_url'] or '')).lower()
        if disk:
            by_disk.setdefault(disk, ph)

    matches = {}
    for name in names:
        base = os.path.basename(name.replace('\\', '/'))
        ph = by_original.get(base.lower()) or by_disk.get(_safe_upload_filename(base).lower())
        if ph:
            matches[name] = {'id': ph['id'], 'thumb_url': ph['thumb_url'],
                             'name': ph['original_filename'] or _original_photo_name(ph['file_url'])}
    return jsonify({'matches': matches})


@app.route('/api/admin/album/<int:album_id>/upload', methods=['POST'])
def api_upload_photo(album_id):
    if 'file' not in request.files:
        return jsonify({'error': 'Нет файла'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Пустой файл'}), 400

    if file:
        # 1. Узнаем настройки альбома, текст водяного знака и SLUG (название) альбома
        connection = get_db_connection()
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT slug, is_watermark_enabled FROM photo_album WHERE id = %s", (album_id,))
                album_settings = cursor.fetchone()
                cursor.execute("SELECT watermark_text FROM users WHERE id = 1")
                user_settings = cursor.fetchone()
        finally:
            connection.close()

        if not album_settings:
            return jsonify({'error': 'Альбом не найден'}), 404

        album_slug = album_settings['slug']

        # УМНАЯ СТРУКТУРА ПАПОК: uploads/albums/{slug}_{id}/...
        album_folder_name = f"{album_slug}_{album_id}"
        album_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'albums', album_folder_name)
        full_dir = os.path.join(album_dir, 'full')
        thumb_dir = os.path.join(album_dir, 'thumb')
        wm_dir = os.path.join(album_dir, 'watermarked')
        
        os.makedirs(full_dir, exist_ok=True)
        os.makedirs(thumb_dir, exist_ok=True)

        filename = _safe_upload_filename(file.filename)
        unique_name = f"{uuid.uuid4().hex[:8]}_{filename}"
        
        full_path = os.path.join(full_dir, unique_name)
        thumb_path = os.path.join(thumb_dir, unique_name)

        # 2. Сохраняем оригинал
        file.save(full_path)
        stamp_photo_metadata(full_path)

        # 3. Генерируем водяной знак, если он включен
        watermark_url = None
        if album_settings['is_watermark_enabled']:
            wm_text = user_settings['watermark_text'] if user_settings and user_settings['watermark_text'] else "LENSE & LIGHT"
            client_preview_path = os.path.join(album_dir, f"client_temp_{unique_name}")
            
            img = Image.open(full_path)
            img.thumbnail((1920, 1920)) 
            if img.mode != 'RGB': img = img.convert('RGB')
            img.save(client_preview_path, 'JPEG', quality=85)
            
            # Передаем правильную папку для сохранения (wm_dir)
            watermark_url = apply_watermark(client_preview_path, wm_text, wm_dir)
            os.remove(client_preview_path) 

        # 3.5. Достаём EXIF из оригинала (камера/объектив/выдержка/диафрагма/ISO)
        exif_data = extract_exif_data(full_path)

        # 4. Создаем миниатюру для админки и галереи (Thumb)
        img = Image.open(full_path)
        orig_width, orig_height = img.size
        ratio = orig_width / orig_height
        if ratio >= 1.15: target_slug = 'ratio-hor'
        elif ratio <= 0.85: target_slug = 'ratio-ver'
        else: target_slug = 'ratio-sq'
            
        img.thumbnail((1000, 1000))
        if img.mode != 'RGB': img = img.convert('RGB')
        img.save(thumb_path, 'JPEG', optimize=True, quality=85)
        stamp_photo_metadata(thumb_path)

        # Сохраняем красивые пути для БД
        file_url = f"uploads/albums/{album_folder_name}/full/{unique_name}"
        thumb_url = f"uploads/albums/{album_folder_name}/thumb/{unique_name}"
        
        # 5. Сохраняем в БД (С авто-сортировкой в конец)
        original_filename = os.path.basename((file.filename or '').replace('\\', '/'))[:255] or None
        connection = get_db_connection()
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT id FROM grid_class WHERE slug = %s", (target_slug,))
                grid_row = cursor.fetchone()
                grid_class_id = grid_row['id'] if grid_row else 1

                # ЗАМЕНА файла у существующего фото (выбор «Заменить» в окне
                # дубликатов): запись остаётся та же — место в сетке, фокус,
                # масштаб, подпись и сердечки клиентов не трогаем; меняются
                # сам снимок, размеры, пропорция и EXIF. Старые файлы удаляем.
                replace_id = request.form.get('replace_photo_id', type=int)
                if replace_id:
                    cursor.execute("SELECT id, file_url, thumb_url, watermark_url FROM photo "
                                   "WHERE id = %s AND album_id = %s AND is_spacer = 0", (replace_id, album_id))
                    old = cursor.fetchone()
                    if not old:
                        for path in (full_path, thumb_path):
                            if os.path.exists(path):
                                os.remove(path)
                        _remove_watermark_files(watermark_url)
                        return jsonify({'error': 'Фото для замены не найдено'}), 404
                    cursor.execute("""
                        UPDATE photo SET file_url = %s, thumb_url = %s, watermark_url = %s, grid_class_id = %s,
                               width = %s, height = %s, original_filename = %s,
                               exif_camera = %s, exif_lens = %s, exif_focal = %s, exif_speed = %s,
                               exif_aperture = %s, exif_iso = %s, exif_ev = %s, exif_flash = %s
                        WHERE id = %s
                    """, (file_url, thumb_url, watermark_url, grid_class_id, orig_width, orig_height, original_filename,
                          exif_data['camera'], exif_data['lens'], exif_data['focal'], exif_data['speed'],
                          exif_data['aperture'], exif_data['iso'], exif_data['ev'], exif_data['flash'], replace_id))
                    connection.commit()
                    for url in (old['file_url'], old['thumb_url']):
                        path = os.path.join(app.root_path, 'static', url) if url else None
                        if path and os.path.exists(path):
                            os.remove(path)
                    _remove_watermark_files(old['watermark_url'])
                    cursor.execute("""
                        SELECT p.id, p.file_url, p.thumb_url, p.grid_class_id, gc.slug AS grid_class_slug, p.focus_x, p.focus_y,
                               p.zoom, p.sort_order, p.title, p.description, p.exif_camera, p.exif_lens, p.exif_focal,
                               p.exif_speed, p.exif_aperture, p.exif_iso, p.exif_ev, p.exif_flash, p.is_spacer
                        FROM photo p LEFT JOIN grid_class gc ON p.grid_class_id = gc.id WHERE p.id = %s
                    """, (replace_id,))
                    return jsonify({**cursor.fetchone(), 'replaced': True})
                
                # Узнаем максимальный приоритет
                cursor.execute("SELECT MAX(sort_order) as max_sort FROM photo WHERE album_id = %s", (album_id,))
                res = cursor.fetchone()
                next_sort = (res['max_sort'] or 0) + 1
                
                sql = """
                    INSERT INTO photo (album_id, file_url, thumb_url, watermark_url, grid_class_id, width, height, sort_order,
                                        original_filename,
                                        exif_camera, exif_lens, exif_focal, exif_speed, exif_aperture, exif_iso,
                                        exif_ev, exif_flash)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                # original_filename — точное имя с компьютера фотографа (с кириллицей
                # и пробелами), для поиска отобранных клиентом фото среди RAW
                cursor.execute(sql, (
                    album_id, file_url, thumb_url, watermark_url, grid_class_id, orig_width, orig_height, next_sort,
                    original_filename,
                    exif_data['camera'], exif_data['lens'], exif_data['focal'],
                    exif_data['speed'], exif_data['aperture'], exif_data['iso'],
                    exif_data['ev'], exif_data['flash'],
                ))
                photo_id = cursor.lastrowid
                connection.commit()

                # Ключи EXIF отдаём с префиксом exif_ — так же, как их отдаёт
                # api_get_album и читает createPhotoCard в admin.js. Раньше тут
                # были голые camera/lens/..., карточка их не видела, и первое же
                # сохранение модалки ⓘ затирало считанный EXIF пустыми полями.
                return jsonify({
                    'id': photo_id, 'file_url': file_url, 'thumb_url': thumb_url,
                    'grid_class_id': grid_class_id, 'grid_class_slug': target_slug,
                    'focus_x': 50, 'focus_y': 50, 'zoom': 1.0, 'sort_order': next_sort,
                    **{f'exif_{key}': value for key, value in exif_data.items()},
                })
        finally:
            connection.close()

# API: "Пустое место" (заглушка) в сетке альбома — строка в photo без файла,
# is_spacer = 1. Сортируется и перетаскивается как фото, на сайте на её
# месте пустой блок выбранной пропорции (см. album.html, .photo-spacer).
# Удаляется тем же api_delete_photo, пропорция меняется тем же api_update_photo.
@app.route('/api/admin/album/<int:album_id>/spacer', methods=['POST'])
def api_add_spacer(album_id):
    grid_slug = (request.get_json(silent=True) or {}).get('grid_class_slug') or 'ratio-sq'
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM photo_album WHERE id = %s", (album_id,))
            if not cursor.fetchone():
                return jsonify({'error': 'Альбом не найден'}), 404

            cursor.execute("SELECT id, slug FROM grid_class WHERE slug = %s", (grid_slug,))
            grid_row = cursor.fetchone()
            grid_class_id = grid_row['id'] if grid_row else 1
            grid_slug = grid_row['slug'] if grid_row else 'ratio-sq'

            cursor.execute("SELECT MAX(sort_order) as max_sort FROM photo WHERE album_id = %s", (album_id,))
            res = cursor.fetchone()
            next_sort = ((res or {}).get('max_sort') or 0) + 1

            cursor.execute(
                "INSERT INTO photo (album_id, is_spacer, file_url, thumb_url, grid_class_id, sort_order) "
                "VALUES (%s, 1, '', '', %s, %s)",
                (album_id, grid_class_id, next_sort)
            )
            spacer_id = cursor.lastrowid
            connection.commit()
            return jsonify({
                'id': spacer_id, 'is_spacer': 1, 'file_url': '', 'thumb_url': '',
                'grid_class_id': grid_class_id, 'grid_class_slug': grid_slug, 'sort_order': next_sort,
                'focus_x': 50, 'focus_y': 50, 'zoom': 1.0,
            })
    finally:
        connection.close()


# API: Удаление фотографии
@app.route('/api/admin/photo/<int:photo_id>', methods=['DELETE'])
def api_delete_photo(photo_id):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # 1. Получаем пути к файлам
            cursor.execute("SELECT file_url, thumb_url, watermark_url FROM photo WHERE id = %s", (photo_id,))
            photo = cursor.fetchone()

            if photo:
                # 2. Удаляем файлы с жесткого диска (раньше файл со знаком
                # оставался на диске навсегда — его тут просто не удаляли)
                for url in [photo['file_url'], photo['thumb_url']]:
                    if url:
                        filepath = os.path.join(app.root_path, 'static', url)
                        if os.path.exists(filepath):
                            os.remove(filepath)
                _remove_watermark_files(photo['watermark_url'])

                # 3. Удаляем запись из БД
                cursor.execute("DELETE FROM photo WHERE id = %s", (photo_id,))
                connection.commit()
                return jsonify({'status': 'success'})
            return jsonify({'error': 'Фото не найдено'}), 404
    finally:
        connection.close()


# API: Умное обновление (теперь умеет обновлять и сетку, и фокус и зум)
@app.route('/api/admin/photo/<int:photo_id>', methods=['PUT'])
def api_update_photo(photo_id):
    data = request.json
    updates = []
    params = []
    
    if 'grid_class_id' in data:
        updates.append("grid_class_id = %s")
        params.append(data['grid_class_id'])
    
    if 'focus_x' in data and 'focus_y' in data:
        updates.append("focus_x = %s")
        updates.append("focus_y = %s")
        params.append(data['focus_x'])
        params.append(data['focus_y'])
        
    # Добавили проверку на ЗУМ
    if 'zoom' in data:
        updates.append("zoom = %s")
        params.append(data['zoom'])

    # Название файла (для поиска в хранилище + имя файла в zip-архивах,
    # см. _nice_photo_filename) — публично нигде не показывается, кроме
    # вкладки "Избранное" в админке.
    if 'title' in data:
        value = data['title']
        updates.append("title = %s")
        params.append(value.strip() if isinstance(value, str) and value.strip() else None)

    # Ручная правка EXIF (камера/объектив/фокусное/выдержка/диафрагма/ISO/
    # экспокоррекция/вспышка). Пустая строка тоже валидна — так можно
    # затереть автоматически извлечённое (неверное) значение и оставить поле пустым.
    exif_fields = ('exif_camera', 'exif_lens', 'exif_focal', 'exif_speed', 'exif_aperture', 'exif_iso',
                   'exif_ev', 'exif_flash')
    for field in exif_fields:
        if field in data:
            value = data[field]
            updates.append(f"{field} = %s")
            params.append(value.strip() if isinstance(value, str) and value.strip() else None)

    # Подпись к фото (markdown) — источник для photo.description_html в лайтбоксе
    if 'description' in data:
        value = data['description']
        updates.append("description = %s")
        params.append(value.strip() if isinstance(value, str) and value.strip() else None)

    if not updates:
        return jsonify({'error': 'Нет данных для обновления'}), 400
        
    params.append(photo_id)
    sql = f"UPDATE photo SET {', '.join(updates)} WHERE id = %s"
    
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(sql, tuple(params))
            connection.commit()
            return jsonify({'status': 'success'})
    finally:
        connection.close()

# API: Точечное обновление КАТЕГОРИИ альбома (Прямо из списка)
@app.route('/api/admin/album/<int:album_id>/category', methods=['PUT'])
def api_update_album_category(album_id):
    data = request.json
    category_id = data.get('category_id')
    
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("UPDATE photo_album SET category_id = %s WHERE id = %s", (category_id, album_id))
            connection.commit()
        return jsonify({'status': 'success'})
    finally:
        connection.close()


# API: Сохранение настроек альбома (из Редактора)
# ДОБАВЛЕН /settings в URL, ЧТОБЫ ИЗБЕЖАТЬ КОНФЛИКТА
@app.route('/api/admin/album/<int:album_id>/settings', methods=['PUT'])
def api_update_album(album_id):
    data = request.json
    
    title = data.get('title')
    category_id = data.get('category_id') 
    description = data.get('description')
    card_caption = data.get('card_caption')
    color_hex = data.get('color_hex', '#080808') 
    is_active = data.get('is_active', 0)
    is_private = data.get('is_private', 0)
    allow_selection = data.get('allow_selection', 0)
    require_client_info = data.get('require_client_info', 0) 
    
    cover_ratio = data.get('cover_ratio', 'type-square')
    cover_focus_x = data.get('cover_focus_x', 50)
    cover_focus_y = data.get('cover_focus_y', 50)
    cover_zoom = data.get('cover_zoom', 1.0)

    cover_mobile_focus_x = data.get('cover_mobile_focus_x', 50)
    cover_mobile_focus_y = data.get('cover_mobile_focus_y', 50)
    cover_mobile_zoom = data.get('cover_mobile_zoom', 1.0)

    date_taken = data.get('date_taken')
    if not date_taken: date_taken = None
    
    expires_at = data.get('expires_at')
    if not expires_at: expires_at = None
    
    is_watermark_enabled = data.get('is_watermark_enabled', 0)

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Фокус/зум мобильной обложки поменялись — пересобираем
            # cover_mobile_url ЗАНОВО из cover_source_url (нетронутого
            # оригинала), а не из уже обрезанной версии — тот же принцип,
            # что и у направлений (см. admin_direction_edit): иначе кроп
            # с каждым сохранением терял бы в качестве и "сползал".
            cursor.execute(
                "SELECT slug, cover_source_url, cover_mobile_url FROM photo_album WHERE id = %s",
                (album_id,)
            )
            album_row = cursor.fetchone()

            cover_mobile_url = album_row['cover_mobile_url'] if album_row else None
            if album_row and album_row['cover_source_url']:
                src_path = os.path.join(app.root_path, 'static', album_row['cover_source_url'])
                if os.path.exists(src_path):
                    album_folder_name = f"{album_row['slug']}_{album_id}"
                    mobile_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'albums', album_folder_name, 'cover_mobile')
                    mobile_name = make_mobile_crop(
                        src_path, mobile_dir, prefix='covm',
                        focus_x=cover_mobile_focus_x, focus_y=cover_mobile_focus_y, zoom=cover_mobile_zoom,
                    )
                    if album_row['cover_mobile_url']:
                        old_path = os.path.join(app.root_path, 'static', album_row['cover_mobile_url'])
                        if os.path.exists(old_path):
                            os.remove(old_path)
                    cover_mobile_url = f"uploads/albums/{album_folder_name}/cover_mobile/{mobile_name}"

            sql = """
                UPDATE photo_album 
                SET title = %s, category_id = %s, description = %s, card_caption = %s, color_hex = %s, is_active = %s,
                    is_private = %s, allow_selection = %s, require_client_info = %s,
                    date_taken = %s, expires_at = %s, is_watermark_enabled = %s,
                    cover_ratio = %s, cover_focus_x = %s, cover_focus_y = %s, cover_zoom = %s,
                    cover_mobile_focus_x = %s, cover_mobile_focus_y = %s, cover_mobile_zoom = %s, cover_mobile_url = %s
                WHERE id = %s
            """
            cursor.execute(sql, (title, category_id, description, card_caption, color_hex, is_active, is_private,
                                allow_selection, require_client_info, date_taken, expires_at, 
                                is_watermark_enabled, cover_ratio, cover_focus_x, cover_focus_y, cover_zoom,
                                cover_mobile_focus_x, cover_mobile_focus_y, cover_mobile_zoom, cover_mobile_url,
                                album_id))
            connection.commit()
            return jsonify({'status': 'success'})
    finally:
        connection.close()


# Дозаполнение EXIF из файлов: для фото, загруженных ДО автоизвлечения
# (extract_exif_data), и для полей, которые появились позже (экспокоррекция,
# вспышка). Трогает ТОЛЬКО пустые поля — всё, что уже заполнено
# (автоматически или руками в модалке), остаётся как есть. Побочный
# эффект: поле, которое специально очистили вручную, заполнится снова,
# если в файле для него есть данные.
@app.route('/api/admin/album/<int:album_id>/recompute-exif', methods=['POST'])
def api_recompute_exif(album_id):
    exif_keys = ('camera', 'lens', 'focal', 'speed', 'aperture', 'iso', 'ev', 'flash')
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id, file_url, " + ", ".join(f"exif_{key}" for key in exif_keys) +
                " FROM photo WHERE album_id = %s AND is_spacer = 0",
                (album_id,)
            )
            photos = cursor.fetchall()

            updated, skipped = 0, 0

            for p in photos:
                empty_keys = [key for key in exif_keys if not p.get(f"exif_{key}")]
                if not empty_keys:
                    skipped += 1
                    continue

                full_path = os.path.join(app.root_path, 'static', (p['file_url'] or '').lstrip('/'))
                if not os.path.isfile(full_path):
                    skipped += 1
                    continue

                exif_data = extract_exif_data(full_path)
                to_fill = {key: exif_data[key] for key in empty_keys if exif_data[key]}
                if not to_fill:
                    skipped += 1
                    continue

                set_sql = ", ".join(f"exif_{key} = %s" for key in to_fill)
                cursor.execute(f"UPDATE photo SET {set_sql} WHERE id = %s",
                               (*to_fill.values(), p['id']))
                updated += 1

            connection.commit()
        return jsonify({'status': 'success', 'updated': updated, 'skipped': skipped})
    finally:
        connection.close()


# НОВЫЙ РОУТ: Сброс ссылки (Удаляет старые лайки и создает новый токен)
@app.route('/api/admin/album/<int:album_id>/regenerate_token', methods=['POST'])
def api_regenerate_token(album_id):
    new_token = uuid.uuid4().hex
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # 1. Находим старый токен
            cursor.execute("SELECT access_token FROM photo_album WHERE id = %s", (album_id,))
            album = cursor.fetchone()
            
            if album and album['access_token']:
                old_token = album['access_token']
                # 2. Удаляем старые сессии клиентов (Лайки удалятся сами каскадно)
                cursor.execute("DELETE FROM client_sessions WHERE access_token = %s", (old_token,))
                
            # 3. Обновляем токен альбома на новый
            cursor.execute("UPDATE photo_album SET access_token = %s WHERE id = %s", (new_token, album_id))
            connection.commit()
            
            return jsonify({'status': 'success', 'new_token': new_token})
    finally:
        connection.close()

# РОУТ: Полное удаление альбома (Очищает БД и жесткий диск!)
def _delete_album_files_and_record(cursor, album):
    """
    Полное удаление альбома: папка с фотками (full/thumb/watermark/клиентские),
    обложка и запись в БД. Используется и при ручном удалении из админки,
    и при автоочистке просроченных (expires_at) альбомов по расписанию.

    album — dict с ключами: id, slug, cover_url, cover_thumb_url.
    Ничего не коммитит — коммит делает вызывающий код.
    """
    # 1. Удаляем папку со всеми фотками альбома (full, thumb, watermarked, клиентские)
    album_folder_name = f"{album['slug']}_{album['id']}"
    album_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'albums', album_folder_name)

    if os.path.exists(album_dir):
        shutil.rmtree(album_dir)  # Сносит папку целиком со всем содержимым!

    # 2. Удаляем обложки альбома (если это не заглушки)
    for url in [album['cover_url'], album['cover_thumb_url']]:
        if url and 'placeholder' not in url:
            filepath = os.path.join(app.root_path, 'static', url)
            if os.path.exists(filepath):
                os.remove(filepath)

    # 3. Удаляем альбом из базы
    # (ON DELETE CASCADE в самой БД автоматически сотрет все записи в таблицах photo, client_sessions и client_selections!)
    cursor.execute("DELETE FROM photo_album WHERE id = %s", (album['id'],))


def cleanup_expired_albums():
    """
    Автоочистка: полностью удаляет альбомы, у которых expires_at уже в прошлом.
    Вызывается по расписанию планировщиком (см. настройку ниже), а не при каждом запросе.
    """
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id, slug, cover_url, cover_thumb_url FROM photo_album "
                "WHERE expires_at IS NOT NULL AND expires_at < %s",
                (date.today(),)
            )
            expired_albums = cursor.fetchall()

            for album in expired_albums:
                try:
                    _delete_album_files_and_record(cursor, album)
                    print(f"[cleanup_expired_albums] Удален альбом id={album['id']} (slug={album['slug']}), срок истек.")
                except Exception as e:
                    print(f"[cleanup_expired_albums] Ошибка при удалении альбома id={album['id']}: {e}")

            connection.commit()
    finally:
        connection.close()


def _days_left(expires_at):
    """Сколько полных дней альбом ещё будет доступен ПОСЛЕ сегодняшнего:
    0 — сегодня последний день (ночью удалится), None — срока нет."""
    if not expires_at:
        return None
    return max(0, (expires_at - date.today()).days)


@app.template_filter('ru_plural')
def ru_plural(n, one, few, many):
    """Склонение по числу: 1 день, 2 дня, 5 дней."""
    n = abs(int(n or 0))
    if n % 10 == 1 and n % 100 != 11:
        return one
    if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14:
        return few
    return many


def _album_expired(album):
    """Срок хранения альбома истёк (expires_at в прошлом). Такой альбом
    публично уже не показываем, даже если его файлы и записи ещё не успели
    удалить (см. _maybe_cleanup_expired_albums ниже)."""
    return bool(album.get('expires_at')) and album['expires_at'] < date.today()


# Подстраховка планировщика. Passenger на хостинге гасит процесс сайта, когда
# на него долго никто не заходит, — и если в 03:00 процесса нет, ночная
# очистка (см. _start_expired_albums_scheduler) просто не случится, а
# просроченный альбом вместе с именами клиентов останется в БД — хотя в
# политике обещано удаление по истечении срока. Поэтому чистим и "по
# дороге": не чаще раза в час на процесс, в фоне, чтобы не тормозить запрос.
_EXPIRED_CLEANUP_INTERVAL = 60 * 60
_expired_cleanup_lock = threading.Lock()
_expired_cleanup_last = 0.0


def _run_expired_cleanup_safely():
    try:
        cleanup_expired_albums()
    except Exception as e:
        print(f"[cleanup_expired_albums] Ошибка фоновой очистки: {e}")


@app.before_request
def _maybe_cleanup_expired_albums():
    global _expired_cleanup_last
    if time.time() - _expired_cleanup_last < _EXPIRED_CLEANUP_INTERVAL:
        return
    if not _expired_cleanup_lock.acquire(blocking=False):
        return
    try:
        _expired_cleanup_last = time.time()
        threading.Thread(target=_run_expired_cleanup_safely, daemon=True).start()
    finally:
        _expired_cleanup_lock.release()


@app.route('/admin/album/delete/<int:album_id>', methods=['POST'])
def admin_album_delete(album_id):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Получаем инфо об альбоме, чтобы знать, какие файлы удалять
            cursor.execute("SELECT id, slug, cover_url, cover_thumb_url FROM photo_album WHERE id = %s", (album_id,))
            album = cursor.fetchone()

            if album:
                _delete_album_files_and_record(cursor, album)
                connection.commit()
    finally:
        connection.close()
        
    return redirect(url_for('admin_dashboard'))

# API: Загрузка обложки альбома (В ПРАВИЛЬНУЮ ПАПКУ!)
@app.route('/api/admin/album/<int:album_id>/cover', methods=['POST'])
def api_upload_album_cover(album_id):
    if 'cover_file' not in request.files:
        return jsonify({'error': 'Нет файла'}), 400
        
    file = request.files['cover_file']
    if file and file.filename != '':
        connection = get_db_connection()
        try:
            with connection.cursor() as cursor:
                # 1. Узнаем slug альбома, чтобы сформировать имя папки
                cursor.execute(
                    "SELECT slug, cover_url, cover_thumb_url, cover_source_url, cover_mobile_url FROM photo_album WHERE id = %s",
                    (album_id,)
                )
                album = cursor.fetchone()
                
                album_folder_name = f"{album['slug']}_{album_id}"
                album_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'albums', album_folder_name)
                
                full_dir = os.path.join(album_dir, 'cover_full')
                thumb_dir = os.path.join(album_dir, 'cover_thumb')
                source_dir = os.path.join(album_dir, 'cover_source')

                os.makedirs(full_dir, exist_ok=True)
                os.makedirs(thumb_dir, exist_ok=True)
                os.makedirs(source_dir, exist_ok=True)

                filename = _safe_upload_filename(file.filename)
                unique_name = f"cover_{uuid.uuid4().hex[:8]}_{filename}"

                source_path = os.path.join(source_dir, unique_name)

                # Храним нетронутый оригинал отдельно (на случай, если
                # обложке позже тоже понадобится фокус/кроп под мобилку —
                # см. directions), а на сайт отдаём уже сжатую версию:
                # раньше cover_full сохранялся как есть, т.е. прямо с
                # камеры, весом по 8-15 МБ за штуку.
                file.save(source_path)
                stamp_photo_metadata(source_path)

                desktop_name, thumb_name = make_desktop_and_thumb(
                    source_path, full_dir, prefix='cover',
                    # Миниатюра для карточек в "Галерее" — раньше была
                    # 800px и на крупных карточках сетки выглядела мыльно
                    # (апскейлилась браузером на ретине). 1400px всё ещё
                    # ощутимо легче полной версии (2200px), но уже резкая.
                    thumb_size=(1400, 1400), thumb_quality=87,
                )
                os.replace(os.path.join(full_dir, thumb_name), os.path.join(thumb_dir, thumb_name))

                # Реальный кроп 9:16 под мобильный полноэкранный герой
                # альбома (см. album.html/<picture>) — по умолчанию по
                # центру, фокус/зум под мобилку настраиваются потом в
                # редакторе обложки (см. api_update_album).
                mobile_dir = os.path.join(album_dir, 'cover_mobile')
                mobile_name = make_mobile_crop(source_path, mobile_dir, prefix='covm')

                cover_url = f"uploads/albums/{album_folder_name}/cover_full/{desktop_name}"
                cover_thumb_url = f"uploads/albums/{album_folder_name}/cover_thumb/{thumb_name}"
                cover_source_url = f"uploads/albums/{album_folder_name}/cover_source/{unique_name}"
                cover_mobile_url = f"uploads/albums/{album_folder_name}/cover_mobile/{mobile_name}"
                
                # Обновляем БД
                cursor.execute(
                    """UPDATE photo_album SET cover_url = %s, cover_thumb_url = %s,
                       cover_source_url = %s, cover_mobile_url = %s WHERE id = %s""",
                    (cover_url, cover_thumb_url, cover_source_url, cover_mobile_url, album_id)
                )
                connection.commit()
                
                # Удаляем старые файлы обложек
                if album and album['cover_url'] and 'placeholder' not in album['cover_url']:
                    for url in [album['cover_url'], album['cover_thumb_url'],
                                album.get('cover_source_url'), album.get('cover_mobile_url')]:
                        if url:
                            old_path = os.path.join(app.root_path, 'static', url)
                            if os.path.exists(old_path): os.remove(old_path)
                                
                return jsonify({'status': 'success', 'cover_thumb_url': cover_thumb_url})
        finally:
            connection.close()
            
    return jsonify({'error': 'Ошибка сохранения'}), 400

# --- НОВЫЕ РОУТЫ: СОРТИРОВКА ФОТО В АЛЬБОМЕ ---
@app.route('/api/admin/photos/reorder', methods=['POST'])
def api_reorder_photos():
    data = request.json
    photo_ids = data.get('photo_ids', [])
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            for index, p_id in enumerate(photo_ids):
                cursor.execute("UPDATE photo SET sort_order = %s WHERE id = %s", (index, p_id))
            connection.commit()
        return jsonify({'status': 'success'})
    except Exception as e: return jsonify({'error': str(e)}), 500
    finally: connection.close()

@app.route('/api/admin/photo/<int:photo_id>/sort', methods=['PUT'])
def api_update_photo_sort(photo_id):
    data = request.json
    sort_order = data.get('sort_order', 0)
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("UPDATE photo SET sort_order = %s WHERE id = %s", (sort_order, photo_id))
            connection.commit()
        return jsonify({'status': 'success'})
    finally: connection.close()


# Роут создания нового альбома
@app.route('/admin/album/create', methods=['POST'])
def admin_album_create():
    title = request.form.get('title')
    category_id = request.form.get('category_id')
    
    if not title or not category_id:
        flash("Укажите название и категорию")
        return redirect(url_for('admin_dashboard'))

    slug = generate_slug(title)
    date_taken = request.form.get('date_taken')
    if not date_taken: date_taken = None

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # 1. Узнаем максимальный sort_order, чтобы новый альбом упал в самый конец
            cursor.execute("SELECT MAX(sort_order) as max_sort FROM photo_album")
            res = cursor.fetchone()
            next_sort = (res['max_sort'] or 0) + 1
            
            sql = """
                INSERT INTO photo_album (slug, title, category_id, users_id, cover_url, cover_thumb_url, access_token, date_taken, sort_order)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            access_token = uuid.uuid4().hex
            # users_id = 1 (Предполагаем, что ты первый юзер-админ в базе)
            cursor.execute(sql, (slug, title, category_id, 1, None, None, access_token, date_taken, next_sort))
            connection.commit()
            
            new_album_id = cursor.lastrowid
    finally:
        connection.close()

    # Сразу перекидываем в редактор этого альбома!
    return redirect(url_for('admin_dashboard', album_id=new_album_id))


# API: Получить список клиентов и их отобранные фото для конкретного альбома
@app.route('/api/admin/album/<int:album_id>/favorites')
def api_album_favorites(album_id):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # 1. Получаем токен альбома
            cursor.execute("SELECT access_token FROM photo_album WHERE id = %s", (album_id,))
            album = cursor.fetchone()
            
            if not album or not album['access_token']:
                return jsonify({'clients': []})

            token = album['access_token']

            # 2. Получаем всех клиентов, у которых есть сессия в этом альбоме
            cursor.execute("""
                SELECT session_uuid, client_name, created_at, pd_consent_at, pd_consent_version
                FROM client_sessions
                WHERE access_token = %s
                ORDER BY created_at DESC
            """, (token,))
            clients = cursor.fetchall()

            # 3. Для каждого клиента достаем фотографии, которые он лайкнул
            for client in clients:
                # Отдаём дату согласия уже готовой строкой: jsonify превратил бы
                # datetime в "... GMT", хотя в БД лежит время сервера, и браузер
                # сдвинул бы его на свой часовой пояс.
                consent_at = client.pop('pd_consent_at', None)
                client['pd_consent_at'] = consent_at.strftime('%d.%m.%Y %H:%M') if consent_at else None

                sql_photos = """
                    SELECT p.id, p.thumb_url, p.file_url, p.title, p.original_filename
                    FROM client_selections cs
                    JOIN photo p ON cs.photo_id = p.id
                    WHERE cs.session_uuid = %s
                    ORDER BY p.sort_order ASC, p.id ASC
                """
                cursor.execute(sql_photos, (client['session_uuid'],))
                client['photos'] = cursor.fetchall()
                for photo in client['photos']:
                    photo['original_name'] = _original_photo_name(photo['file_url'], photo.pop('original_filename', None))

            return jsonify({'clients': clients})
    finally:
        connection.close()


# Удалить конкретную клиентскую подборку (сессию) целиком — например,
# если клиент сначала натыкал лайков с телефона, а потом переделал с ПК,
# и телефонную сессию нужно снести. ON DELETE CASCADE на client_selections
# (FK на client_sessions.session_uuid) сам подчистит все лайки этой
# сессии. А раз при каждом заходе на страницу альбома лайки берутся live
# через _get_client_selection() — то есть каждый раз заново проверяются
# по этой же таблице — на телефоне после удаления сердечки сами погаснут
# при следующем открытии страницы (кука в браузере может остаться, но
# сессии под ней в БД уже не будет, так что она просто не найдётся).
@app.route('/api/admin/client-session/<session_uuid>', methods=['DELETE'])
def api_admin_delete_client_session(session_uuid):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM client_sessions WHERE session_uuid = %s", (session_uuid,))
            connection.commit()
            return jsonify({'status': 'success'})
    finally:
        connection.close()


# Скачать zip-архив ИМЕННО того, что лайкнул конкретный клиент. Это
# внутренняя, админская кнопка (доступ уже проверен require_admin_login
# по префиксу /api/admin) — поэтому тут всегда оригинал file_url, без
# оглядки на вотермарку: фотографу для финальной отдачи нужно то, что
# клиент отобрал, в полном качестве.
@app.route('/api/admin/client-session/<session_uuid>/download')
def api_admin_download_client_selection(session_uuid):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT client_name FROM client_sessions WHERE session_uuid = %s", (session_uuid,)
            )
            session_row = cursor.fetchone()
            if not session_row:
                abort(404)

            cursor.execute("""
                SELECT p.file_url, p.title
                FROM client_selections cs
                JOIN photo p ON cs.photo_id = p.id
                WHERE cs.session_uuid = %s
                ORDER BY p.sort_order ASC, p.id ASC
            """, (session_uuid,))
            photos = cursor.fetchall()
    finally:
        connection.close()

    if not photos:
        abort(404)

    client_label = secure_filename(session_row['client_name'] or 'client') or 'client'
    zip_path = _build_zip_from_photos(photos)
    return _send_zip_and_cleanup(zip_path, f"{client_label}_{session_uuid[:8]}.zip")



# Роут создания новой Категории
@app.route('/admin/category/create', methods=['POST'])
def admin_category_create():
    name = request.form.get('name')
    description = request.form.get('description')
    tagline = request.form.get('tagline')

    if not name:
        return redirect(url_for('admin_dashboard'))

    # Генерируем slug (например: "Студия" -> "studiya-a1b2c3")
    slug = generate_slug(name)

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            sql = "INSERT INTO category (slug, name, description, tagline) VALUES (%s, %s, %s, %s)"
            cursor.execute(sql, (slug, name, description, tagline))
            connection.commit()
    finally:
        connection.close()

    return redirect(url_for('admin_dashboard'))


# Роут добавления Направления (с загрузкой фото и сортировкой)
@app.route('/admin/direction/create', methods=['POST'])
def admin_direction_create():
    category_id = request.form.get('category_id')
    color_hex = request.form.get('color_hex', '#080808')

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # У каждой категории на главной может быть только ОДНО направление
            # (иначе на публичной странице у карточек совпадут id и вместо
            # разных категорий покажется дублирующаяся первая). Раньше выпадающий
            # список показывал все категории без разбора, и легко было выбрать
            # уже занятую — теперь вместо тихого дубля мы это остановим.
            cursor.execute("SELECT id FROM directions WHERE category_id = %s", (category_id,))
            existing = cursor.fetchone()
            if existing:
                flash("У этой категории уже есть направление на главной — отредактируйте существующее, а не создавайте новое.")
                return redirect(url_for('admin_dashboard', tab='view-categories'))

            cover_file = request.files.get('cover_file')
            file_url = None
            thumb_url = None
            source_url = None
            mobile_url = None

            if cover_file and cover_file.filename:
                dir_path = os.path.join(app.config['UPLOAD_FOLDER'], 'directions')

                src_name, src_path = save_original(cover_file, dir_path, prefix='dir')
                source_url = f"uploads/directions/{src_name}"

                desktop_name, thumb_name = make_desktop_and_thumb(src_path, dir_path, prefix='dir')
                file_url = f"uploads/directions/{desktop_name}"
                thumb_url = f"uploads/directions/{thumb_name}"

                # Фокус/зум ещё не настроены (только что создали) — кроп
                # по центру, дефолтными 50/50/1.0 (совпадает с DEFAULT в БД)
                mobile_name = make_mobile_crop(src_path, dir_path, prefix='dirm')
                mobile_url = f"uploads/directions/{mobile_name}"

            cursor.execute("SELECT MAX(sort_order) as max_sort FROM directions")
            res = cursor.fetchone()
            next_sort = (res['max_sort'] or 0) + 1

            sql = """INSERT INTO directions (category_id, file_url, thumb_url, source_url, mobile_url, color_hex, sort_order)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)"""
            cursor.execute(sql, (category_id, file_url, thumb_url, source_url, mobile_url, color_hex, next_sort))
            connection.commit()
    finally:
        connection.close()

    return redirect(url_for('admin_dashboard', tab='view-categories'))


# Роут редактирования Категории
@app.route('/admin/category/edit/<int:category_id>', methods=['POST'])
def admin_category_edit(category_id):
    name = request.form.get('name')
    description = request.form.get('description')
    tagline = request.form.get('tagline')

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            sql = "UPDATE category SET name = %s, description = %s, tagline = %s WHERE id = %s"
            cursor.execute(sql, (name, description, tagline, category_id))
            connection.commit()
    finally:
        connection.close()

    return redirect(url_for('admin_dashboard', tab='view-categories'))


# Роут редактирования Направления
@app.route('/admin/direction/edit/<int:dir_id>', methods=['POST'])
def admin_direction_edit(dir_id):
    category_id = request.form.get('category_id')
    color_hex = request.form.get('color_hex')
    cover_file = request.files.get('cover_file')
    # Фокус/зум обложки для мобильной версии (см. "Обложка для мобильной
    # версии" в форме) — тот же принцип, что у cover_focus_x/y/cover_zoom
    # альбомов, но отдельно для мобилки: на ПК то же самое фото и так
    # показывается полностью, без обрезки.
    mobile_focus_x = request.form.get('mobile_focus_x', 50)
    mobile_focus_y = request.form.get('mobile_focus_y', 50)
    mobile_zoom = request.form.get('mobile_zoom', 1.0)

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Та же защита от дублей: нельзя перевесить направление на
            # категорию, у которой уже есть своё (см. комментарий в create).
            cursor.execute(
                "SELECT id FROM directions WHERE category_id = %s AND id != %s",
                (category_id, dir_id)
            )
            if cursor.fetchone():
                flash("У этой категории уже есть направление на главной — сначала удалите его или выберите другую категорию.")
                return redirect(url_for('admin_dashboard', tab='view-categories'))

            cursor.execute(
                "SELECT file_url, thumb_url, source_url, mobile_url FROM directions WHERE id = %s",
                (dir_id,)
            )
            old_dir = cursor.fetchone()
            dir_path = os.path.join(app.config['UPLOAD_FOLDER'], 'directions')

            def _remove_old(url):
                if url:
                    old_path = os.path.join(app.root_path, 'static', url)
                    if os.path.exists(old_path):
                        os.remove(old_path)

            if cover_file and cover_file.filename:
                # Новый файл — удаляем ВСЁ старое (включая источник) и
                # пересобираем источник/десктоп/превью/мобильный кроп с нуля,
                # уже с теми фокусом/зумом, что пришли из формы.
                if old_dir:
                    for old_url in [old_dir['file_url'], old_dir['thumb_url'],
                                     old_dir['source_url'], old_dir['mobile_url']]:
                        _remove_old(old_url)

                src_name, src_path = save_original(cover_file, dir_path, prefix='dir')
                source_url = f"uploads/directions/{src_name}"

                desktop_name, thumb_name = make_desktop_and_thumb(src_path, dir_path, prefix='dir')
                file_url = f"uploads/directions/{desktop_name}"
                thumb_url = f"uploads/directions/{thumb_name}"

                mobile_name = make_mobile_crop(src_path, dir_path, prefix='dirm',
                                                focus_x=mobile_focus_x, focus_y=mobile_focus_y, zoom=mobile_zoom)
                mobile_url = f"uploads/directions/{mobile_name}"

                sql = """UPDATE directions SET category_id = %s, color_hex = %s,
                        file_url = %s, thumb_url = %s, source_url = %s, mobile_url = %s,
                        mobile_focus_x = %s, mobile_focus_y = %s, mobile_zoom = %s
                        WHERE id = %s"""
                cursor.execute(sql, (category_id, color_hex, file_url, thumb_url, source_url, mobile_url,
                                      mobile_focus_x, mobile_focus_y, mobile_zoom, dir_id))
            elif old_dir and old_dir['source_url']:
                # Файл не меняли — просто подвинули фокус/зум. Пересобираем
                # ТОЛЬКО мобильный кроп, и обязательно из исходника
                # (old_dir['source_url']), а не из уже обрезанной версии —
                # иначе с каждым сохранением кроп бы «сползал» и терял
                # в качестве. Старый мобильный файл подчищаем, остальное
                # (десктоп-версия, миниатюра, источник) не трогаем.
                src_path = os.path.join(app.root_path, 'static', old_dir['source_url'])
                mobile_name = make_mobile_crop(src_path, dir_path, prefix='dirm',
                                                focus_x=mobile_focus_x, focus_y=mobile_focus_y, zoom=mobile_zoom)
                mobile_url = f"uploads/directions/{mobile_name}"
                _remove_old(old_dir['mobile_url'])

                sql = """UPDATE directions SET category_id = %s, color_hex = %s, mobile_url = %s,
                        mobile_focus_x = %s, mobile_focus_y = %s, mobile_zoom = %s
                        WHERE id = %s"""
                cursor.execute(sql, (category_id, color_hex, mobile_url,
                                      mobile_focus_x, mobile_focus_y, mobile_zoom, dir_id))
            else:
                # Совсем без файла (старая запись без source_url, ещё до
                # миграции) — просто обновляем то, что можем.
                sql = """UPDATE directions SET category_id = %s, color_hex = %s,
                        mobile_focus_x = %s, mobile_focus_y = %s, mobile_zoom = %s
                        WHERE id = %s"""
                cursor.execute(sql, (category_id, color_hex, mobile_focus_x, mobile_focus_y, mobile_zoom, dir_id))

            connection.commit()
    finally:
        connection.close()

    return redirect(url_for('admin_dashboard', tab='view-categories'))

# --- НОВЫЕ РОУТЫ: СОРТИРОВКА НАПРАВЛЕНИЙ ---
@app.route('/api/admin/directions/reorder', methods=['POST'])
def api_reorder_directions():
    data = request.json
    dir_ids = data.get('dir_ids', [])
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            for index, d_id in enumerate(dir_ids):
                cursor.execute("UPDATE directions SET sort_order = %s WHERE id = %s", (index, d_id))
            connection.commit()
        return jsonify({'status': 'success'})
    except Exception as e: return jsonify({'error': str(e)}), 500
    finally: connection.close()


@app.route('/api/admin/direction/<int:dir_id>/sort', methods=['PUT'])
def api_update_direction_sort(dir_id):
    data = request.json
    sort_order = data.get('sort_order', 0)
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("UPDATE directions SET sort_order = %s WHERE id = %s", (sort_order, dir_id))
            connection.commit()
        return jsonify({'status': 'success'})
    finally: connection.close()

# --- НОВЫЕ РОУТЫ УДАЛЕНИЯ И ВОССТАНОВЛЕНИЯ ---
@app.route('/admin/category/delete/<int:cat_id>', methods=['POST'])
def admin_category_delete(cat_id):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Проверяем, привязана ли категория к альбомам или направлениям
            cursor.execute("SELECT COUNT(*) as cnt FROM photo_album WHERE category_id = %s", (cat_id,))
            albums_count = cursor.fetchone()['cnt']
            
            cursor.execute("SELECT COUNT(*) as cnt FROM directions WHERE category_id = %s", (cat_id,))
            dirs_count = cursor.fetchone()['cnt']
            
            if albums_count > 0 or dirs_count > 0:
                # Если связи есть -> Мягкое удаление (Деактивация)
                cursor.execute("UPDATE category SET is_active = FALSE WHERE id = %s", (cat_id,))
                # flash("Категория связана с альбомами. Она деактивирована.")
            else:
                # Если связей нет -> Жесткое удаление навсегда
                cursor.execute("DELETE FROM category WHERE id = %s", (cat_id,))
                # flash("Категория успешно удалена.")
                
            connection.commit()
    finally:
        connection.close()
    return redirect(url_for('admin_dashboard', tab='view-categories'))

@app.route('/admin/category/restore/<int:cat_id>', methods=['POST'])
def admin_category_restore(cat_id):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("UPDATE category SET is_active = TRUE WHERE id = %s", (cat_id,))
            connection.commit()
    finally:
        connection.close()
    return redirect(url_for('admin_dashboard', tab='view-categories'))

# Роут удаления направления (Теперь очищает диск!)
@app.route('/admin/direction/delete/<int:dir_id>', methods=['POST'])
def admin_direction_delete(dir_id):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT file_url, thumb_url, source_url, mobile_url FROM directions WHERE id = %s",
                (dir_id,)
            )
            direction = cursor.fetchone()

            if direction:
                for url in [direction['file_url'], direction['thumb_url'],
                            direction['source_url'], direction['mobile_url']]:
                    if url:
                        filepath = os.path.join(app.root_path, 'static', url)
                        if os.path.exists(filepath):
                            os.remove(filepath)

            cursor.execute("DELETE FROM directions WHERE id = %s", (dir_id,))
            connection.commit()
    finally:
        connection.close()
    return redirect(url_for('admin_dashboard', tab='view-categories'))


# API: Синхронизация водяных знаков для СТАРЫХ фотографий
@app.route('/api/admin/album/<int:album_id>/sync_watermarks', methods=['POST'])
def api_sync_watermarks(album_id):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Достаем SLUG вместе с настройками
            cursor.execute("SELECT slug, is_watermark_enabled FROM photo_album WHERE id = %s", (album_id,))
            album = cursor.fetchone()
            
            cursor.execute("SELECT watermark_text FROM users WHERE id = 1")
            user_settings = cursor.fetchone()
            wm_text = user_settings['watermark_text'] if user_settings and user_settings['watermark_text'] else "LENSE & LIGHT"
            
            cursor.execute("SELECT id, file_url, watermark_url FROM photo WHERE album_id = %s AND is_spacer = 0", (album_id,))
            photos = cursor.fetchall()
            
            if not album:
                return jsonify({'error': 'Альбом не найден'}), 404

            # Формируем красивое имя папки
            album_folder_name = f"{album['slug']}_{album_id}"
            album_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'albums', album_folder_name)
            wm_dir = os.path.join(album_dir, 'watermarked')
            
            if album['is_watermark_enabled']:
                # Пересобираем знаки у ВСЕХ фото альбома. Раньше пересобирались
                # только "старые" (без миниатюры / со старым именем) — и знаки,
                # нарисованные ещё сломанным шрифтом (квадратики вместо
                # кириллицы), кнопка просто пропускала. Кнопку жмут явно, так
                # что пересобрать всё — правильное и ожидаемое поведение
                # (поменяли текст знака, шрифт или размер — нажали — готово).
                for p in photos:
                    wm = p['watermark_url']
                    if p['file_url']:
                        full_path = os.path.join(app.root_path, 'static', p['file_url'])
                        if os.path.exists(full_path):
                            os.makedirs(album_dir, exist_ok=True)
                            client_preview_path = os.path.join(album_dir, f"client_temp_{p['id']}.jpg")
                            
                            img = Image.open(full_path)
                            img.thumbnail((1920, 1920))
                            if img.mode != 'RGB': img = img.convert('RGB')
                            img.save(client_preview_path, 'JPEG', quality=85)
                            
                            # Накладываем знак
                            wm_url = apply_watermark(client_preview_path, wm_text, wm_dir)
                            os.remove(client_preview_path) # Удаляем временный файл
                            
                            if wm_url:
                                cursor.execute("UPDATE photo SET watermark_url = %s WHERE id = %s", (wm_url, p['id']))
                                _remove_watermark_files(wm)  # старое — только после успешной замены
            else:
                # Отключаем вотермарки (Удаляем старые файлы с жесткого диска!)
                for p in photos:
                    if p['watermark_url']:
                        _remove_watermark_files(p['watermark_url'])
                        cursor.execute("UPDATE photo SET watermark_url = NULL WHERE id = %s", (p['id'],))
            
            connection.commit()
            return jsonify({'status': 'success'})
    except Exception as e:
        print("Ошибка синхронизации:", e)
        return jsonify({'error': str(e)}), 500
    finally:
        connection.close()

# ==========================================
# УСЛУГИ И РЕТУШЬ (CRUD)
# ==========================================

@app.route('/admin/service/create', methods=['POST'])
def admin_service_create():
    title = request.form.get('title')
    description = request.form.get('description')
    badge_text = request.form.get('badge_text')
    price = request.form.get('price') 
    if price == '': price = None      
    
    is_highlighted = 1 if request.form.get('is_highlighted') else 0

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Падает в конец
            cursor.execute("SELECT MAX(sort_order) as max_sort FROM services")
            res = cursor.fetchone()
            next_sort = (res['max_sort'] or 0) + 1

            sql = "INSERT INTO services (title, description, badge_text, is_highlighted, price, sort_order) VALUES (%s, %s, %s, %s, %s, %s)"
            cursor.execute(sql, (title, description, badge_text, is_highlighted, price, next_sort))
            connection.commit()
    finally:
        connection.close()
    return redirect(url_for('admin_dashboard', tab='view-services'))

@app.route('/admin/service/edit/<int:srv_id>', methods=['POST'])
def admin_service_edit(srv_id):
    title = request.form.get('title')
    description = request.form.get('description')
    badge_text = request.form.get('badge_text')
    price = request.form.get('price')
    if price == '': price = None
    is_highlighted = 1 if request.form.get('is_highlighted') else 0

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            sql = "UPDATE services SET title=%s, description=%s, badge_text=%s, is_highlighted=%s, price=%s WHERE id=%s"
            cursor.execute(sql, (title, description, badge_text, is_highlighted, price, srv_id))
            connection.commit()
    finally:
        connection.close()
    return redirect(url_for('admin_dashboard', tab='view-services'))

@app.route('/admin/service/delete/<int:srv_id>', methods=['POST'])
def admin_service_delete(srv_id):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM services WHERE id = %s", (srv_id,))
            connection.commit()
    finally:
        connection.close()
    return redirect(url_for('admin_dashboard', tab='view-services'))

# --- НОВЫЕ РОУТЫ: СОРТИРОВКА УСЛУГ ---
@app.route('/api/admin/services/reorder', methods=['POST'])
def api_reorder_services():
    data = request.json
    srv_ids = data.get('srv_ids', [])
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            for index, s_id in enumerate(srv_ids):
                cursor.execute("UPDATE services SET sort_order = %s WHERE id = %s", (index, s_id))
            connection.commit()
        return jsonify({'status': 'success'})
    except Exception as e: return jsonify({'error': str(e)}), 500
    finally: connection.close()

@app.route('/api/admin/service/<int:srv_id>/sort', methods=['PUT'])
def api_update_service_sort(srv_id):
    data = request.json
    sort_order = data.get('sort_order', 0)
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("UPDATE services SET sort_order = %s WHERE id = %s", (sort_order, srv_id))
            connection.commit()
        return jsonify({'status': 'success'})
    finally: connection.close()

# --- РЕТУШЬ ---
@app.route('/admin/retouch/create', methods=['POST'])
def admin_retouch_create():
    tab_name = request.form.get('tab_name')
    caption = request.form.get('caption')

    before_file = request.files.get('before_file')
    after_file = request.files.get('after_file')

    if not before_file or not after_file or not before_file.filename or not after_file.filename:
        flash("Необходимо загрузить оба фото (До и После)")
        return redirect(url_for('admin_dashboard', tab='view-services'))

    retouch_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'retouch')

    before_name, before_thumb_name = save_with_thumbnail(before_file, retouch_dir, prefix='retouch_before')
    after_name, after_thumb_name = save_with_thumbnail(after_file, retouch_dir, prefix='retouch_after')

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT MAX(sort_order) as max_sort FROM retouch_sliders")
            res = cursor.fetchone()
            next_sort = (res['max_sort'] or 0) + 1

            sql = """INSERT INTO retouch_sliders
                    (tab_name, caption, before_url, before_thumb_url, after_url, after_thumb_url, sort_order)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)"""
            cursor.execute(sql, (
                tab_name, caption,
                f"uploads/retouch/{before_name}", f"uploads/retouch/{before_thumb_name}",
                f"uploads/retouch/{after_name}", f"uploads/retouch/{after_thumb_name}",
                next_sort
            ))
            connection.commit()
    finally:
        connection.close()
    return redirect(url_for('admin_dashboard', tab='view-services'))


# --- Редактирование ретуши (с заменой файлов) ---
@app.route('/admin/retouch/edit/<int:ret_id>', methods=['POST'])
def admin_retouch_edit(ret_id):
    tab_name = request.form.get('tab_name')
    caption = request.form.get('caption')

    before_file = request.files.get('before_file')
    after_file = request.files.get('after_file')

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT before_url, before_thumb_url, after_url, after_thumb_url FROM retouch_sliders WHERE id = %s",
                (ret_id,)
            )
            old_data = cursor.fetchone()

            updates = ["tab_name=%s", "caption=%s"]
            params = [tab_name, caption]

            retouch_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'retouch')

            if before_file and before_file.filename:
                if old_data:
                    for old_url in [old_data['before_url'], old_data['before_thumb_url']]:
                        if old_url:
                            old_path = os.path.join(app.root_path, 'static', old_url)
                            if os.path.exists(old_path):
                                os.remove(old_path)

                before_name, before_thumb_name = save_with_thumbnail(before_file, retouch_dir, prefix='retouch_before')
                updates.append("before_url=%s")
                updates.append("before_thumb_url=%s")
                params.append(f"uploads/retouch/{before_name}")
                params.append(f"uploads/retouch/{before_thumb_name}")

            if after_file and after_file.filename:
                if old_data:
                    for old_url in [old_data['after_url'], old_data['after_thumb_url']]:
                        if old_url:
                            old_path = os.path.join(app.root_path, 'static', old_url)
                            if os.path.exists(old_path):
                                os.remove(old_path)

                after_name, after_thumb_name = save_with_thumbnail(after_file, retouch_dir, prefix='retouch_after')
                updates.append("after_url=%s")
                updates.append("after_thumb_url=%s")
                params.append(f"uploads/retouch/{after_name}")
                params.append(f"uploads/retouch/{after_thumb_name}")

            params.append(ret_id)
            sql = f"UPDATE retouch_sliders SET {', '.join(updates)} WHERE id=%s"
            cursor.execute(sql, tuple(params))
            connection.commit()
    finally:
        connection.close()

    return redirect(url_for('admin_dashboard', tab='view-services'))

# Функция удаления ретуши (с очисткой файлов)
@app.route('/admin/retouch/delete/<int:ret_id>', methods=['POST'])
def admin_retouch_delete(ret_id):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT before_url, before_thumb_url, after_url, after_thumb_url FROM retouch_sliders WHERE id = %s",
                (ret_id,)
            )
            row = cursor.fetchone()
            if row:
                for url in [row['before_url'], row['before_thumb_url'], row['after_url'], row['after_thumb_url']]:
                    if url:
                        filepath = os.path.join(app.root_path, 'static', url)
                        if os.path.exists(filepath):
                            os.remove(filepath)
            cursor.execute("DELETE FROM retouch_sliders WHERE id = %s", (ret_id,))
            connection.commit()
    finally:
        connection.close()
    return redirect(url_for('admin_dashboard', tab='view-services'))

# --- СОРТИРОВКА РЕТУШИ ---
@app.route('/api/admin/retouch/reorder', methods=['POST'])
def api_reorder_retouch():
    data = request.json
    ret_ids = data.get('ret_ids', [])
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            for index, r_id in enumerate(ret_ids):
                cursor.execute("UPDATE retouch_sliders SET sort_order = %s WHERE id = %s", (index, r_id))
            connection.commit()
        return jsonify({'status': 'success'})
    except Exception as e: return jsonify({'error': str(e)}), 500
    finally: connection.close()

@app.route('/api/admin/retouch/<int:ret_id>/sort', methods=['PUT'])
def api_update_retouch_sort(ret_id):
    data = request.json
    sort_order = data.get('sort_order', 0)
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("UPDATE retouch_sliders SET sort_order = %s WHERE id = %s", (sort_order, ret_id))
            connection.commit()
        return jsonify({'status': 'success'})
    finally: connection.close()


# ==========================================
# НАСТРОЙКИ ПРОФИЛЯ И СОЦСЕТИ
# ==========================================
@app.route('/admin/settings/profile', methods=['POST'])
def admin_settings_profile():
    name = request.form.get('name')
    surname = request.form.get('surname')
    middle_name = request.form.get('middle_name')
    email = request.form.get('email')
    phone = request.form.get('phone')
    login = request.form.get('login')
    watermark_text = request.form.get('watermark_text')
    avatar_file = request.files.get('avatar_file')
    about_file = request.files.get('about_photo_file')

    # Точки фокуса фото «Обо мне» (ПК и телефон), проценты 0–100
    def _focus(field, default):
        try:
            return max(0, min(100, int(round(float(request.form.get(field, default))))))
        except (TypeError, ValueError):
            return default
    about_focus = (_focus('about_focus_x', 50), _focus('about_focus_y', 30),
                   _focus('about_mobile_focus_x', 50), _focus('about_mobile_focus_y', 30))

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Фото первого блока «Обо мне» — отдельно от аватара (тот на главной)
            if about_file and about_file.filename:
                cursor.execute("SELECT about_photo_url, about_photo_thumb_url FROM users WHERE id = 1")
                old_about = cursor.fetchone() or {}
                for old_url in (old_about.get('about_photo_url'), old_about.get('about_photo_thumb_url')):
                    if old_url:
                        old_path = os.path.join(app.root_path, 'static', old_url)
                        if os.path.exists(old_path):
                            os.remove(old_path)
                about_name, about_thumb = save_with_thumbnail(
                    about_file, app.config['UPLOAD_FOLDER'], prefix='about', thumb_size=(600, 600),
                    full_max_size=(2600, 2600)
                )
                cursor.execute("UPDATE users SET about_photo_url=%s, about_photo_thumb_url=%s WHERE id=1",
                               (f"uploads/{about_name}", f"uploads/{about_thumb}"))
            cursor.execute("""UPDATE users SET about_focus_x=%s, about_focus_y=%s,
                                  about_mobile_focus_x=%s, about_mobile_focus_y=%s WHERE id=1""", about_focus)

            if avatar_file and avatar_file.filename:
                cursor.execute("SELECT avatar_url, avatar_thumb_url FROM users WHERE id = 1")
                old_avatar = cursor.fetchone()
                if old_avatar:
                    for old_url in [old_avatar['avatar_url'], old_avatar['avatar_thumb_url']]:
                        if old_url:
                            old_path = os.path.join(app.root_path, 'static', old_url)
                            if os.path.exists(old_path):
                                os.remove(old_path)

                # Оригинал нужен для большой обложки на "Обо мне", миниатюра — для админки
                unique_name, thumb_name = save_with_thumbnail(
                    avatar_file, app.config['UPLOAD_FOLDER'], prefix='avatar', thumb_size=(300, 300)
                )
                avatar_url = f"uploads/{unique_name}"
                avatar_thumb_url = f"uploads/{thumb_name}"

                sql = """UPDATE users SET name=%s, surname=%s, middle_name=%s, email=%s, phone=%s, login=%s,
                        avatar_url=%s, avatar_thumb_url=%s, watermark_text=%s WHERE id=1"""
                cursor.execute(sql, (name, surname, middle_name, email, phone, login,
                                    avatar_url, avatar_thumb_url, watermark_text))
            else:
                sql = """UPDATE users SET name=%s, surname=%s, middle_name=%s, email=%s, phone=%s, login=%s, watermark_text=%s WHERE id=1"""
                cursor.execute(sql, (name, surname, middle_name, email, phone, login, watermark_text))

            connection.commit()
    finally:
        connection.close()
    return redirect(url_for('admin_dashboard', tab='view-settings'))

@app.route('/admin/settings/password', methods=['POST'])
def admin_settings_password():
    current_password = request.form.get('current_password')
    new_password = request.form.get('new_password')

    if not current_password or not new_password:
        flash('Заполните оба поля')
        return redirect(url_for('admin_dashboard', tab='view-settings'))

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT hash_password FROM users WHERE id = 1")
            user_row = cursor.fetchone()

            if not user_row or not check_password_hash(user_row['hash_password'], current_password):
                flash('Текущий пароль указан неверно')
                return redirect(url_for('admin_dashboard', tab='view-settings'))

            hashed_pw = generate_password_hash(new_password)
            cursor.execute("UPDATE users SET hash_password=%s WHERE id=1", (hashed_pw,))
            connection.commit()
    finally:
        connection.close()

    flash('Пароль успешно обновлён')
    return redirect(url_for('admin_dashboard', tab='view-settings'))

# Разовая обработка УЖЕ загруженных фото: автор в метаданных + удаление
# геометок (новые файлы обрабатываются сами при загрузке, см.
# stamp_photo_metadata). Можно нажимать повторно — результат тот же.
@app.route('/admin/settings/stamp-metadata', methods=['POST'])
def admin_settings_stamp_metadata():
    count = 0
    author = _photo_author_name()  # один раз, а не на каждый файл
    for dirpath, _dirnames, filenames in os.walk(app.config['UPLOAD_FOLDER']):
        for filename in filenames:
            if filename.lower().endswith(('.jpg', '.jpeg')):
                stamp_photo_metadata(os.path.join(dirpath, filename), author)
                count += 1
    flash(f'Готово: обработано фото — {count}. Автор прописан, геометки удалены.')
    return redirect(url_for('admin_dashboard', tab='view-settings'))


# ==========================================
# МЕСТО НА СЕРВЕРЕ (кольцо «Память» в админке и вес альбомов)
# ==========================================
# Сколько всего места на тарифе, сайт узнать не может: на shared-хостинге
# shutil.disk_usage показывает весь диск сервера Beget, а не квоту. Поэтому
# объём тарифа владелец вписывает в «Настройках» (users.storage_limit_gb),
# а занятое место сайт считает сам.
def _dir_size(path, skip=None):
    """Сумма размеров файлов в папке со всеми подпапками. skip — папка, которую не считать."""
    skip = os.path.normcase(os.path.abspath(skip)) if skip else None
    total, stack = 0, [path]
    while stack:
        try:
            with os.scandir(stack.pop()) as entries:
                for entry in entries:
                    try:
                        if entry.is_symlink():
                            continue
                        if entry.is_dir():
                            if os.path.normcase(os.path.abspath(entry.path)) != skip:
                                stack.append(entry.path)
                        else:
                            total += entry.stat().st_size
                    except OSError:
                        continue
        except OSError:
            continue
    return total


INNODB_PAGE = 16 * 1024


def _db_size(cursor):
    """Сколько база занимает на диске. Панель хостинга считает файлы таблиц
    (.ibd), а файл больше самих данных: служебные страницы и минимальный
    размер ~112 КБ даже у почти пустой таблицы. Точный размер файлов MySQL
    отдаёт только с привилегией PROCESS — на Beget её нет (проверено
    18.10.2026, MySQL 8.4), поэтому там размер файла оценивается по таблице:
    данные + индексы + свободное место + 4 служебные страницы, не меньше 7 страниц."""
    for table in ('INNODB_TABLESPACES', 'INNODB_SYS_TABLESPACES'):
        try:
            cursor.execute(f"""SELECT COALESCE(SUM(FILE_SIZE), 0) AS size FROM information_schema.{table}
                               WHERE NAME LIKE CONCAT(DATABASE(), '/%')""")
            size = int((cursor.fetchone() or {}).get('size') or 0)
            if size:
                return size
        except pymysql.MySQLError:
            continue
    try:
        # MySQL 8 по умолчанию отдаёт размеры таблиц из кэша суточной давности
        cursor.execute("SET SESSION information_schema_stats_expiry = 0")
    except pymysql.MySQLError:
        pass
    # Псевдонимы обязательны: MySQL 8 иначе возвращает имена колонок ЗАГЛАВНЫМИ
    cursor.execute("""SELECT engine AS engine, data_length AS data_length,
                             index_length AS index_length, data_free AS data_free
                      FROM information_schema.TABLES WHERE table_schema = DATABASE()""")
    total = 0
    for t in cursor.fetchall():
        used = int(t.get('data_length') or 0) + int(t.get('index_length') or 0)
        if (t.get('engine') or '').lower() == 'innodb':
            used = max(7 * INNODB_PAGE, used + int(t.get('data_free') or 0) + 4 * INNODB_PAGE)
        total += used
    return total


@app.route('/api/admin/storage')
def api_storage():
    upload_root = app.config['UPLOAD_FOLDER']
    albums_root = os.path.join(upload_root, 'albums')

    # Папки альбомов называются {slug}_{id} — вес считаем по id
    by_album, albums_total = {}, 0
    try:
        folders = [e for e in os.scandir(albums_root) if e.is_dir(follow_symlinks=False)]
    except OSError:
        folders = []
    for folder in folders:
        size = _dir_size(folder.path)
        albums_total += size
        m = re.search(r'_(\d+)$', folder.name)
        if m:
            by_album[int(m.group(1))] = by_album.get(int(m.group(1)), 0) + size

    images = _dir_size(upload_root, skip=albums_root)                    # аватар, направления, услуги…
    site = _dir_size(os.path.dirname(app.root_path), skip=upload_root)   # код, шрифты, venv на хостинге

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            db_size = _db_size(cursor)
            # SELECT *, а не storage_limit_gb: до миграции колонки нет, и тогда лимит просто не задан
            cursor.execute("SELECT * FROM users WHERE id = 1")
            limit_gb = (cursor.fetchone() or {}).get('storage_limit_gb')
            cursor.execute("SELECT a.id, a.title FROM photo_album a")
            albums = [{'id': a['id'], 'title': a['title'], 'bytes': by_album.get(a['id'], 0)}
                      for a in cursor.fetchall()]
    finally:
        connection.close()

    return jsonify({
        'limit': int(float(limit_gb) * 1024 ** 3) if limit_gb else None,
        'parts': {'albums': albums_total, 'images': images, 'site': site, 'db': db_size},
        'albums': albums,
    })


@app.route('/admin/settings/storage', methods=['POST'])
def admin_settings_storage():
    raw = (request.form.get('storage_limit_gb') or '').replace(',', '.').strip()
    try:
        limit_gb = round(float(raw), 1) if raw else None
    except ValueError:
        limit_gb = -1
    if limit_gb is not None and not 0 < limit_gb <= 100000:
        flash('Объём тарифа укажите числом в гигабайтах, например 10')
        return redirect(url_for('admin_dashboard', tab='view-settings'))

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("UPDATE users SET storage_limit_gb=%s WHERE id=1", (limit_gb,))
            connection.commit()
    finally:
        connection.close()
    flash('Объём тарифа сохранён' if limit_gb else 'Объём тарифа очищен')
    return redirect(url_for('admin_dashboard', tab='view-settings'))


@app.route('/admin/settings/social/add', methods=['POST'])
def admin_settings_social_add():
    icon_id = request.form.get('icon_social_media_id')
    link = request.form.get('link')
    
    if icon_id and link:
        connection = get_db_connection()
        try:
            with connection.cursor() as cursor:
                # Используем INSERT IGNORE, чтобы не упало, если такая соцсеть уже добавлена
                cursor.execute("INSERT IGNORE INTO social_media (users_id, icon_social_media_id, link) VALUES (1, %s, %s)", (icon_id, link))
                connection.commit()
        finally:
            connection.close()
    return redirect(url_for('admin_dashboard', tab='view-settings'))

@app.route('/admin/settings/social/delete/<int:sm_id>', methods=['POST'])
def admin_settings_social_delete(sm_id):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM social_media WHERE id=%s AND users_id=1", (sm_id,))
            connection.commit()
    finally:
        connection.close()
    return redirect(url_for('admin_dashboard', tab='view-settings'))


# ==========================================
# ДОСТИЖЕНИЯ (дипломы/награды на странице "Обо мне")
# ==========================================

@app.route('/admin/achievement/create', methods=['POST'])
def admin_achievement_create():
    year = request.form.get('year')
    title = request.form.get('title')
    description = request.form.get('description')
    link_url = request.form.get('link_url')

    if not year or not title:
        flash("Укажите год и название достижения")
        return redirect(url_for('admin_dashboard', tab='view-settings'))

    image_url = None
    thumb_url = None
    achievement_file = request.files.get('achievement_file')
    if achievement_file and achievement_file.filename:
        target_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'achievements')
        unique_name, thumb_name = save_with_thumbnail(achievement_file, target_dir, prefix='ach', thumb_size=(500, 500))
        image_url = f"uploads/achievements/{unique_name}"
        thumb_url = f"uploads/achievements/{thumb_name}"

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT MAX(sort_order) as max_sort FROM achievements")
            res = cursor.fetchone()
            next_sort = (res['max_sort'] or 0) + 1

            sql = """INSERT INTO achievements (users_id, year, title, description, link_url, image_url, thumb_url, sort_order)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"""
            # users_id = 1 (как и везде в проекте — предполагаем единственного админа)
            cursor.execute(sql, (1, year, title, description, link_url, image_url, thumb_url, next_sort))
            connection.commit()
    finally:
        connection.close()

    return redirect(url_for('admin_dashboard', tab='view-settings'))


@app.route('/admin/achievement/edit/<int:achievement_id>', methods=['POST'])
def admin_achievement_edit(achievement_id):
    year = request.form.get('year')
    title = request.form.get('title')
    description = request.form.get('description')
    link_url = request.form.get('link_url')
    achievement_file = request.files.get('achievement_file')

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            if achievement_file and achievement_file.filename:
                cursor.execute("SELECT image_url, thumb_url FROM achievements WHERE id = %s", (achievement_id,))
                old = cursor.fetchone()
                if old:
                    for old_url in [old['image_url'], old['thumb_url']]:
                        if old_url:
                            old_path = os.path.join(app.root_path, 'static', old_url)
                            if os.path.exists(old_path):
                                os.remove(old_path)

                target_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'achievements')
                unique_name, thumb_name = save_with_thumbnail(achievement_file, target_dir, prefix='ach', thumb_size=(500, 500))
                image_url = f"uploads/achievements/{unique_name}"
                thumb_url = f"uploads/achievements/{thumb_name}"

                cursor.execute(
                    "UPDATE achievements SET year=%s, title=%s, description=%s, link_url=%s, image_url=%s, thumb_url=%s WHERE id=%s",
                    (year, title, description, link_url, image_url, thumb_url, achievement_id)
                )
            else:
                cursor.execute(
                    "UPDATE achievements SET year=%s, title=%s, description=%s, link_url=%s WHERE id=%s",
                    (year, title, description, link_url, achievement_id)
                )
            connection.commit()
    finally:
        connection.close()

    return redirect(url_for('admin_dashboard', tab='view-settings'))


@app.route('/admin/achievement/delete/<int:achievement_id>', methods=['POST'])
def admin_achievement_delete(achievement_id):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT image_url, thumb_url FROM achievements WHERE id = %s", (achievement_id,))
            row = cursor.fetchone()

            if row:
                for url in [row['image_url'], row['thumb_url']]:
                    if url:
                        filepath = os.path.join(app.root_path, 'static', url)
                        if os.path.exists(filepath):
                            os.remove(filepath)

            cursor.execute("DELETE FROM achievements WHERE id = %s", (achievement_id,))
            connection.commit()
    finally:
        connection.close()

    return redirect(url_for('admin_dashboard', tab='view-settings'))


# --- СОРТИРОВКА ДОСТИЖЕНИЙ (как у услуг: перетаскивание и цифра вручную) ---
@app.route('/api/admin/achievements/reorder', methods=['POST'])
def api_reorder_achievements():
    ach_ids = (request.json or {}).get('ach_ids', [])
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            for index, a_id in enumerate(ach_ids):
                cursor.execute("UPDATE achievements SET sort_order = %s WHERE id = %s", (index, a_id))
            connection.commit()
        return jsonify({'status': 'success'})
    except Exception as e: return jsonify({'error': str(e)}), 500
    finally: connection.close()


@app.route('/api/admin/achievement/<int:achievement_id>/sort', methods=['PUT'])
def api_update_achievement_sort(achievement_id):
    try:
        sort_order = int((request.json or {}).get('sort_order', 0))
    except (TypeError, ValueError):
        sort_order = 0
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("UPDATE achievements SET sort_order = %s WHERE id = %s", (sort_order, achievement_id))
            connection.commit()
        return jsonify({'status': 'success'})
    finally: connection.close()


# ==========================================
# ПУБЛИЧНЫЕ СТРАНИЦЫ САЙТА
# ==========================================

@app.route('/')
def index():
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Направления — превью категорий на главном экране (меню под фото)
            cursor.execute("""
                SELECT d.id, d.file_url, d.thumb_url, d.mobile_url, d.color_hex,
                       d.mobile_focus_x, d.mobile_focus_y, d.mobile_zoom,
                       c.slug AS category_slug,
                       c.name AS category_name, c.description AS category_description,
                       c.tagline AS category_tagline
                FROM directions d
                JOIN category c ON d.category_id = c.id
                WHERE c.is_active = TRUE
                ORDER BY d.sort_order ASC, d.id ASC
            """)
            directions_raw = cursor.fetchall()

            # Подстраховка: на публичной странице каждая категория должна
            # попасть в меню только один раз (иначе совпадут HTML id
            # preview-<slug>/media-preview-<slug>). Проверка выше не даёт
            # админке создать новый дубль, но если в БД уже случайно лежит
            # старый — просто берём первое направление на категорию.
            seen_categories = set()
            directions = []
            for d in directions_raw:
                if d['category_slug'] in seen_categories:
                    continue
                seen_categories.add(d['category_slug'])
                directions.append(d)

            cursor.execute("""
                SELECT * FROM services
                WHERE is_active = TRUE
                ORDER BY sort_order ASC, id ASC
            """)
            services = cursor.fetchall()

            cursor.execute("""
                SELECT * FROM retouch_sliders
                WHERE is_active = TRUE
                ORDER BY sort_order ASC, id ASC
            """)
            retouch_sliders = cursor.fetchall()
    finally:
        connection.close()

    return render_template(
        'index.html',
        directions=directions,
        services=services,
        retouch_sliders=retouch_sliders,
    )


@app.route('/gallery')
def gallery():
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT a.id, a.slug, a.title, a.card_caption, a.cover_url, a.cover_thumb_url, a.cover_ratio, a.color_hex,
                       a.cover_focus_x, a.cover_focus_y, a.cover_zoom,
                       a.date_taken, a.created_at, a.expires_at,
                       c.slug AS category_slug, c.name AS category_name
                FROM photo_album a
                JOIN category c ON a.category_id = c.id
                WHERE a.is_active = TRUE AND a.is_private = FALSE
                  AND (a.expires_at IS NULL OR a.expires_at >= %s)
                ORDER BY a.sort_order ASC, a.created_at DESC
            """, (date.today(),))
            albums = cursor.fetchall()
            for album in albums:
                album['days_left'] = _days_left(album['expires_at'])

            cursor.execute("""
                SELECT c.slug, c.name, COUNT(a.id) AS album_count
                FROM category c
                JOIN photo_album a ON a.category_id = c.id
                    AND a.is_active = TRUE AND a.is_private = FALSE
                    AND (a.expires_at IS NULL OR a.expires_at >= %s)
                WHERE c.is_active = TRUE
                GROUP BY c.id, c.slug, c.name
                ORDER BY c.id ASC
            """, (date.today(),))
            categories = cursor.fetchall()
    finally:
        connection.close()

    return render_template(
        'gallery.html',
        albums=albums,
        categories=categories,
        total_count=len(albums),
        active_category=request.args.get('category', 'all'),
    )


def _about_achievements():
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM achievements WHERE users_id = 1 ORDER BY sort_order ASC, id ASC")
            return cursor.fetchall()
    finally:
        connection.close()


@app.route('/about')
def about():
    return render_template('about.html', achievements=_about_achievements())


# Правовые страницы (152-ФЗ). Оператор — владелец сайта (site_owner из
# inject_site_globals); реквизиты, которых нет в БД, стоят в шаблонах
# заглушками [ЗАПОЛНИТЬ]. Ссылки на них — в cookie-баннере и подвале
# (base.html) и в чекбоксе согласия в окне "Как вас зовут?" (album.html).
@app.route('/privacy')
def privacy():
    return render_template('privacy.html')


@app.route('/cookies')
def cookies_policy():
    return render_template('cookies.html')


# Согласие на обработку ПД — по ч. 1 ст. 9 152-ФЗ оформляется ОТДЕЛЬНО от
# политики. На него ведёт галочка в окне "Как вас зовут?" (album.html).
@app.route('/pd-consent')
@app.route('/pd-consent/<version>')
def pd_consent(version=None):
    version = version or PD_CONSENT_VERSION
    if version not in PD_CONSENT_VERSIONS:
        abort(404)
    return render_template('pd_consent.html', version=version,
                           is_current=(version == PD_CONSENT_VERSION))


def _get_client_selection(cursor, album):
    """Возвращает (session_uuid, набор_id_понравившихся_фото) для текущего
    посетителя этого альбома, если у него уже есть сессия (куки), иначе
    (None, пустое множество)."""
    cookie_name = f"cs_{album['id']}"
    session_uuid = request.cookies.get(cookie_name)
    if not session_uuid:
        return None, set()

    cursor.execute(
        "SELECT session_uuid FROM client_sessions WHERE session_uuid = %s AND access_token = %s",
        (session_uuid, album['access_token'])
    )
    if not cursor.fetchone():
        return None, set()

    cursor.execute("SELECT photo_id FROM client_selections WHERE session_uuid = %s", (session_uuid,))
    liked = {row['photo_id'] for row in cursor.fetchall()}
    return session_uuid, liked


def _album_like_counts(cursor, album, photo_id=None):
    """Сколько человек (сессий отбора) отметили сердечком каждое фото альбома:
    {photo_id: число}. Посетители видят только числа, без имён — имена
    знает только админ (вкладка «Выбор клиентов»). С photo_id — число для
    одного фото."""
    sql = ("SELECT cs.photo_id, COUNT(*) AS n FROM client_selections cs "
           "JOIN client_sessions s ON s.session_uuid = cs.session_uuid "
           "WHERE s.access_token = %s")
    params = [album['access_token']]
    if photo_id is not None:
        sql += " AND cs.photo_id = %s"
        params.append(photo_id)
    cursor.execute(sql + " GROUP BY cs.photo_id", params)
    return {row['photo_id']: row['n'] for row in cursor.fetchall()}


@app.route('/album/<slug>')
def album_detail(slug):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT a.*, c.name AS category_name
                FROM photo_album a
                LEFT JOIN category c ON a.category_id = c.id
                WHERE a.slug = %s
            """, (slug,))
            album = cursor.fetchone()

            if not album or not album['is_active'] or _album_expired(album):
                abort(404)

            # Приватный альбом открывается только по секретной ссылке
            # ?token=... — тот самый access_token, который админка
            # выдает при создании альбома (см. комментарий в CREATE_DB.sql).
            if album['is_private']:
                token = request.args.get('token')
                if not token or token != album['access_token']:
                    abort(404)

            cursor.execute("""
                SELECT p.*, gc.slug AS grid_class_slug
                FROM photo p
                LEFT JOIN grid_class gc ON p.grid_class_id = gc.id
                WHERE p.album_id = %s
                ORDER BY p.sort_order ASC, p.id ASC
            """, (album['id'],))
            photos = cursor.fetchall()

            liked_photo_ids = set()
            like_counts = {}
            if album['allow_selection']:
                _, liked_photo_ids = _get_client_selection(cursor, album)
                like_counts = _album_like_counts(cursor, album)
    finally:
        connection.close()

    album['days_left'] = _days_left(album['expires_at'])

    # Публике отдаём вотермарку вместо оригинала, если она включена для
    # альбома — то же самое изображение, что видит клиент в лайтбоксе и
    # что скачивается по кнопке "Скачать". Плюс собираем EXIF в JSON здесь
    # же (не в шаблоне), чтобы аккуратно и безопасно положить его в
    # data-атрибут карточки (album.js его потом просто JSON.parse-ит).
    for p in photos:
        # Заглушка ("пустое место" из админки) — просто занимает место в
        # сетке, картинки и данных съёмки у неё нет.
        if p.get('is_spacer'):
            continue
        if album['is_watermark_enabled'] and p.get('watermark_url'):
            p['display_url'] = p['watermark_url']
            # Миниатюра в сетке — тоже со знаком. Если её ещё нет (фото со
            # знаком старого образца, до кнопки синхронизации), лучше отдать
            # большой файл со знаком, чем чистую thumb/ — она к тому же
            # закрыта для посетителей (см. _protect_watermarked_originals).
            wm_thumb = watermark_thumb_url(p['watermark_url'])
            p['display_thumb_url'] = (wm_thumb if os.path.exists(os.path.join(app.root_path, 'static', wm_thumb))
                                      else p['watermark_url'])
        else:
            p['display_url'] = p['file_url']
            p['display_thumb_url'] = p['thumb_url']
        p['is_liked'] = p['id'] in liked_photo_ids
        p['like_count'] = like_counts.get(p['id'], 0)
        p['exif_json'] = json.dumps({
            'camera': p.get('exif_camera'),
            'lens': p.get('exif_lens'),
            'focal': p.get('exif_focal'),
            'speed': p.get('exif_speed'),
            'aperture': p.get('exif_aperture'),
            'iso': p.get('exif_iso'),
            'ev': p.get('exif_ev'),
            'flash': p.get('exif_flash'),
            'description_html': render_markdown(p.get('description')) if p.get('description') else '',
        }, ensure_ascii=False)

    return render_template(
        'album.html',
        album=album,
        photos=photos,
        photo_count=sum(1 for p in photos if not p.get('is_spacer')),
    )


# Скачать альбом целиком одним zip-архивом (кнопка на обложке альбома).
# Те же правила доступа, что и у самой страницы альбома: приватный —
# только по ?token=, и то же самое изображение, что видит человек в
# лайтбоксе — то есть с вотермаркой, если она включена для альбома
# (иначе кнопка "скачать всё" превращалась бы в дыру мимо защиты фото).
@app.route('/album/<slug>/download')
def album_download_all(slug):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM photo_album WHERE slug = %s", (slug,))
            album = cursor.fetchone()
            if not album or not album['is_active'] or _album_expired(album):
                abort(404)

            if album['is_private']:
                token = request.args.get('token')
                if not token or token != album['access_token']:
                    abort(404)

            cursor.execute("""
                SELECT file_url, watermark_url, title FROM photo
                WHERE album_id = %s AND is_spacer = 0 ORDER BY sort_order ASC, id ASC
            """, (album['id'],))
            photos = cursor.fetchall()
    finally:
        connection.close()

    if not photos:
        abort(404)

    for p in photos:
        p['display_url'] = p['watermark_url'] if (album['is_watermark_enabled'] and p.get('watermark_url')) else p['file_url']

    zip_path = _build_zip_from_photos(photos)
    return _send_zip_and_cleanup(zip_path, f"{secure_filename(album['slug'])}.zip")


# API: отбор фото клиентом ("сердечко" в альбоме). Работает только если
# у альбома включено allow_selection. Сессия клиента живет в отдельной
# куке на альбом (cs_<album_id>), потому что client_sessions.session_uuid
# уникален на всю таблицу и не может обслуживать сразу два разных альбома.
@app.route('/api/album/<slug>/select/<int:photo_id>', methods=['POST', 'DELETE'])
def api_client_select(slug, photo_id):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM photo_album WHERE slug = %s", (slug,))
            album = cursor.fetchone()
            if not album or not album['is_active'] or not album['allow_selection'] or _album_expired(album):
                return jsonify({'error': 'Отбор фото недоступен для этого альбома'}), 403

            if album['is_private']:
                token = request.args.get('token') or (request.json or {}).get('token')
                if not token or token != album['access_token']:
                    return jsonify({'error': 'Нет доступа'}), 403

            cookie_name = f"cs_{album['id']}"
            session_uuid = request.cookies.get(cookie_name)
            new_cookie = None

            if session_uuid:
                cursor.execute(
                    "SELECT session_uuid FROM client_sessions WHERE session_uuid = %s AND access_token = %s",
                    (session_uuid, album['access_token'])
                )
                if not cursor.fetchone():
                    session_uuid = None  # кука есть, но не для этого альбома/токена

            if not session_uuid:
                data = request.json or {}
                # Обрезаем под размер колонок (varchar 64/256), иначе MySQL в
                # строгом режиме уронит INSERT на слишком длинном вводе.
                client_name = (data.get('client_name') or '').strip()[:64]
                # Контакт (client_contact) больше не принимаем: в форме его
                # нет, и собирать лишние ПД незачем (ст. 5 152-ФЗ). Колонка в
                # БД осталась от старой версии и не заполняется.

                if album['require_client_info'] and not client_name:
                    return jsonify({'need_info': True}), 428

                # 152-ФЗ: имя — персональные данные, сохраняем его только при
                # явном согласии (обязательный чекбокс в окне "Как вас зовут?",
                # album.js) и запоминаем, с КАКОЙ редакцией согласия человек
                # согласился. Сессия без имени (альбом не требует
                # представиться) — это просто случайный id в куке.
                consent_version = None
                if client_name:
                    consent_version = data.get('pd_consent_version')
                    if data.get('pd_consent') is not True or consent_version not in PD_CONSENT_VERSIONS:
                        return jsonify({'error': 'Нужно согласие на обработку персональных данных'}), 400

                # Момент согласия фиксируем временем БД (как и created_at) —
                # чтобы при необходимости можно было подтвердить, когда оно дано.
                session_uuid = uuid.uuid4().hex
                consent_at_sql = "CURRENT_TIMESTAMP" if client_name else "NULL"
                cursor.execute(
                    "INSERT INTO client_sessions (access_token, client_name, pd_consent_at, pd_consent_version, session_uuid) "
                    f"VALUES (%s, %s, {consent_at_sql}, %s, %s)",
                    (album['access_token'], client_name or None, consent_version, session_uuid)
                )
                new_cookie = session_uuid

            if request.method == 'POST':
                cursor.execute(
                    "INSERT IGNORE INTO client_selections (photo_id, session_uuid) VALUES (%s, %s)",
                    (photo_id, session_uuid)
                )
                liked = True
            else:
                cursor.execute(
                    "DELETE FROM client_selections WHERE photo_id = %s AND session_uuid = %s",
                    (photo_id, session_uuid)
                )
                liked = False

            connection.commit()
            count = _album_like_counts(cursor, album, photo_id).get(photo_id, 0)

            resp = jsonify({'status': 'success', 'liked': liked, 'count': count})
            if new_cookie:
                resp.set_cookie(cookie_name, new_cookie, max_age=60 * 60 * 24 * 180,
                                httponly=True, secure=COOKIES_SECURE, samesite='Lax')
            return resp
    finally:
        connection.close()


# ==========================================
# АВТОУДАЛЕНИЕ ПРОСРОЧЕННЫХ АЛЬБОМОВ (по расписанию)
# ==========================================
# DEBUG_MODE раньше был захардкожен в True для ЛЮБОГО окружения. Из-за
# этого guard ниже срабатывал и на боевом сервере тоже: WERKZEUG_RUN_MAIN —
# это внутренняя переменная автоперезапуска Werkzeug при локальной
# разработке, Passenger её никогда не ставит, так что условие "DEBUG_MODE и
# нет WERKZEUG_RUN_MAIN" было истинным и на проде — планировщик автоудаления
# просроченных альбомов там просто никогда не стартовал. Теперь по
# умолчанию False (правильно и безопасно для прода); для локальной отладки
# явно выставляйте переменную окружения FLASK_DEBUG=1 перед запуском.
DEBUG_MODE = os.environ.get("FLASK_DEBUG") == "1"

def _start_expired_albums_scheduler():
    # В debug-режиме Flask поднимает 2 процесса (сторож автоперезагрузки + рабочий).
    # WERKZEUG_RUN_MAIN есть только в рабочем процессе — планировщик стартуем только там,
    # иначе задача будет крутиться в двух процессах одновременно.
    if DEBUG_MODE and os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        return

    scheduler = BackgroundScheduler(daemon=True)
    # Запускаем ежедневно в 03:00 ночи. Время не критично — задача просто
    # проверяет, у каких альбомов expires_at уже в прошлом, и удаляет их.
    scheduler.add_job(cleanup_expired_albums, 'cron', hour=3, minute=0)
    scheduler.start()
    atexit.register(lambda: scheduler.shutdown(wait=False))

_start_expired_albums_scheduler()

if __name__ == "__main__":
    app.run(debug=DEBUG_MODE)