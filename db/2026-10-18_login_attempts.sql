-- Неудачные попытки входа в админку: после 5 ошибок за 15 минут вход с этого
-- IP закрывается на 15 минут (защита от подбора пароля). Записи старше суток
-- сайт удаляет сам.
CREATE TABLE `login_attempts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `ip` VARCHAR(45) NOT NULL,
  `attempted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_login_attempts_ip_time` (`ip`, `attempted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
