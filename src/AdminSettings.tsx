import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { db, auth } from './firebase';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, 
  Image as ImageIcon, 
  MessageSquare, 
  Users, 
  BarChart, 
  Globe, 
  Share2, 
  Shield, 
  Save, 
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Sparkles,
  Zap,
  Layout as LayoutIcon,
  Search,
  Wand2
} from 'lucide-react';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

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

export default function AdminSettings({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [settings, setSettings] = useState({ 
    siteTitle: 'TJ INVEST - Leilões de Imóveis',
    siteDescription: 'Especialistas em leilões de imóveis com segurança e rentabilidade.',
    address: '', 
    email: '', 
    phone: '', 
    aboutText: '', 
    updateInterval: '1',
    logoUrl: 'https://i.postimg.cc/14q5TzRL/logo.png',
    hideLogoTop: false,
    hideLogoFooter: false,
    themePalette: 'emerald',
    headerStyle: 'light',
    backgroundStyle: 'light',
    typography: 'default',
    instagram: '',
    facebook: '',
    linkedin: '',
    showRoiCalculator: true,
    showTicker: true,
    showTestimonials: true,
    testimonialStyle: 'grid',
    tickerUpdateInterval: '60',
    tickerPrompt: 'Gere 10 itens para uma barra de cotações de leilões de imóveis. Misture notícias curtas com notícias mais detalhadas (acima de 20 palavras). Inclua variações de SELIC, IPCA, Dólar, Euro e novidades do mercado de leilões no Brasil. Use um tom profissional. IMPORTANTE: TODAS AS RESPOSTAS DEVEM SER EM PORTUGUÊS DO BRASIL.',
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
    showFaqs: true,
    scoreWeightRoi: 40,
    scoreWeightDiscount: 30,
    scoreWeightLiquidity: 15,
    scoreWeightRisk: 15,
  });
  const [faqs, setFaqs] = useState<any[]>([]);
  const [newFaq, setNewFaq] = useState({ question: '', answer: '' });
  const [editingFaq, setEditingFaq] = useState<any>(null);

  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [newTestimonial, setNewTestimonial] = useState({ name: '', text: '', role: 'Investidor', rating: 5, photoUrl: '' });
  const [editingTestimonial, setEditingTestimonial] = useState<any>(null);

  const [isGeneratingHeader, setIsGeneratingHeader] = useState(false);
  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [leiloeiros, setLeiloeiros] = useState<any[]>([]);
  const [newLeiloeiro, setNewLeiloeiro] = useState({ nome: '', url: '' });
  const [editingLeiloeiro, setEditingLeiloeiro] = useState<any>(null);
  const [headerPrompt, setHeaderPrompt] = useState('Escritório de luxo moderno, tons de esmeralda e dourado, minimalista, profissional, mercado imobiliário');

  const compressImage = (base64Str: string, maxWidth = 1200, maxHeight = 675, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    });
  };

  const generateHeaderImage = async () => {
    try {
      setIsGeneratingHeader(true);
      
      // Check for API key selection if using advanced models
      if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
        await window.aistudio.openSelectKey();
      }

      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Chave de API não encontrada.");
      
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: {
          parts: [
            { text: `Crie uma imagem de fundo para o topo de um site de leilões de imóveis de luxo. Estilo: ${headerPrompt}. A imagem deve ser elegante, profissional e ter espaço para texto por cima. Formato horizontal.` },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "1K"
          },
        },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64Data = part.inlineData.data;
          const rawImageUrl = `data:image/png;base64,${base64Data}`;
          const compressedUrl = await compressImage(rawImageUrl);
          setSettings(prev => ({ ...prev, headerBackgroundImage: compressedUrl }));
          break;
        }
      }
    } catch (error: any) {
      console.error("Erro ao gerar imagem:", error);
      
      let errorMessage = "Erro ao gerar imagem com IA. Tente novamente.";
      
      if (error.message?.includes("RESOURCE_EXHAUSTED") || error.status === "RESOURCE_EXHAUSTED" || error.code === 429) {
        errorMessage = "Cota de geração de imagem esgotada para este projeto. Por favor, selecione uma chave de API com faturamento ativo para continuar.";
        if (window.aistudio) {
          window.aistudio.openSelectKey();
        }
      }
      
      alert(errorMessage);
    } finally {
      setIsGeneratingHeader(false);
    }
  };

  const seedTestimonials = async () => {
    const samples = [
      { name: "Ricardo Santos", role: "Investidor Imobiliário", rating: 5, text: "A assessoria da TJ INVEST foi fundamental para meu primeiro arremate em São Paulo. Transparência total e análise jurídica impecável.", photoUrl: "https://i.pravatar.cc/150?u=ricardo" },
      { name: "Mariana Oliveira", role: "Médica", rating: 5, text: "Sempre tive medo de leilões, mas com o suporte deles arrematei um apartamento no Rio com 45% de desconto. Recomendo muito!", photoUrl: "https://i.pravatar.cc/150?u=mariana" },
      { name: "Carlos Eduardo", role: "Empresário", rating: 5, text: "Já arrematei 3 imóveis com a equipe. A agilidade no processo de desocupação é o grande diferencial deles.", photoUrl: "https://i.pravatar.cc/150?u=carlos" },
      { name: "Fernanda Lima", role: "Advogada", rating: 5, text: "Como advogada, sou exigente com a documentação. A TJ INVEST superou minhas expectativas na análise de riscos.", photoUrl: "https://i.pravatar.cc/150?u=fernanda" },
      { name: "João Pedro", role: "Aposentado", rating: 4, text: "Excelente atendimento. Me ajudaram a diversificar meu patrimônio com segurança em leilões judiciais.", photoUrl: "https://i.pravatar.cc/150?u=joao" },
      { name: "Beatriz Costa", role: "Arquiteta", rating: 5, text: "O simulador de ROI deles é muito preciso. Arrematei, reformei e vendi com o lucro exatamente como previsto.", photoUrl: "https://i.pravatar.cc/150?u=beatriz" },
      { name: "Sérgio Mendes", role: "Investidor", rating: 5, text: "Melhor assessoria do Brasil. Atendimento personalizado e conhecimento profundo do mercado de leilões da Caixa.", photoUrl: "https://i.pravatar.cc/150?u=sergio" },
      { name: "Patrícia Souza", role: "Funcionária Pública", rating: 5, text: "Consegui minha casa própria através de um leilão extrajudicial com a ajuda da TJ. Gratidão eterna à equipe!", photoUrl: "https://i.pravatar.cc/150?u=patricia" },
      { name: "Roberto Alves", role: "Comerciante", rating: 5, text: "O acompanhamento pós-leilão é o que faz a diferença. Não te deixam na mão em nenhuma etapa.", photoUrl: "https://i.pravatar.cc/150?u=roberto" },
      { name: "Camila Rocha", role: "Investidora", rating: 5, text: "Eficiência e segurança. Arrematei um terreno em Curitiba e todo o processo foi muito mais simples do que eu imaginava.", photoUrl: "https://i.pravatar.cc/150?u=camila" }
    ];

    try {
      for (const sample of samples) {
        await addDoc(collection(db, 'testimonials'), sample);
      }
      alert('10 depoimentos de exemplo foram gerados com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'testimonials/seed');
    }
  };

  const regenerateText = async (id: string, currentName: string, currentRole: string) => {
    try {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Chave de API não encontrada. Verifique as configurações de Secrets.");
      }
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Gere um depoimento curto e convincente (máximo 200 caracteres) em português do Brasil para um site de assessoria em leilões de imóveis. O nome do cliente é ${currentName} e seu papel é ${currentRole}. O tom deve ser profissional e de satisfação com o lucro obtido. IMPORTANTE: A RESPOSTA DEVE SER EXCLUSIVAMENTE EM PORTUGUÊS DO BRASIL.`,
      });
      const newText = response.text.trim().replace(/^"|"$/g, '');
      
      if (editingTestimonial?.id === id) {
        setEditingTestimonial({ ...editingTestimonial, text: newText });
      } else {
        await updateDoc(doc(db, 'testimonials', id), { text: newText });
      }
    } catch (error) {
      console.error("Erro ao regerar texto:", error);
      alert("Erro ao regerar texto com IA.");
    }
  };

  const regeneratePhoto = async (id: string) => {
    const newPhoto = `https://i.pravatar.cc/150?u=${Math.random()}`;
    if (editingTestimonial?.id === id) {
      setEditingTestimonial({ ...editingTestimonial, photoUrl: newPhoto });
    } else {
      await updateDoc(doc(db, 'testimonials', id), { photoUrl: newPhoto });
    }
  };

  const saveAllTestimonials = async () => {
    try {
      const batch = writeBatch(db);
      // This is a bit tricky since we don't have a local "dirty" state for all testimonials
      // unless we change how we manage them. 
      // For now, I'll just show a message or implement a simple version if I change the state.
      // Let's stick to individual saves for now as requested, but I'll add a "Salvar Todos" 
      // that could be useful if we had a bulk edit mode.
      alert("Os depoimentos são salvos individualmente ou automaticamente ao editar.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'testimonials/bulk');
    }
  };

  useEffect(() => {
    const unsubSite = onSnapshot(doc(db, 'settings', 'site'), (docSnap) => {
      if (docSnap.exists()) setSettings(prev => ({ ...prev, ...docSnap.data() }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/site');
    });
    const unsubHeader = onSnapshot(doc(db, 'settings', 'header'), (docSnap) => {
      if (docSnap.exists()) setSettings(prev => ({ ...prev, headerBackgroundImage: docSnap.data().headerBackgroundImage }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/header');
    });
    const unsubAssets = onSnapshot(doc(db, 'settings', 'assets'), (docSnap) => {
      if (docSnap.exists()) setSettings(prev => ({ ...prev, ...docSnap.data() }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/assets');
    });
    const unsubFaqs = onSnapshot(collection(db, 'faqs'), (snapshot) => {
      setFaqs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'faqs');
    });
    const unsubTestimonials = onSnapshot(collection(db, 'testimonials'), (snapshot) => {
      setTestimonials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'testimonials');
    });
    const unsubLeiloeiros = onSnapshot(collection(db, 'leiloeiros'), (snapshot) => {
      setLeiloeiros(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leiloeiros');
    });
    return () => {
      unsubSite();
      unsubHeader();
      unsubAssets();
      unsubFaqs();
      unsubTestimonials();
      unsubLeiloeiros();
    };
  }, []);

  const generateKeywords = async () => {
    try {
      setIsGeneratingKeywords(true);
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Chave de API não encontrada.");
      
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Gere uma lista de 30 a 40 palavras-chave de SEO altamente relevantes e estratégicas para um site de assessoria em leilões de imóveis chamado "${settings.siteTitle}". 
        Descrição do site: "${settings.siteDescription}". 
        Inclua termos como "leilão de imóveis", "arrematação", "investimento imobiliário", "leilão judicial", "leilão extrajudicial", "oportunidade", "lucratividade", "segurança jurídica", e variações regionais ou específicas do nicho.
        IMPORTANTE: AS PALAVRAS-CHAVE DEVEM SER EM PORTUGUÊS DO BRASIL.
        Retorne APENAS as palavras-chave separadas por vírgula, em uma única linha, sem numeração, sem explicações e sem introduções.`,
      });
      
      const keywords = response.text.trim().replace(/^"|"$/g, '').replace(/\n/g, ' ').replace(/\s+/g, ' ');
      setSettings(prev => ({ ...prev, seoKeywords: keywords }));
      alert('Palavras-chave geradas com sucesso! Não esqueça de salvar as alterações.');
    } catch (error) {
      console.error("Erro ao gerar palavras-chave:", error);
      alert("Erro ao gerar palavras-chave com IA. Verifique sua conexão ou chave de API.");
    } finally {
      setIsGeneratingKeywords(false);
    }
  };

  const saveSettings = async () => {
    try {
      setIsSaving(true);
      console.log("Iniciando salvamento das configurações...");
      
      // Filter out any undefined values that might cause Firestore to fail
      const cleanSettings = Object.fromEntries(
        Object.entries(settings).filter(([_, v]) => v !== undefined)
      );
      
      // Extrair campos pesados para documentos separados
      const { 
        headerBackgroundImage, 
        logoUrl, 
        faviconUrl, 
        ogImage, 
        ...otherSettings 
      } = cleanSettings;
      
      // Save main settings (excluding the heavy assets)
      await setDoc(doc(db, 'settings', 'site'), otherSettings, { merge: true });
      console.log("Configurações gerais salvas.");
      
      // Salvar imagem de fundo separadamente
      if (headerBackgroundImage !== undefined) {
        await setDoc(doc(db, 'settings', 'header'), { 
          headerBackgroundImage: headerBackgroundImage || '' 
        }, { merge: true });
        console.log("Configurações de header salvas.");
      }

      // Salvar outros assets pesados separadamente
      const assets: any = {};
      if (logoUrl !== undefined) assets.logoUrl = logoUrl || '';
      if (faviconUrl !== undefined) assets.faviconUrl = faviconUrl || '';
      if (ogImage !== undefined) assets.ogImage = ogImage || '';

      if (Object.keys(assets).length > 0) {
        await setDoc(doc(db, 'settings', 'assets'), assets, { merge: true });
        console.log("Assets (Logo/Favicon/OG) salvos separadamente.");
      }
      
      alert('Configurações salvas com sucesso!');
    } catch (error: any) {
      console.error("Erro detalhado ao salvar:", error);
      if (error.message?.includes('permission-denied')) {
        alert('Erro de permissão: Você precisa estar logado como administrador (tjinvestoficial@gmail.com) para salvar.');
      } else {
        handleFirestoreError(error, OperationType.WRITE, 'settings/site');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const addFaq = async () => {
    try {
      await addDoc(collection(db, 'faqs'), newFaq);
      setNewFaq({ question: '', answer: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'faqs');
    }
  };

  const deleteFaq = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'faqs', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'faqs/' + id);
    }
  };

  const saveFaq = async (id: string, question: string, answer: string) => {
    try {
      await updateDoc(doc(db, 'faqs', id), { question, answer });
      setEditingFaq(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'faqs/' + id);
    }
  };

  const addLeiloeiro = async () => {
    if (!newLeiloeiro.nome || !newLeiloeiro.url) return;
    try {
      await addDoc(collection(db, 'leiloeiros'), newLeiloeiro);
      setNewLeiloeiro({ nome: '', url: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'leiloeiros');
    }
  };

  const deleteLeiloeiro = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'leiloeiros', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'leiloeiros/' + id);
    }
  };

  const saveLeiloeiro = async (id: string, nome: string, url: string) => {
    try {
      await updateDoc(doc(db, 'leiloeiros', id), { nome, url });
      setEditingLeiloeiro(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'leiloeiros/' + id);
    }
  };

  const importLeiloeiros = async () => {
    const { LEILOEIROS_CONFIAVEIS } = await import('./constants/leiloeiros');
    try {
      const batch = writeBatch(db);
      LEILOEIROS_CONFIAVEIS.forEach((l) => {
        const newDocRef = doc(collection(db, 'leiloeiros'));
        batch.set(newDocRef, l);
      });
      await batch.commit();
      alert('Leiloeiros importados com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'leiloeiros/import');
    }
  };

  return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Painel Administrativo</h1>
          <div className="flex gap-3">
            <button 
              onClick={() => onNavigate('/admin/blog')}
              className="bg-stone-900 text-white px-6 py-2 rounded-xl font-bold hover:bg-black transition-all flex items-center gap-2 shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 2v4h4" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h10M7 16h10" />
              </svg>
              Gerenciar Blog
            </button>
            <button onClick={() => onNavigate('/')} className="bg-stone-100 text-stone-600 px-6 py-2 rounded-xl font-bold hover:bg-stone-200 transition-all">Voltar ao Início</button>
          </div>
        </div>

        <div className="flex gap-4 mb-8 border-b border-stone-200 pb-4 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition-colors ${activeTab === 'general' ? 'bg-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          >
            Configurações Gerais
          </button>
          <button 
            onClick={() => setActiveTab('testimonials')}
            className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition-colors ${activeTab === 'testimonials' ? 'bg-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          >
            Depoimentos
          </button>
          <button 
            onClick={() => setActiveTab('faqs')}
            className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition-colors ${activeTab === 'faqs' ? 'bg-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          >
            Perguntas Frequentes
          </button>
          <button 
            onClick={() => setActiveTab('score')}
            className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition-colors ${activeTab === 'score' ? 'bg-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          >
            Configurar Score
          </button>
          <button 
            onClick={() => setActiveTab('leiloeiros')}
            className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition-colors ${activeTab === 'leiloeiros' ? 'bg-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          >
            Leiloeiros
          </button>
        </div>
        
        {activeTab === 'general' && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-stone-100 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Configurações Gerais</h2>
            <button onClick={saveSettings} className="bg-primary text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-primary-dark transition-colors shadow-sm">Salvar Seção</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">Título do Site</label>
              <input className="w-full border p-2 rounded" placeholder="Título do Site" value={settings.siteTitle} onChange={e => setSettings({...settings, siteTitle: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">Descrição do Site (SEO)</label>
              <input className="w-full border p-2 rounded" placeholder="Descrição curta" value={settings.siteDescription} onChange={e => setSettings({...settings, siteDescription: e.target.value})} />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">Endereço</label>
              <input className="w-full border p-2 rounded" placeholder="Endereço" value={settings.address} onChange={e => setSettings({...settings, address: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">Email de Contato</label>
              <input className="w-full border p-2 rounded" placeholder="Email" value={settings.email} onChange={e => setSettings({...settings, email: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">WhatsApp (com DDD)</label>
              <input className="w-full border p-2 rounded" placeholder="Ex: 5531973590970" value={settings.phone} onChange={e => setSettings({...settings, phone: e.target.value})} />
            </div>
          </div>

          <label className="block text-xs font-semibold text-stone-600 mb-1">Texto "Sobre Nós"</label>
          <textarea className="w-full border p-2 mb-4 rounded" placeholder="Sobre" value={settings.aboutText} onChange={e => setSettings({...settings, aboutText: e.target.value})} rows={5} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-2">Atualização Automática (Scraping)</label>
              <select 
                className="w-full border p-2 rounded-lg bg-stone-50" 
                value={settings.updateInterval || '1'} 
                onChange={e => setSettings({...settings, updateInterval: e.target.value})}
              >
                <option value="1">A cada 1 hora</option>
                <option value="4">A cada 4 horas</option>
                <option value="12">A cada 12 horas</option>
                <option value="24">A cada 24 horas</option>
              </select>
              <p className="text-xs text-stone-500 mt-1">Frequência de busca por novos leilões.</p>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-2">Recursos Ativos</label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={settings.showRoiCalculator !== false} 
                    onChange={e => setSettings({...settings, showRoiCalculator: e.target.checked})}
                    className="rounded border-stone-300 text-primary focus:ring-primary"
                  />
                  Calculadora de ROI nos Cards
                </label>
                <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={settings.showTicker !== false} 
                    onChange={e => setSettings({...settings, showTicker: e.target.checked})}
                    className="rounded border-stone-300 text-primary focus:ring-primary"
                  />
                  Barra de Cotações (Ticker)
                </label>
                <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={settings.showTestimonials !== false} 
                    onChange={e => setSettings({...settings, showTestimonials: e.target.checked})}
                    className="rounded border-stone-300 text-primary focus:ring-primary"
                  />
                  Seção de Depoimentos
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-2">Estilo dos Depoimentos</label>
              <select 
                className="w-full border p-2 rounded-lg bg-stone-50" 
                value={settings.testimonialStyle || 'grid'} 
                onChange={e => setSettings({...settings, testimonialStyle: e.target.value})}
              >
                <option value="grid">Grade (3 colunas)</option>
                <option value="carousel">Carrossel (Slide)</option>
                <option value="marquee">Fluxo Contínuo (Marquee)</option>
                <option value="list">Lista Vertical</option>
                <option value="cards">Cards Minimalistas</option>
              </select>
              <p className="text-xs text-stone-500 mt-1">Como os depoimentos aparecem no site.</p>
            </div>
          </div>

          <div className="mb-6 border-t pt-4">
            <h3 className="font-bold text-stone-800 mb-4">Imagem de Fundo do Topo (IA)</h3>
            <div className="bg-stone-50 p-4 rounded-xl border border-stone-100 mb-4">
              <p className="text-xs text-stone-500 mb-3">Gere uma imagem exclusiva para o fundo do seu menu usando Inteligência Artificial.</p>
              <div className="flex flex-col gap-3">
                <input 
                  className="w-full border p-2 rounded text-sm" 
                  placeholder="Descreva o estilo da imagem (ex: Prédios modernos ao pôr do sol)" 
                  value={headerPrompt} 
                  onChange={e => setHeaderPrompt(e.target.value)} 
                />
                <div className="flex gap-2">
                  <button 
                    onClick={generateHeaderImage} 
                    disabled={isGeneratingHeader}
                    className={`flex-1 bg-amber-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-amber-600 transition-all flex items-center justify-center gap-2 ${isGeneratingHeader ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isGeneratingHeader ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        Gerando...
                      </>
                    ) : (
                      <>✨ Gerar Imagem com IA</>
                    )}
                  </button>
                  {settings.headerBackgroundImage && (
                    <button 
                      onClick={() => setSettings({...settings, headerBackgroundImage: ''})}
                      className="bg-stone-200 text-stone-600 px-4 py-2 rounded-lg font-bold hover:bg-stone-300 transition-all"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
              
              {settings.headerBackgroundImage && (
                <div className="mt-4">
                  <label className="block text-xs font-semibold text-stone-600 mb-2">Prévia e Opacidade do Overlay</label>
                  <div className="relative h-24 rounded-lg overflow-hidden border mb-3">
                    <img src={settings.headerBackgroundImage} className="w-full h-full object-cover" alt="Header Preview" />
                    <div 
                      className="absolute inset-0 bg-black" 
                      style={{ opacity: settings.headerOverlayOpacity }}
                    ></div>
                    <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-xs">
                      TEXTO DO MENU
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.1" 
                      className="flex-1"
                      value={settings.headerOverlayOpacity || 0.5} 
                      onChange={e => setSettings({...settings, headerOverlayOpacity: parseFloat(e.target.value)})} 
                    />
                    <span className="text-xs font-bold text-stone-600">{Math.round((settings.headerOverlayOpacity || 0.5) * 100)}% Escurecimento</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mb-6 border-t pt-4">
            <h3 className="font-bold text-stone-800 mb-4">SEO & Identidade Visual</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1 flex justify-between">
                  Palavras-chave SEO (separadas por vírgula)
                  <button 
                    onClick={generateKeywords}
                    disabled={isGeneratingKeywords}
                    className="text-primary hover:text-primary-dark flex items-center gap-1 text-[10px] font-bold uppercase transition-colors disabled:opacity-50"
                  >
                    {isGeneratingKeywords ? 'Gerando...' : <><Wand2 size={10} /> Gerar com IA</>}
                  </button>
                </label>
                <textarea 
                  className="w-full border p-2 rounded text-sm" 
                  placeholder="leilão, imóveis, investimento, arremate" 
                  value={settings.seoKeywords || ''} 
                  onChange={e => setSettings({...settings, seoKeywords: e.target.value})}
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">URL Canônica</label>
                <input className="w-full border p-2 rounded" placeholder="https://seusite.com.br" value={settings.canonicalUrl || ''} onChange={e => setSettings({...settings, canonicalUrl: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Google Analytics ID (G-XXXXXXX)</label>
                <input className="w-full border p-2 rounded" placeholder="G-XXXXXXXXXX" value={settings.googleAnalyticsId || ''} onChange={e => setSettings({...settings, googleAnalyticsId: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Google Tag Manager ID (GTM-XXXXXXX)</label>
                <input className="w-full border p-2 rounded" placeholder="GTM-XXXXXXXXXX" value={settings.googleTagManagerId || ''} onChange={e => setSettings({...settings, googleTagManagerId: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Twitter Handle (@usuario)</label>
                <input className="w-full border p-2 rounded" placeholder="@tjinvest" value={settings.twitterHandle || ''} onChange={e => setSettings({...settings, twitterHandle: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Robots Meta Tag (Indexação)</label>
                <select className="w-full border p-2 rounded" value={settings.robotsPolicy || 'index, follow'} onChange={e => setSettings({...settings, robotsPolicy: e.target.value})}>
                  <option value="index, follow">Indexar e Seguir (Padrão)</option>
                  <option value="noindex, follow">Não Indexar, mas Seguir Links</option>
                  <option value="noindex, nofollow">Não Indexar e Não Seguir</option>
                </select>
              </div>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <h4 className="text-sm font-bold text-blue-800 mb-2">Arquivos Gerados Automaticamente:</h4>
              <div className="flex gap-4 text-xs font-medium">
                <a href="/sitemap.xml" target="_blank" className="text-blue-600 hover:underline flex items-center gap-1">
                  📄 sitemap.xml
                </a>
                <a href="/robots.txt" target="_blank" className="text-blue-600 hover:underline flex items-center gap-1">
                  🤖 robots.txt
                </a>
              </div>
              <p className="text-[10px] text-blue-600 mt-2">Estes arquivos são gerados dinamicamente com base nas suas configurações e imóveis ativos.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-2">Favicon (Ícone da Aba)</label>
                <div className="flex gap-4 items-center mb-2">
                  {settings.faviconUrl && (
                    <div className="bg-stone-100 p-2 rounded border">
                      <img src={settings.faviconUrl} alt="Favicon Preview" className="h-8 w-8 object-contain" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input 
                      type="text" 
                      className="w-full border p-2 rounded mb-2 text-xs" 
                      placeholder="URL do Favicon" 
                      value={settings.faviconUrl || ''} 
                      onChange={e => setSettings({...settings, faviconUrl: e.target.value})} 
                    />
                    <label className="bg-stone-200 hover:bg-stone-300 text-stone-700 px-3 py-1 rounded cursor-pointer text-xs font-medium transition-colors">
                      Upload Favicon
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              const compressed = await compressImage(reader.result as string, 64, 64, 0.9);
                              setSettings({...settings, faviconUrl: compressed});
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-2">Imagem de Compartilhamento (OG Image)</label>
                <div className="flex gap-4 items-center mb-2">
                  {settings.ogImage && (
                    <div className="bg-stone-100 p-2 rounded border">
                      <img src={settings.ogImage} alt="OG Preview" className="h-12 w-20 object-cover" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input 
                      type="text" 
                      className="w-full border p-2 rounded mb-2 text-xs" 
                      placeholder="URL da Imagem OG" 
                      value={settings.ogImage || ''} 
                      onChange={e => setSettings({...settings, ogImage: e.target.value})} 
                    />
                    <label className="bg-stone-200 hover:bg-stone-300 text-stone-700 px-3 py-1 rounded cursor-pointer text-xs font-medium transition-colors">
                      Upload OG Image
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              const compressed = await compressImage(reader.result as string, 1200, 630, 0.7);
                              setSettings({...settings, ogImage: compressed});
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6 border-t pt-4">
            <h3 className="font-bold text-stone-800 mb-4">Configurações da Barra de Cotações (Ticker)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Intervalo de Atualização (Minutos)</label>
                <input 
                  type="number" 
                  className="w-full border p-2 rounded" 
                  placeholder="Ex: 60" 
                  value={settings.tickerUpdateInterval || '60'} 
                  onChange={e => setSettings({...settings, tickerUpdateInterval: e.target.value})} 
                />
                <p className="text-[10px] text-stone-400 mt-1">Tempo entre atualizações automáticas via IA.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Prompt para a IA (Opcional)</label>
                <input 
                  className="w-full border p-2 rounded" 
                  placeholder="Instruções para gerar as notícias" 
                  value={settings.tickerPrompt || ''} 
                  onChange={e => setSettings({...settings, tickerPrompt: e.target.value})} 
                />
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-stone-700 mb-2">Logomarca (URL ou Upload)</label>
            <div className="flex gap-4 items-center mb-2">
              {settings.logoUrl && (
                <div className="bg-stone-100 p-2 rounded border">
                  <img src={settings.logoUrl} alt="Logo Preview" className="h-12 w-auto object-contain" />
                </div>
              )}
              <div className="flex-1">
                <input 
                  type="text" 
                  className="w-full border p-2 rounded mb-2" 
                  placeholder="URL da imagem (ex: https://i.postimg.cc/...)" 
                  value={settings.logoUrl} 
                  onChange={e => setSettings({...settings, logoUrl: e.target.value})} 
                />
                <div className="flex items-center gap-2">
                  <label className="bg-stone-200 hover:bg-stone-300 text-stone-700 px-3 py-1.5 rounded cursor-pointer text-sm font-medium transition-colors">
                    Fazer Upload de Imagem
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = async () => {
                            const compressed = await compressImage(reader.result as string, 400, 200, 0.8);
                            setSettings({...settings, logoUrl: compressed});
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  <button 
                    onClick={() => setSettings({...settings, logoUrl: ''})} 
                    className="text-red-500 hover:text-red-700 text-sm font-medium px-2"
                  >
                    Remover Logo
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-6 mt-3">
              <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.hideLogoTop || false} 
                  onChange={e => setSettings({...settings, hideLogoTop: e.target.checked})}
                  className={`rounded border-stone-300 text-primary focus:ring-primary`}
                />
                Esconder logo no Topo
              </label>
              <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.hideLogoFooter || false} 
                  onChange={e => setSettings({...settings, hideLogoFooter: e.target.checked})}
                  className="rounded border-stone-300 text-primary focus:ring-primary"
                />
                Esconder logo no Rodapé
              </label>
            </div>
          </div>

          <div className="mb-6 border-t pt-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-stone-800">Paleta de Cores do Site</h3>
              <button 
                onClick={() => setSettings({...settings, themePalette: 'emerald'})}
                className="text-xs font-bold text-primary hover:underline"
              >
                Resetar para Original
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { id: 'emerald', name: 'Esmeralda', primary: '#10b981', dark: '#059669', light: '#34d399' },
                { id: 'blue', name: 'Azul Oceano', primary: '#2563eb', dark: '#1d4ed8', light: '#60a5fa' },
                { id: 'amber', name: 'Ouro Luxo', primary: '#d97706', dark: '#b45309', light: '#fbbf24' },
                { id: 'tjgold', name: 'TJ Invest Gold', primary: '#000000', dark: '#000000', light: '#D4AF37' },
                { id: 'slate', name: 'Ardósia Moderna', primary: '#334155', dark: '#1e293b', light: '#64748b' },
                { id: 'violet', name: 'Roxo Profundo', primary: '#7c3aed', dark: '#6d28d9', light: '#a78bfa' },
                { id: 'red', name: 'Vinho Elegante', primary: '#991b1b', dark: '#7f1d1d', light: '#ef4444' },
              ].map(palette => (
                <button
                  key={palette.id}
                  onClick={() => setSettings({...settings, themePalette: palette.id})}
                  className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${settings.themePalette === palette.id ? 'border-primary bg-primary/5' : 'border-stone-100 hover:border-stone-200'}`}
                >
                  <div className="flex gap-1">
                    <div className="w-6 h-6 rounded-full" style={{ backgroundColor: palette.primary }}></div>
                    <div className="w-6 h-6 rounded-full" style={{ backgroundColor: palette.dark }}></div>
                    <div className="w-6 h-6 rounded-full" style={{ backgroundColor: palette.light }}></div>
                  </div>
                  <span className="text-xs font-bold text-stone-700">{palette.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6 border-t pt-4">
            <h3 className="font-bold text-stone-800 mb-4">Estilo do Topo e Fundo</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-2">Estilo do Topo (Header)</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'light', name: 'Claro' },
                    { id: 'dark', name: 'Escuro Premium' },
                    { id: 'glass-light', name: 'Vidro Claro' },
                    { id: 'glass-dark', name: 'Vidro Escuro' },
                    { id: 'primary', name: 'Cor Primária' },
                    { id: 'accent', name: 'Cor de Destaque' },
                  ].map(style => (
                    <button
                      key={style.id}
                      onClick={() => setSettings({...settings, headerStyle: style.id})}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border-2 ${settings.headerStyle === style.id ? 'border-primary bg-primary/5 text-primary' : 'border-stone-100 text-stone-600 hover:border-stone-200'}`}
                    >
                      {style.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-2">Estilo do Fundo (Background)</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'light', name: 'Claro' },
                    { id: 'dark', name: 'Gradiente Profundo' },
                    { id: 'primary', name: 'Cor Primária' },
                    { id: 'accent', name: 'Cor de Destaque' },
                  ].map(style => (
                    <button
                      key={style.id}
                      onClick={() => setSettings({...settings, backgroundStyle: style.id})}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border-2 ${settings.backgroundStyle === style.id ? 'border-primary bg-primary/5 text-primary' : 'border-stone-100 text-stone-600 hover:border-stone-200'}`}
                    >
                      {style.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6 border-t pt-4">
            <h3 className="font-bold text-stone-800 mb-4">Tipografia do Site</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { id: 'default', name: 'Padrão (Inter)', desc: 'Moderno e limpo' },
                { id: 'editorial', name: 'Editorial (Lora)', desc: 'Clássico e legível' },
                { id: 'modern', name: 'Moderno (Outfit)', desc: 'Geométrico e atual' },
                { id: 'elegant', name: 'Elegante (Playfair)', desc: 'Luxuoso e sofisticado' },
              ].map(font => (
                <button
                  key={font.id}
                  onClick={() => setSettings({...settings, typography: font.id})}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${settings.typography === font.id ? 'border-primary bg-primary/5' : 'border-stone-100 hover:border-stone-200'}`}
                >
                  <p className={`text-lg font-bold mb-1 ${
                    font.id === 'editorial' ? 'font-serif' : 
                    font.id === 'elegant' ? 'font-serif italic' : 
                    font.id === 'modern' ? 'font-sans' : 'font-sans'
                  }`}>
                    {font.name}
                  </p>
                  <p className="text-[10px] text-stone-500 uppercase tracking-wider">{font.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6 border-t pt-4">
            <h3 className="font-bold text-stone-800 mb-4">Redes Sociais</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Instagram (URL)</label>
                <input className="w-full border p-2 rounded" placeholder="https://instagram.com/..." value={settings.instagram || ''} onChange={e => setSettings({...settings, instagram: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Facebook (URL)</label>
                <input className="w-full border p-2 rounded" placeholder="https://facebook.com/..." value={settings.facebook || ''} onChange={e => setSettings({...settings, facebook: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">LinkedIn (URL)</label>
                <input className="w-full border p-2 rounded" placeholder="https://linkedin.com/in/..." value={settings.linkedin || ''} onChange={e => setSettings({...settings, linkedin: e.target.value})} />
              </div>
            </div>
          </div>

          <button onClick={saveSettings} className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold hover:bg-primary-dark transition-colors shadow-sm">Salvar Configurações</button>
        </div>
        )}

        {activeTab === 'testimonials' && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-stone-100 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-stone-800">Depoimentos de Clientes</h2>
            <div className="flex gap-2">
              <button 
                onClick={saveSettings}
                className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary-dark font-bold transition-colors shadow-sm"
              >
                Salvar Estilo e Configurações
              </button>
              <button 
                onClick={seedTestimonials}
                className="text-xs bg-stone-100 text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-200 font-bold transition-colors"
              >
                Gerar 10 Exemplos
              </button>
            </div>
          </div>
          <div className="mb-6 space-y-4 bg-stone-50 p-4 rounded-xl border border-stone-100">
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm font-bold text-stone-700 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.showTestimonials} 
                  onChange={e => setSettings({...settings, showTestimonials: e.target.checked})}
                  className="rounded border-stone-300 text-primary focus:ring-primary"
                />
                Exibir Seção de Depoimentos
              </label>
              <div className="flex items-center gap-2">
                <label className="text-sm font-bold text-stone-600">Estilo:</label>
                <select 
                  className="border p-1 rounded text-sm" 
                  value={settings.testimonialStyle} 
                  onChange={e => setSettings({...settings, testimonialStyle: e.target.value})}
                >
                  <option value="grid">Grade (Grid)</option>
                  <option value="carousel">Carrossel</option>
                  <option value="list">Lista</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mb-6 space-y-4 bg-stone-50 p-4 rounded-xl border border-stone-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input className="border p-2 rounded" placeholder="Nome do Cliente" value={newTestimonial.name} onChange={e => setNewTestimonial({...newTestimonial, name: e.target.value})} />
              <input className="border p-2 rounded" placeholder="Cargo/Papel (ex: Investidor)" value={newTestimonial.role} onChange={e => setNewTestimonial({...newTestimonial, role: e.target.value})} />
              <div className="flex items-center gap-2">
                <label className="text-sm font-bold text-stone-600">Estrelas:</label>
                <select className="border p-2 rounded w-full" value={newTestimonial.rating} onChange={e => setNewTestimonial({...newTestimonial, rating: parseInt(e.target.value)})}>
                  {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} Estrelas</option>)}
                </select>
              </div>
              <input className="border p-2 rounded" placeholder="URL da Foto (Opcional)" value={newTestimonial.photoUrl} onChange={e => setNewTestimonial({...newTestimonial, photoUrl: e.target.value})} />
            </div>
            <textarea className="w-full border p-2 rounded" placeholder="Texto do Depoimento" value={newTestimonial.text} onChange={e => setNewTestimonial({...newTestimonial, text: e.target.value})} rows={3} />
            <button 
              onClick={async () => {
                try {
                  await addDoc(collection(db, 'testimonials'), newTestimonial);
                  setNewTestimonial({ name: '', text: '', role: 'Investidor', rating: 5, photoUrl: '' });
                } catch (error) {
                  handleFirestoreError(error, OperationType.CREATE, 'testimonials');
                }
              }} 
              className="bg-primary text-white px-4 py-2 rounded-lg font-bold"
            >
              Adicionar Depoimento
            </button>
          </div>
          <div className="space-y-4">
            {testimonials.map(t => (
              <div key={t.id} className="border border-stone-100 p-4 rounded-xl bg-stone-50/50">
                {editingTestimonial?.id === t.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input className="border p-2 rounded text-sm" value={editingTestimonial.name} onChange={e => setEditingTestimonial({...editingTestimonial, name: e.target.value})} placeholder="Nome" />
                      <input className="border p-2 rounded text-sm" value={editingTestimonial.role} onChange={e => setEditingTestimonial({...editingTestimonial, role: e.target.value})} placeholder="Cargo" />
                      <select className="border p-2 rounded text-sm" value={editingTestimonial.rating} onChange={e => setEditingTestimonial({...editingTestimonial, rating: parseInt(e.target.value)})}>
                        {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} Estrelas</option>)}
                      </select>
                      <div className="flex gap-2">
                        <input className="border p-2 rounded text-sm flex-1" placeholder="URL da Foto" value={editingTestimonial.photoUrl} onChange={e => setEditingTestimonial({...editingTestimonial, photoUrl: e.target.value})} />
                        <button onClick={() => regeneratePhoto(t.id)} className="bg-stone-200 p-2 rounded hover:bg-stone-300" title="Nova Foto Aleatória">📸</button>
                      </div>
                    </div>
                    <div className="relative">
                      <textarea className="w-full border p-2 rounded text-sm" value={editingTestimonial.text} onChange={e => setEditingTestimonial({...editingTestimonial, text: e.target.value})} rows={3} placeholder="Texto do depoimento" />
                      <button 
                        onClick={() => regenerateText(t.id, editingTestimonial.name, editingTestimonial.role)}
                        className="absolute right-2 bottom-2 bg-amber-100 text-amber-700 px-2 py-1 rounded text-[10px] font-bold hover:bg-amber-200"
                      >
                        ✨ Regerar com IA
                      </button>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={async () => {
                        try {
                          await updateDoc(doc(db, 'testimonials', t.id), editingTestimonial);
                          setEditingTestimonial(null);
                        } catch (error) {
                          handleFirestoreError(error, OperationType.UPDATE, 'testimonials/' + t.id);
                        }
                      }} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold">Salvar Alterações</button>
                      <button onClick={() => setEditingTestimonial(null)} className="border border-stone-200 px-4 py-2 rounded-lg text-sm font-bold">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="relative group">
                        {t.photoUrl ? (
                          <img src={t.photoUrl} alt={t.name} className="w-12 h-12 rounded-full object-cover border border-stone-200" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-stone-200 flex items-center justify-center text-stone-500">👤</div>
                        )}
                        <button 
                          onClick={() => regeneratePhoto(t.id)}
                          className="absolute -bottom-1 -right-1 bg-white shadow-sm border rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Nova Foto"
                        >
                          <span className="text-[10px]">🔄</span>
                        </button>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-stone-800">{t.name}</p>
                          <span className="text-[10px] text-stone-400 font-normal">{t.role}</span>
                          <span className="flex text-amber-400 text-[10px]">
                            {"★".repeat(t.rating || 5)}{"☆".repeat(5 - (t.rating || 5))}
                          </span>
                        </div>
                        <p className="text-sm text-stone-600 italic line-clamp-1">"{t.text}"</p>
                      </div>
                    </div>
                    <div className="flex gap-3 items-center">
                      <button 
                        onClick={() => regenerateText(t.id, t.name, t.role)}
                        className="text-amber-600 text-xs hover:underline flex items-center gap-1"
                        title="Regerar texto com IA"
                      >
                        ✨ IA
                      </button>
                      <button onClick={() => setEditingTestimonial(t)} className="text-primary font-bold text-sm hover:underline">Editar</button>
                      <button onClick={async () => {
                        if(confirm('Excluir este depoimento?')) {
                          try {
                            await deleteDoc(doc(db, 'testimonials', t.id));
                          } catch (error) {
                            handleFirestoreError(error, OperationType.DELETE, 'testimonials/' + t.id);
                          }
                        }
                      }} className="text-red-600 font-bold text-sm hover:underline">Excluir</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        )}

        {activeTab === 'faqs' && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-stone-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-stone-800">Perguntas Frequentes</h2>
            <button onClick={saveSettings} className="bg-primary text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-primary-dark transition-colors shadow-sm">
              {isSaving ? 'Salvando...' : 'Salvar Seção'}
            </button>
          </div>
          
          <div className="mb-6 space-y-4 bg-stone-50 p-4 rounded-xl border border-stone-100">
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm font-bold text-stone-700 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.showFaqs !== false} 
                  onChange={e => setSettings({...settings, showFaqs: e.target.checked})}
                  className="rounded border-stone-300 text-primary focus:ring-primary"
                />
                Exibir Seção de FAQ
              </label>
            </div>
          </div>

          <div className="mb-6 space-y-4">
            <input className="w-full border p-2 rounded" placeholder="Pergunta" value={newFaq.question} onChange={e => setNewFaq({...newFaq, question: e.target.value})} />
            <textarea className="w-full border p-2 rounded" placeholder="Resposta" value={newFaq.answer} onChange={e => setNewFaq({...newFaq, answer: e.target.value})} rows={3} />
            <button onClick={addFaq} className="bg-primary text-white px-4 py-2 rounded-lg font-bold">Adicionar FAQ</button>
          </div>
          <div className="space-y-4">
            {faqs.map(faq => (
              <div key={faq.id} className="border border-stone-100 p-4 rounded-xl bg-stone-50/50">
                {editingFaq?.id === faq.id ? (
                  <div className="space-y-2">
                    <input className="w-full border p-2 rounded" value={editingFaq.question} onChange={e => setEditingFaq({...editingFaq, question: e.target.value})} />
                    <textarea className="w-full border p-2 rounded" value={editingFaq.answer} onChange={e => setEditingFaq({...editingFaq, answer: e.target.value})} />
                    <div className="flex gap-2">
                      <button onClick={() => saveFaq(faq.id, editingFaq.question, editingFaq.answer)} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold">Salvar</button>
                      <button onClick={() => setEditingFaq(null)} className="border border-stone-200 px-4 py-2 rounded-lg text-sm font-bold">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-stone-800">{faq.question}</p>
                      <p className="text-sm text-stone-600">{faq.answer}</p>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setEditingFaq(faq)} className="text-primary font-bold text-sm hover:underline">Editar</button>
                      <button onClick={() => deleteFaq(faq.id)} className="text-red-600 font-bold text-sm hover:underline">Excluir</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        )}

        {activeTab === 'score' && (
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-stone-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Pesos do Score de Oportunidade</h2>
                  <p className="text-stone-500 text-sm">Ajuste a importância de cada fator no cálculo do score final (0-100).</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-stone-700 mb-2">Peso: Rentabilidade (ROI)</label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={settings.scoreWeightRoi} 
                        onChange={(e) => setSettings({...settings, scoreWeightRoi: parseInt(e.target.value)})}
                        className="flex-1 accent-primary"
                      />
                      <span className="font-bold text-primary w-12">{settings.scoreWeightRoi}%</span>
                    </div>
                    <p className="text-xs text-stone-400 mt-1 italic">Impacto do retorno estimado sobre o investimento.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-stone-700 mb-2">Peso: Margem de Desconto</label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={settings.scoreWeightDiscount} 
                        onChange={(e) => setSettings({...settings, scoreWeightDiscount: parseInt(e.target.value)})}
                        className="flex-1 accent-primary"
                      />
                      <span className="font-bold text-primary w-12">{settings.scoreWeightDiscount}%</span>
                    </div>
                    <p className="text-xs text-stone-400 mt-1 italic">Impacto da diferença entre avaliação e preço mínimo.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-stone-700 mb-2">Peso: Liquidez (Tipo de Imóvel)</label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={settings.scoreWeightLiquidity} 
                        onChange={(e) => setSettings({...settings, scoreWeightLiquidity: parseInt(e.target.value)})}
                        className="flex-1 accent-primary"
                      />
                      <span className="font-bold text-primary w-12">{settings.scoreWeightLiquidity}%</span>
                    </div>
                    <p className="text-xs text-stone-400 mt-1 italic">Impacto da facilidade de revenda baseada no tipo.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-stone-700 mb-2">Peso: Segurança (Risco)</label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={settings.scoreWeightRisk} 
                        onChange={(e) => setSettings({...settings, scoreWeightRisk: parseInt(e.target.value)})}
                        className="flex-1 accent-primary"
                      />
                      <span className="font-bold text-primary w-12">{settings.scoreWeightRisk}%</span>
                    </div>
                    <p className="text-xs text-stone-400 mt-1 italic">Impacto da complexidade jurídica e ocupação.</p>
                  </div>

                  <div className="pt-4 border-t border-stone-100">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-stone-600">Total dos Pesos:</span>
                      <span className={`text-lg font-bold ${(settings.scoreWeightRoi + settings.scoreWeightDiscount + settings.scoreWeightLiquidity + settings.scoreWeightRisk) === 100 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {settings.scoreWeightRoi + settings.scoreWeightDiscount + settings.scoreWeightLiquidity + settings.scoreWeightRisk}%
                      </span>
                    </div>
                    {(settings.scoreWeightRoi + settings.scoreWeightDiscount + settings.scoreWeightLiquidity + settings.scoreWeightRisk) !== 100 && (
                      <p className="text-xs text-red-500 mt-1">A soma dos pesos deve ser exatamente 100% para um cálculo preciso.</p>
                    )}
                  </div>
                </div>

                <div className="bg-stone-50 p-6 rounded-xl border border-stone-200">
                  <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    O que é o Score de Oportunidade?
                  </h3>
                  <div className="space-y-4 text-sm text-stone-600 leading-relaxed">
                    <p>
                      O <strong>Score de Oportunidade</strong> é uma métrica exclusiva da TJ Invest que avalia o potencial de lucro e o nível de risco de cada imóvel.
                    </p>
                    <ul className="space-y-2">
                      <li><strong>1. Rentabilidade (ROI):</strong> Avalia o retorno estimado. Scores altos indicam lucro rápido e expressivo.</li>
                      <li><strong>2. Margem de Desconto:</strong> Quanto maior o desconto em relação ao valor de mercado, maior a pontuação.</li>
                      <li><strong>3. Liquidez:</strong> Apartamentos e casas em áreas urbanas pontuam mais que terrenos ou áreas rurais.</li>
                      <li><strong>4. Segurança (Risco):</strong> Leilões extrajudiciais e imóveis desocupados recebem pontuações de segurança maiores.</li>
                    </ul>
                    <div className="p-3 bg-white rounded-lg border border-stone-200 mt-4 italic text-xs">
                      "Este score ajuda o investidor a filtrar rapidamente as melhores oportunidades do mercado, equilibrando ganho financeiro com segurança jurídica."
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button 
                  onClick={saveSettings}
                  disabled={isSaving || (settings.scoreWeightRoi + settings.scoreWeightDiscount + settings.scoreWeightLiquidity + settings.scoreWeightRisk) !== 100}
                  className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {isSaving ? 'Salvando...' : 'Salvar Configurações do Score'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'leiloeiros' && (
          <div className="bg-white rounded-3xl shadow-xl border border-stone-100 overflow-hidden">
            <div className="p-8 border-b border-stone-100 bg-stone-50/50">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black text-stone-800 flex items-center gap-2">
                    <Shield className="h-6 w-6 text-primary" />
                    Leiloeiros Confiáveis
                  </h2>
                  <p className="text-stone-500 mt-1">Gerencie a lista de leiloeiros e ferramentas recomendadas.</p>
                </div>
                <button 
                  onClick={importLeiloeiros}
                  className="bg-stone-800 text-white px-4 py-2 rounded-xl font-bold hover:bg-stone-700 transition-all flex items-center gap-2 text-sm"
                >
                  <Sparkles className="h-4 w-4" />
                  Importar Lista Padrão
                </button>
              </div>
            </div>
            
            <div className="p-8 space-y-8">
              <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200">
                <h3 className="font-bold text-stone-800 mb-4">Adicionar Novo Leiloeiro</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input 
                    type="text" 
                    placeholder="Nome do Leiloeiro" 
                    value={newLeiloeiro.nome}
                    onChange={(e) => setNewLeiloeiro({...newLeiloeiro, nome: e.target.value})}
                    className="bg-white border border-stone-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                  <input 
                    type="url" 
                    placeholder="URL (ex: https://...)" 
                    value={newLeiloeiro.url}
                    onChange={(e) => setNewLeiloeiro({...newLeiloeiro, url: e.target.value})}
                    className="bg-white border border-stone-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                </div>
                <button 
                  onClick={addLeiloeiro}
                  className="mt-4 w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  Adicionar Leiloeiro
                </button>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-stone-800 flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Lista de Leiloeiros ({leiloeiros.length})
                </h3>
                
                <div className="grid grid-cols-1 gap-3">
                  {leiloeiros.sort((a, b) => a.nome.localeCompare(b.nome)).map((leiloeiro) => (
                    <div key={leiloeiro.id} className="bg-white border border-stone-100 p-4 rounded-xl shadow-sm hover:shadow-md transition-all group">
                      {editingLeiloeiro?.id === leiloeiro.id ? (
                        <div className="space-y-3">
                          <input 
                            type="text" 
                            value={editingLeiloeiro.nome}
                            onChange={(e) => setEditingLeiloeiro({...editingLeiloeiro, nome: e.target.value})}
                            className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 outline-none focus:border-primary"
                          />
                          <input 
                            type="url" 
                            value={editingLeiloeiro.url}
                            onChange={(e) => setEditingLeiloeiro({...editingLeiloeiro, url: e.target.value})}
                            className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 outline-none focus:border-primary"
                          />
                          <div className="flex gap-2">
                            <button 
                              onClick={() => saveLeiloeiro(leiloeiro.id, editingLeiloeiro.nome, editingLeiloeiro.url)}
                              className="bg-emerald-500 text-white p-2 rounded-lg hover:bg-emerald-600 transition-colors"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => setEditingLeiloeiro(null)}
                              className="bg-stone-200 text-stone-600 p-2 rounded-lg hover:bg-stone-300 transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-bold text-stone-800">{leiloeiro.nome}</h4>
                            <a 
                              href={leiloeiro.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                            >
                              <Globe className="h-3 w-3" />
                              {leiloeiro.url}
                            </a>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => setEditingLeiloeiro(leiloeiro)}
                              className="p-2 text-stone-400 hover:text-primary transition-colors"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => deleteLeiloeiro(leiloeiro.id)}
                              className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {leiloeiros.length === 0 && (
                    <div className="text-center py-12 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                      <Users className="h-12 w-12 text-stone-300 mx-auto mb-3" />
                      <p className="text-stone-500">Nenhum leiloeiro cadastrado.</p>
                      <button 
                        onClick={importLeiloeiros}
                        className="mt-4 text-primary font-bold hover:underline"
                      >
                        Importar lista padrão agora
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-center pb-12 mt-8">
          <button 
            onClick={saveSettings} 
            disabled={isSaving}
            className={`bg-primary text-white px-12 py-4 rounded-2xl font-black text-lg transition-all shadow-lg ${isSaving ? 'opacity-70 cursor-not-allowed' : 'hover:bg-primary-dark hover:shadow-primary/20 hover:-translate-y-1 active:translate-y-0'}`}
          >
            {isSaving ? 'SALVANDO...' : 'SALVAR TODAS AS ALTERAÇÕES DO SITE'}
          </button>
        </div>
      </div>
  );
}
