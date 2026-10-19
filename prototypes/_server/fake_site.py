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
             about_photo_url=None, about_photo_thumb_url=None, about_focus_x=57, about_focus_y=20,
             about_mobile_focus_x=60, about_mobile_focus_y=22, watermark_text="ВЕЛИКАЯ ХОРО МУДРАЯ", role_id=1,
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
# Направления для главной (чтобы на телефоне было что листать) — картинка та же, что у аватара
DIRS = [dict(id=i, file_url="uploads/" + avatar, thumb_url=None, mobile_url=None, color_hex=hx,
             mobile_focus_x=50, mobile_focus_y=40, mobile_zoom=1.0, category_slug=slug, category_name=nm,
             category_description="Тестовое описание категории", category_tagline="Тест")
        for i, (slug, nm, hx) in enumerate([("concerts", "Концерты", "#7a4a2a"), ("cosplay", "Косплей", "#2a4a7a"), ("food", "Еда", "#4a7a2a")], 1)]
SOCIAL = [dict(id=1, link="https://t.me/example", title="Telegram", icon="icons/telegram.svg"),
          dict(id=2, link="https://vk.com/example", title="ВКонтакте", icon="icons/vk.svg")]

# Тестовые альбомы для страниц /gallery и /album/<slug>: миниатюры берутся из
# первого локального альбома в static/uploads/albums (свои фото владельца,
# никуда не уходят). Нет папки — альбомы просто пустые.
import datetime as _dt
from PIL import Image as _Image
_ALB_ROOT = os.path.join(UP, "albums")
_alb_dir = next((d for d in sorted(os.listdir(_ALB_ROOT)) if os.path.isdir(os.path.join(_ALB_ROOT, d, "thumb"))), None) if os.path.isdir(_ALB_ROOT) else None
PHOTOS = []
if _alb_dir:
    for _i, _f in enumerate(sorted(os.listdir(os.path.join(_ALB_ROOT, _alb_dir, "thumb")))[:18], 1):
        try:
            _w, _h = _Image.open(os.path.join(_ALB_ROOT, _alb_dir, "thumb", _f)).size
        except Exception:
            continue
        _r = _w / _h
        _url = f"uploads/albums/{_alb_dir}/thumb/{_f}"
        PHOTOS.append(dict(id=100 + _i, album_id=1, file_url=_url, thumb_url=_url, watermark_url=None, is_spacer=0,
                           grid_class_slug="ratio-hor" if _r >= 1.15 else "ratio-ver" if _r <= 0.85 else "ratio-sq",
                           width=_w, height=_h, sort_order=_i, title=None, description=None, original_filename=_f.split("_", 1)[-1],
                           exif_camera="Sony ILCE-6000", exif_lens="E 18-55mm", exif_focal="35 мм", exif_speed="1/250",
                           exif_aperture="f/2.8", exif_iso="ISO 400", exif_ev=None, exif_flash=None))
_cover = PHOTOS[0]["file_url"] if PHOTOS else "uploads/" + avatar
_today = _dt.date.today()
ALBUMS = [dict(id=i, slug=sl, title=t, description="Тестовый альбом для прототипов", card_caption=None,
               cover_url=PHOTOS[k % max(1, len(PHOTOS))]["file_url"] if PHOTOS else _cover,
               cover_thumb_url=PHOTOS[k % max(1, len(PHOTOS))]["file_url"] if PHOTOS else _cover,
               cover_mobile_url=None, cover_ratio=rt, color_hex=hx, cover_focus_x=50, cover_focus_y=40, cover_zoom=1.0,
               date_taken=_dt.date(2026, 7, 6), created_at=_dt.datetime(2026, 9, 1), expires_at=exp,
               category_slug="cosplay", category_name="Косплей", is_active=1, is_private=0, allow_selection=sel,
               require_client_info=0, is_watermark_enabled=0, access_token="tok" + str(i), user_id=1, category_id=1)
          for i, k, sl, t, rt, hx, exp, sel in [
              (1, 0, "miku", "Косплей Мику", "type-wide", "#3a5a7a", _today + _dt.timedelta(days=5), 1),
              (2, 3, "zakat", "Закат на пирсе", "type-tall", "#7a4a2a", _today + _dt.timedelta(days=1), 1),
              (3, 6, "park", "Прогулка в парке", "type-square", "#4a6a3a", _today + _dt.timedelta(days=20), 1),
              (4, 9, "fontan", "У фонтана", "type-square", "#5a4a6a", _today, 0)]]


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
        if "FROM photo_album a" in self.last: return [dict(a) for a in ALBUMS]   # раньше «FROM photo p»: в списке альбомов админки есть подзапрос по фото
        if "FROM photo p" in self.last: return [dict(x) for x in PHOTOS]
        if "original_filename FROM photo" in self.last: return [dict(x) for x in PHOTOS]
        if "FROM client_selections cs" in self.last:   # сколько человек отметили фото
            rows = [dict(photo_id=ph["id"], n=n) for ph, n in zip(PHOTOS, [3, 0, 1, 0, 5, 2, 0, 0, 1, 4]) if n]
            return [r for r in rows if not (self.params and len(self.params) > 1) or r["photo_id"] == self.params[1]]
        if "COUNT(a.id) AS album_count" in self.last: return [dict(slug="cosplay", name="Косплей", album_count=len(ALBUMS))]
        if "FROM photo_album a" in self.last: return [dict(a) for a in ALBUMS]
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
