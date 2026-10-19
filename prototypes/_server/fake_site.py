"""Тестовый сайт для прототипов дизайна: настоящие шаблоны из scr/, но вместо MySQL —
подставные данные. Запуск (из корня проекта):

    prototypes\\.venv\\Scripts\\python prototypes\\_server\\fake_site.py

и открыть http://127.0.0.1:5090/_proto/about-hero/hero_cmp (или about-awards/awards_cmp).

- /_proto/<папка>/<имя>     — страница prototypes/<папка>/<имя>.html
- /_proto_asset/<путь>      — любой файл из prototypes/
- /about?v=<x>, /gallery?v=<x>, /admin?v=<x>, /album/...?v=<x> — подключает
  найденные в prototypes/*/ файлы <страница>_<x>.css и .js (вариант прототипа)
Логин в админку: admin / secret. Окружение (prototypes/.venv) в git не попадает.
"""
import os, sys, glob, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
PROTO = os.path.dirname(HERE)                       # prototypes/
SCR = os.path.join(os.path.dirname(PROTO), "scr")
os.environ.update(DB_USER="x", DB_PASSWORD="x", DB_NAME="x", FLASK_SECRET_KEY="test", FLASK_DEBUG="1")
os.chdir(SCR)
sys.path.insert(0, SCR)

import pymysql
from werkzeug.security import generate_password_hash

UP = os.path.join(SCR, "static", "uploads")
avatar = next((f for f in sorted(os.listdir(UP)) if f.startswith("avatar_")), "x") if os.path.isdir(UP) else "x"

OWNER = dict(id=1, name="Андрей", surname="Григорьев", middle_name="", email="owner@example.com",
             phone="+79991234567", login="admin", hash_password=generate_password_hash("secret"), is_active=1,
             avatar_url="uploads/" + avatar, avatar_thumb_url=None,
             about_photo_url=None, about_photo_thumb_url=None, about_focus_x=57, about_focus_y=23,
             about_mobile_focus_x=57, about_mobile_focus_y=27, watermark_text="ВЕЛИКАЯ ХОРО МУДРАЯ", role_id=1,
             storage_limit_gb=(float(os.environ["FAKE_LIMIT"]) or None) if os.environ.get("FAKE_LIMIT") else 10)
# Награды: картинки — prototypes/about-awards/dipl*.jpg (подменяются в HTML ниже)
ACH = [dict(id=1, users_id=1, year="2026", title="Гран-при",
            description="Гран-при в личной номинации «Журналистика» (фотопроекты) среди 7 образовательных учреждений",
            link_url="http://techn.sstu.ru/note/?note=3968", image_url="__P__dipl1.jpg", thumb_url=None, sort_order=0),
       dict(id=2, users_id=1, year="2026", title="Победитель «Студенческой весны»",
            description="Победитель районного фестиваля студенческого творчества «Студенческая весна»",
            link_url="https://vk.ru/wall-223192623_513", image_url="__P__dipl2.jpg", thumb_url=None, sort_order=1),
       dict(id=3, users_id=1, year="2025", title="Без ссылки и описания", description=None, link_url=None,
            image_url="__P__dipl1.jpg", thumb_url=None, sort_order=2)]
SOCIAL = [dict(id=1, link="https://t.me/example", title="Telegram", icon="icons/telegram.svg"),
          dict(id=2, link="https://vk.com/example", title="ВКонтакте", icon="icons/vk.svg")]

# Альбомы витрины: фото берутся из локальных папок static/uploads/albums/<slug>_<id>
# (свои фото владельца, никуда не уходят; владелец разрешил показывать их в README).
# Нет папки — альбом просто пустой. id альбома = id из имени папки, чтобы кольцо
# «Память» в админке нашло вес по папке.
import datetime as _dt
from PIL import Image as _Image
_ALB_ROOT = os.path.join(UP, "albums")
_today = _dt.date.today()
# Категории, направления, обложки, цвета и порядок фото — как на рабочем сайте
# (взято с его публичных страниц 19.10.2026; порядок фото — showcase_order.json).
CATS = [dict(id=1, slug="meropriiatiia", name="Мероприятия", tagline="Концерты & Драйв",
             description="Репортажная съемка. Эмоции, атмосфера, детали."),
        dict(id=2, slug="kosplei", name="Косплей", tagline="Персонажи & Свет",
             description="Живые уличные фотосессии. Помогу подобрать подходящую локацию, составлю маршрут и ракурсы для вашего образа."),
        dict(id=3, slug="atmosfera", name="Атмосфера", tagline="Природа & Созерцание",
             description="Свободное творчество. Мои личные проекты и фотоэксперименты.")]
