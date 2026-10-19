# Коллажи для README: телефоны в ряд со скруглёнными углами на тёмном фоне,
# и подрезка/сжатие скриншотов ПК в docs/readme/.
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SH = os.path.join(HERE, "shots")
OUT = os.path.join(HERE, "..", "..", "docs", "readme")
os.makedirs(OUT, exist_ok=True)
BG = (12, 12, 13)


def rounded(im, r):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), r, fill=255)
    out = Image.new("RGBA", im.size)
    out.paste(im, (0, 0), mask)
    return out


def phones(names, out, h=900, gap=40, pad=48):
    ims = [Image.open(os.path.join(SH, n + ".jpg")).convert("RGB") for n in names]
    ims = [im.resize((round(im.width * h / im.height), h), Image.LANCZOS) for im in ims]
    w = sum(i.width for i in ims) + gap * (len(ims) - 1) + pad * 2
    canvas = Image.new("RGB", (w, h + pad * 2), BG)
    x = pad
    for im in ims:
        frame = Image.new("RGB", (im.width + 12, im.height + 12), (52, 50, 46))
        fr = rounded(frame, 46)
        canvas.paste(fr, (x - 6, pad - 6), fr)
        ph = rounded(im, 40)
        canvas.paste(ph, (x, pad), ph)
        x += im.width + gap
    canvas.save(os.path.join(OUT, out), quality=86, optimize=True, progressive=True)
    print(out, canvas.size, os.path.getsize(os.path.join(OUT, out)) // 1024, "КБ")


def pc(name, out, crop=None, width=1440):
    im = Image.open(os.path.join(SH, name)).convert("RGB")
    if crop:
        im = im.crop(crop)
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    path = os.path.join(OUT, out)
    if out.endswith(".png"):
        im.save(path, optimize=True)
    else:
        im.save(path, quality=84, optimize=True, progressive=True)
    print(out, im.size, os.path.getsize(path) // 1024, "КБ")


phones(["m_home", "m_gallery", "m_album", "m_about"], "phones.jpg")
phones(["m_admin", "m_admin_sheet", "m_admin_more"], "admin-phone.jpg")
pc("album_cover.jpg", "album-cover.jpg")
pc("album_grid.jpg", "album-grid.jpg", crop=(0, 28, 1440, 900))
pc("about_hero.jpg", "about-hero.jpg")
pc("about_gear.jpg", "about-gear.jpg", crop=(0, 100, 1440, 560))
pc("about_contact.jpg", "about-contact.jpg")
pc("admin_dark.jpg", "admin-dark.jpg")
pc("admin_light.jpg", "admin-light.jpg")
pc("admin_photos.jpg", "admin-photos.jpg")
pc("admin_dupes.jpg", "admin-dupes.jpg", crop=(370, 200, 1070, 700))
pc("admin_clients.jpg", "admin-clients.jpg")
pc("admin_ring.png", "admin-ring.png")
