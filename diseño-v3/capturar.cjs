const { chromium } = require('@playwright/test');
const path = require('path');
const tabs = [['summary', '01-resumen'], ['products', '02-productos'], ['cash', '03-caja-y-cortes'], ['staff', '04-personal'], ['trend', '05-tendencia'], ['forecast', '06-pronostico'], ['profit', '07-rentabilidad'], ['kitchen', '08-cocina'], ['customers', '09-clientes'], ['messages', '10-mensajes'], ['alerts', '11-alertas'], ['settings', '12-ajustes']];
(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const file = 'file:///' + path.resolve(__dirname, 'propuesta.html').split(path.sep).join('/');
  for (const [tab, name] of tabs) {
    await page.goto(file + '?tab=' + tab);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(__dirname, name + '.png'), fullPage: true });
    console.log(name);
  }
  await browser.close();
})();