_CAT = {c["slug"]: c for c in CATS}
_MARA = "Косплеер: [Мара](https://vk.ru/dont_be_shyyyyy)"
# (папка, slug, название, категория, формат карточки, цвет, дней до удаления (витрина), отбор,
#  обложка full, обложка mobile, фокус обложки x/y, масштаб, подпись, дата съёмки)
ALBUM_SPECS = [
    ("kosplei-miku-fb8b9d_3", "kosplei-miku-fb8b9d", "Косплей Мику", "kosplei", "type-square", "#de8773", 2, 1,
     "cover_92a43fc5.jpg", "covm_621ebf35.jpg", 80, 50, 1.0, _MARA, _dt.date(2025, 10, 4)),
    ("kosplei-miku-b62d1e_4", "kosplei-miku-b62d1e", "Косплей Мику", "kosplei", "type-horizontal", "#eee8dc", 5, 1,
     "cover_05023dd3.jpg", "covm_b524b9f3.jpg", 50, 50, 1.0, _MARA, _dt.date(2026, 7, 6)),
    ("vypusk-626222_5", "vypusk-626222", "Выпуск", "meropriiatiia", "type-horizontal", "#051b5a", None, 0,
     "cover_561851ff.jpg", "covm_b82b829d.jpg", 50, 50, 1.1, None, _dt.date(2026, 6, 27)),
    ("tsvety-2b049d_6", "tsvety-2b049d", "Цветы", "atmosfera", "type-square", "#060911", None, 0,
     "cover_7e17460e.jpg", "covm_4d205e7c.jpg", 50, 50, 1.0, None, _dt.date(2026, 5, 18)),
]
import json as _json
_ORDER_FILE = os.path.join(HERE, "showcase_order.json")
_ORDER = _json.load(open(_ORDER_FILE, encoding="utf-8")) if os.path.isfile(_ORDER_FILE) else {}
EXIF_SETS = [("Sony ILCE-6000", "E 18-55mm F3.5-5.6 OSS", "35 мм", "1/250", "f/5.6", "ISO 100", None, None),
             ("Sony ILCE-6000", "Sigma 30mm F1.4 DC DN", "30 мм", "1/160", "f/1.4", "ISO 800", "-0.3 EV", None),
             ("Sony ILCE-6000", "Sigma 56mm F1.4 DC DN", "56 мм", "1/320", "f/1.8", "ISO 1600", None, None)]
PHOTOS_BY_ALBUM, PHOTOS, ALBUMS = {}, [], []
for (_dir, _slug, _title, _cat, _ratio, _hex, _days, _sel, _cfull, _cmob, _fx, _fy, _zoom, _cap, _date) in ALBUM_SPECS:
    _aid = int(_dir.rsplit("_", 1)[1])
    _tdir = os.path.join(_ALB_ROOT, _dir, "thumb")
    _files = sorted(os.listdir(_tdir)) if os.path.isdir(_tdir) else []
    _files = [f for f in _ORDER.get(_dir, []) if f in _files] + [f for f in _files if f not in _ORDER.get(_dir, [])]
    _photos = []
    for _i, _f in enumerate(_files, 1):
        try:
            _w, _h = _Image.open(os.path.join(_tdir, _f)).size
        except Exception:
            continue
        _r = _w / _h
        _full = f"uploads/albums/{_dir}/full/{_f}"
        _thumb = f"uploads/albums/{_dir}/thumb/{_f}"
        _ex = EXIF_SETS[_i % len(EXIF_SETS)]
        _photos.append(dict(id=_aid * 100 + _i, album_id=_aid,
                            file_url=_full if os.path.isfile(os.path.join(UP, _full[len("uploads/"):])) else _thumb,
                            thumb_url=_thumb, watermark_url=None, is_spacer=0,
                            grid_class_slug="ratio-hor" if _r >= 1.15 else "ratio-ver" if _r <= 0.85 else "ratio-sq",
                            width=_w, height=_h, sort_order=_i, title=None, description=None,
                            original_filename=f"DSC0{4200 + _aid * 37 + _i}.ARW",
                            exif_camera=_ex[0], exif_lens=_ex[1], exif_focal=_ex[2], exif_speed=_ex[3],
                            exif_aperture=_ex[4], exif_iso=_ex[5], exif_ev=_ex[6], exif_flash=_ex[7],
                            focus_x=50, focus_y=50, zoom=1.0))
    PHOTOS_BY_ALBUM[_aid] = _photos
    PHOTOS += _photos
    _cov = lambda sub, name: f"uploads/albums/{_dir}/{sub}/{name}" if os.path.isfile(os.path.join(_ALB_ROOT, _dir, sub, name)) else None
    _cover = _cov("cover_full", _cfull) or (_photos[0]["file_url"] if _photos else "uploads/" + avatar)
    ALBUMS.append(dict(id=_aid, slug=_slug, title=_title, description=_cap, card_caption=_cap,
                       cover_url=_cover,
                       cover_thumb_url=_cov("cover_thumb", "thumb_" + _cfull) or _cover,
                       cover_mobile_url=_cov("cover_mobile", _cmob), cover_ratio=_ratio, color_hex=_hex,
                       cover_focus_x=_fx, cover_focus_y=_fy, cover_zoom=_zoom,
                       date_taken=_date, created_at=_dt.datetime(2026, 9, 1),
                       expires_at=_today + _dt.timedelta(days=_days) if _days is not None else None,
                       category_slug=_cat, category_name=_CAT[_cat]["name"], is_active=1, is_private=0, allow_selection=_sel,
                       require_client_info=_sel, is_watermark_enabled=0, access_token="tok" + str(_aid), user_id=1,
                       category_id=_CAT[_cat]["id"]))

