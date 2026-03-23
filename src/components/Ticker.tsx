import { memo, useEffect, useState } from 'react';

export const Ticker = memo(({ items }: { items?: any[] }) => {
  const defaultData = [
    { label: 'SELIC', value: '10,75%', trend: 'down' },
    { label: 'DÓLAR', value: 'R$ 4,98', trend: 'down' },
    { label: 'EURO', value: 'R$ 5,42', trend: 'up' },
    { label: 'IPCA (12m)', value: '4,50%', trend: 'up' },
    { label: 'IGP-M (12m)', value: '-3,32%', trend: 'down' },
    { label: 'MERCADO', value: 'Alta procura por leilões de imóveis em SP e RJ', trend: 'neutral' },
    { label: 'DICA', value: 'Imóveis ocupados costumam ter maior desconto', trend: 'neutral' },
  ];

  const marketData = items && items.length > 0 ? items : defaultData;
  
  // Calcula a duração baseada no comprimento total do texto para manter uma velocidade constante
  const totalChars = marketData.reduce((acc, item) => acc + (item.label?.length || 0) + (item.value?.length || 0) + 10, 0);
  const duration = Math.max(60, Math.floor(totalChars / 5)); // Aproximadamente 5 caracteres por segundo (metade da velocidade anterior)

  return (
    <div className="max-w-7xl mx-auto w-full px-4 md:px-8 pt-4">
      <div className="bg-stone-900 text-stone-300 text-xs py-2.5 px-4 rounded-xl overflow-hidden border border-stone-800 flex items-center shadow-sm">
        <div className="bg-stone-900 pr-4 font-bold text-primary z-10 flex items-center gap-2 shrink-0 border-r border-stone-700">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-light opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          MERCADO AGORA
        </div>
        <div className="flex-1 overflow-hidden relative ml-4">
          <div 
            className="animate-marquee whitespace-nowrap flex items-center w-max will-change-transform"
            style={{ animationDuration: `${duration}s` }}
          >
            {/* Duplicamos o conteúdo para o efeito de loop contínuo */}
            {[...marketData, ...marketData].map((item, index) => (
              <span key={index} className="mx-8 flex items-center gap-2 shrink-0">
                <span className="font-semibold text-stone-400">{item.label}:</span>
                <span className="text-white">{item.value}</span>
                {item.trend === 'up' && <span className="text-primary">▲</span>}
                {item.trend === 'down' && <span className="text-red-500">▼</span>}
                {item.trend === 'neutral' && <span className="text-blue-400">◆</span>}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
