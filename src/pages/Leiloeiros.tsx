import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'motion/react';
import { Shield, Globe, ExternalLink, Search } from 'lucide-react';

export default function Leiloeiros() {
  const [leiloeiros, setLeiloeiros] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'leiloeiros'), (snapshot) => {
      setLeiloeiros(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredLeiloeiros = leiloeiros.filter(l => 
    l.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.url.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div className="min-h-screen bg-stone-50 pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-bold text-sm mb-4"
          >
            <Shield className="h-4 w-4" />
            Curadoria TJ Invest
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black text-stone-900 mb-6"
          >
            Leiloeiros <span className="text-primary">Confiáveis</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-stone-600 max-w-2xl mx-auto"
          >
            Lista selecionada de portais e leiloeiros com histórico de segurança e transparência no mercado brasileiro.
          </motion.p>
        </div>

        <div className="mb-12 max-w-xl mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
            <input 
              type="text" 
              placeholder="Buscar leiloeiro ou site..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-2xl pl-12 pr-4 py-4 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLeiloeiros.map((leiloeiro, index) => (
              <motion.a
                key={leiloeiro.id}
                href={leiloeiro.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="group bg-white p-6 rounded-3xl border border-stone-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="h-12 w-12 rounded-2xl bg-stone-50 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <Globe className="h-6 w-6" />
                    </div>
                    <ExternalLink className="h-5 w-5 text-stone-300 group-hover:text-primary transition-colors" />
                  </div>
                  <h3 className="text-xl font-bold text-stone-800 mb-2 group-hover:text-primary transition-colors">
                    {leiloeiro.nome}
                  </h3>
                  <p className="text-stone-500 text-sm break-all">
                    {leiloeiro.url.replace('https://', '').replace('www.', '')}
                  </p>
                </div>
                
                <div className="mt-6 pt-6 border-t border-stone-50 flex items-center text-primary font-bold text-sm">
                  Acessar Portal
                  <motion.span 
                    animate={{ x: [0, 5, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="ml-2"
                  >
                    →
                  </motion.span>
                </div>
              </motion.a>
            ))}
          </div>
        )}

        {!loading && filteredLeiloeiros.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-stone-200">
            <Search className="h-12 w-12 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-500 text-lg">Nenhum leiloeiro encontrado para "{searchTerm}"</p>
          </div>
        )}

        <div className="mt-20 bg-stone-900 rounded-[3rem] p-8 md:p-16 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary rounded-full blur-[120px]"></div>
          </div>
          
          <h2 className="text-3xl md:text-4xl font-black mb-6 relative z-10">Sentiu falta de algum leiloeiro?</h2>
          <p className="text-stone-400 mb-10 max-w-2xl mx-auto relative z-10">
            Nossa lista é atualizada constantemente. Se você conhece um leiloeiro de confiança que não está aqui, entre em contato conosco.
          </p>
          <a 
            href="https://wa.me/5511999999999" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 rounded-2xl font-black text-lg hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 relative z-10"
          >
            Sugerir Leiloeiro
          </a>
        </div>
      </div>
    </div>
  );
}