# Направления на главной — те же фото, мобильные кадры и цвета, что на рабочем сайте
def _up(path):
    return path if os.path.isfile(os.path.join(UP, path[len("uploads/"):])) else None
DIRS = [dict(id=i, file_url=_up(f"uploads/directions/{f}") or "uploads/" + avatar, thumb_url=_up(f"uploads/directions/thumb_{f}"),
             mobile_url=_up(f"uploads/directions/{m}"), color_hex=hx, mobile_focus_x=mx, mobile_focus_y=my, mobile_zoom=1.0,
             category_slug=slug, category_name=_CAT[slug]["name"], category_description=_CAT[slug]["description"],
             category_tagline=_CAT[slug]["tagline"], category_id=_CAT[slug]["id"])
        for i, (slug, f, m, hx, mx, my) in enumerate([
            ("meropriiatiia", "dir_237b4bb4.jpg", "dirm_4499dd7c.jpg", "#051359", 50, 50),
            ("kosplei", "dir_2c939674.jpg", "dirm_34930772.jpg", "#eee8dc", 45, 52),
            ("atmosfera", "dir_2e51bdb1.jpg", "dirm_d9ac3dc2.jpg", "#060910", 50, 50)], 1)]

# Выдуманные клиенты альбома с отбором — для «Выбора клиентов» в админке
CLIENTS = [dict(session_uuid="s-anna", client_name="Анна", created_at=_dt.datetime(2026, 10, 12, 18, 40),
                pd_consent_at=_dt.datetime(2026, 10, 12, 18, 40), pd_consent_version="2026-10-02", picks=[0, 2, 4, 7, 9, 11]),
           dict(session_uuid="s-maria", client_name="Мария", created_at=_dt.datetime(2026, 10, 13, 10, 5),
                pd_consent_at=_dt.datetime(2026, 10, 13, 10, 5), pd_consent_version="2026-10-02", picks=[1, 2, 5, 8])]
LIKES = [3, 0, 2, 0, 5, 1, 0, 2, 4, 1, 0, 3]   # сколько человек отметили фото (по порядку в альбоме)


ATTEMPTS = []   # неудачные входы (login_attempts)


