-- Структура базы сайта (без данных). Собрано из экспорта phpMyAdmin.
-- Изменения схемы после этого экспорта — в db/ГГГГ-ММ-ДД_*.sql:
-- выполните их по порядку дат после этого файла.
-- Таблица grid_class нужна с тремя строками: slug ratio-hor, ratio-ver, ratio-sq.

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET NAMES utf8mb4;

CREATE TABLE `achievements` (
  `id` int NOT NULL,
  `users_id` int NOT NULL,
  `year` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `link_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `image_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `thumb_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `category` (
  `id` int NOT NULL,
  `slug` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tagline` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `client_selections` (
  `id` int NOT NULL,
  `photo_id` int NOT NULL,
  `session_uuid` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `client_sessions` (
  `id` int NOT NULL,
  `access_token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `client_contact` varchar(256) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `session_uuid` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `directions` (
  `id` int NOT NULL,
  `category_id` int NOT NULL,
  `file_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `thumb_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mobile_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `color_hex` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT '#080808',
  `mobile_focus_x` int DEFAULT '50',
  `mobile_focus_y` int DEFAULT '50',
  `mobile_zoom` decimal(3,1) DEFAULT '1.0',
  `sort_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `grid_class` (
  `id` int NOT NULL,
  `slug` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `icon_social_media` (
  `id` int NOT NULL,
  `title` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `icon` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `begin_link` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `photo` (
  `id` int NOT NULL,
  `album_id` int NOT NULL,
  `file_url` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `thumb_url` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `watermark_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `grid_class_id` int NOT NULL DEFAULT '1',
  `sort_order` int DEFAULT '0',
  `width` int DEFAULT NULL,
  `height` int DEFAULT NULL,
  `focus_x` int DEFAULT '50',
  `focus_y` int DEFAULT '50',
  `zoom` decimal(3,1) DEFAULT '1.0',
  `exif_camera` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `exif_lens` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `exif_focal` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `exif_speed` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `exif_aperture` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `exif_iso` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `exif_ev` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `exif_flash` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `photo_album` (
  `id` int NOT NULL,
  `slug` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `card_caption` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category_id` int DEFAULT NULL,
  `users_id` int DEFAULT NULL,
  `color_hex` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT '#080808',
  `cover_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cover_thumb_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cover_source_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cover_mobile_focus_x` int DEFAULT '50',
  `cover_mobile_focus_y` int DEFAULT '50',
  `cover_mobile_zoom` decimal(3,1) DEFAULT '1.0',
  `cover_mobile_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_order` int DEFAULT '0',
  `cover_ratio` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT 'type-square',
  `cover_focus_x` int DEFAULT '50',
  `cover_focus_y` int DEFAULT '50',
  `cover_zoom` decimal(3,1) DEFAULT '1.0',
  `date_taken` date DEFAULT NULL,
  `expires_at` date DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '0',
  `is_private` tinyint(1) DEFAULT '0',
  `allow_selection` tinyint(1) DEFAULT '0',
  `access_token` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_watermark_enabled` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `require_client_info` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `retouch_sliders` (
  `id` int NOT NULL,
  `tab_name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `caption` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `before_url` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `after_url` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `before_thumb_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `after_thumb_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_order` int DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `role` (
  `id` int NOT NULL,
  `slug` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `services` (
  `id` int NOT NULL,
  `title` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `badge_text` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_highlighted` tinyint(1) DEFAULT '0',
  `price` decimal(10,2) DEFAULT NULL,
  `sort_order` int DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `social_media` (
  `id` int NOT NULL,
  `users_id` int NOT NULL,
  `icon_social_media_id` int NOT NULL,
  `link` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `users` (
  `id` int NOT NULL,
  `name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `surname` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `middle_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `login` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `hash_password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `avatar_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar_thumb_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `watermark_text` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT 'ВЕЛИКАЯ ХОРО МУДРАЯ',
  `role_id` int DEFAULT '2',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `achievements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `users_id` (`users_id`);

ALTER TABLE `category`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`);

ALTER TABLE `client_selections`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_like` (`photo_id`,`session_uuid`),
  ADD KEY `session_uuid` (`session_uuid`);

ALTER TABLE `client_sessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `session_uuid` (`session_uuid`),
  ADD KEY `access_token` (`access_token`);

ALTER TABLE `directions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `category_id` (`category_id`);

ALTER TABLE `grid_class`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`);

ALTER TABLE `icon_social_media`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `title` (`title`);

ALTER TABLE `photo`
  ADD PRIMARY KEY (`id`),
  ADD KEY `grid_class_id` (`grid_class_id`),
  ADD KEY `idx_photo_sort` (`album_id`,`sort_order`);

ALTER TABLE `photo_album`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`),
  ADD UNIQUE KEY `access_token` (`access_token`),
  ADD KEY `category_id` (`category_id`),
  ADD KEY `users_id` (`users_id`),
  ADD KEY `idx_album_active_date` (`is_active`,`created_at`);

ALTER TABLE `retouch_sliders`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `role`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`);

ALTER TABLE `services`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `social_media`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `users_id` (`users_id`,`icon_social_media_id`),
  ADD KEY `icon_social_media_id` (`icon_social_media_id`);

ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `phone` (`phone`),
  ADD UNIQUE KEY `login` (`login`),
  ADD KEY `role_id` (`role_id`);

ALTER TABLE `achievements`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

ALTER TABLE `category`
  MODIFY `id` int NOT NULL AUTO_INCREMENT,;

ALTER TABLE `client_selections`
  MODIFY `id` int NOT NULL AUTO_INCREMENT,;

ALTER TABLE `client_sessions`
  MODIFY `id` int NOT NULL AUTO_INCREMENT,;

ALTER TABLE `directions`
  MODIFY `id` int NOT NULL AUTO_INCREMENT,;

ALTER TABLE `grid_class`
  MODIFY `id` int NOT NULL AUTO_INCREMENT,;

ALTER TABLE `icon_social_media`
  MODIFY `id` int NOT NULL AUTO_INCREMENT,;

ALTER TABLE `photo`
  MODIFY `id` int NOT NULL AUTO_INCREMENT,;

ALTER TABLE `photo_album`
  MODIFY `id` int NOT NULL AUTO_INCREMENT,;

ALTER TABLE `retouch_sliders`
  MODIFY `id` int NOT NULL AUTO_INCREMENT,;

ALTER TABLE `role`
  MODIFY `id` int NOT NULL AUTO_INCREMENT,;

ALTER TABLE `services`
  MODIFY `id` int NOT NULL AUTO_INCREMENT,;

ALTER TABLE `social_media`
  MODIFY `id` int NOT NULL AUTO_INCREMENT,;

ALTER TABLE `users`
  MODIFY `id` int NOT NULL AUTO_INCREMENT,;

ALTER TABLE `achievements`
  ADD CONSTRAINT `achievements_ibfk_1` FOREIGN KEY (`users_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `client_selections`
  ADD CONSTRAINT `client_selections_ibfk_1` FOREIGN KEY (`photo_id`) REFERENCES `photo` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `client_selections_ibfk_2` FOREIGN KEY (`session_uuid`) REFERENCES `client_sessions` (`session_uuid`) ON DELETE CASCADE;

ALTER TABLE `client_sessions`
  ADD CONSTRAINT `client_sessions_ibfk_1` FOREIGN KEY (`access_token`) REFERENCES `photo_album` (`access_token`) ON DELETE CASCADE;

ALTER TABLE `directions`
  ADD CONSTRAINT `directions_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `category` (`id`) ON DELETE RESTRICT;

ALTER TABLE `photo`
  ADD CONSTRAINT `photo_ibfk_1` FOREIGN KEY (`album_id`) REFERENCES `photo_album` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `photo_ibfk_2` FOREIGN KEY (`grid_class_id`) REFERENCES `grid_class` (`id`) ON DELETE RESTRICT;

ALTER TABLE `photo_album`
  ADD CONSTRAINT `photo_album_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `category` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `photo_album_ibfk_2` FOREIGN KEY (`users_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT;

ALTER TABLE `social_media`
  ADD CONSTRAINT `social_media_ibfk_1` FOREIGN KEY (`users_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `social_media_ibfk_2` FOREIGN KEY (`icon_social_media_id`) REFERENCES `icon_social_media` (`id`);

ALTER TABLE `users`
  ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `role` (`id`) ON DELETE RESTRICT;
