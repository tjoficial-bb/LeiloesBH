import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';
import { BlogCard } from './components/BlogCard';
import { BlogPost } from './services/blogService';
import { Search, Filter, Calendar, User, ArrowRight, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';

export default function BlogList({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'posts'),
      where('status', '==', 'published'),
      orderBy('date', 'desc'),
      limit(20)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BlogPost)));
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  const allTags = Array.from(new Set(posts.flatMap(p => p.tags || [])));

  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          post.excerpt.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = !selectedTag || post.tags?.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  return (
    <div className="max-w-7xl mx-auto py-12 px-4 md:px-8">
      {/* Mobile Filter Toggle */}
      <div className="mb-6 md:hidden">
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

      {/* Filters & Search */}
      <div className={`mb-12 flex-col md:flex-row gap-6 items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-stone-100 ${showFiltersMobile ? 'flex' : 'hidden md:flex'}`}>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
          <input 
            type="text" 
            placeholder="Pesquisar artigos..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
          />
        </div>
        
        <div className="flex flex-wrap gap-2 justify-center">
          <button 
            onClick={() => setSelectedTag(null)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${!selectedTag ? 'bg-primary text-white shadow-md' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          >
            Todos
          </button>
          {allTags.map(tag => (
            <button 
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${selectedTag === tag ? 'bg-primary text-white shadow-md' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-stone-100 animate-pulse h-96 rounded-2xl"></div>
          ))}
        </div>
      ) : filteredPosts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {filteredPosts.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <BlogCard post={post} onNavigate={onNavigate} />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-stone-200">
          <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search className="text-stone-300" size={32} />
          </div>
          <h3 className="text-xl font-bold text-stone-800 mb-2">Nenhum artigo encontrado</h3>
          <p className="text-stone-500">Tente ajustar sua pesquisa ou filtros.</p>
          <button 
            onClick={() => { setSearchTerm(''); setSelectedTag(null); }}
            className="mt-6 text-primary font-bold hover:underline"
          >
            Limpar todos os filtros
          </button>
        </div>
      )}
    </div>
  );
}
