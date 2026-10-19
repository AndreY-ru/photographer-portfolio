-- Редакция согласия на обработку ПД, с которой согласился посетитель
-- (например, '2026-10-02'). Сам текст каждой редакции лежит неизменным в
-- scr/templates/pd_consent/<редакция>.html и открывается по /pd-consent/<редакция>.
-- Вместе с pd_consent_at это доказывает, КОГДА и С ЧЕМ человек согласился.
--
-- ВЫПОЛНИТЬ В phpMyAdmin ДО заливки нового __init__.py.
-- Если ещё не выполнен 2026-09-28_pd_consent_at.sql — сначала его, потом этот.

ALTER TABLE `client_sessions`
  ADD COLUMN `pd_consent_version` VARCHAR(32) NULL DEFAULT NULL
  COMMENT 'Редакция согласия на обработку ПД (templates/pd_consent/<редакция>.html)'
  AFTER `pd_consent_at`;
