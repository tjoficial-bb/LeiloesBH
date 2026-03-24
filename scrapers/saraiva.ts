import { chromium } from 'playwright';
import { Scraper } from './base.ts';

export class SaraivaScraper implements Scraper {
  async scrape(url: string): Promise<any> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    // Stealth: hide automation and fix __name ReferenceError from esbuild
    await page.addInitScript(`
      window.__name = (fn, name) => fn;
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    `);
    
    // Capture console logs from the page
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
    
    try {
      await page.goto(formattedUrl, { waitUntil: 'load', timeout: 90000 });
      
      // Wait for Cloudflare to pass
      let title = await page.title();
      let attempts = 0;
      while (title.includes('Just a moment') && attempts < 10) {
        console.log('Cloudflare detected, waiting...');
        await page.waitForTimeout(5000);
        title = await page.title();
        attempts++;
      }

      // Add some random mouse movement to look more human
      await page.mouse.move(Math.random() * 500, Math.random() * 500);
      await page.waitForTimeout(2000);
      
      // Check if we are still on the challenge page
      const bodyText = await page.evaluate(() => document.body.innerText);
      if (bodyText.includes('security verification') || bodyText.includes('verifying you are not a bot')) {
        console.log('Still on Cloudflare verification page. Trying to wait more...');
        await page.waitForTimeout(10000);
      }
    } catch (error) {
      console.log('Error navigating to page:', error);
    }
    
    // Wait for images to potentially load
    await page.waitForTimeout(3000);
    
    const data = await page.evaluate(() => {
      const getElementText = (selector: string) => {
        const el = document.querySelector(selector) as HTMLElement;
        console.log('Selector:', selector, 'Found:', !!el, 'Text:', el?.textContent?.trim());
        return el?.textContent?.trim();
      };
      const getElementAttr = (selector: string, attr: string) => {
        const el = document.querySelector(selector);
        console.log('Selector:', selector, 'Found:', !!el, 'Attr:', el?.getAttribute(attr));
        return el?.getAttribute(attr);
      };
      
      const extractPracaInfo = (keywords: string[]) => {
        const elements = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent || '';
          // Relaxed check: no longer requiring el.children.length === 0
          return keywords.some(k => text.toLowerCase().includes(k.toLowerCase())) && text.length < 150;
        });
        
        let foundData = '';
        let foundValor = '';

        const currencyRegex = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/i;
        const dateRegex = /(\d{1,2}[\/\.]\d{1,2}[\/\.]\d{2,4}(?:\s+\d{2}:\d{2})?|(?:\d{1,2}\s+de\s+(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+\d{4}))/i;

        for (const el of elements) {
          // Check if the element itself has both
          const elText = (el as HTMLElement).innerText || el.textContent || '';
          const lowerElText = elText.toLowerCase();
          
          // Encontrar qual keyword deu match para buscar depois dela
          let bestKeyword = '';
          for (const k of keywords) {
            if (lowerElText.includes(k.toLowerCase())) {
              if (k.length > bestKeyword.length) bestKeyword = k;
            }
          }
          
          const textAfterKeyword = elText.substring(lowerElText.indexOf(bestKeyword.toLowerCase()) + bestKeyword.length);
          
          const elMatchData = textAfterKeyword.match(dateRegex);
          const elMatchValor = textAfterKeyword.match(currencyRegex);
          
          if (elMatchData && !foundData) foundData = elMatchData[1];
          if (elMatchValor && !foundValor) foundValor = 'R$ ' + elMatchValor[1];

          if (foundData && foundValor) return { data: foundData, valor: foundValor };

          let current: Element | null = el;
          
          // Busca em até 15 níveis de parentesco (ainda mais profundo)
          for (let i = 0; i < 15; i++) {
            if (!current) break;
            const parentText = (current as HTMLElement).innerText || current.textContent || '';
            const lowerParentText = parentText.toLowerCase();
            
            // Re-find the best keyword in the parent to get the correct textAfterKeyword
            let parentBestKeyword = '';
            for (const k of keywords) {
              if (lowerParentText.includes(k.toLowerCase())) {
                if (k.length > parentBestKeyword.length) parentBestKeyword = k;
              }
            }

            if (parentBestKeyword) {
              const textAfterKeywordParent = parentText.substring(lowerParentText.indexOf(parentBestKeyword.toLowerCase()) + parentBestKeyword.length);

              if (!foundData) {
                const matchData = textAfterKeywordParent.match(dateRegex);
                if (matchData) foundData = matchData[1];
              }
              
              if (!foundValor) {
                const matchValor = textAfterKeywordParent.match(currencyRegex);
                if (matchValor) foundValor = 'R$ ' + matchValor[1];
              }
            }
            
            if (foundData && foundValor) return { data: foundData, valor: foundValor };
            
            // Tenta buscar nos irmãos
            const siblings = Array.from(current.parentElement?.children || []);
            for (const sibling of siblings) {
              if (sibling === current) continue;
              const siblingText = (sibling as HTMLElement).innerText || sibling.textContent || '';
              
              if (!foundData) {
                const matchData = siblingText.match(dateRegex);
                if (matchData) foundData = matchData[1];
              }
              
              if (!foundValor) {
                const matchValor = siblingText.match(currencyRegex);
                if (matchValor) foundValor = 'R$ ' + matchValor[1];
              }
              
              if (foundData && foundValor) return { data: foundData, valor: foundValor };
            }
            
            current = current.parentElement;
          }
        }

        // Fallback: Busca global se não encontrou nada específico perto dos elementos
        if (!foundData || !foundValor) {
          const bodyText = (document.body as HTMLElement).innerText || '';
          const lines = bodyText.split('\n');
          for (const line of lines) {
            if (keywords.some(k => line.toLowerCase().includes(k.toLowerCase()))) {
              const lowerLine = line.toLowerCase();
              // Encontrar qual keyword deu match para buscar depois dela
              let bestKeyword = '';
              for (const k of keywords) {
                if (lowerLine.includes(k.toLowerCase())) {
                  if (k.length > bestKeyword.length) bestKeyword = k;
                }
              }
              
              const textAfterKeyword = line.substring(lowerLine.indexOf(bestKeyword.toLowerCase()) + bestKeyword.length);
              
              if (!foundData) {
                const matchData = textAfterKeyword.match(dateRegex);
                if (matchData) foundData = matchData[1];
              }
              if (!foundValor) {
                const matchValor = textAfterKeyword.match(currencyRegex);
                if (matchValor) foundValor = 'R$ ' + matchValor[1];
              }
            }
          }
        }

        return { data: foundData, valor: foundValor };
      };

      const extractValueByKeyword = (keywords: string[]) => {
        const elements = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent || '';
          return keywords.some(k => text.toLowerCase().includes(k.toLowerCase())) && text.length < 100;
        });
        
