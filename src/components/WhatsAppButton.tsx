import { MessageCircle, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';

export function WhatsAppButton({ phone }: { phone: string }) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const message = `Olá! Gostaria de mais informações sobre os leilões da TJ INVEST. Estou vendo esta página: ${currentUrl}`;
  const whatsappUrl = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-2">
      <button 
        onClick={() => setIsDismissed(true)}
        className="bg-stone-200 text-stone-600 p-1 rounded-full hover:bg-stone-300 transition-colors"
        title="Fechar"
      >
        <X size={12} />
      </button>
      <motion.a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="bg-[#25D366] text-white p-4 rounded-full shadow-lg hover:shadow-2xl transition-shadow flex items-center justify-center"
      >
        <MessageCircle size={28} fill="currentColor" />
      </motion.a>
    </div>
  );
}
