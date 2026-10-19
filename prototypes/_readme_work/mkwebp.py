# Анимированный WebP из записанных кадров:
#   python mkwebp.py <имя> <ширина> <выход.webp> [crop x,y,w,h | -] [fps] [качество]
import sys, json, os
from PIL import Image

name, width, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
crop = tuple(int(v) for v in sys.argv[4].split(",")) if len(sys.argv) > 4 and sys.argv[4] != "-" else None
fps = float(sys.argv[5]) if len(sys.argv) > 5 else 15
quality = int(sys.argv[6]) if len(sys.argv) > 6 else 76
base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rec", name)
fr = json.load(open(os.path.join(base, "frames.json")))["frames"]
if not fr:
    sys.exit("нет кадров")
# Ровная сетка времени: на каждый тик — последний пришедший кадр; одинаковые подряд склеиваются
t, t_end, step, j, seq = fr[0]["t"], fr[-1]["t"] + 0.5, 1.0 / fps, 0, []
while t <= t_end:
    while j + 1 < len(fr) and fr[j + 1]["t"] <= t:
        j += 1
    if seq and seq[-1][0] == j:
        seq[-1][1] += 1
    else:
        seq.append([j, 1])
    t += step
imgs, durs = [], []
for idx, n in seq:
    im = Image.open(fr[idx]["file"]).convert("RGB")
    if crop:
        x, y, w, h = crop
        im = im.crop((x, y, x + w, y + h))
    if im.width != width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    imgs.append(im)
    durs.append(int(round(n * 1000 / fps)))
durs[-1] = max(durs[-1], 1200)   # пауза перед повтором
imgs[0].save(out, "WEBP", save_all=True, append_images=imgs[1:], duration=durs, loop=0, quality=quality, method=4)
print(f"{os.path.basename(out)}: {len(imgs)} кадров, {os.path.getsize(out) // 1024} КБ")
