import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cron from 'node-cron';
import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';

// Load Firebase config more compatibly
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));

import { SaraivaScraper } from './scrapers/saraiva.ts';
import { AuketScraper } from './scrapers/auket.ts';

// Inicializa Firebase Client SDK para operações no servidor
const firebaseApp = initializeApp(firebaseConfig);
const firestore = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

async function runScrapeUpdate(propertyId: string, url: string) {
  console.log(`[Cron] Atualizando imóvel ${propertyId} - URL: ${url}`);
  try {
    let scraper;
    if (url.includes('auket.com.br')) {
      scraper = new AuketScraper();
    } else {
      scraper = new SaraivaScraper();
    }
    const result = await scraper.scrape(url);
    console.log(`[Cron] Resultado do scrape para ${propertyId}:`, JSON.stringify(result, null, 2));
    if (result.success !== false) {
      const data = result.data || result;
      console.log(`[Cron] Dados a serem atualizados para ${propertyId}:`, JSON.stringify(data, null, 2));
      
      // Filtrar campos vazios para não sobrescrever dados existentes que podem ter sido inseridos manualmente
      const updatePayload: any = {
        last_updated: new Date().toISOString()
      };
      
      Object.keys(data).forEach(key => {
        if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
          updatePayload[key] = data[key];
        }
      });

      await updateDoc(doc(firestore, 'imoveis', propertyId), updatePayload);
      console.log(`[Cron] Imóvel ${propertyId} atualizado com sucesso.`);
    } else {
      console.log(`[Cron] Scrape falhou ou requer login para ${propertyId}:`, result);
    }
  } catch (error) {
    console.error(`[Cron] Erro ao atualizar imóvel ${propertyId}:`, error);
  }
}

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const PORT = 3000;

  // Cron Job Dinâmico
  let currentCronTask: any = null;

  const setupCronJob = (intervalHours: string) => {
    if (currentCronTask) {
      currentCronTask.stop();
    }

    let cronExpression = '0 * * * *'; // default 1 hour
    if (intervalHours === '4') cronExpression = '0 */4 * * *';
    else if (intervalHours === '12') cronExpression = '0 */12 * * *';
    else if (intervalHours === '24') cronExpression = '0 0 * * *';

    console.log(`[Cron] Configurando atualização automática para rodar com a expressão: ${cronExpression} (A cada ${intervalHours} hora(s))`);

    currentCronTask = cron.schedule(cronExpression, async () => {
      console.log('[Cron] Iniciando atualização automática de todos os imóveis...');
      try {
        const snapshot = await getDocs(collection(firestore, 'imoveis'));
        for (const propertyDoc of snapshot.docs) {
          const property = propertyDoc.data();
          if (property.link_original) {
            await runScrapeUpdate(propertyDoc.id, property.link_original);
          }
        }
        console.log('[Cron] Atualização automática concluída.');
      } catch (error) {
        console.error('[Cron] Erro no job de atualização automática:', error);
      }
    });
  };

  // Escutar mudanças nas configurações para atualizar o cron job
  onSnapshot(doc(firestore, 'settings', 'site'), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      const interval = data.updateInterval || '1';
      setupCronJob(interval);
    } else {
      setupCronJob('1');
    }
  });

  // API routes
  app.post('/api/scrape', async (req, res) => {
    const { url } = req.body;
    console.log('Scraping URL:', url);
    try {
      let scraper;
      if (url.includes('auket.com.br')) {
        scraper = new AuketScraper();
      } else {
        scraper = new SaraivaScraper();
      }
      const data = await scraper.scrape(url);
      console.log('Scrape result:', data);
      
      res.json({ success: true, data });
    } catch (error) {
      console.error('Scrape error:', error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to scrape' });
    }
  });

  app.post('/api/update-property', async (req, res) => {
    const { id, url } = req.body;
    if (!id || !url) return res.status(400).json({ success: false, error: 'ID e URL são obrigatórios' });
    
    try {
      await runScrapeUpdate(id, url);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Erro ao atualizar imóvel' });
    }
  });

  app.post('/api/discovery/sync-auctioneer', async (req, res) => {
    const { url, id } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'URL é obrigatória' });

    console.log(`[Discovery] Sincronizando leiloeiro: ${url}`);
    try {
      // Usar um scraper genérico para encontrar links de lotes
      const response = await fetch(url);
      const html = await response.text();
      
      // Regex simples para encontrar links que pareçam lotes ou imóveis
      // Isso pode ser melhorado com IA no futuro
      const linkRegex = /href=["']([^"']*(?:lote|imovel|item|detalhe|leilao)[^"']*)["']/gi;
      const matches = html.matchAll(linkRegex);
      const links = new Set<string>();
      
      const urlObj = new URL(url);
      const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

      for (const match of matches) {
        let link = match[1];
        if (link.startsWith('/')) link = baseUrl + link;
        if (!link.startsWith('http')) continue;
        if (link.includes(urlObj.host)) {
          links.add(link);
        }
      }

      const foundLinks = Array.from(links).slice(0, 15); // Limitar a 15 links por vez
      
      // Atualizar last_sync no Firestore
      if (id) {
        await updateDoc(doc(firestore, 'leiloeiros_monitorados', id), {
          last_sync: new Date().toISOString()
        });
      }

      res.json({ success: true, foundLinks });
    } catch (error) {
      console.error('[Discovery] Erro ao sincronizar leiloeiro:', error);
      res.status(500).json({ success: false, error: 'Erro ao varrer site do leiloeiro' });
    }
  });

  // Dynamic Sitemap
  app.get('/sitemap.xml', async (req, res) => {
    try {
      const settingsSnap = await getDocs(collection(firestore, 'settings'));
      const settings = settingsSnap.docs.find(d => d.id === 'site')?.data() || {};
      const baseUrl = settings.canonicalUrl || `${req.protocol}://${req.get('host')}`;
      
      const imoveisSnap = await getDocs(collection(firestore, 'imoveis'));
      const imoveis = imoveisSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/sobre</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/faq</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`;

      imoveis.forEach((imovel: any) => {
        // In a real app we might have property pages, but here they are in modals.
        // If we had /imovel/:id we would add them here.
        // For now, just the main pages.
      });

      xml += `\n</urlset>`;
      res.header('Content-Type', 'application/xml');
      res.send(xml);
    } catch (error) {
      res.status(500).send('Error generating sitemap');
    }
  });

  // Dynamic Robots.txt
  app.get('/robots.txt', async (req, res) => {
    try {
      const settingsSnap = await getDocs(collection(firestore, 'settings'));
      const settings = settingsSnap.docs.find(d => d.id === 'site')?.data() || {};
      const baseUrl = settings.canonicalUrl || `${req.protocol}://${req.get('host')}`;
      const policy = settings.robotsPolicy || 'index, follow';
      
      let robots = `User-agent: *\n`;
      if (policy.includes('noindex')) {
        robots += `Disallow: /\n`;
      } else {
        robots += `Allow: /\n`;
        robots += `Disallow: /admin\n`;
      }
      robots += `\nSitemap: ${baseUrl}/sitemap.xml`;
      
      res.header('Content-Type', 'text/plain');
      res.send(robots);
    } catch (error) {
      res.status(500).send('Error generating robots.txt');
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: {
          port: 24679, // Use a different port to avoid conflicts
        }
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });

  server.on('error', (e: any) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Retrying in 1 second...`);
      setTimeout(() => {
        server.close();
        server.listen(PORT, '0.0.0.0');
      }, 1000);
    } else {
      console.error('Server error:', e);
    }
  });
}

startServer();
