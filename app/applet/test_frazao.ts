import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto('https://www.frazaoleiloes.com.br/lote/36398-casa-no-bairro-florida-sete-lagoas-mg', { waitUntil: 'networkidle' });
    const content = await page.evaluate(() => {
      return {
        body: document.body.innerText,
        title: document.title,
        h1: document.querySelector('h1')?.innerText,
        h2: document.querySelector('h2')?.innerText,
        allText: Array.from(document.querySelectorAll('p, div, span, b, strong')).map(el => (el as HTMLElement).innerText).filter(t => t.length > 5).slice(0, 100)
      };
    });
    console.log('TITLE:', content.title);
    console.log('H1:', content.h1);
    console.log('H2:', content.h2);
    console.log('BODY TEXT:', content.body);
    console.log('ALL TEXT:', JSON.stringify(content.allText, null, 2));
  } catch (e) {
    console.error('ERROR:', e);
  } finally {
    await browser.close();
  }
}

run();
