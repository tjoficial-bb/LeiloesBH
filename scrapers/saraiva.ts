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
    await page.goto(formattedUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Wait a bit more for dynamic content
    await page.waitForTimeout(1000);
    
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
            return keywords.some(k => text.toLowerCase().includes(k.toLowerCase())) && text.length < 100 && el.children.length === 0;
          });
          
          for (const el of elements) {
            let current = el;
            let foundData = '';
            let foundValor = '';
            
            // Busca em até 10 níveis de parentesco
            for (let i = 0; i < 10; i++) {
              if (!current) break;
              const parentText = current.innerText || current.textContent || '';
              
              if (!foundData) {
                const matchData = parentText.match(/(\d{2}[\/\.]\d{2}[\/\.]\d{2,4})/);
                if (matchData) foundData = matchData[1];
              }
              
              if (!foundValor) {
                const matchValor = parentText.match(/(R\$\s*[\d\.,]+)/i);
                if (matchValor) foundValor = matchValor[1];
              }
              
              if (foundData && foundValor) return { data: foundData, valor: foundValor };
              
              // Tenta buscar nos irmãos se não encontrou no pai
              const siblings = Array.from(current.parentElement?.children || []);
              for (const sibling of siblings) {
                if (sibling === current) continue;
                const siblingText = sibling.innerText || sibling.textContent || '';
                
                if (!foundData) {
                  const matchData = siblingText.match(/(\d{2}[\/\.]\d{2}[\/\.]\d{2,4})/);
                  if (matchData) foundData = matchData[1];
                }
                
                if (!foundValor) {
                  const matchValor = siblingText.match(/(R\$\s*[\d\.,]+)/i);
                  if (matchValor) foundValor = matchValor[1];
                }
                
                if (foundData && foundValor) return { data: foundData, valor: foundValor };
              }
              
              current = current.parentElement;
            }
            if (foundData || foundValor) return { data: foundData, valor: foundValor };
          }
          return { data: '', valor: '' };
        };

        const extractValueByKeyword = (keywords) => {
          const elements = Array.from(document.querySelectorAll('*')).filter(el => {
            const text = el.textContent || '';
            return keywords.some(k => text.toLowerCase().includes(k.toLowerCase())) && text.length < 100 && el.children.length === 0;
          });
          
          for (const el of elements) {
            let current = el;
            for (let i = 0; i < 6; i++) {
              if (!current) break;
              const text = current.innerText || current.textContent || '';
              // Regex para capturar valores monetários (R$ 1.234,56 ou apenas 1.234,56)
              const match = text.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
              if (match) return 'R$ ' + match[1];
              
              const nextSibling = current.nextElementSibling;
              if (nextSibling) {
                const siblingText = nextSibling.innerText || nextSibling.textContent || '';
                const siblingMatch = siblingText.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
                if (siblingMatch) return 'R$ ' + siblingMatch[1];
              }
              current = current.parentElement;
            }
          }
          return '';
        };

        const p1 = extractPracaInfo(['1ª Praça', '1º Leilão', '1ª Praca', '1º Leilao', 'Primeira Praça', 'Primeiro Leilão', '1º Ciclo', '1ª Data', '1º Encerramento', '1º Praça', '1ª Leilão']);
        const p2 = extractPracaInfo(['2ª Praça', '2º Leilão', '2ª Praca', '2º Leilao', 'Segunda Praça', 'Segundo Leilão', '2º Ciclo', '2ª Data', '2º Encerramento', '2º Praça', '2ª Leilão']);
        
        let valor_avaliacao = getElementText('.valor-avaliacao') || extractValueByKeyword(['Avaliação', 'Valor de Avaliação', 'Avaliado em', 'Valor do Imóvel', 'Valor de Mercado', 'Preço de Avaliação']) || '0';
        let preco_leilao = getElementText('.preco-leilao') || getElementText('.lot-price') || getElementText('.price') || extractValueByKeyword(['Lance Mínimo', 'Lance Inicial', 'Valor Mínimo', 'Preço Mínimo', 'Valor de Venda', 'Lance Atual']) || '0';
        
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
