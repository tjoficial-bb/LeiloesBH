export abstract class Scraper {
  abstract scrape(url: string): Promise<any>;
}
