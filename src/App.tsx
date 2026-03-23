/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { CardImovel } from './components/CardImovel';
import { Layout } from './components/Layout';
import { motion } from 'motion/react';
import { Heart } from 'lucide-react';
import Sobre from './Sobre';
import FAQ from './FAQ';
import AdminSettings from './AdminSettings';
import BlogList from './BlogList';
import BlogPost from './BlogPost';
import AdminBlog from './AdminBlog';
import { BlogCard } from './components/BlogCard';
import { db, auth } from './firebase';
import { collection, addDoc, updateDoc, doc, onSnapshot, getDocs, deleteDoc, query, limit, orderBy, getDocFromServer, where, setDoc } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { GoogleGenAI, Type } from "@google/genai";

const ADMIN_EMAIL = 'tjinvestoficial@gmail.com';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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
  const [featuredPosts, setFeaturedPosts] = useState<any[]>([]);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingImovel, setEditingImovel] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
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
  });

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

    return () => {
      unsub();
      unsubHeader();
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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'testimonials');
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
      const now = Date.now();
      const lastUpdate = settings.lastTickerUpdate || 0;
      const intervalMs = (parseInt(settings.tickerUpdateInterval || '60')) * 60 * 1000;

      if (now - lastUpdate > intervalMs) {
        console.log('Atualizando ticker via IA...');
        try {
          const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
          if (!apiKey) return;

          const ai = new GoogleGenAI({ apiKey });
          const prompt = settings.tickerPrompt || 'Gere 10 itens para uma barra de cotações de leilões de imóveis. Misture notícias curtas com notícias mais detalhadas (acima de 20 palavras). Inclua SELIC, IPCA, Dólar, Euro e novidades do mercado. Use um tom profissional.';
          
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
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

          const tickerItems = JSON.parse(response.text);
          await updateDoc(doc(db, 'settings', 'site'), {
            tickerItems,
            lastTickerUpdate: now
          });
          console.log('Ticker updated successfully!');
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, 'settings/site');
        }
      }
    };

    updateTicker();
    const interval = setInterval(updateTicker, 5 * 60 * 1000); // Verifica a cada 5 min
    return () => clearInterval(interval);
  }, [isSettingsLoading, settings.showTicker, settings.tickerUpdateInterval, settings.lastTickerUpdate, user?.email]);

  useEffect(() => {
    if (settings.testimonialStyle === 'carousel' && testimonials.length > 0) {
      const interval = setInterval(() => {
        if (carouselRef.current) {
          const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
          if (scrollLeft + clientWidth >= scrollWidth - 10) {
            carouselRef.current.scrollTo({ left: 0, behavior: 'smooth' });
          } else {
            carouselRef.current.scrollBy({ left: 300, behavior: 'smooth' });
          }
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [settings.testimonialStyle, testimonials]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        console.log('Login cancelado pelo usuário.');
      } else {
        console.error('Erro no login:', error);
        alert('Erro ao realizar login. Tente novamente.');
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const handleScrape = async () => {
    console.log('handleScrape chamado. Usuário:', user?.email);
    if (!(user?.email === ADMIN_EMAIL)) {
      console.log('Acesso negado. Usuário não é admin.');
      return;
    }
    setIsProcessing(true);
    try {
      console.log('Iniciando fetch para:', `${window.location.origin}/api/scrape`);
      const response = await fetch(`${window.location.origin}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      console.log('Fetch concluído. Status:', response.status);
      const result = await response.json();
      console.log('Scrape result:', result);
      if (result.success) {
        const imovelData = result.data.data || result.data;
        console.log('Adding to Firestore:', imovelData);
        await addDoc(collection(db, 'imoveis'), {
          ...imovelData
        });
        console.log('Successfully added to Firestore');
        setUrl(''); // Clear input
      } else if (result.loginRequired) {
        alert('Login necessário! Clique no link abaixo para logar.');
        window.open(result.loginUrl, '_blank');
      } else {
        alert('Erro ao realizar o scrape.');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'imoveis');
    } finally {
      setIsProcessing(false);
    }
  };

  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);

  const generateAnalysis = async () => {
    if (!editingImovel) return;
    setIsGeneratingAnalysis(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        throw new Error("Chave de API do Gemini não encontrada. Verifique se ela está configurada no menu 'Secrets'.");
      }
      
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Você é um especialista em leilões de imóveis da TJ Invest. 
Analise os dados do imóvel abaixo e escreva uma análise persuasiva, profissional e técnica para um investidor. 
Destaque os pontos positivos (localização, potencial de valorização, desconto em relação ao mercado) e mencione brevemente os cuidados necessários.

Use uma formatação agradável:
- Use marcadores (•) para listas.
- Use negrito (**) para termos importantes.
- Use emojis de forma moderada (máximo 3 em todo o texto).
- Divida em parágrafos curtos.
- O tom deve ser de um consultor sênior falando com um cliente VIP.

Dados do imóvel:
${JSON.stringify(editingImovel, null, 2)}

Retorne apenas o texto da análise.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setEditingImovel({ ...editingImovel, analise_especialista: response.text });
    } catch (error: any) {
      console.error("Erro ao gerar análise:", error);
      alert(`Erro ao gerar análise com IA: ${error?.message || 'Erro desconhecido'}`);
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

  const handleManualUpdate = async (id: string, url: string) => {
    if (!isAdmin) return;
    setIsProcessing(true);
    try {
      const response = await fetch(`${window.location.origin}/api/update-property`, {
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

  const isAdmin = user?.email === ADMIN_EMAIL;

  const [currentPage, setCurrentPage] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => setCurrentPage(window.location.pathname);
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPage(path);
    window.scrollTo(0, 0);
  };

  if (isSettingsLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-stone-500 font-medium animate-pulse">Carregando TJ INVEST...</p>
        </div>
      </div>
    );
  }

  // ... (dentro do return)
  return (
    <Layout user={user} onLogin={handleLogin} onLogout={handleLogout} onNavigate={navigate} settings={settings}>
      {currentPage === '/' && (
        <>
          {isAdmin && (
            <div className="mb-8 p-6 bg-white rounded-xl shadow-sm border border-stone-100">
              <h2 className="text-xl font-bold mb-4">Painel de Administração</h2>
              <div className="flex flex-col md:flex-row gap-4">
                <input 
                  type="text" 
                  value={url} 
                  onChange={(e) => setUrl(e.target.value)} 
                  placeholder="Cole o link do leilão" 
                  className="border p-2 rounded w-full"
                />
                <button 
                  onClick={handleScrape} 
                  disabled={isProcessing}
                  className={`bg-blue-600 text-white px-6 py-2 rounded font-semibold whitespace-nowrap ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isProcessing ? 'Processando...' : 'Fazer Scrape'}
                </button>
              </div>
            </div>
          )}
          
          <div className="mb-8 bg-white p-6 rounded-xl shadow-sm border border-stone-100 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-stone-100 animate-pulse h-96 rounded-2xl"></div>
              ))
            ) : (imoveisFiltrados && imoveisFiltrados.length > 0) ? (
              imoveisFiltrados.map((imovel, index) => (
                <motion.div 
                  key={imovel.id} 
                  className="relative"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <CardImovel 
                    imovel={imovel} 
                    showRoi={settings.showRoiCalculator !== false} 
                    isFavorite={favorites.includes(imovel.id)}
                    onToggleFavorite={() => handleToggleFavorite(imovel.id)}
                  />
                  {isAdmin && (
                    <div className="mt-2 flex gap-3 text-sm">
                      <button onClick={() => setEditingImovel(imovel)} className="text-blue-600 font-medium hover:underline">Editar</button>
                      <button 
                        onClick={() => handleManualUpdate(imovel.id, imovel.link_original)} 
                        disabled={isProcessing}
                        className={`text-primary font-medium hover:underline ${isProcessing ? 'opacity-50' : ''}`}
                      >
                        {isProcessing ? '...' : 'Atualizar'}
                      </button>
                      <button onClick={() => handleDelete(imovel.id)} className="text-red-600 font-medium hover:underline">Excluir</button>
                    </div>
                  )}
                </motion.div>
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-stone-500">
                Nenhum imóvel encontrado com os filtros selecionados.
              </div>
            )}
          </div>

          {settings.showTestimonials !== false && testimonials.length > 0 && (
            <div className="mt-24 mb-12">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-stone-900 mb-4">O que dizem nossos clientes</h2>
                <div className="w-20 h-1 bg-primary mx-auto rounded-full"></div>
              </div>

              {settings.testimonialStyle === 'carousel' ? (
                <div ref={carouselRef} className="flex overflow-x-auto gap-6 pb-8 snap-x no-scrollbar scroll-smooth">
                  {testimonials.map((t, i) => (
                    <motion.div 
                      key={t.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      className="min-w-[300px] md:min-w-[400px] snap-center bg-white p-8 rounded-2xl shadow-sm border border-stone-100 flex flex-col hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-4 mb-6">
                        {t.photoUrl ? (
                          <img src={t.photoUrl} alt={t.name} className="w-14 h-14 rounded-full object-cover border-2 border-primary/10" referrerPolicy="no-referrer" />
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
                    </motion.div>
                  ))}
                </div>
              ) : settings.testimonialStyle === 'marquee' ? (
                <div className="relative overflow-hidden py-4">
                  <div className="flex gap-6 animate-marquee whitespace-nowrap">
                    {[...testimonials, ...testimonials].map((t, i) => (
                      <div 
                        key={`${t.id}-${i}`}
                        className="inline-block w-[300px] md:w-[350px] bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex flex-col shrink-0"
                      >
                        <div className="flex items-center gap-3 mb-4">
                          {t.photoUrl ? (
                            <img src={t.photoUrl} alt={t.name} className="w-10 h-10 rounded-full object-cover border border-stone-100" referrerPolicy="no-referrer" />
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
                    <motion.div 
                      key={t.id}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex gap-6 items-start hover:shadow-md transition-shadow"
                    >
                      {t.photoUrl ? (
                        <img src={t.photoUrl} alt={t.name} className="w-16 h-16 rounded-full object-cover border border-stone-100 shrink-0" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 font-bold text-2xl shrink-0">
                          {t.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-bold text-stone-900 text-lg">{t.name}</p>
                          <span className="text-xs text-stone-400 font-medium px-2 py-0.5 bg-stone-50 rounded-full">{t.role}</span>
                          <div className="flex text-amber-400 text-xs">
                            {"★".repeat(t.rating || 5)}{"☆".repeat(5 - (t.rating || 5))}
                          </div>
                        </div>
                        <p className="text-stone-600 leading-relaxed italic">"{t.text}"</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : settings.testimonialStyle === 'cards' ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {testimonials.map((t, i) => (
                    <motion.div 
                      key={t.id}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.05 }}
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
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {testimonials.map((t, i) => (
                    <motion.div 
                      key={t.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex flex-col hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-4 mb-4">
                        {t.photoUrl ? (
                          <img src={t.photoUrl} alt={t.name} className="w-12 h-12 rounded-full object-cover border border-stone-100" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 font-bold">
                            {t.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-stone-900 leading-tight">{t.name}</p>
                          <div className="flex text-amber-400 text-xs mt-0.5">
                            {"★".repeat(t.rating || 5)}{"☆".repeat(5 - (t.rating || 5))}
                          </div>
                        </div>
                      </div>
                      <p className="text-stone-600 text-sm leading-relaxed mb-4 flex-grow italic">"{t.text}"</p>
                      <div className="pt-4 border-t border-stone-50">
                        <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">{t.role}</p>
                      </div>
                    </motion.div>
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
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <BlogCard post={post} onNavigate={navigate} />
                  </motion.div>
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
      {currentPage === '/admin' && <AdminSettings onNavigate={navigate} />}
      {currentPage === '/admin/blog' && <AdminBlog />}
      
      {editingImovel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
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
                      const parseCurrency = (val: any) => parseFloat(String(val || '0').replace(/[^0-9,]/g, '').replace(',', '.') || '0');
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
                <label className="block text-sm font-semibold text-stone-700 mb-1">Análise do Especialista</label>
                <textarea 
                  value={editingImovel.analise_especialista || ''} 
                  onChange={(e) => setEditingImovel({...editingImovel, analise_especialista: e.target.value})} 
                  className="w-full border border-stone-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                  rows={4}
                  placeholder="Descreva os pontos positivos e negativos do imóvel..."
                />
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
                <label className="block text-sm font-semibold text-stone-700 mb-1">Link do Leilão</label>
                <input type="text" value={editingImovel.link_original || ''} onChange={(e) => setEditingImovel({...editingImovel, link_original: e.target.value})} className="w-full border border-stone-300 p-2.5 rounded-lg" />
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
        </div>
      )}
    </Layout>
  );
}
