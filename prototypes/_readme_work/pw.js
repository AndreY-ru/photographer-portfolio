// Запуск: node pw.js <файл-сценария.js> — сценарий экспортирует async (browser) => результат.
// Playwright: установленный пакет `playwright` или путь к нему в PW_MODULE.
const { chromium } = require(process.env.PW_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const run = require(require('path').resolve(process.argv[2]));
    const res = await run(browser);
    console.log(JSON.stringify(res, null, 1));
  } catch (e) { console.error('ОШИБКА:', e.message); process.exitCode = 1; }
  finally { await browser.close(); }
})();
