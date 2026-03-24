import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
  });
  const page = await context.newPage();
  await page.goto('https://www.auket.com.br/imovel/mg/contagem/residencial-cobertura-duplex-nunca-habitado-135-49-m-3-quartos-2-vagas-contagem-mg-imovel-2687533', { waitUntil: 'load' });
  await page.waitForTimeout(5000);
  
  const data = await page.evaluate(() => {
    return {
      title: document.title,
      html: document.querySelector('body')?.innerText.substring(0, 500) || 'N/A'
    };
  });
  
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})();