        const currencyRegex = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/i;

        for (const el of elements) {
          let current: Element | null = el;
          // Search up to 8 levels
          for (let i = 0; i < 8; i++) {
            if (!current) break;
            
            // Check current element text
            const currentText = (current as HTMLElement).innerText || current.textContent || '';
            const currentMatch = currentText.match(currencyRegex);
            if (currentMatch) return 'R$ ' + currentMatch[1];

            // Check all siblings
            const siblings = Array.from(current.parentElement?.children || []);
            for (const sibling of siblings) {
              const siblingText = (sibling as HTMLElement).innerText || sibling.textContent || '';
              const match = siblingText.match(currencyRegex);
              if (match) return 'R$ ' + match[1];
            }

            // Check parent text
            const parentText = (current.parentElement as HTMLElement)?.innerText || current.parentElement?.textContent || '';
            const parentMatch = parentText.match(currencyRegex);
            if (parentMatch) return 'R$ ' + parentMatch[1];

            current = current.parentElement;
          }
        }
        
        // Final fallback: search the whole body for the keyword followed by a price
        const bodyText = document.body.innerText;
        for (const keyword of keywords) {
          const regex = new RegExp(keyword + '[^R$]*' + currencyRegex.source, 'i');
          const match = bodyText.match(regex);
          if (match) return 'R$ ' + match[1];
        }

