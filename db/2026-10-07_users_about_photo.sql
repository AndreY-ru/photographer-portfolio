-- Отдельное фото для страницы «Обо мне» (первый блок «Кадр») и точка фокуса
-- на нём — отдельно для ПК и для телефона. Точка фокуса — место на фото
-- (в процентах от ширины и высоты), куда встаёт рамка автофокуса и вокруг
-- которого кадрируется фото. На главной по-прежнему показывается аватар
-- (avatar_url). Если about_photo_url пустой — на «Обо мне» тоже аватар.
--
-- ВЫПОЛНИТЬ В phpMyAdmin ДО заливки нового __init__.py: новый код пишет в
-- эти колонки при сохранении профиля, и без них сохранение перестанет работать.

ALTER TABLE `users`
  ADD COLUMN `about_photo_url` VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL
    COMMENT 'Фото первого блока страницы «Обо мне»' AFTER `avatar_thumb_url`,
  ADD COLUMN `about_photo_thumb_url` VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL
    COMMENT 'Миниатюра фото «Обо мне» для админки' AFTER `about_photo_url`,
  ADD COLUMN `about_focus_x` TINYINT UNSIGNED NOT NULL DEFAULT 50
    COMMENT 'Фокус «Обо мне» на ПК, % по горизонтали' AFTER `about_photo_thumb_url`,
  ADD COLUMN `about_focus_y` TINYINT UNSIGNED NOT NULL DEFAULT 30
    COMMENT 'Фокус «Обо мне» на ПК, % по вертикали' AFTER `about_focus_x`,
  ADD COLUMN `about_mobile_focus_x` TINYINT UNSIGNED NOT NULL DEFAULT 50
    COMMENT 'Фокус «Обо мне» на телефоне, % по горизонтали' AFTER `about_focus_y`,
  ADD COLUMN `about_mobile_focus_y` TINYINT UNSIGNED NOT NULL DEFAULT 30
    COMMENT 'Фокус «Обо мне» на телефоне, % по вертикали' AFTER `about_mobile_focus_x`;
