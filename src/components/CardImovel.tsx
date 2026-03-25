import { memo, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Calculator, X, Info, Phone, Quote, ShieldCheck, AlertCircle, Heart, Map, TrendingUp, RefreshCw, Edit, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

export const CardImovel = memo(({ 
  imovel, 
  showRoi = true, 
  isFavorite = false, 
  onToggleFavorite,
  settings,
  isAdmin = false,
  onManualFix,
  onRefresh,
  onEdit,
  onDelete,
  isUpdating = false
}: { 
  imovel: any, 
  showRoi?: boolean, 
  isFavorite?: boolean, 
  onToggleFavorite?: () => void,
  settings?: any,
  isAdmin?: boolean,
  onManualFix?: (field: 'primeira' | 'segunda') => void,
  onRefresh?: () => void,
  onEdit?: () => void,
  onDelete?: () => void,
  isUpdating?: boolean
}) => {
  const [showCalc, setShowCalc] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  
  const parseCurrency = (val: any) => {
    const strVal = String(val || '0').trim();
    // If it's already a clean number string like "1500000.00"
    if (/^\\d+(\\.\\d+)?$/.test(strVal)) return parseFloat(strVal);
    // Remove everything except numbers, commas and dots
    const cleanStr = strVal.replace(/[^0-9,.]/g, '');
    // If it has both dots and commas, assume the last one is the decimal separator
    if (cleanStr.includes(',') && cleanStr.includes('.')) {
      const lastComma = cleanStr.lastIndexOf(',');
      const lastDot = cleanStr.lastIndexOf('.');
      if (lastComma > lastDot) {
        // format: 1.500.000,00
        return parseFloat(cleanStr.replace(/\\./g, '').replace(',', '.'));
      } else {
        // format: 1,500,000.00
        return parseFloat(cleanStr.replace(/,/g, ''));
      }
    }
    // If it only has commas, assume it's a decimal separator (Brazilian format)
    if (cleanStr.includes(',')) {
      return parseFloat(cleanStr.replace(',', '.'));
    }
    // If it only has dots, check if it's a thousands separator or decimal
    // If there's only one dot and exactly 2 digits after it, assume decimal
    if (cleanStr.includes('.')) {
      if (/\\.\\d{2}$/.test(cleanStr) && cleanStr.split('.').length === 2) {
        return parseFloat(cleanStr);
      }
      // Otherwise assume thousands separator
      return parseFloat(cleanStr.replace(/\\./g, ''));
    }
    return parseFloat(cleanStr || '0');
  };
  const avaliacaoOriginal = parseCurrency(imovel.valor_avaliacao);
  const lanceMinimoOriginal = parseCurrency(imovel.preco_leilao);

  // Estados para a calculadora interna
  const [valAvaliacao, setValAvaliacao] = useState(avaliacaoOriginal);
  const [valLance, setValLance] = useState(lanceMinimoOriginal);
  const [valReforma, setValReforma] = useState(0);
  const [valItbi, setValItbi] = useState(lanceMinimoOriginal * 0.03); // ITBI (estimado 3%)
  const [valRegistro, setValRegistro] = useState(lanceMinimoOriginal * 0.01); // Registro (estimado 1%)
  const [manualItbi, setManualItbi] = useState(false);
  const [manualRegistro, setManualRegistro] = useState(false);

  const formatBRLInput = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleBRLChange = (value: string, setter: (val: number) => void, type?: string) => {
    const digits = value.replace(/\D/g, '');
    const numberValue = parseInt(digits || '0', 10) / 100;
    setter(numberValue);

    if (type === 'lance') {
      if (!manualItbi) setValItbi(numberValue * 0.03);
      if (!manualRegistro) setValRegistro(numberValue * 0.01);
    } else if (type === 'itbi') {
      setManualItbi(true);
    } else if (type === 'registro') {
      setManualRegistro(true);
    }
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

  const isFirstPracaPassed = useMemo(() => {
    if (typeof imovel.primeira_praca_data !== 'string' || !imovel.primeira_praca_data) return false;
    try {
      // Tenta extrair a data no formato DD/MM/AAAA ou DD.MM.AAAA
      const dateMatch = imovel.primeira_praca_data.match(/(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{2,4})/);
      if (!dateMatch) return false;
      
      const [_, day, month, year] = dateMatch;
      const fullYear = year.length === 2 ? `20${year}` : year;
      const dateObj = new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      
      return !isNaN(dateObj.getTime()) && dateObj < new Date();
    } catch (e) {
      return false;
    }
  }, [imovel.primeira_praca_data]);

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
    const avaliacao = parseCurrency(imovel.valor_avaliacao);
    const lance = parseCurrency(imovel.preco_leilao);
    const descontoPercent = avaliacao > 0 ? ((avaliacao - lance) / avaliacao * 100) : 0;
    const tipo = String(imovel.tipo || '').toLowerCase();

    // Pesos do Admin ou Padrão
    const wRoi = settings?.scoreWeightRoi ?? 40;
    const wDiscount = settings?.scoreWeightDiscount ?? 30;
    const wLiquidity = settings?.scoreWeightLiquidity ?? 15;
    const wRisk = settings?.scoreWeightRisk ?? 15;

    let score = 0;

    // ROI (Weight based on settings)
    if (roi > 100) score += wRoi;
    else if (roi > 70) score += (wRoi * 0.875);
    else if (roi > 50) score += (wRoi * 0.75);
    else if (roi > 30) score += (wRoi * 0.5);
    else if (roi > 15) score += (wRoi * 0.25);

    // Desconto (Weight based on settings)
    if (descontoPercent > 60) score += wDiscount;
    else if (descontoPercent > 50) score += (wDiscount * 0.83);
    else if (descontoPercent > 40) score += (wDiscount * 0.66);
    else if (descontoPercent > 30) score += (wDiscount * 0.5);
    else if (descontoPercent > 20) score += (wDiscount * 0.33);

    // Liquidez (Weight based on settings)
    if (tipo.includes('apartamento') || tipo.includes('casa')) score += wLiquidity;
    else if (tipo.includes('comercial') || tipo.includes('sala')) score += (wLiquidity * 0.66);
    else if (tipo.includes('terreno') || tipo.includes('lote')) score += (wLiquidity * 0.33);
    else score += (wLiquidity * 0.66); // Default

    // Risco (Weight based on settings)
    const risco = String(imovel.risco || 'médio').toLowerCase();
    if (risco === 'baixo') score += wRisk;
    else if (risco === 'médio') score += (wRisk * 0.66);
    else if (risco === 'alto') score += (wRisk * 0.33);

    return Math.round(score / 10);
  }, [roiOriginal, imovel.valor_avaliacao, imovel.preco_leilao, imovel.tipo, imovel.risco, settings]);

  const scoreBreakdown = useMemo(() => {
    const roi = parseFloat(roiOriginal);
    const avaliacao = parseCurrency(imovel.valor_avaliacao);
    const lance = parseCurrency(imovel.preco_leilao);
    const descontoPercent = avaliacao > 0 ? ((avaliacao - lance) / avaliacao * 100) : 0;
    const tipo = String(imovel.tipo || '').toLowerCase();
    const risco = String(imovel.risco || 'médio').toLowerCase();

    // Pesos do Admin ou Padrão
    const wRoi = settings?.scoreWeightRoi ?? 40;
    const wDiscount = settings?.scoreWeightDiscount ?? 30;
    const wLiquidity = settings?.scoreWeightLiquidity ?? 15;
    const wRisk = settings?.scoreWeightRisk ?? 15;

    let roiScore = 0;
    if (roi > 100) roiScore = wRoi;
    else if (roi > 70) roiScore = Math.round(wRoi * 0.875);
    else if (roi > 50) roiScore = Math.round(wRoi * 0.75);
    else if (roi > 30) roiScore = Math.round(wRoi * 0.5);
    else if (roi > 15) roiScore = Math.round(wRoi * 0.25);

    let descScore = 0;
    if (descontoPercent > 60) descScore = wDiscount;
    else if (descontoPercent > 50) descScore = Math.round(wDiscount * 0.83);
    else if (descontoPercent > 40) descScore = Math.round(wDiscount * 0.66);
    else if (descontoPercent > 30) descScore = Math.round(wDiscount * 0.5);
    else if (descontoPercent > 20) descScore = Math.round(wDiscount * 0.33);

    let tipoScore = 0;
    if (tipo.includes('apartamento') || tipo.includes('casa')) tipoScore = wLiquidity;
    else if (tipo.includes('comercial') || tipo.includes('sala')) tipoScore = Math.round(wLiquidity * 0.66);
    else if (tipo.includes('terreno') || tipo.includes('lote')) tipoScore = Math.round(wLiquidity * 0.33);
    else tipoScore = Math.round(wLiquidity * 0.66);

    let riscoScore = 0;
    if (risco === 'baixo') riscoScore = wRisk;
    else if (risco === 'médio') riscoScore = Math.round(wRisk * 0.66);
    else if (risco === 'alto') riscoScore = Math.round(wRisk * 0.33);

    const totalScore = roiScore + descScore + tipoScore + riscoScore;
    const summary = totalScore >= 80 ? "Excelente oportunidade com alta margem e baixo risco." :
                    totalScore >= 60 ? "Boa oportunidade, requer análise detalhada dos custos." :
                    totalScore >= 40 ? "Oportunidade média, margem de lucro reduzida." :
                    "Oportunidade de alto risco ou baixa rentabilidade.";

    return {
      roi: { val: roi.toFixed(1) + '%', score: roiScore, max: wRoi },
      desconto: { val: descontoPercent.toFixed(1) + '%', score: descScore, max: wDiscount },
      tipo: { val: imovel.tipo || 'N/A', score: tipoScore, max: wLiquidity },
      risco: { val: imovel.risco || 'Médio', score: riscoScore, max: wRisk },
      summary
    };
  }, [roiOriginal, imovel.valor_avaliacao, imovel.preco_leilao, imovel.tipo, imovel.risco, settings]);

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
          {isAdmin && (
            <div className="flex flex-col gap-2">
              <button 
                onClick={(e) => { e.preventDefault(); onEdit?.(); }}
                className="p-2 bg-white/90 text-blue-600 rounded-full shadow-lg hover:bg-blue-600 hover:text-white transition-all backdrop-blur-sm"
                title="Editar Imóvel"
              >
                <Edit size={18} />
              </button>
              <button 
                onClick={(e) => { e.preventDefault(); onRefresh?.(); }}
                disabled={isUpdating}
                className={`p-2 bg-white/90 text-primary rounded-full shadow-lg hover:bg-primary hover:text-white transition-all backdrop-blur-sm ${isUpdating ? 'animate-spin' : ''}`}
                title="Atualizar Dados"
              >
                <RefreshCw size={18} />
              </button>
              <button 
                onClick={(e) => { e.preventDefault(); onDelete?.(); }}
                className="p-2 bg-white/90 text-red-600 rounded-full shadow-lg hover:bg-red-600 hover:text-white transition-all backdrop-blur-sm"
                title="Excluir Imóvel"
              >
                <Trash2 size={18} />
              </button>
            </div>
          )}
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
        
        {imovel.last_updated && (
          <div className="flex items-center gap-1.5 mb-3 px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[10px] text-stone-400 font-medium">
              Dados atualizados em {new Date(imovel.last_updated).toLocaleDateString('pt-BR')} às {new Date(imovel.last_updated).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
        
        <div className="grid grid-cols-3 gap-2 bg-stone-50 p-3 rounded-xl mb-4 relative">
          <div>
            <div className="flex items-center gap-1">
              <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">1ª Praça (Aval.)</p>
              {isAdmin && (
                <button 
                  onClick={(e) => { e.preventDefault(); onRefresh?.(); }}
                  className="p-0.5 rounded text-stone-300 hover:text-primary transition-colors"
                  title="Atualizar dados do site"
                >
                  <RefreshCw size={10} className={isUpdating ? 'animate-spin' : ''} />
                </button>
              )}
            </div>
            <p className="text-xs font-bold text-stone-700 truncate" title={imovel.primeira_praca_valor || imovel.valor_avaliacao}>{imovel.primeira_praca_valor || imovel.valor_avaliacao || 'N/A'}</p>
          </div>
          <div>
            <div className="flex items-center gap-1">
              <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">2ª Praça (Lance)</p>
              {isAdmin && (
                <button 
                  onClick={(e) => { e.preventDefault(); onRefresh?.(); }}
                  className="p-0.5 rounded text-stone-300 hover:text-primary transition-colors"
                  title="Atualizar dados do site"
                >
                  <RefreshCw size={10} className={isUpdating ? 'animate-spin' : ''} />
                </button>
              )}
            </div>
            <p className="text-xs font-bold text-primary-dark truncate" title={imovel.segunda_praca_valor || imovel.preco_leilao}>{imovel.segunda_praca_valor || imovel.preco_leilao || 'N/A'}</p>
          </div>
          <div className="relative">
            <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">{imovel.titulo_roi || 'ROI Est.'}</p>
            <div className="flex items-center gap-1">
              <p className="text-xs font-bold text-blue-700">{lanceMinimoOriginal > 0 ? `${roiOriginal}%` : 'N/A'}</p>
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
                      onChange={(e) => handleBRLChange(e.target.value, setValLance, 'lance')}
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
                      onChange={(e) => handleBRLChange(e.target.value, setValItbi, 'itbi')}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200 bg-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-stone-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-stone-500 uppercase mb-1 ml-1">Registro</label>
                    <input 
                      type="text" 
                      value={formatBRLInput(valRegistro)} 
                      onChange={(e) => handleBRLChange(e.target.value, setValRegistro, 'registro')}
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

        {createPortal(
          <AnimatePresence>
            {showAnalysis && (
              <motion.div 
                key="analysis-modal"
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowAnalysis(false)}
                  className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 20 }}
                  className="relative bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-stone-200/50"
                >
                  <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-20">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                        <ShieldCheck size={28} />
                      </div>
                      <div>
                        <h4 className="font-black text-stone-900 uppercase tracking-tight leading-none text-lg">{imovel.titulo_analise_especialista || 'Análise Técnica'}</h4>
                        <p className="text-[10px] text-stone-400 font-black uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-primary"></span>
                          TJ INVEST • RELATÓRIO EXCLUSIVO
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowAnalysis(false)}
                      className="w-10 h-10 rounded-full bg-stone-50 flex items-center justify-center text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-all border border-stone-200/50"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="p-8 md:p-12 overflow-y-auto flex-grow bg-gradient-to-b from-white to-stone-50/50">
                    <div className="relative max-w-prose mx-auto">
                      <Quote className="absolute -top-10 -left-10 text-primary/5 w-24 h-24 -z-10" />
                      
                      <div className="prose prose-stone prose-sm md:prose-base max-w-none 
                        prose-headings:font-black prose-headings:tracking-tight prose-headings:text-stone-900
                        prose-h3:text-primary-dark prose-h3:mt-8 prose-h3:mb-4
                        prose-p:text-stone-600 prose-p:leading-relaxed prose-p:mb-6
                        prose-strong:text-stone-900 prose-strong:font-black
                        prose-ul:list-disc prose-ul:pl-6
                        prose-li:text-stone-600 prose-li:mb-2
                        prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                        font-sans">
                        {imovel.analise_especialista ? (
                          <ReactMarkdown>{imovel.analise_especialista}</ReactMarkdown>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center text-stone-300 mb-4 animate-pulse">
                              <TrendingUp size={32} />
                            </div>
                            <p className="text-stone-500 font-medium max-w-xs">
                              Nossos especialistas estão trabalhando na análise detalhada deste imóvel. Em breve, você terá um relatório completo sobre os riscos e oportunidades.
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 mt-12 border-t border-stone-200/60 pt-8">
                        <div className="w-14 h-14 rounded-2xl bg-stone-900 border-4 border-white shadow-xl flex items-center justify-center text-white font-black text-xl">
                          TJ
                        </div>
                        <div>
                          <p className="font-black text-stone-900 text-base leading-none">Especialista TJ Invest</p>
                          <p className="text-[10px] text-stone-400 uppercase font-black tracking-widest mt-1">Consultoria Estratégica & Jurídica</p>
                        </div>
                      </div>

                      <div className="mt-16 p-8 md:p-10 bg-stone-900 rounded-[2.5rem] text-white relative overflow-hidden shadow-2xl shadow-stone-900/20">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                          <ShieldCheck size={120} className="rotate-12" />
                        </div>
                        
                        <div className="relative z-10">
                          <div className="flex items-center gap-2 mb-6 text-primary-light">
                            <AlertCircle size={20} />
                            <p className="text-xs font-black uppercase tracking-[0.2em]">Aviso de Segurança</p>
                          </div>
                          
                          <h5 className="text-2xl md:text-3xl font-black mb-4 leading-tight">Segurança é o melhor investimento.</h5>
                          <p className="text-stone-400 mb-10 leading-relaxed text-sm md:text-base max-w-md">
                            Leilões possuem riscos ocultos que apenas uma análise técnica profunda pode revelar. Não arrisque seu patrimônio sem suporte especializado.
                          </p>

                          <a 
                            href={`https://wa.me/${(imovel.whatsapp_assessoria || '5531973590970').replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMessage)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-3 bg-primary text-white font-black px-10 py-5 rounded-2xl hover:bg-primary-dark transition-all shadow-xl shadow-primary/30 group w-full md:w-auto text-lg"
                          >
                            <Phone size={20} className="group-hover:rotate-12 transition-transform" />
                            Consultoria Especializada
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-5 bg-stone-50 border-t border-stone-100 text-center">
                    <p className="text-[9px] text-stone-400 font-black uppercase tracking-[0.3em]">
                      Documento Confidencial • TJ Invest Assessoria © 2024
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
        
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
        
        <a href={imovel.link_botao || imovel.link_original} target="_blank" rel="noopener noreferrer" className="block text-center bg-stone-900 text-white font-semibold px-4 py-3 rounded-xl hover:bg-stone-800 transition-colors mt-auto">
          {imovel.texto_botao || settings?.defaultCtaText || 'Ver Detalhes do Leilão'}
        </a>
      </div>
    </div>
  );
});

