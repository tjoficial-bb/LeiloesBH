import { useState, useEffect } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function WhatsAppButton({ phone }: { phone: string }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isDismissed) setShowTooltip(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [isDismissed]);

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const message = `Olá! Gostaria de mais informações sobre os leilões da TJ INVEST. Estou vendo esta página: ${currentUrl}`;
  const whatsappUrl = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-3">
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white p-4 rounded-2xl shadow-xl border border-stone-100 max-w-[240px] relative"
          >
            <button 
              onClick={() => { setShowTooltip(false); setIsDismissed(true); }}
              className="absolute -top-2 -right-2 bg-stone-100 text-stone-500 p-1 rounded-full hover:bg-stone-200 transition-colors"
            >
              <X size={12} />
            </button>
            <p className="text-sm font-medium text-stone-800">
              Olá! 👋 Precisa de ajuda com algum leilão? Fale conosco agora!
            </p>
            <div className="absolute bottom-[-6px] right-6 w-3 h-3 bg-white border-r border-b border-stone-100 rotate-45"></div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="bg-[#25D366] text-white p-4 rounded-full shadow-lg hover:shadow-2xl transition-shadow flex items-center justify-center relative group"
      >
        <MessageCircle size={28} fill="currentColor" />
        <span className="absolute right-full mr-4 bg-stone-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Falar no WhatsApp
        </span>
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
      </motion.a>
    </div>
  );
}
