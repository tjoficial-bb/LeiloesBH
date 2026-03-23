import { memo, useState, useMemo } from 'react';
import { Calculator, X, Info, Phone, Quote, ShieldCheck, AlertCircle, Heart, Map, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const CardImovel = memo(({ 
  imovel, 
  showRoi = true, 
  isFavorite = false, 
  onToggleFavorite 
}: { 
  imovel: any, 
  showRoi?: boolean, 
  isFavorite?: boolean, 
  onToggleFavorite?: () => void 
}) => {
  const [showCalc, setShowCalc] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  
  const parseCurrency = (val: any) => parseFloat(String(val || '0').replace(/[^0-9,]/g, '').replace(',', '.') || '0');
  const avaliacaoOriginal = parseCurrency(imovel.valor_avaliacao);
  const lanceMinimoOriginal = parseCurrency(imovel.preco_leilao);

  // Estados para a calculadora interna
  const [valAvaliacao, setValAvaliacao] = useState(avaliacaoOriginal);
  const [valLance, setValLance] = useState(lanceMinimoOriginal);
  const [valReforma, setValReforma] = useState(0);
  const [valItbi, setValItbi] = useState(lanceMinimoOriginal * 0.03); // ITBI (estimado 3%)
  const [valRegistro, setValRegistro] = useState(lanceMinimoOriginal * 0.01); // Registro (estimado 1%)

  const formatBRLInput = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleBRLChange = (value: string, setter: (val: number) => void) => {
    const digits = value.replace(/\D/g, '');
    const numberValue = parseInt(digits || '0', 10) / 100;
    setter(numberValue);
  };

  const roiCalculado = useMemo(() => {
    const totalInvestimento = valLance + valReforma + valItbi + valRegistro;
    const lucro = valAvaliacao - totalInvestimento;
    return totalInvestimento > 0 ? (lucro / totalInvestimento * 100).toFixed(1) : '0';
  }, [valAvaliacao, valLance, valReforma, valItbi, valRegistro]);

  const lucroRS = useMemo(() => {
    return (valAvaliacao - (valLance + valReforma + valItbi + valRegistro)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }, [valAvaliacao, valLance, valReforma, valItbi, valRegistro]);

  const roiOriginal = lanceMinimoOriginal > 0 ? ((avaliacaoOriginal - lanceMinimoOriginal) / lanceMinimoOriginal * 100).toFixed(1) : '0';

  const isFirstPracaPassed = typeof imovel.primeira_praca_data === 'string' ? new Date(imovel.primeira_praca_data.split(' ')[0].split('/').reverse().join('-')) < new Date() : false;

  const getRiscoColor = (risco: string) => {
    switch (risco?.toLowerCase()) {
      case 'baixo': return 'bg-primary/10 text-primary-dark border-primary/20';
      case 'médio': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'alto': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-stone-100 text-stone-800 border-stone-200';
    }
  };

  const opportunityScore = useMemo(() => {
    const roi = parseFloat(roiOriginal);
    if (roi > 100) return 10;
    if (roi > 80) return 9;
    if (roi > 60) return 8;
    if (roi > 40) return 7;
    if (roi > 20) return 6;
    return 5;
  }, [roiOriginal]);

  const whatsappMessage = `Olá! Tenho interesse no imóvel: ${imovel.titulo}. 
📍 Localização: ${imovel.endereco}
💰 Valor: ${imovel.preco_leilao}
Link: ${window.location.origin}/imovel/${imovel.id}`;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col h-full relative">
      <div className="relative h-56 overflow-hidden shrink-0">
        <img 
          src={imovel.imagem_url || 'https://picsum.photos/seed/imovel/400/300'} 
          alt={imovel.titulo} 
          className="w-full h-full object-cover" 
          referrerPolicy="no-referrer"
          loading="lazy"
        />
        
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <button 
            onClick={(e) => { e.preventDefault(); onToggleFavorite?.(); }}
            className={`p-2 rounded-full shadow-lg transition-all ${isFavorite ? 'bg-red-500 text-white' : 'bg-white/80 text-stone-400 hover:text-red-500 backdrop-blur-sm'}`}
          >
            <Heart size={20} fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="absolute top-3 left-3 flex flex-wrap gap-2 pr-3">
          {imovel.desconto && (
            <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm flex items-center gap-1">
              <TrendingUp size={14} />
              {imovel.desconto}
            </span>
          )}
          {imovel.tipo && (
            <span className="bg-stone-800 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
              {imovel.tipo}
            </span>
          )}
        </div>

        <div className="absolute bottom-3 right-3">
          <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-xl shadow-sm border border-stone-100 flex items-center gap-2">
            <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Score</span>
            <span className={`text-sm font-black ${opportunityScore >= 8 ? 'text-primary' : 'text-amber-500'}`}>
              {opportunityScore}/10
            </span>
          </div>
        </div>

        {imovel.risco_juridico && (
          <div className="absolute bottom-3 left-3">
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full shadow-sm border flex items-center gap-1.5 ${getRiscoColor(imovel.risco_juridico)}`}>
              <span className="w-2 h-2 rounded-full bg-current opacity-75"></span>
              Risco Jurídico: {imovel.risco_juridico}
            </span>
          </div>
        )}
      </div>
      
      <div className="p-5 flex flex-col flex-grow">
        <div className="flex justify-between items-start gap-2 mb-2">
          <h3 className="font-bold text-lg text-stone-900 leading-tight line-clamp-2">{imovel.titulo || 'Sem título'}</h3>
        </div>
        
        <div className="flex items-center justify-between mb-4">
          <p className="text-stone-500 text-sm flex items-start gap-1 line-clamp-1">
            <span className="shrink-0 mt-0.5">📍</span>
            {imovel.endereco || 'Endereço não disponível'}
          </p>
          <a 
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(imovel.endereco || '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary-dark p-1 rounded-lg hover:bg-primary/5 transition-colors"
            title="Ver no Mapa"
          >
            <Map size={18} />
          </a>
        </div>
        
        <div className="grid grid-cols-3 gap-2 bg-stone-50 p-3 rounded-xl mb-4 relative">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">Avaliação</p>
            <p className="text-xs font-bold text-stone-700 truncate" title={imovel.valor_avaliacao}>{imovel.valor_avaliacao || 'N/A'}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">Lance Mín.</p>
            <p className="text-xs font-bold text-primary-dark truncate" title={imovel.preco_leilao}>{imovel.preco_leilao || 'N/A'}</p>
          </div>
          <div className="relative">
            <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">ROI Est.</p>
            <div className="flex items-center gap-1">
              <p className="text-xs font-bold text-blue-700">{roiOriginal}%</p>
              {showRoi && (
                <button 
                  onClick={() => setShowCalc(!showCalc)}
                  className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all shadow-sm flex items-center justify-center"
                  title="Simular ROI"
                >
                  <Calculator size={14} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showCalc && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-4 bg-stone-50 rounded-xl border border-stone-200 shadow-inner"
            >
              <div className="p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                    <Calculator size={12} />
                    ROI Avançado
                  </h4>
                  <button 
                    onClick={() => {
                      setValAvaliacao(avaliacaoOriginal);
                      setValLance(lanceMinimoOriginal);
                      setValReforma(0);
                      setValItbi(lanceMinimoOriginal * 0.03);
                      setValRegistro(lanceMinimoOriginal * 0.01);
                    }}
                    className="text-[9px] font-bold text-stone-400 hover:text-primary uppercase tracking-tighter"
                  >
                    Resetar
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[9px] font-bold text-stone-500 uppercase mb-1 ml-1">Venda Estimada</label>
                    <input 
                      type="text" 
                      value={formatBRLInput(valAvaliacao)} 
                      onChange={(e) => handleBRLChange(e.target.value, setValAvaliacao)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200 bg-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-stone-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-stone-500 uppercase mb-1 ml-1">Seu Lance</label>
                    <input 
                      type="text" 
                      value={formatBRLInput(valLance)} 
                      onChange={(e) => handleBRLChange(e.target.value, setValLance)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200 bg-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-stone-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-stone-500 uppercase mb-1 ml-1">Reforma</label>
                    <input 
                      type="text" 
                      value={formatBRLInput(valReforma)} 
                      onChange={(e) => handleBRLChange(e.target.value, setValReforma)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200 bg-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-stone-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-stone-500 uppercase mb-1 ml-1">ITBI (Est.)</label>
                    <input 
                      type="text" 
                      value={formatBRLInput(valItbi)} 
                      onChange={(e) => handleBRLChange(e.target.value, setValItbi)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200 bg-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-stone-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-stone-500 uppercase mb-1 ml-1">Registro</label>
                    <input 
                      type="text" 
                      value={formatBRLInput(valRegistro)} 
                      onChange={(e) => handleBRLChange(e.target.value, setValRegistro)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200 bg-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-stone-700"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-200 flex justify-between items-end">
                  <div>
                    <p className="text-[9px] font-bold text-stone-400 uppercase mb-0.5">Lucro Líquido</p>
                    <p className="text-sm font-black text-stone-900 leading-none">{lucroRS}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-stone-400 uppercase mb-0.5">ROI Final</p>
                    <p className="text-xl font-black text-primary leading-none">{roiCalculado}%</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <a 
            href={`https://wa.me/${(imovel.whatsapp_assessoria || '5531973590970').replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMessage)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold px-4 py-2.5 rounded-xl hover:bg-[#128C7E] transition-all text-sm shadow-sm"
          >
            <Phone size={16} />
            Consultoria
          </a>
          <button 
            onClick={() => setShowAnalysis(true)}
            className="flex items-center justify-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 font-bold px-4 py-2.5 rounded-xl hover:bg-amber-100 transition-all text-sm shadow-sm"
          >
            <TrendingUp size={16} />
            Análise
          </button>
        </div>

        <AnimatePresence>
          {showAnalysis && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAnalysis(false)}
                className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              >
                <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <ShieldCheck size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-stone-900 uppercase tracking-tight leading-none">Análise Técnica</h4>
                      <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-1">TJ INVEST • EXCLUSIVO</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowAnalysis(false)}
                    className="w-10 h-10 rounded-full bg-stone-50 flex items-center justify-center text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-8 md:p-10 overflow-y-auto flex-grow bg-stone-50/30">
                  <div className="relative">
                    <Quote className="absolute -top-6 -left-6 text-primary/10 w-16 h-16 -z-10" />
                    <div className="prose prose-stone max-w-none">
                      <div className="text-stone-700 leading-relaxed whitespace-pre-wrap text-sm md:text-base">
                        {imovel.analise_especialista || "Nossa IA está processando a análise detalhada deste imóvel. Em breve, você terá um relatório completo sobre os riscos e oportunidades."}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-8 border-t border-stone-100 pt-6">
                      <div className="w-12 h-12 rounded-full bg-stone-200 border-2 border-white shadow-sm flex items-center justify-center text-stone-500 font-bold">
                        TJ
                      </div>
                      <div>
                        <p className="font-bold text-stone-900 text-sm">Especialista TJ Invest</p>
                        <p className="text-[10px] text-stone-400 uppercase font-bold tracking-tighter">Consultoria Estratégica</p>
                      </div>
                    </div>

                    <div className="mt-12 p-6 md:p-8 bg-white rounded-3xl border border-stone-200 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Phone size={80} className="rotate-12" />
                      </div>
                      
                      <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-4 text-amber-600">
                          <AlertCircle size={18} />
                          <p className="text-xs font-black uppercase tracking-widest">Atenção ao Arrematante</p>
                        </div>
                        
                        <h5 className="text-xl font-bold text-stone-900 mb-3 leading-tight">Não arremate sem suporte especializado.</h5>
                        <p className="text-sm text-stone-600 mb-8 leading-relaxed max-w-md">
                          Leilões judiciais e extrajudiciais possuem nuances que podem comprometer seu capital. Nossa assessoria garante que você tenha segurança em cada etapa do processo.
                        </p>

                        <a 
                          href={`https://wa.me/${(imovel.whatsapp_assessoria || '5531973590970').replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMessage)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-3 bg-primary text-white font-bold px-8 py-4 rounded-2xl hover:bg-primary-dark transition-all shadow-xl shadow-primary/20 group w-full md:w-auto"
                        >
                          <Phone size={18} className="group-hover:rotate-12 transition-transform" />
                          Falar com Especialista agora
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-white border-t border-stone-100 text-center">
                  <p className="text-[10px] text-stone-300 font-medium uppercase tracking-widest">
                    Documento Interno • TJ Invest Assessoria
                  </p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        <div className="space-y-2 mb-6 flex-grow">
          <div className="flex justify-between text-xs text-stone-600">
            <span className="font-medium">{imovel.titulo_praca_1 || '1ª Praça'}:</span>
            <div className="text-right">
              <p className={isFirstPracaPassed ? 'line-through text-stone-400' : ''}>{imovel.primeira_praca_data}</p>
              <p className="font-bold text-stone-900">{imovel.primeira_praca_valor}</p>
            </div>
          </div>
          <div className="flex justify-between text-xs text-stone-600">
            <span className="font-medium">{imovel.titulo_praca_2 || '2ª Praça'}:</span>
            <div className="text-right">
              <p>{imovel.segunda_praca_data}</p>
              <p className="font-bold text-stone-900">{imovel.segunda_praca_valor}</p>
            </div>
          </div>
        </div>
        
        <a href={imovel.link_original} target="_blank" rel="noopener noreferrer" className="block text-center bg-stone-900 text-white font-semibold px-4 py-3 rounded-xl hover:bg-stone-800 transition-colors mt-auto">
          {imovel.texto_botao || 'Ver Detalhes do Leilão'}
        </a>
      </div>
    </div>
  );
});

