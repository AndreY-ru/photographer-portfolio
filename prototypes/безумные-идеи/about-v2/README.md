# «Обо мне» v2 — полароид и лапка Хоро (снято с сайта)

Демо-страница `/about-v2`: первый блок «Обо мне» — непроявленный полароид, его можно
схватить и потрясти, а снизу выглядывает волчья лапка (отсылка к Хоро) и трясёт его
сама, потом время от времени возвращается и делает сценки (машет, гладит, стучит,
прячется). Владелец снял её с сайта 2026-10-09 и попросил сохранить сюда.

Файлы лежали так:

| Файл здесь | Где был на сайте |
|---|---|
| `about_v2.html` | `scr/templates/about_v2.html` |
| `about-v2.css` | `scr/static/css/about-v2.css` |
| `about-v2.js` | `scr/static/js/about-v2.js` |
| `holo-paw.webp` | `scr/static/img/holo-paw.webp` (лапка, нарисована владельцем) |

Как вернуть:

1. Разложить файлы обратно по путям из таблицы.
2. В `scr/templates/about.html` обернуть первый блок (`<section class="about-hero">…</section>`
   вместе со строкой `{% set about_photo = … %}` перед ним) в `{% block about_hero %}…{% endblock %}` —
   `about_v2.html` наследует `about.html` и подменяет только этот блок.
3. В `scr/__init__.py` рядом с `/about` добавить роут:

```python
@app.route('/about-v2')
def about_v2():
    response = make_response(render_template('about_v2.html', achievements=_about_achievements()))
    response.headers['X-Robots-Tag'] = 'noindex, nofollow'
    return response
```

4. В `base.html` подсветку пункта меню сделать `request.endpoint in ('about', 'about_v2')`.

Прототип, из которого выросла страница: `prototypes/about-hero/` (вариант «О — Лапка Хоро»).
