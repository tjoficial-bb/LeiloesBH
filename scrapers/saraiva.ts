import { chromium } from 'playwright';
import { Scraper } from './base.ts';

export class SaraivaScraper implements Scraper {
  async scrape(url: string): Promise<any> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    // Capture console logs from the page
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
    await page.goto(formattedUrl, { waitUntil: 'networkidle' });
    
    // Wait a bit more for dynamic content
    await page.waitForTimeout(3000);
    
    const data = await page.evaluate(`
      (() => {
        const getElementText = (selector) => {
          const el = document.querySelector(selector);
          console.log('Selector:', selector, 'Found:', !!el, 'Text:', el?.textContent?.trim());
          return el?.textContent?.trim();
        };
        const getElementAttr = (selector, attr) => {
          const el = document.querySelector(selector);
          console.log('Selector:', selector, 'Found:', !!el, 'Attr:', el?.getAttribute(attr));
          return el?.getAttribute(attr);
        };
        
        const extractPracaInfo = (keywords) => {
          const elements = Array.from(document.querySelectorAll('*')).filter(el => {
            const text = el.textContent || '';
            return keywords.some(k => text.toLowerCase().includes(k.toLowerCase())) && text.length < 150 && el.children.length === 0;
          });
          
          for (const el of elements) {
            let current = el;
            for (let i = 0; i < 5; i++) { // Aumentado para 5 níveis de busca
              if (!current) break;
              const parentText = current.innerText || current.textContent || '';
              const matchData = parentText.match(/\\d{2}\/\\d{2}\/\\d{4}/);
              const matchValor = parentText.match(/R\\$\\s*[\\d\\.,]+/);
              
              if (matchData && matchValor) {
                return { data: matchData[0], valor: matchValor[0] };
              }
              current = current.parentElement;
            }
          }
          return { data: '', valor: '' };
        };

        const p1 = extractPracaInfo(['1ª Praça', '1º Leilão', '1ª Praca', '1º Leilao', 'Primeira Praça', 'Primeiro Leilão']);
        const p2 = extractPracaInfo(['2ª Praça', '2º Leilão', '2ª Praca', '2º Leilao', 'Segunda Praça', 'Segundo Leilão']);
        
        const valor_avaliacao = getElementText('.valor-avaliacao') || '0';
        const preco_leilao = getElementText('.preco-leilao') || getElementText('.lot-price') || getElementText('.price') || '0';
        
        let primeira_praca_valor = p1.valor || getElementText('.primeira-praca-valor') || '';
        let segunda_praca_valor = p2.valor || getElementText('.segunda-praca-valor') || '';
        
        if (!primeira_praca_valor || primeira_praca_valor === '0' || primeira_praca_valor === '') {
          primeira_praca_valor = valor_avaliacao;
        }
        if (!segunda_praca_valor || segunda_praca_valor === '0' || segunda_praca_valor === '') {
          segunda_praca_valor = preco_leilao;
        }
        
        return {
          titulo: getElementText('h1') || getElementText('.titulo-lote') || getElementText('.lot-title') || getElementText('h2') || 'Título não encontrado',
          descricao: getElementText('.descricao-lote') || getElementText('.lot-description') || getElementText('.description') || '',
          preco_leilao: preco_leilao,
          endereco: getElementText('.endereco-lote') || getElementText('.lot-address') || getElementText('.address') || 'Endereço não encontrado',
          imagem: getElementAttr('img.img-lote', 'src') || getElementAttr('.lot-image img', 'src') || getElementAttr('img', 'src') || '',
          primeira_praca_data: p1.data || getElementText('.primeira-praca-data') || '',
          primeira_praca_valor: primeira_praca_valor,
          segunda_praca_data: p2.data || getElementText('.segunda-praca-data') || '',
          segunda_praca_valor: segunda_praca_valor,
          valor_avaliacao: valor_avaliacao,
          desconto: '',
          link_original: window.location.href
        };
      })()
    `);
    
    await browser.close();
    return data;
  }
}
