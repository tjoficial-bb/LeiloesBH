import { useState, useEffect } from 'react';
import { Search, Filter, Globe, Building2, Landmark, MapPin, TrendingDown, Loader2, Plus, ExternalLink, ShieldCheck, Zap, ListPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, onSnapshot } from 'firebase/firestore';

export default function DiscoveryDashboard({ onAddProperty }: { onAddProperty: (url: string) => void }) {
  const [filters, setFilters] = useState({
    city: '',
    type: 'all',
    bank: 'all',
    minDiscount: 0,
    maxPrice: ''
  });
  
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [monitoredAuctioneers, setMonitoredAuctioneers] = useState<any[]>([]);
  const [trustedAuctioneers, setTrustedAuctioneers] = useState<any[]>([]);
  const [newAuctioneerUrl, setNewAuctioneerUrl] = useState('');
  const [isAddingAuctioneer, setIsAddingAuctioneer] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'monitor'>('search');
  const [searchAuctioneer, setSearchAuctioneer] = useState('');

  useEffect(() => {
    const unsubscribeMonitored = onSnapshot(collection(db, 'leiloeiros_monitorados'), (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setMonitoredAuctioneers(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leiloeiros_monitorados');
    });

    const unsubscribeTrusted = onSnapshot(collection(db, 'leiloeiros'), (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setTrustedAuctioneers(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leiloeiros');
    });

    return () => {
      unsubscribeMonitored();
      unsubscribeTrusted();
    };
  }, []);

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const trustedNames = trustedAuctioneers.slice(0, 20).map(l => l.nome).join(', ');
      
      const prompt = `
        Você é um assistente de busca de leilões de imóveis. 
        Encontre leilões de imóveis reais e ativos em ${filters.city || 'Brasil'}.
        
        IMPORTANTE: TODAS AS RESPOSTAS DEVEM SER EM PORTUGUÊS DO BRASIL.
        
        Filtros:
        - Tipo: ${filters.type === 'all' ? 'Judicial e Extrajudicial' : filters.type}
        - Banco/Comitente: ${filters.bank === 'all' ? 'Qualquer' : filters.bank}
        - Desconto Mínimo: ${filters.minDiscount}%
        
        PRIORIZE buscas nos seguintes sites de leiloeiros confiáveis: ${trustedNames || 'Zuk, Mega Leilões, Sodré Santoro, Frazão, Freitas'}.
        
        Retorne uma lista de imóveis encontrados com:
        - titulo (em português)
        - endereco (em português)
        - preco (lance mínimo)
        - avaliacao
        - desconto (calculado ou informado)
        - tipo (Judicial/Extrajudicial)
        - banco
        - link (URL direta do lote)
        - site (nome do leiloeiro)
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                titulo: { type: Type.STRING },
                endereco: { type: Type.STRING },
                preco: { type: Type.STRING },
                avaliacao: { type: Type.STRING },
                desconto: { type: Type.STRING },
                tipo: { type: Type.STRING },
                banco: { type: Type.STRING },
                link: { type: Type.STRING },
                site: { type: Type.STRING }
              },
              required: ["titulo", "link", "site"]
            }
          }
        }
      });

      const foundResults = JSON.parse(response.text || '[]');
      // Add unique IDs
      const resultsWithIds = foundResults.map((r: any, i: number) => ({
        ...r,
        id: `found-${Date.now()}-${i}`
      }));
      
      setResults(resultsWithIds);
    } catch (error) {
      console.error('Discovery error:', error);
      alert('Erro ao realizar varredura inteligente. Tente novamente.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddAuctioneer = async (auctioneer?: any) => {
    const url = auctioneer?.url || newAuctioneerUrl;
    if (!url) return;
    setIsAddingAuctioneer(true);
    try {
      let name = auctioneer?.nome;
      
      if (!name) {
        // Usar Gemini para identificar o nome do leiloeiro pela URL
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Qual o nome do leiloeiro deste site: ${url}? Retorne apenas o nome curto.`
        });
        name = response.text?.trim() || 'Leiloeiro';
      }
      
      // Verificar se já está monitorado
      if (monitoredAuctioneers.some(a => a.url === url)) {
        alert('Este leiloeiro já está sendo monitorado.');
        return;
      }
      
      await addDoc(collection(db, 'leiloeiros_monitorados'), {
        url: url,
        nome: name,
        last_sync: null,
        status: 'active',
        added_at: new Date().toISOString()
      });
      
      setNewAuctioneerUrl('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'leiloeiros_monitorados');
    } finally {
      setIsAddingAuctioneer(false);
    }
  };

  const handleSyncAuctioneer = async (auctioneer: any) => {
    // Aqui chamamos o backend para fazer o scrape da página principal do leiloeiro
    // e encontrar novos links de imóveis
    alert(`Sincronizando ${auctioneer.nome}... Esta funcionalidade varre o site em busca de novos lotes.`);
    
    try {
      const response = await fetch('/api/discovery/sync-auctioneer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: auctioneer.url, id: auctioneer.id })
      });
      
      const data = await response.json();
      if (data.success) {
        setResults(data.foundLinks.map((link: string, i: number) => ({
          id: `sync-${Date.now()}-${i}`,
          titulo: `Novo Lote Encontrado - ${auctioneer.nome}`,
          link: link,
          site: auctioneer.nome,
          endereco: 'Verificar no site',
          preco: 'Pendente',
          desconto: 'Pendente',
          tipo: 'Desconhecido',
          banco: 'Desconhecido'
        })));
        setActiveTab('search');
      }
    } catch (error) {
      console.error('Sync error:', error);
    }
  };

  const handleDeleteAuctioneer = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'leiloeiros_monitorados', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `leiloeiros_monitorados/${id}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-stone-100 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('search')}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'search' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
        >
          <Search size={18} />
          Varredura Global
        </button>
        <button 
          onClick={() => setActiveTab('monitor')}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'monitor' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
        >
          <Zap size={18} />
          Monitoramento Direto
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'search' ? (
          <motion.div 
            key="search-tab"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-8"
          >
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-primary/10 rounded-2xl">
                  <Globe className="text-primary" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-stone-900">Discovery Engine</h2>
                  <p className="text-stone-500 text-sm">Varredura inteligente com IA nos principais leiloeiros do Brasil</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Cidade / Região</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Ex: Belo Horizonte"
                      className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                      value={filters.city}
                      onChange={e => setFilters({...filters, city: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Tipo de Leilão</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                    <select 
                      className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition-all appearance-none"
                      value={filters.type}
                      onChange={e => setFilters({...filters, type: e.target.value})}
                    >
                      <option value="all">Todos os Tipos</option>
                      <option value="judicial">Judicial</option>
                      <option value="extrajudicial">Extrajudicial</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Banco / Comitente</label>
                  <div className="relative">
                    <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                    <select 
                      className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition-all appearance-none"
                      value={filters.bank}
                      onChange={e => setFilters({...filters, bank: e.target.value})}
                    >
                      <option value="all">Todos os Bancos</option>
                      <option value="caixa">Caixa Econômica</option>
                      <option value="bradesco">Bradesco</option>
                      <option value="santander">Santander</option>
                      <option value="itau">Itaú</option>
                      <option value="banco do brasil">Banco do Brasil</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Desconto Mínimo</label>
                  <div className="relative">
                    <TrendingDown className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                    <select 
                      className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition-all appearance-none"
                      value={filters.minDiscount}
                      onChange={e => setFilters({...filters, minDiscount: parseInt(e.target.value)})}
                    >
                      <option value="0">Qualquer Desconto</option>
                      <option value="30">Acima de 30%</option>
                      <option value="40">Acima de 40%</option>
                      <option value="50">Acima de 50%</option>
                      <option value="60">Acima de 60%</option>
                    </select>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleSearch}
                disabled={isSearching}
                className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-all disabled:opacity-50"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    IA Varrendo Leiloeiros em Tempo Real...
                  </>
                ) : (
                  <>
                    <Search size={20} />
                    Iniciar Varredura Inteligente
                  </>
                )}
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <h3 className="font-black text-stone-900 uppercase tracking-widest text-xs">Resultados Encontrados ({results.length})</h3>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <AnimatePresence mode="popLayout">
                  {results.map((result, index) => (
                    <motion.div 
                      key={result.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-center gap-6"
                    >
                      <div className="flex-grow space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-stone-100 text-stone-600 text-[10px] font-black px-2 py-0.5 rounded uppercase">{result.site}</span>
                          {result.tipo && (
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${result.tipo.toLowerCase().includes('judicial') ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {result.tipo}
                            </span>
                          )}
                          {result.banco && (
                            <span className="bg-primary/10 text-primary text-[10px] font-black px-2 py-0.5 rounded uppercase">{result.banco}</span>
                          )}
                        </div>
                        <h4 className="font-bold text-stone-900 text-lg">{result.titulo}</h4>
                        <div className="flex items-center gap-4 text-sm text-stone-500">
                          <div className="flex items-center gap-1">
                            <MapPin size={14} />
                            {result.endereco || 'Endereço não informado'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-8 shrink-0">
                        <div className="text-right">
                          <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Lance Mínimo</p>
                          <p className="text-lg font-black text-stone-900">{result.preco || 'Sob Consulta'}</p>
                          {result.desconto && (
                            <p className="text-[10px] text-emerald-600 font-bold">Desconto: {result.desconto}</p>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <a 
                            href={result.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-3 bg-stone-50 text-stone-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                          >
                            <ExternalLink size={20} />
                          </a>
                          <button 
                            onClick={() => onAddProperty(result.link)}
                            className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-primary-dark transition-all shadow-lg shadow-primary/20"
                          >
                            <Plus size={20} />
                            Importar
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {results.length === 0 && !isSearching && (
                  <div className="bg-stone-50 border-2 border-dashed border-stone-200 rounded-3xl p-12 text-center">
                    <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="text-stone-300" size={32} />
                    </div>
                    <h4 className="text-stone-900 font-bold mb-1">Nenhum imóvel encontrado</h4>
                    <p className="text-stone-500 text-sm">Ajuste os filtros e inicie uma nova varredura inteligente.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="monitor-tab"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Sidebar: Trusted Auctioneers List */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary/10 rounded-xl">
                      <ShieldCheck className="text-primary" size={20} />
                    </div>
                    <div>
                      <h3 className="font-black text-stone-900 text-sm uppercase tracking-widest">Leiloeiros Confiáveis</h3>
                      <p className="text-[10px] text-stone-500">Selecione da sua lista importada</p>
                    </div>
                  </div>

                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={14} />
                    <input 
                      type="text" 
                      placeholder="Buscar na lista..."
                      className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-100 rounded-xl text-xs focus:ring-2 focus:ring-primary outline-none transition-all"
                      value={searchAuctioneer}
                      onChange={e => setSearchAuctioneer(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {trustedAuctioneers
                      .filter(l => l.nome.toLowerCase().includes(searchAuctioneer.toLowerCase()))
                      .map((l) => {
                        const isMonitored = monitoredAuctioneers.some(m => m.url === l.url);
                        return (
                          <div key={l.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-stone-50 transition-colors border border-transparent hover:border-stone-100 group">
                            <div className="min-w-0">
                              <p className="font-bold text-stone-800 text-xs truncate">{l.nome}</p>
                              <p className="text-[10px] text-stone-400 truncate">{l.url.replace('https://', '')}</p>
                            </div>
                            <button 
                              onClick={() => handleAddAuctioneer(l)}
                              disabled={isMonitored || isAddingAuctioneer}
                              className={`p-2 rounded-lg transition-all ${isMonitored ? 'text-emerald-500 bg-emerald-50' : 'text-stone-400 hover:text-primary hover:bg-primary/10'}`}
                            >
                              {isMonitored ? <Check size={16} /> : <Plus size={16} />}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Main: Monitored List */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-amber-100 rounded-2xl">
                      <Zap className="text-amber-600" size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-stone-900">Monitoramento Ativo</h2>
                      <p className="text-stone-500 text-sm">Leiloeiros sendo varridos automaticamente por IA</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-grow relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                      <input 
                        type="url" 
                        placeholder="Adicionar nova URL personalizada..."
                        className="w-full pl-10 pr-4 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                        value={newAuctioneerUrl}
                        onChange={e => setNewAuctioneerUrl(e.target.value)}
                      />
                    </div>
                    <button 
                      onClick={() => handleAddAuctioneer()}
                      disabled={isAddingAuctioneer || !newAuctioneerUrl}
                      className="bg-stone-900 text-white px-8 rounded-2xl font-bold hover:bg-stone-800 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {isAddingAuctioneer ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                      Monitorar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {monitoredAuctioneers.map((auctioneer) => (
                    <div key={auctioneer.id} className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm hover:shadow-md transition-all space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center font-black text-stone-400">
                            {auctioneer.nome?.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-bold text-stone-900">{auctioneer.nome}</h4>
                            <p className="text-[10px] text-stone-400 truncate max-w-[150px]">{auctioneer.url}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDeleteAuctioneer(auctioneer.id)}
                          className="text-stone-300 hover:text-red-500 transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-stone-400">
                        <span>Status</span>
                        <span className="text-emerald-600 flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                          Monitorando
                        </span>
                      </div>

                      <div className="pt-4 border-t border-stone-50 flex gap-2">
                        <button 
                          onClick={() => handleSyncAuctioneer(auctioneer)}
                          className="flex-grow bg-stone-50 text-stone-600 py-3 rounded-xl font-bold text-xs hover:bg-stone-100 transition-all flex items-center justify-center gap-2"
                        >
                          <Zap size={14} />
                          Varrer Agora
                        </button>
                        <a 
                          href={auctioneer.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 bg-stone-50 text-stone-400 hover:text-primary rounded-xl transition-all"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>
                  ))}

                  {monitoredAuctioneers.length === 0 && (
                    <div className="col-span-full bg-stone-50 border-2 border-dashed border-stone-200 rounded-3xl p-12 text-center">
                      <p className="text-stone-500 text-sm">Nenhum leiloeiro em monitoramento ativo.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper icons
const X = ({ size, className }: { size?: number, className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);

const Check = ({ size, className }: { size?: number, className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 6 9 17l-5-5"/></svg>
);