class Cursor:
    def __init__(self): self.last = ""; self.params = None; self.lastrowid = 1
    def __enter__(self): return self
    def __exit__(self, *a): pass
    def execute(self, sql, params=None):
        self.last, self.params = sql, params
        if "INSERT INTO login_attempts" in sql: ATTEMPTS.append(_dt.datetime.now())
        if "DELETE FROM login_attempts WHERE ip" in sql: ATTEMPTS.clear()
    def fetchone(self):
        if "FROM login_attempts" in self.last: return dict(n=len(ATTEMPTS), first_at=ATTEMPTS[0] if ATTEMPTS else None)
        if "TIMESTAMPDIFF" in self.last: return dict(s=14 * 60 + 20)
        if "FROM users" in self.last: return OWNER
        if "information_schema.TABLES" in self.last: return dict(size=24 * 1024 * 1024)   # вес базы
        if "FROM photo_album" in self.last and self.params:
            key = "id" if "WHERE id" in self.last else "slug"
            return next((dict(a) for a in ALBUMS if a[key] == self.params[0]), None)
        if "FROM photo p LEFT JOIN grid_class" in self.last and PHOTOS:   # фото после замены файла
            return dict(PHOTOS[0], grid_class_id=1, focus_x=50, focus_y=50, zoom=1.0)
        if "FROM photo WHERE id = %s AND album_id" in self.last and PHOTOS:   # фото, которое заменяют
            return dict(id=self.params[0], file_url="uploads/__нет__/old.jpg", thumb_url="uploads/__нет__/old_t.jpg", watermark_url=None)
        return None
    def fetchall(self):
        if "information_schema.TABLES" in self.last:   # таблицы базы: 14 маленьких, как на хостинге
            return [dict(engine="InnoDB", data_length=16384 * (4 if i < 2 else 1), index_length=16384 * (i % 3), data_free=0) for i in range(14)]
        if "FROM social_media" in self.last: return [dict(x) for x in SOCIAL]
        if "FROM achievements" in self.last: return [dict(x) for x in ACH]
        if "FROM directions d" in self.last: return [dict(x) for x in DIRS]
        if "COUNT(a.id) AS album_count" in self.last:   # фильтры галереи
            return [dict(slug=c["slug"], name=c["name"], album_count=sum(a["category_slug"] == c["slug"] for a in ALBUMS)) for c in CATS]
        if "FROM photo_album a" in self.last:   # раньше «FROM photo p»: в списке альбомов админки есть подзапрос по фото
            return [dict(a, total_likes=sum(LIKES[:len(PHOTOS_BY_ALBUM.get(a["id"], []))]) if a["allow_selection"] else 0,
                         photo_count=len(PHOTOS_BY_ALBUM.get(a["id"], []))) for a in ALBUMS]
        if "FROM photo p" in self.last:
            aid = self.params[0] if self.params else None
            return [dict(x) for x in PHOTOS_BY_ALBUM.get(aid, PHOTOS)]
        if "original_filename FROM photo" in self.last: return [dict(x) for x in PHOTOS]
        if "FROM client_sessions" in self.last and "access_token" in self.last:   # клиенты альбома
            return [{k: v for k, v in c.items() if k != "picks"} for c in CLIENTS] if self.params == ("tok4",) else []
        if "FROM client_selections cs" in self.last and "WHERE cs.session_uuid" in self.last:   # что отобрал клиент
            c = next((c for c in CLIENTS if c["session_uuid"] == self.params[0]), None)
            ph = PHOTOS_BY_ALBUM.get(4, [])
            return [dict(id=ph[i]["id"], thumb_url=ph[i]["thumb_url"], file_url=ph[i]["file_url"], title=None,
                         original_filename=ph[i]["original_filename"]) for i in (c["picks"] if c else []) if i < len(ph)]
        if "FROM client_selections cs" in self.last:   # сколько человек отметили фото
            aid = next((a["id"] for a in ALBUMS if self.params and a["access_token"] == self.params[0]), None)
            rows = [dict(photo_id=ph["id"], n=n) for ph, n in zip(PHOTOS_BY_ALBUM.get(aid, []), LIKES) if n]
            return [r for r in rows if not (self.params and len(self.params) > 1) or r["photo_id"] == self.params[1]]
        if "FROM category" in self.last: return [dict(c, is_active=1) for c in CATS]
        return []


class Conn:
    def cursor(self): return Cursor()
    def commit(self): pass
    def close(self): pass


pymysql.connect = lambda **kw: Conn()
spec = importlib.util.spec_from_file_location("photoapp", os.path.join(SCR, "__init__.py"))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
app = mod.app
app.config["TESTING"] = True

from flask import request, send_file, abort, render_template_string


@app.route("/_proto/<path:name>")
def proto_page(name):
    path = os.path.join(PROTO, name + ".html")
    if not os.path.isfile(path): abort(404)
    return render_template_string(open(path, encoding="utf-8").read())


@app.route("/_proto_asset/<path:name>")
def proto_asset(name):
    path = os.path.normpath(os.path.join(PROTO, name))
    if not path.startswith(PROTO) or not os.path.isfile(path): abort(404)
    return send_file(path, max_age=0)


@app.after_request
def inject_variant(resp):
    if resp.mimetype != "text/html":
        return resp
    html = resp.get_data(as_text=True)
    if "__P__" in html:
        html = html.replace("/static/__P__", "/_proto_asset/about-awards/")
    v = request.args.get("v")
    pages = {"/admin": "admin", "/gallery": "gallery", "/about": "about", "/": "home"}
    if v and (request.path in pages or request.path.startswith("/album/")):
        pre = pages.get(request.path, "album")
        for ext, tag in (("css", '<link rel="stylesheet" href="{}"></head>'), ("js", '<script src="{}"></script></body>')):
            found = glob.glob(os.path.join(PROTO, "*", f"{pre}_{v}.{ext}"))
            if found:
                rel = os.path.relpath(found[0], PROTO).replace(os.sep, "/")
                url = f"/_proto_asset/{rel}?t={os.path.getmtime(found[0])}"
                anchor = "</head>" if ext == "css" else "</body>"
                html = html.replace(anchor, tag.format(url), 1)
    resp.set_data(html)
    return resp


if __name__ == "__main__":
    from werkzeug.serving import run_simple
    run_simple("127.0.0.1", 5090, app, threaded=True, use_reloader=False)
