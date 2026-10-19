# Локальный просмотр README примерно как на GitHub: preview.html рядом (открыть двойным щелчком)
import io, os, re
import markdown

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
md = io.open(os.path.join(ROOT, "README.md"), encoding="utf-8").read()
# Картинки и ссылки — относительно корня проекта
md = re.sub(r'(src=")(docs/)', r'\1../../\2', md)
md = re.sub(r'(\]\()((?:docs|prototypes)/)', r'\1../../\2', md)
md = re.sub(r'(\]\()(prototypes/)', r'\1../../\2', md)
html = markdown.markdown(md, extensions=["tables", "fenced_code", "md_in_html"])
page = f"""<!doctype html><html lang="ru"><meta charset="utf-8"><title>README — просмотр</title>
<style>
body {{ margin: 0; background: #0d1117; color: #e6edf3; font: 16px/1.5 -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; }}
main {{ max-width: 1012px; margin: 32px auto; padding: 32px 40px; border: 1px solid #30363d; border-radius: 6px; }}
h1, h2 {{ border-bottom: 1px solid #30363d; padding-bottom: .3em; }} h1 {{ font-size: 2em; }} h2 {{ font-size: 1.5em; margin-top: 24px; }}
a {{ color: #4493f8; text-decoration: none; }} img {{ max-width: 100%; }}
table {{ border-collapse: collapse; display: block; overflow: auto; margin: 16px 0; }}
td, th {{ border: 1px solid #30363d; padding: 6px 13px; vertical-align: top; }} tr:nth-child(2n) {{ background: #161b22; }}
code {{ background: rgba(110,118,129,.4); padding: .2em .4em; border-radius: 6px; font-size: 85%; }}
pre {{ background: #161b22; padding: 16px; border-radius: 6px; overflow: auto; }} pre code {{ background: none; padding: 0; }}
hr {{ border: 0; height: 4px; background: #30363d; margin: 24px 0; }} sub {{ color: #8b949e; }}
</style><main>{html}</main></html>"""
io.open(os.path.join(HERE, "preview.html"), "w", encoding="utf-8").write(page)
print("preview.html готов")
