import { SaraivaScraper } from './scrapers/saraiva.ts';

async function run() {
  const scraper = new SaraivaScraper();
  try {
    const data = await scraper.scrape('https://www.saraivaleiloes.com.br/Leilao/1234');
    console.log(data);
  } catch (e) {
    console.error(e);
  }
}
run();