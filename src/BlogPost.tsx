import { useState, useEffect } from 'react';
import { getPostBySlug, BlogPost as BlogPostType, getRelatedPosts } from './services/blogService';
import { Calendar, User, Clock, Share2, Facebook, Instagram, Linkedin, ArrowLeft, MessageCircle, List, ChevronRight, Award, ShieldCheck, CheckCircle2, HelpCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import { motion, useScroll, useSpring } from 'motion/react';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function BlogPost({ slug, onNavigate }: { slug: string, onNavigate: (path: string) => void }) {
  const [post, setPost] = useState<BlogPostType | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPostType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);
  const [toc, setToc] = useState<{ id: string, text: string, level: number }[]>([]);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  const slugify = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  };

  const getHeaderText = (children: any): string => {
    if (!children) return '';
    if (typeof children === 'string') return children;
    if (Array.isArray(children)) return children.map(getHeaderText).join('');
    if (typeof children === 'object' && children.props && children.props.children) {
      return getHeaderText(children.props.children);
    }
    return '';
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'site'));
        if (settingsDoc.exists()) {
          setSettings(settingsDoc.data());
        }
      } catch (error) {
        console.error("Erro ao carregar configurações:", error);
      }
    };

    const fetchPost = async () => {
      setIsLoading(true);
      try {
        const data = await getPostBySlug(slug);
        setPost(data);
        
        if (data) {
          // SEO Updates
          document.title = `${data.metaTitle || data.title} | TJ INVEST`;
          let metaDesc = document.querySelector('meta[name="description"]');
          if (metaDesc) metaDesc.setAttribute('content', data.metaDescription || data.excerpt);
          
          // Generate ToC
          const headers = data.content.match(/^\s*#{2,3}\s*.+/gm);
          if (headers) {
            const tocItems = headers.map(h => {
              const level = h.trim().startsWith('###') ? 3 : 2;
              const text = h.replace(/^\s*#{2,3}\s*/, '').replace(/\*\*/g, '').replace(/\*/g, '').trim();
              const id = slugify(text);
              return { id, text, level };
            });
            setToc(tocItems);
          }

          // Fetch related posts
          if (data.id) {
            const related = await getRelatedPosts(data.category, data.id);
            setRelatedPosts(related);
          }

          // JSON-LD for SEO (BlogPosting)
          const jsonLd = {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "headline": data.title,
            "image": data.imageUrl,
            "author": {
              "@type": "Organization",
              "name": "TJ INVEST"
            },
            "publisher": {
              "@type": "Organization",
              "name": "TJ INVEST",
              "logo": {
                "@type": "ImageObject",
                "url": "https://tjinvest.com.br/logo.png"
              }
            },
            "datePublished": data.date,
            "dateModified": data.updatedAt || data.date,
            "description": data.metaDescription || data.excerpt,
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": window.location.href
            }
          };

          const script = document.createElement('script');
          script.type = 'application/ld+json';
          script.id = 'blog-jsonld';
          script.text = JSON.stringify(jsonLd);
          document.head.appendChild(script);

          // FAQ Schema if available
          if (data.faqs && data.faqs.length > 0) {
            const faqSchema = {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": data.faqs.map(faq => ({
                "@type": "Question",
                "name": faq.question,
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": faq.answer
                }
              }))
            };
            
            const scriptFaq = document.createElement('script');
            scriptFaq.type = 'application/ld+json';
            scriptFaq.id = 'faq-jsonld';
            scriptFaq.text = JSON.stringify(faqSchema);
            document.head.appendChild(scriptFaq);
          }
        }
      } catch (error) {
        console.error("Erro ao carregar post:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
    fetchPost();
    window.scrollTo(0, 0);

    return () => {
      const existingScript = document.getElementById('blog-jsonld');
      if (existingScript) existingScript.remove();
      const existingFaq = document.getElementById('faq-jsonld');
      if (existingFaq) existingFaq.remove();
    };
  }, [slug]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-24 px-4">
        <div className="h-12 bg-stone-100 animate-pulse rounded-xl mb-8 w-3/4"></div>
        <div className="h-6 bg-stone-100 animate-pulse rounded-lg mb-12 w-1/2"></div>
        <div className="h-96 bg-stone-100 animate-pulse rounded-3xl mb-12"></div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-4xl mx-auto py-24 px-4 text-center">
        <h2 className="text-3xl font-bold text-stone-900 mb-6">Artigo não encontrado</h2>
        <p className="text-stone-500 mb-8">O artigo que você está procurando não existe ou foi removido.</p>
        <button 
          onClick={() => onNavigate('/blog')}
          className="bg-primary text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-primary-dark transition-all"
        >
          Voltar para o Blog
        </button>
      </div>
    );
  }

  const formattedDate = format(new Date(post.date), "dd 'de' MMMM, yyyy", { locale: ptBR });
  const whatsappLink = settings?.phone ? `https://wa.me/${settings.phone}?text=Olá! Li o artigo "${post.title}" no blog e gostaria de saber mais sobre a assessoria em leilões.` : '#';

  return (
    <>
      {/* Reading Progress Bar */}
      <motion.div 
        className="fixed top-0 left-0 right-0 h-1 bg-primary z-[100] origin-left"
        style={{ scaleX }}
      />

      <article className="max-w-6xl mx-auto py-12 px-4 md:px-8">
        {/* Breadcrumbs for SEO */}
        <nav className="flex items-center gap-2 text-[10px] font-black text-stone-400 uppercase tracking-widest mb-8 overflow-x-auto whitespace-nowrap pb-2">
          <button onClick={() => onNavigate('/')} className="hover:text-primary transition-colors">Home</button>
          <ChevronRight size={12} />
          <button onClick={() => onNavigate('/blog')} className="hover:text-primary transition-colors">Blog</button>
          <ChevronRight size={12} />
          <span className="text-stone-900 truncate max-w-[200px]">{post.category}</span>
        </nav>

        <motion.button 
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => onNavigate('/blog')}
          className="flex items-center gap-2 text-stone-500 hover:text-primary font-bold mb-12 transition-colors group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          Voltar para o Blog
        </motion.button>

        <header className="mb-12 max-w-4xl">
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <span className="bg-stone-900 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
              {post.category}
            </span>
            <div className="flex flex-wrap gap-2">
              {post.tags?.map(tag => (
                <span key={tag} className="bg-primary/10 text-primary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-stone-900 mb-8 leading-[1.1] tracking-tight">
            {post.title}
          </h1>
          
          <div className="flex flex-wrap items-center gap-6 text-stone-400 text-xs font-bold uppercase tracking-widest border-y border-stone-100 py-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-stone-900 flex items-center justify-center text-white text-[10px]">
                {post.author.charAt(0)}
              </div>
              <span className="text-stone-900">{post.author}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-stone-300" />
              {formattedDate}
            </div>
            {post.updatedAt && (
              <div className="flex items-center gap-2 text-primary">
                <RefreshCw size={14} />
                Atualizado: {format(new Date(post.updatedAt), "dd/MM/yy")}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-stone-300" />
              {Math.ceil(post.content.split(' ').length / 200)} min de leitura
            </div>
          </div>
        </header>

        <div className="flex flex-col md:flex-row gap-16">
          {/* Sidebar for sharing & ToC - Fixed on the left for desktop */}
          <aside className="md:w-56 flex flex-col gap-8 sticky top-32 h-fit order-2 md:order-1 shrink-0">
            {/* Share Buttons */}
            <div>
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-4">Compartilhar</p>
              <div className="flex gap-3">
                <a 
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center text-stone-400 hover:bg-blue-600 hover:text-white transition-all border border-stone-100"
                >
                  <Facebook size={18} />
                </a>
                <button className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center text-stone-400 hover:bg-pink-600 hover:text-white transition-all border border-stone-100">
                  <Instagram size={18} />
                </button>
                <a 
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center text-stone-400 hover:bg-blue-700 hover:text-white transition-all border border-stone-100"
                >
                  <Linkedin size={18} />
                </a>
                <button 
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: post.title,
                        text: post.excerpt,
                        url: window.location.href,
                      });
                    }
                  }}
                  className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center text-stone-400 hover:bg-primary hover:text-white transition-all border border-stone-100"
                >
                  <Share2 size={18} />
                </button>
              </div>
            </div>

            {/* Table of Contents */}
            {toc.length > 0 && (
              <div className="hidden md:block">
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <List size={14} />
                  Neste Artigo
                </p>
                <nav className="space-y-3">
                  {toc.map((item, i) => (
                    <a 
                      key={i}
                      href={`#${item.id}`}
                      className={`block text-sm font-bold transition-all hover:text-primary ${item.level === 3 ? 'pl-4 text-stone-400' : 'text-stone-600'}`}
                      onClick={(e) => {
                        e.preventDefault();
                        const el = document.getElementById(item.id);
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      {item.text}
                    </a>
                  ))}
                </nav>
              </div>
            )}
          </aside>

          {/* Content - Now with more space */}
          <div className="flex-1 order-1 md:order-2 max-w-none">
            {/* Table of Contents - Mobile */}
          {toc.length > 0 && (
            <div className="md:hidden mb-12 bg-stone-50 rounded-3xl p-8 border border-stone-100">
              <p className="text-xs font-black text-stone-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <List size={16} />
                Neste Artigo
              </p>
              <nav className="space-y-4">
                {toc.map((item, i) => (
                  <a 
                    key={i}
                    href={`#${item.id}`}
                    className={`block text-base font-bold transition-all hover:text-primary ${item.level === 3 ? 'pl-4 text-stone-400' : 'text-stone-600'}`}
                    onClick={(e) => {
                      e.preventDefault();
                      const el = document.getElementById(item.id);
                      if (el) {
                        const offset = 100;
                        const bodyRect = document.body.getBoundingClientRect().top;
                        const elementRect = el.getBoundingClientRect().top;
                        const elementPosition = elementRect - bodyRect;
                        const offsetPosition = elementPosition - offset;

                        window.scrollTo({
                          top: offsetPosition,
                          behavior: 'smooth'
                        });
                      }
                    }}
                  >
                    {item.text}
                  </a>
                ))}
              </nav>
            </div>
          )}

          <div className="prose prose-stone prose-lg max-w-none 
              prose-headings:text-stone-900 prose-headings:font-black prose-headings:tracking-tight
              prose-h2:text-3xl prose-h2:mt-16 prose-h2:mb-8 prose-h2:border-b prose-h2:border-stone-200 prose-h2:pb-6 prose-h2:leading-tight
              prose-h3:text-2xl prose-h3:mt-12 prose-h3:mb-6 prose-h3:leading-snug
              prose-p:text-stone-600 prose-p:leading-[1.9] prose-p:mb-8 prose-p:text-justify md:prose-p:text-left
              prose-strong:text-stone-900 prose-strong:font-bold
              prose-ul:my-10 prose-li:mb-4 prose-li:text-stone-600
              prose-blockquote:border-l-8 prose-blockquote:border-primary prose-blockquote:bg-stone-50 prose-blockquote:py-8 prose-blockquote:px-10 prose-blockquote:rounded-r-3xl prose-blockquote:italic prose-blockquote:text-stone-800 prose-blockquote:my-12 prose-blockquote:shadow-sm prose-blockquote:not-italic
              prose-a:text-primary prose-a:font-bold prose-a:no-underline hover:prose-a:underline transition-all">
              <ReactMarkdown 
                components={{
                  h2: ({node, ...props}) => {
                    const text = getHeaderText(props.children);
                    const id = slugify(text);
                    return <h2 id={id} {...props} />;
                  },
                  h3: ({node, ...props}) => {
                    const text = getHeaderText(props.children);
                    const id = slugify(text);
                    return <h3 id={id} {...props} />;
                  },
                  a: ({node, ...props}) => {
                    const isInternal = props.href?.startsWith('/blog/') || props.href?.startsWith('https://ais-dev-wqvv7cwsf6umaej2fdvgax-201019927993.us-east1.run.app/blog/');
                    
                    if (isInternal) {
                      return (
                        <a 
                          {...props} 
                          onClick={(e) => {
                            e.preventDefault();
                            const slug = props.href?.split('/blog/')[1];
                            if (slug) onNavigate(`/blog/${slug}`);
                          }}
                          className="text-primary font-bold hover:underline cursor-pointer"
                        >
                          {props.children}
                        </a>
                      );
                    }
                    return <a {...props} target="_blank" rel="noopener noreferrer" className="text-primary font-bold hover:underline" />;
                  }
                }}
              >
                {post.content}
              </ReactMarkdown>
            </div>

            {/* FAQ Section Visual - If the AI generated structured FAQs */}
            {post.faqs && post.faqs.length > 0 && (
              <div className="mt-20 bg-stone-900 rounded-3xl p-10 text-white">
                <div className="flex items-center gap-3 mb-8">
                  <HelpCircle className="text-primary" size={32} />
                  <h3 className="text-3xl font-black tracking-tight">Perguntas Frequentes</h3>
                </div>
                <div className="space-y-8">
                  {post.faqs.map((faq, i) => (
                    <div key={i} className="border-b border-white/10 pb-8 last:border-0 last:pb-0">
                      <h4 className="text-xl font-bold mb-4 text-primary">{faq.question}</h4>
                      <p className="text-stone-400 leading-relaxed">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Author Profile Card */}
            <div className="mt-20 bg-stone-50 rounded-3xl p-8 border border-stone-100 flex flex-col md:flex-row items-center gap-8">
              <div className="w-24 h-24 rounded-2xl bg-stone-900 flex items-center justify-center text-white text-3xl font-black shrink-0 shadow-lg">
                TJ
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-xl font-black text-stone-900">Equipe TJ INVEST</h4>
                  <ShieldCheck size={18} className="text-primary" />
                </div>
                <p className="text-stone-500 text-sm leading-relaxed mb-4">
                  Especialistas em assessoria jurídica e estratégica para leilões de imóveis. Nossa missão é democratizar o acesso a investimentos seguros e rentáveis no mercado de leilões judiciais e extrajudiciais.
                </p>
                <div className="flex gap-4">
                  <div className="flex items-center gap-1 text-[10px] font-black text-stone-400 uppercase tracking-widest">
                    <Award size={14} className="text-primary" />
                    +10 Anos de Experiência
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-black text-stone-400 uppercase tracking-widest">
                    <CheckCircle2 size={14} className="text-primary" />
                    Assessoria Completa
                  </div>
                </div>
              </div>
            </div>

            {/* WhatsApp CTA Section - Reduced Size */}
            <div className="mt-12 bg-stone-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl border border-white/5">
              <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 blur-[80px] rounded-full -mr-24 -mt-24"></div>
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageCircle className="text-primary" size={24} />
                    <span className="text-primary font-black uppercase tracking-widest text-[10px]">Assessoria Especializada</span>
                  </div>
                  <h3 className="text-2xl font-black mb-3 leading-tight">Precisa de ajuda para arrematar com segurança?</h3>
                  <p className="text-stone-400 text-sm max-w-xl">Nossa equipe de especialistas está pronta para guiar você em cada etapa do leilão.</p>
                </div>
                <a 
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="whitespace-nowrap bg-primary text-white px-8 py-4 rounded-xl font-black text-sm hover:bg-primary-dark transition-all shadow-lg hover:shadow-primary/20 flex items-center gap-2"
                >
                  Falar com um Assessor
                  <ArrowLeft size={18} className="rotate-180" />
                </a>
              </div>
            </div>
            
            <div className="mt-16 pt-12 border-t border-stone-100">
              <h4 className="text-xl font-bold text-stone-900 mb-6">Tags Relacionadas</h4>
              <div className="flex flex-wrap gap-2">
                {post.tags?.map(tag => (
                  <span key={tag} className="bg-stone-100 text-stone-600 text-sm font-bold px-4 py-2 rounded-xl hover:bg-stone-200 transition-colors cursor-pointer">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Related Articles */}
            {relatedPosts.length > 0 && (
              <div className="mt-24">
                <div className="flex items-center justify-between mb-8">
                  <h4 className="text-2xl font-black text-stone-900">Artigos Relacionados</h4>
                  <button 
                    onClick={() => onNavigate('/blog')}
                    className="text-sm font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    Ver todos <ChevronRight size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {relatedPosts.map(rp => (
                    <div 
                      key={rp.id} 
                      className="group cursor-pointer"
                      onClick={() => onNavigate(`/blog/${rp.slug}`)}
                    >
                      <div className="aspect-video rounded-2xl overflow-hidden mb-4 shadow-sm border border-stone-100">
                        <img 
                          src={rp.imageUrl || `https://picsum.photos/seed/${rp.slug}/400/250`} 
                          alt={rp.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest mb-2 block">{rp.category}</span>
                      <h5 className="font-bold text-stone-900 group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                        {rp.title}
                      </h5>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </article>
    </>
  );
}
