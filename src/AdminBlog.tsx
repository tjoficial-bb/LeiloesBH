import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { BlogPost, generateBlogContent, generateBlogImage, generateBlogTitle, generateSuggestedTopics, BLOG_CATEGORIES } from './services/blogService';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
import { Plus, Edit2, Trash2, Sparkles, Save, X, Eye, EyeOff, Star, Check, AlertCircle, Loader2, Image as ImageIcon, Link as LinkIcon, Type, FileText, Tag, User, Calendar, Wand2, RefreshCw, RotateCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { resizeBase64Image, calculateDocumentSize } from './utils/imageUtils';
import ReactMarkdown from 'react-markdown';

export default function AdminBlog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [currentPost, setCurrentPost] = useState<Partial<BlogPost>>({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    author: 'Equipe TJ INVEST',
    date: new Date().toISOString(),
    imageUrl: '',
    tags: [],
    category: BLOG_CATEGORIES[0],
    metaTitle: '',
    metaDescription: '',
    status: 'draft',
    featured: false
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [wordCount, setWordCount] = useState(1000);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);
  const [imageWithText, setImageWithText] = useState(false);
  const [imageStyle, setImageStyle] = useState('Fotografia realista');
  const [imagePrompt, setImagePrompt] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([
    "Como investir em leilões de imóveis com segurança",
    "Diferenças entre leilão judicial e extrajudicial",
    "Como analisar o edital de um leilão de imóveis",
    "Vantagens de comprar imóveis em leilão para investir",
    "Riscos comuns em leilões e como evitá-los",
    "O papel do advogado na arrematação de imóveis",
    "Como financiar a compra de um imóvel em leilão",
    "Leilão de imóveis ocupados: o que fazer?",
    "Estratégias para vencer um leilão de imóveis",
    "Documentação necessária para participar de leilões"
  ]);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BlogPost)));
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'posts');
    });
    
    // Tentar carregar tópicos salvos ou gerar novos se estiver vazio
    const savedTopics = localStorage.getItem('suggested_blog_topics');
    if (savedTopics) {
      setSuggestedTopics(JSON.parse(savedTopics));
    } else {
      handleRegenerateTopics();
    }

    return () => unsub();
  }, []);

  const handleRegenerateTopics = async () => {
    setIsGeneratingTopics(true);
    try {
      const newTopics = await generateSuggestedTopics(10);
      if (newTopics && newTopics.length > 0) {
        setSuggestedTopics(newTopics);
        localStorage.setItem('suggested_blog_topics', JSON.stringify(newTopics));
      }
    } catch (error) {
      console.error("Erro ao gerar tópicos:", error);
    } finally {
      setIsGeneratingTopics(false);
    }
  };

  const handleSave = async () => {
    try {
      let postToSave = { ...currentPost };
      
      // Redimensionar imagem se for base64 para economizar espaço no Firestore
      if (postToSave.imageUrl && postToSave.imageUrl.startsWith('data:image')) {
        try {
          postToSave.imageUrl = await resizeBase64Image(postToSave.imageUrl, 800, 450, 0.6);
        } catch (e) {
          console.error("Erro ao redimensionar imagem:", e);
        }
      }

      // Verificar tamanho do documento (limite do Firestore é 1MB)
      const docSize = calculateDocumentSize(postToSave);
      if (docSize > 1000000) {
        return alert(`O artigo é muito grande (${(docSize / 1024 / 1024).toFixed(2)}MB). O limite do Firestore é 1MB. Tente reduzir o conteúdo ou usar uma URL externa para a imagem.`);
      }

      if (postToSave.id) {
        const postRef = doc(db, 'posts', postToSave.id);
        const { id, ...data } = postToSave;
        await updateDoc(postRef, {
          ...data,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'posts'), {
          ...postToSave,
          date: new Date().toISOString()
        });
      }
      setIsEditing(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, currentPost.id ? OperationType.UPDATE : OperationType.CREATE, 'posts');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este artigo?")) return;
    try {
      await deleteDoc(doc(db, 'posts', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'posts');
    }
  };

  const handleGenerateAI = async () => {
    if (!topic) return alert("Por favor, informe um tópico para o artigo.");
    setIsGenerating(true);
    try {
      const keywordList = keywords.split(',').map(k => k.trim()).filter(k => k);
      const result = await generateBlogContent(topic, keywordList, wordCount);
      setCurrentPost({
        ...currentPost,
        ...result,
        date: new Date().toISOString(),
        status: 'draft'
      });
    } catch (error) {
      console.error("Erro na geração por IA:", error);
      alert("Erro ao gerar conteúdo com IA.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateTitle = async () => {
    if (!topic) return alert("Por favor, informe um tópico primeiro.");
    setIsGeneratingTitle(true);
    try {
      const keywordList = keywords.split(',').map(k => k.trim()).filter(k => k);
      const newTitle = await generateBlogTitle(topic, keywordList);
      setCurrentPost({ ...currentPost, title: newTitle });
    } catch (error) {
      console.error("Erro ao regenerar título:", error);
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!currentPost.title) return alert("Por favor, informe um título para o artigo primeiro.");
    setIsGeneratingImage(true);
    try {
      // Check for API key selection if using advanced models
      if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
        await window.aistudio.openSelectKey();
      }

      const imageUrl = await generateBlogImage(currentPost.title, imageWithText, imageStyle, imagePrompt);
      setCurrentPost({ ...currentPost, imageUrl });
    } catch (error: any) {
      console.error("Erro na geração de imagem:", error);
      
      let errorMessage = "Erro ao gerar imagem com IA.";
      if (error.message?.includes("RESOURCE_EXHAUSTED") || error.status === "RESOURCE_EXHAUSTED" || error.code === 429) {
        errorMessage = "Cota de geração de imagem esgotada. Por favor, selecione uma chave de API com faturamento ativo.";
        if (window.aistudio) {
          window.aistudio.openSelectKey();
        }
      }
      
      alert(errorMessage);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const resetForm = () => {
    setCurrentPost({
      title: '',
      slug: '',
      content: '',
      excerpt: '',
      author: 'Equipe TJ INVEST',
      date: new Date().toISOString(),
      imageUrl: '',
      tags: [],
      category: BLOG_CATEGORIES[0],
      metaTitle: '',
      metaDescription: '',
      status: 'draft',
      featured: false
    });
    setTopic('');
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-4">
      <div className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-3xl font-black text-stone-900 mb-2">Gerenciador de Blog</h1>
          <p className="text-stone-500">Crie e gerencie artigos otimizados para SEO com auxílio de IA.</p>
        </div>
        {!isEditing && (
          <button 
            onClick={() => { resetForm(); setIsEditing(true); }}
            className="bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-primary-dark transition-all flex items-center gap-2"
          >
            <Plus size={20} />
            Novo Artigo
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white p-8 rounded-3xl shadow-xl border border-stone-100"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 pb-6 border-b border-stone-100 gap-4">
              <h2 className="text-xl sm:text-2xl font-bold text-stone-800 flex items-center gap-2">
                {currentPost.id ? <Edit2 size={24} className="text-primary" /> : <Plus size={24} className="text-primary" />}
                {currentPost.id ? 'Editar Artigo' : 'Novo Artigo'}
              </h2>
              <div className="flex gap-3 w-full sm:w-auto">
                <button onClick={() => setIsEditing(false)} className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-bold text-stone-500 hover:bg-stone-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleSave} className="flex-1 sm:flex-none bg-primary text-white px-8 py-2.5 rounded-xl font-bold shadow-lg hover:bg-primary-dark transition-all flex items-center justify-center gap-2">
                  <Save size={20} />
                  Salvar
                </button>
              </div>
            </div>

            {/* AI Generation Tool */}
            {!currentPost.id && (
              <div className="mb-12 bg-primary/5 p-6 rounded-2xl border border-primary/10">
                <div className="flex items-center gap-2 mb-4 text-primary font-black uppercase tracking-widest text-xs">
                  <Sparkles size={16} />
                  Gerador de Artigo com IA
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row gap-3 items-end">
                    <div className="flex-1 w-full">
                      <label className="block text-[10px] font-black text-primary/60 uppercase tracking-widest mb-1 ml-1">Tópico Principal (SEO)</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Como escolher o melhor imóvel em leilão judicial..." 
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="w-full border border-primary/20 p-3 rounded-xl focus:ring-2 focus:ring-primary outline-none bg-white"
                      />
                    </div>
                    <div className="flex-1 w-full">
                      <label className="block text-[10px] font-black text-primary/60 uppercase tracking-widest mb-1 ml-1">Palavras-chave (separadas por vírgula)</label>
                      <input 
                        type="text" 
                        placeholder="Ex: leilão judicial, investimento, segurança jurídica" 
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        className="w-full border border-primary/20 p-3 rounded-xl focus:ring-2 focus:ring-primary outline-none bg-white"
                      />
                    </div>
                  </div>
                  
                  <div className="flex flex-col md:flex-row gap-3 items-end">
                    <div className="w-full md:w-48">
                      <label className="block text-[10px] font-black text-primary/60 uppercase tracking-widest mb-1 ml-1">Tamanho (Palavras)</label>
                      <select 
                        value={wordCount}
                        onChange={(e) => setWordCount(Number(e.target.value))}
                        className="w-full border border-primary/20 p-3 rounded-xl focus:ring-2 focus:ring-primary outline-none bg-white font-bold text-stone-700"
                      >
                        <option value={500}>500 palavras</option>
                        <option value={1000}>1000 palavras</option>
                        <option value={2000}>2000 palavras</option>
                        <option value={3000}>3000 palavras</option>
                        <option value={5000}>5000 palavras</option>
                      </select>
                    </div>
                    <button 
                      onClick={handleGenerateAI}
                      disabled={isGenerating}
                      className="bg-stone-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50 flex-1 h-[50px] justify-center"
                    >
                      {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                      Gerar Artigo Completo com IA
                    </button>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2 ml-1">
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Sugestões de Tópicos:</p>
                    <button 
                      onClick={handleRegenerateTopics}
                      disabled={isGeneratingTopics}
                      className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 disabled:opacity-50"
                    >
                      {isGeneratingTopics ? <Loader2 size={10} className="animate-spin" /> : <RotateCw size={10} />}
                      Regenerar Sugestões
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestedTopics.map((t, i) => (
                      <button 
                        key={i}
                        onClick={() => setTopic(t)}
                        className="text-[10px] bg-white border border-stone-200 px-2 py-1 rounded-lg text-stone-500 hover:border-primary hover:text-primary transition-all"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-xs font-black text-stone-500 uppercase tracking-widest">Título do Artigo</label>
                    <button 
                      onClick={handleRegenerateTitle}
                      disabled={isGeneratingTitle}
                      className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 disabled:opacity-50"
                    >
                      {isGeneratingTitle ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                      Regenerar Título
                    </button>
                  </div>
                  <input 
                    type="text" 
                    value={currentPost.title} 
                    onChange={e => setCurrentPost({...currentPost, title: e.target.value})}
                    className="w-full border border-stone-200 p-4 rounded-xl text-xl font-bold focus:ring-2 focus:ring-primary outline-none"
                    placeholder="Título chamativo..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-stone-500 uppercase tracking-widest mb-2">Slug da URL</label>
                  <div className="flex items-center gap-2 text-stone-400 bg-stone-50 p-3 rounded-xl border border-stone-200">
                    <LinkIcon size={16} />
                    <span className="text-sm">/blog/</span>
                    <input 
                      type="text" 
                      value={currentPost.slug} 
                      onChange={e => setCurrentPost({...currentPost, slug: e.target.value.toLowerCase().replace(/ /g, '-')})}
                      className="flex-1 bg-transparent outline-none text-stone-700 font-medium"
                      placeholder="slug-do-artigo"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4 border-b border-stone-100">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setViewMode('edit')}
                        className={`pb-2 px-4 text-sm font-bold transition-all ${viewMode === 'edit' ? 'text-primary border-b-2 border-primary' : 'text-stone-400 hover:text-stone-600'}`}
                      >
                        Editor
                      </button>
                      <button 
                        onClick={() => setViewMode('preview')}
                        className={`pb-2 px-4 text-sm font-bold transition-all ${viewMode === 'preview' ? 'text-primary border-b-2 border-primary' : 'text-stone-400 hover:text-stone-600'}`}
                      >
                        Visualização
                      </button>
                    </div>
                    
                    <div className="pb-2 px-4 text-[10px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-2">
                      <FileText size={12} />
                      {currentPost.content ? currentPost.content.trim().split(/\s+/).length : 0} palavras
                    </div>
                  </div>

                  {viewMode === 'edit' ? (
                    <textarea 
                      value={currentPost.content} 
                      onChange={e => setCurrentPost({...currentPost, content: e.target.value})}
                      className="w-full border border-stone-200 p-4 rounded-xl h-[500px] font-mono text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
                      placeholder="Escreva seu conteúdo aqui..."
                    />
                  ) : (
                    <div className="w-full border border-stone-200 p-8 rounded-xl h-[500px] overflow-y-auto bg-stone-50 prose prose-stone max-w-none">
                      <ReactMarkdown>{currentPost.content || ''}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-stone-50 p-6 rounded-2xl border border-stone-100">
                  <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2">
                    <ImageIcon size={18} className="text-primary" />
                    Imagem de Capa
                  </h3>
                  
                  <div className="space-y-4 mb-4">
                    <div>
                      <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Estilo da Imagem</label>
                      <select 
                        value={imageStyle} 
                        onChange={e => setImageStyle(e.target.value)}
                        className="w-full border border-stone-200 p-2 rounded-lg text-xs focus:ring-2 focus:ring-primary outline-none"
                      >
                        <option value="Fotografia realista">Fotografia Realista</option>
                        <option value="Ilustração 3D">Ilustração 3D</option>
                        <option value="Arte Digital">Arte Digital</option>
                        <option value="Minimalista">Minimalista</option>
                        <option value="Abstrato">Abstrato</option>
                        <option value="Cinematográfico">Cinematográfico</option>
                      </select>
                    </div>
                    
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={imageWithText} 
                        onChange={e => setImageWithText(e.target.checked)}
                        className="rounded border-stone-300 text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-bold text-stone-600">Incluir título na imagem</span>
                    </label>

                    <div>
                      <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Prompt Customizado (Opcional)</label>
                      <textarea 
                        value={imagePrompt} 
                        onChange={e => setImagePrompt(e.target.value)}
                        className="w-full border border-stone-200 p-2 rounded-lg text-xs focus:ring-2 focus:ring-primary outline-none resize-none"
                        placeholder="Descreva o que deseja na imagem..."
                        rows={2}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 mb-4">
                    <input 
                      type="text" 
                      value={currentPost.imageUrl} 
                      onChange={e => setCurrentPost({...currentPost, imageUrl: e.target.value})}
                      className="flex-1 border border-stone-200 p-3 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none"
                      placeholder="URL da imagem..."
                    />
                    <button 
                      onClick={handleGenerateImage}
                      disabled={isGeneratingImage}
                      className="bg-primary/10 text-primary p-3 rounded-xl hover:bg-primary/20 transition-all disabled:opacity-50"
                      title="Gerar Imagem com IA"
                    >
                      {isGeneratingImage ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18} />}
                    </button>
                  </div>
                  {currentPost.imageUrl && (
                    <img src={currentPost.imageUrl} alt="Preview" className="w-full h-40 object-cover rounded-xl shadow-sm" referrerPolicy="no-referrer" />
                  )}
                </div>

                <div className="bg-stone-50 p-6 rounded-2xl border border-stone-100">
                  <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2">
                    <Tag size={18} className="text-primary" />
                    SEO e Metadados
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Meta Title</label>
                      <input 
                        type="text" 
                        value={currentPost.metaTitle} 
                        onChange={e => setCurrentPost({...currentPost, metaTitle: e.target.value})}
                        className="w-full border border-stone-200 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Meta Description</label>
                      <textarea 
                        value={currentPost.metaDescription} 
                        onChange={e => setCurrentPost({...currentPost, metaDescription: e.target.value})}
                        className="w-full border border-stone-200 p-2.5 rounded-lg text-sm h-24 focus:ring-2 focus:ring-primary outline-none resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Resumo (Excerpt)</label>
                      <textarea 
                        value={currentPost.excerpt} 
                        onChange={e => setCurrentPost({...currentPost, excerpt: e.target.value})}
                        className="w-full border border-stone-200 p-2.5 rounded-lg text-sm h-24 focus:ring-2 focus:ring-primary outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-stone-50 p-6 rounded-2xl border border-stone-100">
                  <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2">
                    <Star size={18} className="text-primary" />
                    Configurações
                  </h3>
                  <div className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-12 h-6 rounded-full transition-all relative ${currentPost.featured ? 'bg-primary' : 'bg-stone-300'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${currentPost.featured ? 'left-7' : 'left-1'}`}></div>
                      </div>
                      <input type="checkbox" className="hidden" checked={currentPost.featured} onChange={e => setCurrentPost({...currentPost, featured: e.target.checked})} />
                      <span className="text-sm font-bold text-stone-700">Destaque na Home</span>
                    </label>

                    <div>
                      <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Categoria</label>
                      <select 
                        value={currentPost.category} 
                        onChange={e => setCurrentPost({...currentPost, category: e.target.value})}
                        className="w-full border border-stone-200 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                      >
                        {BLOG_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Status</label>
                      <select 
                        value={currentPost.status} 
                        onChange={e => setCurrentPost({...currentPost, status: e.target.value as 'draft' | 'published'})}
                        className="w-full border border-stone-200 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                      >
                        <option value="draft">Rascunho</option>
                        <option value="published">Publicado</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Autor</label>
                      <input 
                        type="text" 
                        value={currentPost.author} 
                        onChange={e => setCurrentPost({...currentPost, author: e.target.value})}
                        className="w-full border border-stone-200 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 gap-4"
          >
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-24 bg-stone-100 animate-pulse rounded-2xl"></div>
              ))
            ) : posts.length > 0 ? (
              posts.map(post => (
                <div key={post.id} className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-stone-100 flex flex-col sm:flex-row items-start sm:items-center justify-between hover:border-primary/20 transition-all group gap-4">
                  <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 shadow-sm">
                      <img src={post.imageUrl || `https://picsum.photos/seed/${post.slug}/200/200`} alt={post.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-bold text-stone-900 group-hover:text-primary transition-colors truncate">{post.title}</h3>
                        {post.featured && <Star size={14} className="text-amber-400 fill-amber-400 shrink-0" />}
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 ${post.status === 'published' ? 'bg-emerald-100 text-emerald-600' : 'bg-stone-100 text-stone-400'}`}>
                          {post.status === 'published' ? 'Publicado' : 'Rascunho'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-stone-400">
                        <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(post.date).toLocaleDateString('pt-BR')}</span>
                        <span className="flex items-center gap-1 truncate"><User size={12} /> {post.author}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto justify-end">
                    <button 
                      onClick={() => { setCurrentPost(post); setIsEditing(true); }}
                      className="p-2 sm:p-3 rounded-xl bg-stone-50 text-stone-600 hover:bg-primary hover:text-white transition-all shadow-sm"
                      title="Editar"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(post.id!)}
                      className="p-2 sm:p-3 rounded-xl bg-stone-50 text-stone-600 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                      title="Excluir"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-stone-200">
                <FileText className="text-stone-200 mx-auto mb-4" size={48} />
                <h3 className="text-xl font-bold text-stone-800 mb-2">Nenhum artigo ainda</h3>
                <p className="text-stone-500 mb-8">Comece criando seu primeiro artigo otimizado para SEO.</p>
                <button 
                  onClick={() => { resetForm(); setIsEditing(true); }}
                  className="bg-primary text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-primary-dark transition-all"
                >
                  Criar Primeiro Artigo
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
