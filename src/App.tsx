/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CardImovel } from './components/CardImovel';
import { Layout } from './components/Layout';
import { Heart, Filter, ChevronDown, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Sobre from './Sobre';
import FAQ from './FAQ';
import AdminSettings from './AdminSettings';
import Leiloeiros from './pages/Leiloeiros';
import BlogList from './BlogList';
import BlogPost from './BlogPost';
import AdminBlog from './AdminBlog';
import DiscoveryDashboard from './DiscoveryDashboard';
import { BlogCard } from './components/BlogCard';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { collection, addDoc, updateDoc, doc, onSnapshot, getDocs, deleteDoc, query, limit, orderBy, getDocFromServer, where, setDoc } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User, browserPopupRedirectResolver } from 'firebase/auth';
import { GoogleGenAI, Type } from "@google/genai";

const ADMIN_EMAIL = 'tjinvestoficial@gmail.com';

const formatCurrencyInput = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const numberValue = parseInt(digits, 10) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(numberValue);
};

export default function App() {
  const [url, setUrl] = useState('');
  const [imoveis, setImoveis] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [isTestimonialsLoading, setIsTestimonialsLoading] = useState(true);
  const [featuredPosts, setFeaturedPosts] = useState<any[]>([]);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingImovel, setEditingImovel] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  
  const [isProcessing, setIsProcessing] = useState<string | boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [settings, setSettings] = useState<any>({
    siteTitle: 'TJ INVEST - Leilões de Imóveis',
    siteDescription: 'Especialistas em leilões de imóveis com segurança e rentabilidade.',
    showRoiCalculator: true,
    showTicker: true,
    showTestimonials: true,
    testimonialStyle: 'grid',
    themePalette: 'emerald',
    headerStyle: 'light',
    backgroundStyle: 'light',
    typography: 'default',
    seoKeywords: '',
    ogImage: '',
    faviconUrl: '',
    googleAnalyticsId: '',
    canonicalUrl: '',
    twitterHandle: '',
    robotsPolicy: 'index, follow',
    googleTagManagerId: '',
    headerBackgroundImage: '',
    headerOverlayOpacity: 0.5,
    logoUrl: 'https://i.postimg.cc/14q5TzRL/logo.png',
  });

  const settingsRef = useRef(settings);
  const isUpdatingTicker = useRef(false);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'site'), (doc) => {
      if (doc.exists()) setSettings((prev: any) => ({ ...prev, ...doc.data() }));
      setIsSettingsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/site');
      setIsSettingsLoading(false);
    });

    const unsubHeader = onSnapshot(doc(db, 'settings', 'header'), (doc) => {
      if (doc.exists()) setSettings((prev: any) => ({ ...prev, headerBackgroundImage: doc.data().headerBackgroundImage }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/header');
    });

    const unsubAssets = onSnapshot(doc(db, 'settings', 'assets'), (doc) => {
      if (doc.exists()) setSettings((prev: any) => ({ ...prev, ...doc.data() }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/assets');
    });

    return () => {
      unsub();
      unsubHeader();
      unsubAssets();
    };
  }, []);

  useEffect(() => {
    if (isSettingsLoading) return;

    // Update Title
    document.title = settings.siteTitle || 'TJ INVEST - Leilões de Imóveis';

    // Update Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', settings.siteDescription || '');

    // Update Keywords
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.setAttribute('name', 'keywords');
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.setAttribute('content', settings.seoKeywords || '');

    // Update Favicon
    let linkFavicon = document.querySelector('link[rel="icon"]');
    if (!linkFavicon) {
      linkFavicon = document.createElement('link');
      linkFavicon.setAttribute('rel', 'icon');
      document.head.appendChild(linkFavicon);
    }
    if (settings.faviconUrl) {
      linkFavicon.setAttribute('href', settings.faviconUrl);
    }

    // Update OG Image
    let metaOgImage = document.querySelector('meta[property="og:image"]');
    if (!metaOgImage) {
      metaOgImage = document.createElement('meta');
      metaOgImage.setAttribute('property', 'og:image');
      document.head.appendChild(metaOgImage);
    }
    metaOgImage.setAttribute('content', settings.ogImage || '');

    // Update Canonical
    let linkCanonical = document.querySelector('link[rel="canonical"]');
    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.setAttribute('rel', 'canonical');
      document.head.appendChild(linkCanonical);
    }
    if (settings.canonicalUrl) {
      linkCanonical.setAttribute('href', settings.canonicalUrl);
    }

    // Update Robots
    let metaRobots = document.querySelector('meta[name="robots"]');
    if (!metaRobots) {
      metaRobots = document.createElement('meta');
      metaRobots.setAttribute('name', 'robots');
      document.head.appendChild(metaRobots);
    }
    metaRobots.setAttribute('content', settings.robotsPolicy || 'index, follow');

    // Update Twitter Tags
    const twitterTags = [
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: settings.siteTitle },
      { name: 'twitter:description', content: settings.siteDescription },
      { name: 'twitter:image', content: settings.ogImage },
      { name: 'twitter:site', content: settings.twitterHandle },
    ];

    twitterTags.forEach(tag => {
      if (!tag.content) return;
      let el = document.querySelector(`meta[name="${tag.name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', tag.name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', tag.content);
    });

    // Google Tag Manager
    if (settings.googleTagManagerId) {
      const gtmId = 'gtm-script';
      if (!document.getElementById(gtmId)) {
        const script = document.createElement('script');
        script.id = gtmId;
        script.innerHTML = `
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${settings.googleTagManagerId}');
        `;
        document.head.appendChild(script);
      }
    }

    // Google Analytics
    if (settings.googleAnalyticsId) {
      const scriptId = 'google-analytics-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${settings.googleAnalyticsId}`;
        document.head.appendChild(script);

        const configScript = document.createElement('script');
        configScript.innerHTML = `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${settings.googleAnalyticsId}');
        `;
        document.head.appendChild(configScript);
      }
    }
  }, [settings, isSettingsLoading]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Load favorites
        const unsubFavs = onSnapshot(collection(db, 'users', currentUser.uid, 'favorites'), (snapshot) => {
          setFavorites(snapshot.docs.map(doc => doc.id));
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, `users/${currentUser.uid}/favorites`);
        });
        return () => unsubFavs();
      } else {
        setFavorites([]);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    // Carrega imóveis independente de autenticação
    setIsLoading(true);
    const q = query(collection(db, 'imoveis'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('Imoveis carregados:', data);
      setImoveis(data);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'imoveis');
      setIsLoading(false);
    });

    const unsubTestimonials = onSnapshot(collection(db, 'testimonials'), (snapshot) => {
      setTestimonials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsTestimonialsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'testimonials');
      setIsTestimonialsLoading(false);
    });

    const unsubPosts = onSnapshot(
      query(collection(db, 'posts'), where('status', '==', 'published'), where('featured', '==', true), limit(3)),
      (snapshot) => {
        setFeaturedPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'posts');
      }
    );

    return () => {
      unsubscribe();
      unsubTestimonials();
      unsubPosts();
    };
  }, []);

  // Lógica de atualização do Ticker via IA
  useEffect(() => {
    if (isSettingsLoading || !settings.showTicker || user?.email !== ADMIN_EMAIL) return;

    const updateTicker = async () => {
      if (isUpdatingTicker.current) return;
      
      const currentSettings = settingsRef.current;
      const now = Date.now();
      const lastUpdate = currentSettings.lastTickerUpdate || 0;
      const intervalMs = Math.max(1, parseInt(currentSettings.tickerUpdateInterval || '60')) * 60 * 1000;

      if (now - lastUpdate > intervalMs) {
        isUpdatingTicker.current = true;
        console.log('Atualizando ticker via IA...');
        
        const maxRetries = 5;
        let attempt = 0;

        const executeTickerUpdate = async (): Promise<any> => {
          try {
            const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
            if (!apiKey) throw new Error("Chave de API não encontrada.");

            const ai = new GoogleGenAI({ apiKey });
            const prompt = currentSettings.tickerPrompt || 'Gere 10 itens para uma barra de cotações de leilões de imóveis. Misture notícias curtas com notícias mais detalhadas (acima de 20 palavras). Inclua SELIC, IPCA, Dólar, Euro e novidades do mercado. Use um tom profissional.';
            
            const response = await ai.models.generateContent({
              model: "gemini-3.1-flash-lite-preview",
              contents: prompt,
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: { type: Type.STRING },
                      value: { type: Type.STRING },
                      trend: { type: Type.STRING, enum: ['up', 'down', 'neutral'] }
                    },
                    required: ['label', 'value', 'trend']
                  }
                }
              }
            });

            return JSON.parse(response.text);
          } catch (error: any) {
            const errorObj = typeof error === 'string' ? JSON.parse(error) : error;
            if ((errorObj?.error?.code === 429 || errorObj?.status === 'RESOURCE_EXHAUSTED') && attempt < maxRetries) {
              attempt++;
              // Backoff muito mais agressivo: 10s, 30s, 90s, 270s, 810s
              const delay = Math.pow(3, attempt) * 10000;
              console.warn(`Cota esgotada. Tentativa ${attempt} de ${maxRetries}. Tentando novamente em ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              return executeTickerUpdate();
            }
            throw error;
          }
        };

        try {
          const tickerItems = await executeTickerUpdate();
          await updateDoc(doc(db, 'settings', 'site'), {
            tickerItems,
            lastTickerUpdate: now
          });
          console.log('Ticker updated successfully!');
        } catch (error) {
          console.error('Ticker update error:', error);
        } finally {
          isUpdatingTicker.current = false;
        }
      }
    };

    updateTicker();
    const interval = setInterval(updateTicker, 30 * 60 * 1000); // Verifica a cada 30 min
    return () => clearInterval(interval);
  }, [isSettingsLoading, settings.showTicker, settings.tickerUpdateInterval, user?.email]);

  useEffect(() => {
    if (settings.testimonialStyle === 'carousel' && testimonials.length > 0 && !isCarouselPaused) {
      const interval = setInterval(() => {
        if (carouselRef.current) {
          const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
          if (scrollLeft + clientWidth >= scrollWidth - 10) {
            carouselRef.current.scrollTo({ left: 0, behavior: 'smooth' });
          } else {
            carouselRef.current.scrollBy({ left: 350, behavior: 'smooth' });
          }
        }
      }, 3000); // 3 seconds per slide
      return () => clearInterval(interval);
    }
  }, [settings.testimonialStyle, testimonials, isCarouselPaused]);

  const scrollCarouselLeft = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollCarouselRight = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      console.log('Login realizado com sucesso:', result.user.email);
    } catch (error: any) {
      console.error('Erro detalhado no login:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        console.log('Login cancelado pelo usuário.');
        return;
      }
      
      let message = 'Erro ao realizar login. Tente novamente.';
      if (error.code === 'auth/unauthorized-domain') {
        message = `Este domínio (${window.location.hostname}) não está autorizado no Firebase.\n\nPor favor, acesse o Console do Firebase > Authentication > Settings (Configurações) > Authorized domains (Domínios autorizados) e adicione o domínio:\n${window.location.hostname}`;
      } else if (error.code === 'auth/popup-blocked') {
        message = 'O popup de login foi bloqueado pelo seu navegador. Por favor, permita popups para este site.';
      } else if (error.message) {
        message = `Erro: ${error.message}`;
      }
      
      alert(message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const [scrapeProgress, setScrapeProgress] = useState<{ current: number, total: number, url: string } | null>(null);

  const handleScrape = async () => {
    console.log('handleScrape chamado. Usuário:', user?.email);
    if (!(user?.email === ADMIN_EMAIL)) {
      console.log('Acesso negado. Usuário não é admin.');
      return;
    }
    
    const urlList = url.split('\n').map(u => u.trim()).filter(u => u !== '');
    if (urlList.length === 0) {
      alert('Por favor, insira pelo menos um link.');
      return;
    }

    setIsProcessing('new');
    setScrapeProgress({ current: 0, total: urlList.length, url: '' });
    let successCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < urlList.length; i++) {
        const currentUrl = urlList[i];
        setScrapeProgress({ current: i + 1, total: urlList.length, url: currentUrl });
        console.log(`Processando ${i + 1}/${urlList.length}:`, currentUrl);
        
        try {
          const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: currentUrl })
          });
          
          const result = await response.json();
          if (result.success) {
            const imovelData = result.data.data || result.data;
            await addDoc(collection(db, 'imoveis'), {
              ...imovelData,
              addedAt: new Date().toISOString()
            });
            successCount++;
          } else {
            console.error(`Erro no scrape da URL ${currentUrl}:`, result.error);
            errorCount++;
          }
        } catch (err) {
          console.error(`Erro ao processar URL ${currentUrl}:`, err);
          errorCount++;
        }
      }
      
      setUrl(''); // Clear input
      alert(`Processamento concluído!\nSucesso: ${successCount}\nErros: ${errorCount}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'imoveis');
    } finally {
      setIsProcessing(false);
      setScrapeProgress(null);
    }
  };

  const handleAddFromDiscovery = async (discoveryUrl: string) => {
    if (!(user?.email === ADMIN_EMAIL)) return;
    setIsProcessing('discovery');
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: discoveryUrl })
      });
      const result = await response.json();
      if (result.success) {
        const imovelData = result.data.data || result.data;
        await addDoc(collection(db, 'imoveis'), {
          ...imovelData,
          addedAt: new Date().toISOString()
        });
        alert('Imóvel importado com sucesso!');
      } else {
        alert('Erro ao importar imóvel.');
      }
    } catch (error) {
      console.error('Erro ao importar da descoberta:', error);
      alert('Erro ao importar imóvel.');
    } finally {
      setIsProcessing(false);
    }
  };

  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);

  const generateAnalysis = async () => {
    if (!editingImovel) return;
    setIsGeneratingAnalysis(true);
    
    const maxRetries = 5;
    let attempt = 0;

    const executeGeneration = async (): Promise<string> => {
      try {
        const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error("Chave de API do Gemini não encontrada.");
        }
        
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Você é um especialista sênior em leilões de imóveis da TJ Invest. 
Sua tarefa é realizar uma análise técnica e estratégica profunda do imóvel abaixo para um investidor de alto padrão.

IMPORTANTE: A ANÁLISE DEVE SER ESCRITA EXCLUSIVAMENTE EM PORTUGUÊS DO BRASIL.

ESTRUTURA OBRIGATÓRIA DA RESPOSTA:

1. **RESUMO EXECUTIVO**: Um parágrafo impactante sobre a oportunidade.
2. **SCORE DE OPORTUNIDADE (0-10)**: 
   - Atribua uma nota de 0 a 10.
   - EXPLIQUE detalhadamente por que essa nota foi dada (considere ROI, localização, liquidez e risco).
   - Use uma linguagem clara: "Este imóvel recebe nota X porque..."
3. **PONTOS FORTES**: Use marcadores (•) para destacar localização, potencial de valorização e margem de segurança.
4. **ANÁLISE DE RISCO**: Mencione os cuidados jurídicos e operacionais necessários de forma profissional.
5. **ESTRATÉGIA DE SAÍDA**: Sugira se é melhor para revenda rápida, aluguel ou uso próprio.

DIRETRIZES DE FORMATAÇÃO:
- Use **negrito** para termos e valores cruciais.
- Use parágrafos curtos e bem espaçados.
- Use emojis de forma muito moderada (máximo 3 em todo o texto).
- O tom deve ser autoritário, mas acessível, como um consultor sênior falando com um cliente VIP.

Dados do imóvel:
${JSON.stringify(editingImovel, null, 2)}

Retorne apenas o texto da análise formatado em Markdown.`;

        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite-preview",
          contents: prompt,
        });

        return response.text;
      } catch (error: any) {
        const errorObj = typeof error === 'string' ? JSON.parse(error) : error;
        if ((errorObj?.error?.code === 429 || errorObj?.status === 'RESOURCE_EXHAUSTED') && attempt < maxRetries) {
          attempt++;
          // Backoff muito mais agressivo: 10s, 30s, 90s, 270s, 810s
          const delay = Math.pow(3, attempt) * 10000;
          console.warn(`Cota esgotada. Tentativa ${attempt} de ${maxRetries}. Tentando novamente em ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return executeGeneration();
        }
        throw error;
      }
    };

    try {
      const analysis = await executeGeneration();
      setEditingImovel({ ...editingImovel, analise_especialista: analysis });
    } catch (error: any) {
      console.error("Erro ao gerar análise:", error);
      
      let errorMessage = 'Erro ao gerar análise com IA. Tente novamente mais tarde.';
      
      try {
        const errorObj = typeof error === 'string' ? JSON.parse(error) : error;
        if (errorObj?.error?.code === 429 || errorObj?.status === 'RESOURCE_EXHAUSTED') {
          errorMessage = 'A cota de uso da IA foi esgotada. Por favor, aguarde alguns minutos e tente novamente.';
        } else if (error?.message) {
          errorMessage = `Erro: ${error.message}`;
        }
      } catch (e) {
        if (error?.message) errorMessage = `Erro: ${error.message}`;
      }
      
      alert(errorMessage);
    } finally {
      setIsGeneratingAnalysis(false);
    }
  };

  const handleUpdate = async (data: any) => {
    if (!(user?.email === ADMIN_EMAIL)) return;
    const imovelRef = doc(db, 'imoveis', data.id);
    try {
      // Remove id before updating
      const { id, ...updateData } = data;
      await updateDoc(imovelRef, updateData);
      setEditingImovel(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'imoveis/' + data.id);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(user?.email === ADMIN_EMAIL)) return;
    // if (!confirm('Tem certeza que deseja excluir este imóvel?')) return;
    const imovelRef = doc(db, 'imoveis', id);
    try {
      await deleteDoc(imovelRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'imoveis/' + id);
    }
  };

  const handleManualFix = async (imovelId: string, field: 'primeira' | 'segunda') => {
    try {
      const imovel = imoveis.find(i => i.id === imovelId);
      if (!imovel) return;

      const newValue = field === 'primeira' ? imovel.valor_avaliacao : imovel.preco_leilao;
      if (!newValue) {
        alert('Valor de origem não disponível');
        return;
      }

      const imovelRef = doc(db, 'imoveis', imovelId);
      const updateData = field === 'primeira' 
        ? { primeira_praca_valor: newValue }
        : { segunda_praca_valor: newValue };

      await updateDoc(imovelRef, updateData);
    } catch (error) {
      console.error('Erro ao fixar valor manualmente:', error);
      handleFirestoreError(error, OperationType.UPDATE, `imoveis/${imovelId}`);
    }
  };

  const handleManualUpdate = async (id: string, url: string) => {
    if (!isAdmin) return;
    setIsProcessing(id);
    try {
      const response = await fetch('/api/update-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, url })
      });
      const result = await response.json();
      if (result.success) {
        alert('Imóvel atualizado com sucesso!');
      } else {
        alert('Erro ao atualizar imóvel.');
      }
    } catch (error) {
      console.error('Erro na atualização manual:', error);
      alert('Erro na atualização manual.');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleFavorite = async (imovelId: string) => {
    if (!user) {
      handleLogin();
      return;
    }
    const favRef = doc(db, 'users', user.uid, 'favorites', imovelId);
    try {
      if (favorites.includes(imovelId)) {
        await deleteDoc(favRef);
      } else {
        await addDoc(collection(db, 'users', user.uid, 'favorites'), {
          id: imovelId,
          addedAt: new Date().toISOString()
        });
        // Note: addDoc with a specific ID is better, but Firestore addDoc generates one.
        // Let's use setDoc instead to use the imovelId as document ID.
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  // Corrected toggleFavorite using setDoc
  const handleToggleFavorite = async (imovelId: string) => {
    if (!user) {
      handleLogin();
      return;
    }
    const favRef = doc(db, 'users', user.uid, 'favorites', imovelId);
    try {
      if (favorites.includes(imovelId)) {
        await deleteDoc(favRef);
      } else {
        await setDoc(favRef, {
          imovelId,
          addedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      handleFirestoreError(error, favorites.includes(imovelId) ? OperationType.DELETE : OperationType.WRITE, `users/${user.uid}/favorites/${imovelId}`);
    }
  };

  const [filtroTitulo, setFiltroTitulo] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroPrecoMax, setFiltroPrecoMax] = useState('');
  const [filtroDescontoMin, setFiltroDescontoMin] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroFavoritos, setFiltroFavoritos] = useState(false);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  const [listPage, setListPage] = useState(1);
  const itemsPerPage = 15;

  const imoveisFiltrados = useMemo(() => {
    if (!Array.isArray(imoveis)) return [];
    return imoveis.filter(imovel => {
      const matchesTitulo = String(imovel.titulo || '').toLowerCase().includes(filtroTitulo.toLowerCase());
      const matchesCidade = String(imovel.endereco || '').toLowerCase().includes(filtroCidade.toLowerCase());
      const matchesTipo = filtroTipo === '' || imovel.tipo === filtroTipo;
      
      const preco = parseFloat(String(imovel.preco_leilao || '0').replace(/[^0-9,]/g, '').replace(',', '.') || '0');
      const matchesPreco = filtroPrecoMax === '' || preco <= parseFloat(filtroPrecoMax);
      
      const descontoStr = String(imovel.desconto || '0').replace('%', '').trim();
      const desconto = parseFloat(descontoStr) || 0;
      const matchesDesconto = filtroDescontoMin === '' || desconto >= parseFloat(filtroDescontoMin);
      
      const matchesEstado = filtroEstado === '' || String(imovel.endereco || '').toLowerCase().includes(filtroEstado.toLowerCase());
      const matchesFavoritos = !filtroFavoritos || favorites.includes(imovel.id);

      return matchesTitulo && matchesCidade && matchesTipo && matchesPreco && matchesDesconto && matchesEstado && matchesFavoritos;
    });
  }, [imoveis, filtroTitulo, filtroCidade, filtroTipo, filtroPrecoMax, filtroDescontoMin, filtroEstado, filtroFavoritos, favorites]);

  // Reset page when filters change
  useEffect(() => {
    setListPage(1);
  }, [filtroTitulo, filtroCidade, filtroTipo, filtroPrecoMax, filtroDescontoMin, filtroEstado, filtroFavoritos]);

  const totalPages = Math.ceil(imoveisFiltrados.length / itemsPerPage);
  const paginatedImoveis = imoveisFiltrados.slice((listPage - 1) * itemsPerPage, listPage * itemsPerPage);

  const isAdmin = user?.email === ADMIN_EMAIL;

  const [currentPage, setCurrentPage] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => setCurrentPage(window.location.pathname);
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const navigate = (path: string) => {
    console.log('Navigating to:', path, 'Current page:', currentPage);
    if (currentPage === path) return;
    window.history.pushState({}, '', path);
    setCurrentPage(path);
    window.scrollTo(0, 0);
  };

  // ... (dentro do return)
  return (
    <Layout user={user} onLogin={handleLogin} onLogout={handleLogout} onNavigate={navigate} settings={settings}>
      {currentPage === '/' && (
        <>
          {isAdmin && (
            <div className="mb-8 p-4 sm:p-6 bg-white rounded-2xl shadow-sm border border-stone-100">
              <h2 className="text-xl font-bold mb-4">Painel de Administração</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <textarea 
                    value={url} 
                    onChange={(e) => setUrl(e.target.value)} 
                    placeholder="Cole os links dos leilões (um por linha)" 
                    className="border border-stone-200 p-3 rounded-xl w-full h-32 resize-none focus:ring-2 focus:ring-primary outline-none"
                  />
                  <button 
                    onClick={handleScrape}
                    disabled={!!isProcessing}
                    className={`bg-primary text-white p-3 rounded-xl font-bold hover:bg-primary-dark transition-all disabled:opacity-50 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isProcessing === 'new' ? (
                      <div className="flex flex-col items-center">
                        <span>Processando {scrapeProgress?.current}/{scrapeProgress?.total}</span>
                        <span className="text-[10px] font-normal opacity-75 truncate max-w-[200px]">{scrapeProgress?.url}</span>
                      </div>
                    ) : 'Fazer Scrape de Todos'}
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="p-4 bg-stone-50 rounded-xl border border-stone-100 h-32 flex flex-col justify-center items-center text-center">
                    <p className="text-sm font-bold text-stone-700 mb-2">Gerenciamento de Blog</p>
                    <button 
                      onClick={() => navigate('/admin-blog')}
                      className="bg-stone-900 text-white px-6 py-2 rounded-xl font-bold hover:bg-black transition-all"
                    >
                      Acessar Blog Admin
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="mb-4 md:hidden">
            <button
              onClick={() => setShowFiltersMobile(!showFiltersMobile)}
              className="w-full bg-white border border-stone-200 p-3 rounded-xl flex items-center justify-between font-medium text-stone-700 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Filter size={18} />
                Filtros e Busca
              </div>
              <ChevronDown size={18} className={`transition-transform ${showFiltersMobile ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div className={`mb-8 bg-white p-6 rounded-xl shadow-sm border border-stone-100 grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 ${showFiltersMobile ? 'grid' : 'hidden md:grid'}`}>
            <input type="text" placeholder="Título..." value={filtroTitulo} onChange={e => setFiltroTitulo(e.target.value)} className="border p-2 rounded text-sm" />
            <input type="text" placeholder="Cidade/Endereço..." value={filtroCidade} onChange={e => setFiltroCidade(e.target.value)} className="border p-2 rounded text-sm" />
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="border p-2 rounded text-sm">
              <option value="">Todos os tipos</option>
              <option value="Apartamento">Apartamento</option>
              <option value="Casa">Casa</option>
              <option value="Terreno">Terreno</option>
              <option value="Comercial">Comercial</option>
            </select>
            <input type="number" placeholder="Preço máx..." value={filtroPrecoMax} onChange={e => setFiltroPrecoMax(e.target.value)} className="border p-2 rounded text-sm" />
            <select value={filtroDescontoMin} onChange={e => setFiltroDescontoMin(e.target.value)} className="border p-2 rounded text-sm">
              <option value="">Qualquer desconto</option>
              <option value="10">&gt; 10% desc.</option>
              <option value="30">&gt; 30% desc.</option>
              <option value="50">&gt; 50% desc.</option>
              <option value="70">&gt; 70% desc.</option>
            </select>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="border p-2 rounded text-sm">
              <option value="">Todos Estados</option>
              <option value="SP">São Paulo (SP)</option>
              <option value="RJ">Rio de Janeiro (RJ)</option>
              <option value="MG">Minas Gerais (MG)</option>
              <option value="PR">Paraná (PR)</option>
              <option value="SC">Santa Catarina (SC)</option>
              <option value="RS">Rio Grande do Sul (RS)</option>
            </select>
            <button 
              onClick={() => {
                if (!user) {
                  handleLogin();
                  return;
                }
                setFiltroFavoritos(!filtroFavoritos);
              }}
              className={`flex items-center justify-center gap-2 border p-2 rounded text-sm font-bold transition-all ${filtroFavoritos ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`}
            >
              <Heart size={16} fill={filtroFavoritos ? "currentColor" : "none"} />
              {filtroFavoritos ? 'Ver Todos' : 'Meus Favoritos'}
            </button>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <p className="text-xs sm:text-sm text-stone-600 font-medium text-center sm:text-left">
              Mostrando {Math.min(itemsPerPage * listPage, imoveisFiltrados.length)} de {imoveisFiltrados.length} oportunidades
            </p>
            {totalPages > 1 && (
              <div className="flex gap-2 w-full sm:w-auto justify-center sm:justify-end">
                <button 
                  onClick={() => setListPage(p => Math.max(1, p - 1))}
                  disabled={listPage === 1}
                  className="px-3 py-2 bg-white border border-stone-200 rounded-lg disabled:opacity-50 font-bold text-xs sm:text-sm hover:bg-stone-50 transition-colors flex-1 sm:flex-none"
                >
                  Anterior
                </button>
                <span className="px-3 py-2 font-bold text-xs sm:text-sm flex items-center bg-stone-50 rounded-lg border border-stone-100">
                  {listPage} / {totalPages}
                </span>
                <button 
                  onClick={() => setListPage(p => Math.min(totalPages, p + 1))}
                  disabled={listPage === totalPages}
                  className="px-3 py-2 bg-white border border-stone-200 rounded-lg disabled:opacity-50 font-bold text-xs sm:text-sm hover:bg-stone-50 transition-colors flex-1 sm:flex-none"
                >
                  Próximo
                </button>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-stone-100 animate-pulse h-96 rounded-2xl"></div>
              ))
            ) : (paginatedImoveis && paginatedImoveis.length > 0) ? (
              paginatedImoveis.map((imovel, index) => (
                <div 
                  key={imovel.id} 
                  className="relative"
                >
                  <CardImovel 
                    imovel={imovel} 
                    showRoi={settings.showRoiCalculator !== false} 
                    isFavorite={favorites.includes(imovel.id)}
                    onToggleFavorite={() => handleToggleFavorite(imovel.id)}
                    settings={settings}
                    isAdmin={isAdmin}
                    onManualFix={(field) => handleManualFix(imovel.id, field)}
                    onRefresh={() => handleManualUpdate(imovel.id, imovel.link_original)}
                    onEdit={() => setEditingImovel(imovel)}
                    onDelete={() => setShowDeleteConfirm(imovel.id)}
                    isUpdating={isProcessing === imovel.id}
                  />
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-stone-500">
                Nenhum imóvel encontrado com os filtros selecionados.
              </div>
            )}
          </div>

          {settings.showTestimonials !== false && (isTestimonialsLoading || testimonials.length > 0) && (
            <div className="mt-24 mb-12">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-stone-900 mb-4">O que dizem nossos clientes</h2>
                <div className="w-20 h-1 bg-primary mx-auto rounded-full"></div>
              </div>

              {isTestimonialsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100 animate-pulse">
                      <div className="flex gap-1 mb-4">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <div key={s} className="w-4 h-4 bg-stone-200 rounded-full"></div>
                        ))}
                      </div>
                      <div className="h-4 bg-stone-200 rounded w-full mb-2"></div>
                      <div className="h-4 bg-stone-200 rounded w-3/4 mb-6"></div>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-stone-200 rounded-full"></div>
                        <div>
                          <div className="h-4 bg-stone-200 rounded w-24 mb-1"></div>
                          <div className="h-3 bg-stone-200 rounded w-16"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : settings.testimonialStyle === 'carousel' ? (
                <div 
                  className="relative group"
                  onMouseEnter={() => setIsCarouselPaused(true)}
                  onMouseLeave={() => setIsCarouselPaused(false)}
                  onTouchStart={() => setIsCarouselPaused(true)}
                  onTouchEnd={() => setIsCarouselPaused(false)}
                >
                  <button 
                    onClick={scrollCarouselLeft}
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-6 z-10 bg-white shadow-lg border border-stone-100 rounded-full p-2 text-stone-600 hover:text-primary hover:scale-110 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                    aria-label="Anterior"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  
                  <div ref={carouselRef} className="flex overflow-x-auto gap-6 pb-8 snap-x no-scrollbar scroll-smooth">
                    {testimonials.map((t, i) => (
                      <div 
                        key={t.id}
                        className="min-w-[300px] md:min-w-[400px] snap-center bg-white p-8 rounded-2xl shadow-sm border border-stone-100 flex flex-col hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center gap-4 mb-6">
                          {t.photoUrl ? (
                            <img src={t.photoUrl} alt={t.name} className="w-14 h-14 rounded-full object-cover border-2 border-primary/10" referrerPolicy="no-referrer" loading="lazy" />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 font-bold text-xl">
                              {t.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-stone-900 text-lg leading-tight">{t.name}</p>
                            <p className="text-xs text-stone-400 font-medium uppercase tracking-wider">{t.role}</p>
                            <div className="flex text-amber-400 text-xs mt-1">
                              {"★".repeat(t.rating || 5)}{"☆".repeat(5 - (t.rating || 5))}
                            </div>
                          </div>
                        </div>
                        <p className="text-stone-600 leading-relaxed mb-4 flex-grow italic text-lg">"{t.text}"</p>
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={scrollCarouselRight}
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-6 z-10 bg-white shadow-lg border border-stone-100 rounded-full p-2 text-stone-600 hover:text-primary hover:scale-110 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                    aria-label="Próximo"
                  >
                    <ChevronRight size={24} />
                  </button>
                </div>
              ) : settings.testimonialStyle === 'marquee' ? (
                <div className="relative overflow-hidden py-4">
                  <div 
                    className="flex w-max gap-6 animate-marquee whitespace-nowrap"
                    style={{ animationDuration: `${Math.max(testimonials.length * 4, 10)}s` }}
                  >
                    {[...testimonials, ...testimonials].map((t, i) => (
                      <div 
                        key={`${t.id}-${i}`}
                        className="inline-block w-[300px] md:w-[350px] bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex flex-col shrink-0"
                      >
                        <div className="flex items-center gap-3 mb-4">
                          {t.photoUrl ? (
                            <img src={t.photoUrl} alt={t.name} className="w-10 h-10 rounded-full object-cover border border-stone-100" referrerPolicy="no-referrer" loading="lazy" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 font-bold text-sm">
                              {t.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-stone-900 text-sm leading-tight">{t.name}</p>
                            <div className="flex text-amber-400 text-[10px]">
                              {"★".repeat(t.rating || 5)}{"☆".repeat(5 - (t.rating || 5))}
                            </div>
                          </div>
                        </div>
                        <p className="text-stone-600 text-xs leading-relaxed italic whitespace-normal">"{t.text}"</p>
                      </div>
                    ))}
                  </div>
                  {/* Gradient overlays for smooth fade */}
                  <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-stone-50 to-transparent z-10"></div>
                  <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-stone-50 to-transparent z-10"></div>
                </div>
              ) : settings.testimonialStyle === 'list' ? (
                <div className="max-w-3xl mx-auto space-y-6">
                  {testimonials.map((t, i) => (
                    <div 
                      key={t.id}
                      className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex gap-6 items-start hover:shadow-md transition-shadow"
                    >
                      {t.photoUrl ? (
                        <img src={t.photoUrl} alt={t.name} className="w-16 h-16 rounded-full object-cover border-2 border-primary/10" referrerPolicy="no-referrer" loading="lazy" />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 font-bold text-2xl shrink-0">
                          {t.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-bold text-stone-900 text-lg">{t.name}</p>
                          <p className="text-xs text-stone-400 font-medium uppercase tracking-wider">{t.role}</p>
                        </div>
                        <div className="flex text-amber-400 text-xs mb-3">
                          {"★".repeat(t.rating || 5)}{"☆".repeat(5 - (t.rating || 5))}
                        </div>
                        <p className="text-stone-600 leading-relaxed italic">"{t.text}"</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : settings.testimonialStyle === 'cards' ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {testimonials.map((t, i) => (
                    <div 
                      key={t.id}
                      className="bg-stone-50 p-5 rounded-xl border border-stone-200 flex flex-col"
                    >
                      <div className="flex text-amber-400 text-[10px] mb-3">
                        {"★".repeat(t.rating || 5)}{"☆".repeat(5 - (t.rating || 5))}
                      </div>
                      <p className="text-stone-700 text-sm leading-relaxed mb-4 flex-grow italic line-clamp-4">"{t.text}"</p>
                      <div className="flex items-center gap-2">
                        {t.photoUrl && <img src={t.photoUrl} alt={t.name} className="w-6 h-6 rounded-full object-cover" referrerPolicy="no-referrer" />}
                        <div>
                          <p className="font-bold text-stone-900 text-[10px] leading-tight">{t.name}</p>
                          <p className="text-[8px] text-stone-400 uppercase">{t.role}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {testimonials.map((t) => (
                    <div 
                      key={t.id}
                      className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100 flex flex-col hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-4 mb-6">
                        {t.photoUrl ? (
                          <img src={t.photoUrl} alt={t.name} className="w-14 h-14 rounded-full object-cover border-2 border-primary/10" referrerPolicy="no-referrer" loading="lazy" />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 font-bold text-xl">
                            {t.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-stone-900 text-lg leading-tight">{t.name}</p>
                          <p className="text-xs text-stone-400 font-medium uppercase tracking-wider">{t.role}</p>
                          <div className="flex text-amber-400 text-xs mt-1">
                            {"★".repeat(t.rating || 5)}{"☆".repeat(5 - (t.rating || 5))}
                          </div>
                        </div>
                      </div>
                      <p className="text-stone-600 leading-relaxed mb-4 flex-grow italic text-lg">"{t.text}"</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {featuredPosts.length > 0 && (
            <div className="mt-24 mb-12">
              <div className="flex justify-between items-end mb-12">
                <div>
                  <h2 className="text-3xl font-bold text-stone-900 mb-2">Blog & Notícias</h2>
                  <p className="text-stone-500">Fique por dentro das melhores oportunidades e dicas do mercado.</p>
                </div>
                <button 
                  onClick={() => navigate('/blog')}
                  className="text-primary font-bold hover:underline flex items-center gap-2 group"
                >
                  Ver todos os artigos
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {featuredPosts.map((post, index) => (
                  <div
                    key={post.id}
                  >
                    <BlogCard post={post} onNavigate={navigate} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {currentPage === '/sobre' && <Sobre onNavigate={navigate} isAdmin={isAdmin} />}
      {currentPage === '/faq' && <FAQ isAdmin={isAdmin} />}
      {currentPage === '/blog' && <BlogList onNavigate={navigate} />}
      {currentPage.startsWith('/blog/') && <BlogPost slug={currentPage.split('/blog/')[1]} onNavigate={navigate} />}
      {currentPage === '/admin' && isAdmin && <AdminSettings onNavigate={navigate} />}
      {currentPage === '/admin/blog' && isAdmin && <AdminBlog />}
      {currentPage === '/admin/discovery' && isAdmin && (
        <div className="max-w-7xl mx-auto px-4 py-12">
          <DiscoveryDashboard onAddProperty={handleAddFromDiscovery} />
        </div>
      )}
      {currentPage === '/leiloeiros' && <Leiloeiros />}
      
      {editingImovel && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white p-6 md:p-8 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-stone-800">Editar Imóvel</h2>
              <button onClick={() => setEditingImovel(null)} className="text-stone-400 hover:text-stone-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-stone-700 mb-1">Título</label>
                <input type="text" value={editingImovel.titulo || ''} onChange={(e) => setEditingImovel({...editingImovel, titulo: e.target.value})} className="w-full border border-stone-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-stone-700 mb-1">Endereço</label>
                <input type="text" value={editingImovel.endereco || ''} onChange={(e) => setEditingImovel({...editingImovel, endereco: e.target.value})} className="w-full border border-stone-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
              </div>
              
              {/* Valores Básicos */}
              <div className="bg-stone-50 p-4 rounded-xl md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 border border-stone-100">
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1">Valor de Avaliação</label>
                  <input type="text" value={editingImovel.valor_avaliacao || ''} onChange={(e) => setEditingImovel({...editingImovel, valor_avaliacao: formatCurrencyInput(e.target.value)})} className="w-full border border-stone-300 p-2.5 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1">Preço Leilão</label>
                  <input type="text" value={editingImovel.preco_leilao || ''} onChange={(e) => setEditingImovel({...editingImovel, preco_leilao: formatCurrencyInput(e.target.value)})} className="w-full border border-stone-300 p-2.5 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1">Desconto (%)</label>
                  <input type="text" value={editingImovel.desconto || ''} onChange={(e) => setEditingImovel({...editingImovel, desconto: e.target.value})} className="w-full border border-stone-300 p-2.5 rounded-lg" placeholder="Ex: 50%" />
                </div>
              </div>

              {/* Estimativas de Mercado */}
              <div className="bg-blue-50 p-4 rounded-xl md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 border border-blue-100">
                <h3 className="md:col-span-2 font-bold text-blue-800 text-sm uppercase tracking-wider flex justify-between items-center">
                  Estimativas de Mercado
                  <button 
                    type="button"
                    onClick={() => {
                      const parseCurrency = (val: any) => {
                        const strVal = String(val || '0').trim();
                        if (/^\\d+(\\.\\d+)?$/.test(strVal)) return parseFloat(strVal);
                        const cleanStr = strVal.replace(/[^0-9,.]/g, '');
                        if (cleanStr.includes(',') && cleanStr.includes('.')) {
                          const lastComma = cleanStr.lastIndexOf(',');
                          const lastDot = cleanStr.lastIndexOf('.');
                          if (lastComma > lastDot) {
                            return parseFloat(cleanStr.replace(/\\./g, '').replace(',', '.'));
                          } else {
                            return parseFloat(cleanStr.replace(/,/g, ''));
                          }
                        }
                        if (cleanStr.includes(',')) {
                          return parseFloat(cleanStr.replace(',', '.'));
                        }
                        if (cleanStr.includes('.')) {
                          if (/\\.\\d{2}$/.test(cleanStr) && cleanStr.split('.').length === 2) {
                            return parseFloat(cleanStr);
                          }
                          return parseFloat(cleanStr.replace(/\\./g, ''));
                        }
                        return parseFloat(cleanStr || '0');
                      };
                      const mercado = parseCurrency(editingImovel.valor_mercado);
                      const arremate = parseCurrency(editingImovel.estimativa_arrematacao);
                      if (mercado > 0 && arremate > 0) {
                        const lucroRs = mercado - arremate;
                        const lucroPct = (lucroRs / arremate) * 100;
                        setEditingImovel({
                          ...editingImovel,
                          lucro_estimado_rs: `R$ ${lucroRs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                          lucro_estimado_pct: `${lucroPct.toFixed(1)}%`
                        });
                      } else {
                        alert('Preencha o Valor de Mercado e a Estimativa de Arrematação com números válidos para calcular.');
                      }
                    }}
                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    Calcular Lucro
                  </button>
                </h3>
                <div>
                  <label className="block text-sm font-semibold text-blue-900 mb-1">Valor de Mercado (R$)</label>
                  <input type="text" value={editingImovel.valor_mercado || ''} onChange={(e) => setEditingImovel({...editingImovel, valor_mercado: formatCurrencyInput(e.target.value)})} className="w-full border border-blue-200 p-2.5 rounded-lg" placeholder="Ex: R$ 500.000,00" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-blue-900 mb-1">Estimativa Arrematação (R$)</label>
                  <input type="text" value={editingImovel.estimativa_arrematacao || ''} onChange={(e) => setEditingImovel({...editingImovel, estimativa_arrematacao: formatCurrencyInput(e.target.value)})} className="w-full border border-blue-200 p-2.5 rounded-lg" placeholder="Ex: R$ 250.000,00" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-blue-900 mb-1">Lucro Estimado (R$)</label>
                  <input type="text" value={editingImovel.lucro_estimado_rs || ''} onChange={(e) => setEditingImovel({...editingImovel, lucro_estimado_rs: formatCurrencyInput(e.target.value)})} className="w-full border border-blue-200 p-2.5 rounded-lg" placeholder="Ex: R$ 250.000,00" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-blue-900 mb-1">Lucro Estimado (%)</label>
                  <input type="text" value={editingImovel.lucro_estimado_pct || ''} onChange={(e) => setEditingImovel({...editingImovel, lucro_estimado_pct: e.target.value})} className="w-full border border-blue-200 p-2.5 rounded-lg" placeholder="Ex: 100%" />
                </div>
              </div>

              {/* Praças */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1">Data 1ª Praça</label>
                  <input type="text" value={editingImovel.primeira_praca_data || ''} onChange={(e) => setEditingImovel({...editingImovel, primeira_praca_data: e.target.value})} className="w-full border border-stone-300 p-2.5 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1">Valor 1ª Praça</label>
                  <input type="text" value={editingImovel.primeira_praca_valor || ''} onChange={(e) => setEditingImovel({...editingImovel, primeira_praca_valor: formatCurrencyInput(e.target.value)})} className="w-full border border-stone-300 p-2.5 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1">Data 2ª Praça</label>
                  <input type="text" value={editingImovel.segunda_praca_data || ''} onChange={(e) => setEditingImovel({...editingImovel, segunda_praca_data: e.target.value})} className="w-full border border-stone-300 p-2.5 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1">Valor 2ª Praça</label>
                  <input type="text" value={editingImovel.segunda_praca_valor || ''} onChange={(e) => setEditingImovel({...editingImovel, segunda_praca_valor: formatCurrencyInput(e.target.value)})} className="w-full border border-stone-300 p-2.5 rounded-lg" />
                </div>
              </div>

              {/* Risco Jurídico e Configurações Extras */}
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1">Risco Jurídico</label>
                  <select 
                    value={editingImovel.risco_juridico || 'A analisar'} 
                    onChange={(e) => setEditingImovel({...editingImovel, risco_juridico: e.target.value})} 
                    className="w-full border border-stone-300 p-2.5 rounded-lg bg-white"
                  >
                    <option value="A analisar">A analisar</option>
                    <option value="Baixo">Baixo</option>
                    <option value="Médio">Médio</option>
                    <option value="Alto">Alto</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1">Texto do Botão</label>
                  <input type="text" value={editingImovel.texto_botao || ''} onChange={(e) => setEditingImovel({...editingImovel, texto_botao: e.target.value})} className="w-full border border-stone-300 p-2.5 rounded-lg" placeholder="Ex: Ver Detalhes do Leilão" />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-stone-700 mb-1">WhatsApp para Assessoria (Opcional)</label>
                <input 
                  type="text" 
                  value={editingImovel.whatsapp_assessoria || ''} 
                  onChange={(e) => setEditingImovel({...editingImovel, whatsapp_assessoria: e.target.value})} 
                  className="w-full border border-stone-300 p-2.5 rounded-lg" 
                  placeholder="Ex: 5531973590970" 
                />
                <p className="text-[10px] text-stone-400 mt-1">Se vazio, usará o WhatsApp padrão do site.</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-stone-700 mb-1">Link do Leilão (Atualização Automática)</label>
                <input type="text" value={editingImovel.link_original || ''} onChange={(e) => setEditingImovel({...editingImovel, link_original: e.target.value})} className="w-full border border-stone-300 p-2.5 rounded-lg" />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-stone-700 mb-1">Link do Botão (Exibição no Card)</label>
                <input type="text" value={editingImovel.link_botao || ''} onChange={(e) => setEditingImovel({...editingImovel, link_botao: e.target.value})} className="w-full border border-stone-300 p-2.5 rounded-lg" placeholder="Se vazio, usará o Link do Leilão" />
              </div>

              
              <div className="md:col-span-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-semibold text-stone-700">Análise do especialista</label>
                  <button 
                    onClick={generateAnalysis} 
                    disabled={isGeneratingAnalysis}
                    className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-200 px-3 py-1 rounded-full font-semibold transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {isGeneratingAnalysis ? 'Gerando...' : '✨ Gerar com IA'}
                  </button>
                </div>
                <textarea 
                  className="w-full border border-stone-300 p-2.5 rounded-lg min-h-[100px]"
                  value={editingImovel.analise_especialista || ''}
                  onChange={(e) => setEditingImovel({...editingImovel, analise_especialista: e.target.value})}
                />
              </div>

              {/* Custom Titles Section */}
              <div className="md:col-span-2 mt-4 border-t pt-4">
                <h4 className="font-bold text-stone-800 mb-4">Nomenclaturas Customizadas (Opcional)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">Título: Estimativa de Mercado</label>
                    <input type="text" value={editingImovel.titulo_estimativa_mercado || ''} onChange={(e) => setEditingImovel({...editingImovel, titulo_estimativa_mercado: e.target.value})} className="w-full border border-stone-300 p-2 rounded-md text-sm" placeholder="Ex: Estimativa de Mercado" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">Título: Análise do Especialista</label>
                    <input type="text" value={editingImovel.titulo_analise_especialista || ''} onChange={(e) => setEditingImovel({...editingImovel, titulo_analise_especialista: e.target.value})} className="w-full border border-stone-300 p-2 rounded-md text-sm" placeholder="Ex: Análise do Especialista" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">Título: Avaliação</label>
                    <input type="text" value={editingImovel.titulo_avaliacao || ''} onChange={(e) => setEditingImovel({...editingImovel, titulo_avaliacao: e.target.value})} className="w-full border border-stone-300 p-2 rounded-md text-sm" placeholder="Ex: Avaliação" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">Título: Lance Mínimo</label>
                    <input type="text" value={editingImovel.titulo_lance_minimo || ''} onChange={(e) => setEditingImovel({...editingImovel, titulo_lance_minimo: e.target.value})} className="w-full border border-stone-300 p-2 rounded-md text-sm" placeholder="Ex: Lance Mínimo" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">Título: ROI Est.</label>
                    <input type="text" value={editingImovel.titulo_roi || ''} onChange={(e) => setEditingImovel({...editingImovel, titulo_roi: e.target.value})} className="w-full border border-stone-300 p-2 rounded-md text-sm" placeholder="Ex: ROI Est." />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">Título: 1ª Praça</label>
                    <input type="text" value={editingImovel.titulo_praca_1 || ''} onChange={(e) => setEditingImovel({...editingImovel, titulo_praca_1: e.target.value})} className="w-full border border-stone-300 p-2 rounded-md text-sm" placeholder="Ex: 1ª Praça" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">Título: 2ª Praça</label>
                    <input type="text" value={editingImovel.titulo_praca_2 || ''} onChange={(e) => setEditingImovel({...editingImovel, titulo_praca_2: e.target.value})} className="w-full border border-stone-300 p-2 rounded-md text-sm" placeholder="Ex: 2ª Praça" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-stone-600 mb-1">Observações Estimativa (Rodapé do quadro azul)</label>
                    <textarea value={editingImovel.titulo_observacoes_estimativa || ''} onChange={(e) => setEditingImovel({...editingImovel, titulo_observacoes_estimativa: e.target.value})} className="w-full border border-stone-300 p-2 rounded-md text-sm min-h-[60px]" placeholder="Ex: * Ainda falta analisar todos os custos da operação..." />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-8 flex gap-3 justify-end border-t pt-6">
              <button onClick={() => setEditingImovel(null)} className="border border-stone-300 text-stone-700 font-semibold px-6 py-2.5 rounded-xl hover:bg-stone-50 transition-colors">Cancelar</button>
              <button onClick={() => handleUpdate(editingImovel)} className="bg-primary text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-primary-dark transition-colors shadow-sm">Salvar Alterações</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex items-center gap-3 text-red-600 mb-4">
                <div className="p-2 bg-red-100 rounded-full">
                  <AlertCircle size={24} />
                </div>
                <h3 className="text-xl font-bold">Confirmar Exclusão</h3>
              </div>
              <p className="text-stone-600 mb-6">
                Tem certeza que deseja excluir este imóvel? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-3 px-4 bg-stone-100 text-stone-600 font-bold rounded-xl hover:bg-stone-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={async () => {
                    setIsDeleting(true);
                    await handleDelete(showDeleteConfirm);
                    setIsDeleting(false);
                    setShowDeleteConfirm(null);
                  }}
                  disabled={isDeleting}
                  className="flex-1 py-3 px-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
