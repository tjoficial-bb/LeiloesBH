import { chromium } from 'playwright';
import { Scraper } from './base.ts';

export class AuketScraper implements Scraper {
  async scrape(url: string): Promise<any> {
    const browser = await chromium.launch({ 
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'] 
    });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      extraHTTPHeaders: {
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      }
    });
    const page = await context.newPage();
    
    try {
      console.log('AuketScraper: Launching browser...');
      // Stealth: hide automation and fix __name ReferenceError from esbuild
      await page.addInitScript(`
        window.__name = (fn, name) => fn;
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      `);
      
      // Capture console logs from the page
      page.on('console', msg => console.log('PAGE LOG:', msg.text()));
      
      const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
      console.log('Navigating to:', formattedUrl);
      await page.goto(formattedUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      console.log('AuketScraper: Navigation complete.');
      
      // Capture HTML for debugging
      const html = await page.content();
      console.log('AuketScraper: HTML captured (first 500 chars):', html.substring(0, 500));
      
      // Check if login is required
      const loginButton = await page.$('text=Entrar com Google');
      if (loginButton) {
        console.log('Login required detected.');
        return { success: false, loginRequired: true, loginUrl: 'https://www.auket.com.br/login' };
      }
      
      console.log('Login not required, proceeding with scrape...');
      
      // Wait a bit more for dynamic content
      await page.waitForTimeout(3000);
      console.log('AuketScraper: Timeout complete.');
      
      const data = await page.evaluate(() => {
        // Helper para limpar nomes de ícones
        const cleanText = (text: string) => {
          return text.replace(/location_on|arrow_downward|house/gi, '').trim();
        };

        // Extrair título
        const titulo = (document.querySelector('h2.text-lead-500.font-bold') as HTMLElement)?.innerText.trim() || 'Sem título';
        
        // Extrair endereço - usando seletor de atributo para evitar problemas com caracteres especiais na classe
        const endereco = cleanText((document.querySelector('p[class*="text-[#898888]"]') as HTMLElement)?.innerText || '');
        
        // Extrair imagem - lidando com lazy loading
        const imgElement = document.querySelector('img.w-full.h-full.object-cover') || document.querySelector('img');
        const imagem_url = imgElement?.getAttribute('src') || imgElement?.getAttribute('data-src') || '';
        
        // Extrair tipo
        const tipo = cleanText((document.querySelector('div.border-lead-500') as HTMLElement)?.innerText || '');
        
        // Extrair desconto de forma mais segura
        let desconto = '';
        const descontoElements = Array.from(document.querySelectorAll('span.bg-extra-500'));
        for (const el of descontoElements) {
          const text = cleanText((el as HTMLElement).innerText || '');
          if (text.includes('%')) {
            desconto = text;
            break;
          }
        }
        
        // Extrair condições - usando seletor de atributo para evitar problemas com a barra na classe
        const condicoes_pagamento = (document.querySelector('div[class*="text-black/70"][class*="font-normal"]') as HTMLElement)?.innerText.trim() || '';
        
        // Extrair datas e valores de praça - abordagem mais robusta
        const extractPracaInfo = (keywords: string[]) => {
          const elements = Array.from(document.querySelectorAll('*')).filter(el => {
            const text = el.textContent || '';
            return keywords.some(k => text.toLowerCase().includes(k.toLowerCase())) && text.length < 100 && el.children.length === 0;
          });
          
          let foundData = '';
          let foundValor = '';

          const currencyRegex = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/i;

          for (const el of elements) {
            let current: Element | null = el;
            
            // Busca em até 12 níveis de parentesco (mais profundo)
            for (let i = 0; i < 12; i++) {
              if (!current) break;
              const parentText = (current as HTMLElement).innerText || current.textContent || '';
              
              if (!foundData) {
                // Regex melhorado para datas (DD/MM/AAAA, DD.MM.AAAA, DD/MM/AA, etc)
                const matchData = parentText.match(/(\d{1,2}[\/\.]\d{1,2}[\/\.]\d{2,4}(?:\s+\d{2}:\d{2})?)/);
                if (matchData) foundData = matchData[1];
              }
              
              if (!foundValor) {
                const matchValor = parentText.match(currencyRegex);
                if (matchValor) foundValor = 'R$ ' + matchValor[1];
              }
              
              if (foundData && foundValor) return { data: foundData, valor: foundValor };
              
              // Tenta buscar nos irmãos se não encontrou no pai
              const siblings = Array.from(current.parentElement?.children || []);
              for (const sibling of siblings) {
                if (sibling === current) continue;
                const siblingText = (sibling as HTMLElement).innerText || sibling.textContent || '';
                
                if (!foundData) {
                  const matchData = siblingText.match(/(\d{1,2}[\/\.]\d{1,2}[\/\.]\d{2,4}(?:\s+\d{2}:\d{2})?)/);
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
                if (!foundData) {
                  const matchData = line.match(/(\d{1,2}[\/\.]\d{1,2}[\/\.]\d{2,4}(?:\s+\d{2}:\d{2})?)/);
                  if (matchData) foundData = matchData[1];
                }
                if (!foundValor) {
                  const matchValor = line.match(currencyRegex);
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
            return keywords.some(k => text.toLowerCase().includes(k.toLowerCase())) && text.length < 100 && el.children.length === 0;
          });
          
          for (const el of elements) {
            let current: Element | null = el;
            for (let i = 0; i < 6; i++) {
              if (!current) break;
              const text = (current as HTMLElement).innerText || current.textContent || '';
              // Regex para capturar valores monetários (R$ 1.234,56 ou apenas 1.234,56)
              const match = text.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
              if (match) return 'R$ ' + match[1];
              
              const nextSibling = current.nextElementSibling;
              if (nextSibling) {
                const siblingText = (nextSibling as HTMLElement).innerText || nextSibling.textContent || '';
                const siblingMatch = siblingText.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
                if (siblingMatch) return 'R$ ' + siblingMatch[1];
              }
              current = current.parentElement;
            }
          }
          return '';
        };

        const p1 = extractPracaInfo(['1ª Praça', '1º Leilão', '1ª Praca', '1º Leilao', 'Primeira Praça', 'Primeiro Leilão', '1º Ciclo', '1ª Data', '1º Encerramento', '1º Praça', '1ª Leilão', '1ª Etapa', '1º Período', 'Data 1']);
        const p2 = extractPracaInfo(['2ª Praça', '2º Leilão', '2ª Praca', '2º Leilao', 'Segunda Praça', 'Segundo Leilão', '2º Ciclo', '2ª Data', '2º Encerramento', '2º Praça', '2ª Leilão', '2ª Etapa', '2º Período', 'Data 2']);
        
        let primeira_praca_data = p1.data, primeira_praca_valor = p1.valor, segunda_praca_data = p2.data, segunda_praca_valor = p2.valor;
        
        let valor_avaliacao = (document.querySelector('p.line-through') as HTMLElement)?.innerText.trim() || extractValueByKeyword(['Avaliação', 'Valor de Avaliação', 'Avaliado em', 'Valor do Imóvel', 'Valor de Mercado', 'Preço de Avaliação']) || '0';
        let preco_leilao = (document.querySelector('span.text-lead-500.font-extrabold') as HTMLElement)?.innerText.trim() || extractValueByKeyword(['Lance Mínimo', 'Lance Inicial', 'Valor Mínimo', 'Preço Mínimo', 'Valor de Venda', 'Lance Atual']) || '0';

        // Fallback para a lógica antiga caso a nova não encontre
        if (!primeira_praca_data) {
          const pracas = Array.from(document.querySelectorAll('div')).filter(div => 
            div.className.includes('flex-col') && 
            div.className.includes('items-center') && 
            div.className.includes('justify-between')
          );
          
          const currencyRegex = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/i;

          if (pracas.length >= 2) {
            primeira_praca_data = (pracas[0].querySelector('span.font-medium') as HTMLElement)?.innerText.trim() || '';
            const p1ValRaw = (pracas[0].querySelector('span.font-bold') as HTMLElement)?.innerText.trim() || '';
            const p1Match = p1ValRaw.match(currencyRegex);
            primeira_praca_valor = p1Match ? 'R$ ' + p1Match[1] : '';

            segunda_praca_data = (pracas[1].querySelector('span.font-medium') as HTMLElement)?.innerText.trim() || '';
            const p2ValRaw = (pracas[1].querySelector('span.font-bold') as HTMLElement)?.innerText.trim() || '';
            const p2Match = p2ValRaw.match(currencyRegex);
            segunda_praca_valor = p2Match ? 'R$ ' + p2Match[1] : '';
          }
        }
        
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
        
        return {
          titulo,
          endereco,
          imagem_url,
          tipo,
          valor_avaliacao,
          preco_leilao,
          desconto,
          condicoes_pagamento,
          primeira_praca_data,
          primeira_praca_valor,
          segunda_praca_data,
          segunda_praca_valor,
          link_original: window.location.href
        };
      });
      console.log('AuketScraper: Evaluate complete.', data);
      
      return { success: true, data };
    } catch (error) {
      console.error('AuketScraper error:', error);
      throw error;
    } finally {
      console.log('AuketScraper: Closing browser.');
      await browser.close();
    }
  }
}
