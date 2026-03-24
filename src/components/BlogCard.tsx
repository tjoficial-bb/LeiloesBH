import { Calendar, User, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BlogPost } from '../services/blogService';

export function BlogCard({ post, onNavigate }: { post: BlogPost, onNavigate: (path: string) => void }) {
  const formattedDate = format(new Date(post.date), "dd 'de' MMMM, yyyy", { locale: ptBR });

  return (
    <div 
      className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden flex flex-col hover:shadow-md transition-all group cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onNavigate(`/blog/${post.slug}`);
      }}
    >
      <div className="relative h-48 overflow-hidden">
        <img 
          src={post.imageUrl || `https://picsum.photos/seed/${post.slug}/800/600`} 
          alt={post.title} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-4 left-4 flex gap-2">
          {post.tags?.slice(0, 2).map(tag => (
            <span key={tag} className="bg-primary/90 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider backdrop-blur-sm">
              {tag}
            </span>
          ))}
        </div>
      </div>
      
      <div className="p-6 flex flex-col flex-grow">
        <div className="flex items-center gap-4 text-stone-400 text-[10px] mb-3 font-medium uppercase tracking-widest">
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {formattedDate}
          </span>
          <span className="flex items-center gap-1">
            <User size={12} />
            {post.author}
          </span>
        </div>
        
        <h3 className="text-xl font-bold text-stone-900 mb-3 group-hover:text-primary transition-colors line-clamp-2">
          {post.title}
        </h3>
        
        <p className="text-stone-500 text-sm leading-relaxed mb-4 md:mb-6 line-clamp-2 md:line-clamp-3">
          {post.excerpt}
        </p>
        
        <div className="mt-auto flex items-center text-primary font-bold text-sm gap-2 group-hover:gap-3 transition-all">
          Ler Artigo Completo
          <ArrowRight size={16} />
        </div>
      </div>
    </div>
  );
}
