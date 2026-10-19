import os

# Пароль от БД и секретный ключ Flask раньше лежали здесь в открытом виде.
# Теперь они берутся из переменных окружения:
#   - локально: положите их в файл .env рядом с этим файлом (см.
#     .env.example — сам .env в .gitignore и никуда не уедет);
#   - на хостинге: пропишите те же имена в панели управления
#     Python-приложением (cPanel → Setup Python App → Environment variables).
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

host = os.environ.get("DB_HOST", "localhost")
user = os.environ.get("DB_USER")
password = os.environ.get("DB_PASSWORD")
port = int(os.environ.get("DB_PORT", "3306"))
db_name = os.environ.get("DB_NAME")
secret_key = os.environ.get("FLASK_SECRET_KEY")

_missing = [name for name, val in [
    ("DB_USER", user),
    ("DB_PASSWORD", password),
    ("DB_NAME", db_name),
    ("FLASK_SECRET_KEY", secret_key),
] if not val]
if _missing:
    raise RuntimeError(
        "Не заданы переменные окружения: " + ", ".join(_missing) + ". "
        "Смотрите .env.example — локально заполните .env, на хостинге "
        "задайте те же имена в настройках Python-приложения."
    )