        return '';
      };

      const p1Keywords = ['1ª Praça', '1º Leilão', '1ª Praca', '1º Leilao', 'Primeira Praça', 'Primeiro Leilão', '1º Ciclo', '1ª Data', '1º Encerramento', '1º Praça', '1ª Leilão', '1ª Etapa', '1º Período', 'Data 1', '1º Prazo', '1ª PRAÇA', '1ª PRACA'];
      const p2Keywords = ['2ª Praça', '2º Leilão', '2ª Praca', '2º Leilao', 'Segunda Praça', 'Segundo Leilão', '2º Ciclo', '2ª Data', '2º Encerramento', '2º Praça', '2ª Leilão', '2ª Etapa', '2º Período', 'Data 2', '2º Prazo', '2ª PRAÇA', '2ª PRACA'];

      const p1 = extractPracaInfo(p1Keywords);
      const p2 = extractPracaInfo(p2Keywords);
      
      let valor_avaliacao = getElementText('.valor-avaliacao') || extractValueByKeyword(['Avaliação', 'Valor de Avaliação', 'Avaliado em', 'Valor do Imóvel', 'Valor de Mercado', 'Preço de Avaliação', 'Valor Avaliado', 'Total da Avaliação']) || '0';
      let preco_leilao = getElementText('.preco-leilao') || getElementText('.lot-price') || getElementText('.price') || extractValueByKeyword(['Lance Mínimo', 'Lance Inicial', 'Valor Mínimo', 'Preço Mínimo', 'Valor de Venda', 'Lance Atual', 'Valor de Lance', 'Lance de Venda']) || '0';
      
      let primeira_praca_valor = p1.valor || getElementText('.primeira-praca-valor') || '';
      let segunda_praca_valor = p2.valor || getElementText('.segunda-praca-valor') || '';
      
      let primeira_praca_data = p1.data || getElementText('.primeira-praca-data') || '';
      let segunda_praca_data = p2.data || getElementText('.segunda-praca-data') || '';
      
      // Limpeza final: se o valor contiver palavras de praça, provavelmente é um erro de extração
      const isInvalid = (val: string) => {
        if (!val) return true;
        const lower = val.toLowerCase();
        return lower.includes('praça') || lower.includes('leilão') || !/\d/.test(val);
      };

      if (isInvalid(primeira_praca_valor)) primeira_praca_valor = '';
      if (isInvalid(segunda_praca_valor)) segunda_praca_valor = '';
      if (isInvalid(valor_avaliacao)) valor_avaliacao = '';
      if (isInvalid(preco_leilao)) preco_leilao = '';

      // Fallback final com base na regra de negócio: 1ª Praça = Avaliação, 2ª Praça = Preço Leilão
      if (!primeira_praca_valor || primeira_praca_valor === '0' || primeira_praca_valor === '') {
        primeira_praca_valor = valor_avaliacao;
      }
      if (!segunda_praca_valor || segunda_praca_valor === '0' || segunda_praca_valor === '') {
        segunda_praca_valor = preco_leilao;
      }

      // Correção de inversão: Se o valor da 1ª praça for menor que o da 2ª, provavelmente estão invertidos
      const parsePrice = (price: string) => {
        if (!price) return 0;
        const cleaned = price.replace(/[^\d,]/g, '').replace(',', '.');
        return parseFloat(cleaned) || 0;
      };

      const v1 = parsePrice(primeira_praca_valor);
      const v2 = parsePrice(segunda_praca_valor);

      if (v1 > 0 && v2 > 0 && v1 < v2) {
        console.log('Detectada inversão de valores de praça. Corrigindo...');
        const tempVal = primeira_praca_valor;
        primeira_praca_valor = segunda_praca_valor;
        segunda_praca_valor = tempVal;
        
        const tempData = primeira_praca_data;
        primeira_praca_data = segunda_praca_data;
        segunda_praca_data = tempData;
      }
      
      // Garantir que valor_avaliacao seja o maior dos dois se um deles for 0
      if (valor_avaliacao === '0' || !valor_avaliacao) {
        valor_avaliacao = v1 >= v2 ? primeira_praca_valor : segunda_praca_valor;
      }

      const vAval = parsePrice(valor_avaliacao);
      const vLeilao = parsePrice(preco_leilao);
      let descontoCalculado = '';
      if (vAval > 0 && vLeilao > 0) {
        const descPerc = Math.round((1 - (vLeilao / vAval)) * 100);
        descontoCalculado = descPerc + '%';
      }
      
      // Extrair imagem - lidando com lazy loading e meta tags
      const getMainImage = () => {
        // 1. Meta og:image
        const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
        if (ogImage && ogImage.startsWith('http')) return ogImage;

        // 2. Specific selectors
        const specificImg = document.querySelector('img.img-lote') || 
                          document.querySelector('img.photo-lote') ||
                          document.querySelector('.lot-image img') ||
                          document.querySelector('#main-image') ||
                          document.querySelector('.gallery img') ||
                          document.querySelector('.main-image img');
        if (specificImg) {
          const src = specificImg.getAttribute('src') || specificImg.getAttribute('data-src') || specificImg.getAttribute('srcset')?.split(' ')[0];
          if (src && src.startsWith('http')) return src;
        }

        // 3. Heuristic: Largest image
        const images = Array.from(document.querySelectorAll('img')).filter(img => {
          const src = img.getAttribute('src') || '';
          return src.startsWith('http') && !src.includes('logo') && !src.includes('icon');
        });
        
        if (images.length > 0) {
          return images[0].src;
        }

        return '';
      };

      const imagem_url = getMainImage();

      const extractAddress = () => {
        // Try specific selectors first
        const specific = getElementText('.endereco-lote') || 
                       getElementText('.lot-address') || 
                       getElementText('.address') ||
                       getElementText('h2.text-primary') || // Frazão
                       getElementText('.location');
        if (specific && specific !== 'Endereço não encontrado') return specific;

        // Try to find "Localização:" in the text
        const bodyText = document.body.innerText;
        const locMatch = bodyText.match(/Localização:\s*([^\n]+)/i) || 
                        bodyText.match(/Endereço:\s*([^\n]+)/i) ||
                        bodyText.match(/Localizado na\s*([^\n]+)/i);
        
        if (locMatch) return locMatch[1].trim();

        return 'Endereço não encontrado';
      };

      return {
        titulo: getElementText('h1') || getElementText('.titulo-lote') || getElementText('.lot-title') || getElementText('h2') || 'Título não encontrado',
        descricao: getElementText('.descricao-lote') || getElementText('.lot-description') || getElementText('.description') || '',
        preco_leilao: preco_leilao,
        endereco: extractAddress(),
        imagem_url: imagem_url,
        primeira_praca_data: primeira_praca_data,
        primeira_praca_valor: primeira_praca_valor,
        segunda_praca_data: segunda_praca_data,
        segunda_praca_valor: segunda_praca_valor,
        valor_avaliacao: valor_avaliacao,
        preco_avaliacao: valor_avaliacao,
        desconto: descontoCalculado,
        link_original: window.location.href
      };
    });
    
    await browser.close();
    return data;
  }
}
