import { GoogleGenAI, Type } from "@google/genai";
import { collection, addDoc, updateDoc, doc, getDocs, query, where, orderBy, limit, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
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

export interface BlogPost {
  id?: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  author: string;
  date: string;
  imageUrl: string;
  tags: string[];
  category: string;
  metaTitle: string;
  metaDescription: string;
  status: 'draft' | 'published';
  featured: boolean;
  updatedAt?: string;
  faqs?: { question: string; answer: string }[];
}

export const BLOG_CATEGORIES = [
  "Leilão Judicial",
  "Leilão Extrajudicial",
  "Dicas Jurídicas",
  "Investimento Imobiliário",
  "Casos de Sucesso",
  "Mercado Imobiliário"
];

const API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;

export const generateBlogContent = async (topic: string, keywords: string[] = [], wordCount: number = 1000) => {
  if (!API_KEY) throw new Error("API Key not found");

  // Buscar posts existentes para links internos
  let existingPosts: { title: any; slug: any; }[] = [];
  try {
    const postsSnapshot = await getDocs(query(collection(db, 'posts'), where('status', '==', 'published'), limit(15)));
    existingPosts = postsSnapshot.docs.map(doc => ({
      title: doc.data().title,
      slug: doc.data().slug
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'posts');
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const prompt = `Você é um Redator Sênior e Especialista em SEO (Search Engine Optimization) com 15 anos de experiência no mercado imobiliário e jurídico brasileiro.
Sua tarefa é escrever um artigo de blog EXCEPCIONAL, com tom profissional, autoritário e informativo.

TÓPICO: "${topic}"
PALAVRAS-CHAVE OBRIGATÓRIAS (use-as estrategicamente): ${keywords.join(', ')}
TAMANHO ALVO: MÍNIMO de ${wordCount} palavras. É CRÍTICO que o texto seja longo, profundo e detalhado para ultrapassar este limite. Se o alvo for ${wordCount}, escreva pelo menos ${Math.round(wordCount * 1.1)} palavras para garantir a meta.

CATEGORIAS DISPONÍVEIS: ${BLOG_CATEGORIES.join(', ')}

POSTS EXISTENTES NO BLOG (Use para links internos se forem relevantes ao contexto):
${existingPosts.map(p => `- "${p.title}" (link: /blog/${p.slug})`).join('\n')}

REGRAS DE OURO PARA O CONTEÚDO:
1. TÍTULO (H1): Deve ser magnético, focado em SEO e conter a palavra-chave principal.
2. ESTRUTURA: Use uma hierarquia clara de H2 e H3. Nunca use H1 dentro do corpo do texto.
3. LINKS INTERNOS: Tente incluir de 2 a 3 links internos para os posts listados acima, usando âncoras naturais (ex: [como analisar um edital](/blog/analise-edital-leilao)).
4. SEÇÃO DE FAQ: Ao final do artigo, inclua uma seção "Perguntas Frequentes" com 3 a 5 perguntas e respostas curtas e diretas sobre o tema. Isso ajuda muito no ranqueamento.
5. FORMATAÇÃO MARKDOWN: 
   - Use **negrito** para destacar conceitos fundamentais.
   - Use listas com marcadores (bullets) ou numeradas para processos e dicas.
   - Use > (blockquote) para insights de especialistas ou avisos importantes.
   - O texto deve ser dividido em parágrafos curtos e escaneáveis.
6. SEO ON-PAGE: 
   - Inclua a palavra-chave principal no primeiro parágrafo.
   - Mantenha uma densidade natural de palavras-chave.
   - O texto deve responder às intenções de busca do usuário.
7. TOM DE VOZ: Profissional, confiável e educativo. Evite gírias ou termos excessivamente informais.
8. METADADOS: Crie um Meta Title e Meta Description que maximizem o CTR (Taxa de Clique).
9. PROFUNDIDADE: Não seja superficial. Explore cada sub-tópico com riqueza de detalhes, exemplos práticos e explicações técnicas para garantir que o volume de texto atinja o objetivo solicitado.

Retorne APENAS um objeto JSON válido seguindo exatamente este esquema:
{
  "title": "string",
  "slug": "string",
  "content": "string (Markdown rico e bem formatado, incluindo a seção de FAQ no final)",
  "excerpt": "string (resumo atraente de 2 frases)",
  "category": "string (uma das categorias fornecidas)",
  "metaTitle": "string",
  "metaDescription": "string",
  "tags": ["string"],
  "faqs": [
    { "question": "string", "answer": "string" }
  ]
}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    }
  });

  return JSON.parse(response.text);
};

export const generateBlogTitle = async (topic: string, keywords: string[] = []) => {
  if (!API_KEY) throw new Error("API Key not found");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const prompt = `Gere 1 título otimizado para SEO sobre o tópico: "${topic}". 
Palavras-chave: ${keywords.join(', ')}.
O título deve ser atraente para cliques e conter a palavra-chave principal.
Retorne APENAS o título em texto puro.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text.trim();
};

export const generateSuggestedTopics = async (count: number = 10) => {
  if (!API_KEY) throw new Error("API Key not found");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const prompt = `Gere ${count} sugestões de tópicos altamente relevantes e atraentes para um blog de assessoria em leilões de imóveis (TJ INVEST).
Os tópicos devem cobrir leilões judiciais, extrajudiciais, dicas jurídicas, investimentos e segurança na arrematação.
Retorne APENAS um array JSON de strings. Exemplo: ["Tópico 1", "Tópico 2"]`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Erro ao parsear tópicos sugeridos:", e);
    return [];
  }
};

export const generateBlogImage = async (prompt: string) => {
  if (!API_KEY) throw new Error("API Key not found");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: `Uma imagem profissional, cinematográfica e de alta qualidade para um blog de investimentos imobiliários. O tema é: ${prompt}. Estilo: Fotografia realista, iluminação elegante, tons de stone e dourado.`,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9",
      },
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Não foi possível gerar a imagem");
};

export const getPublishedPosts = async (count: number = 10) => {
  try {
    const q = query(
      collection(db, 'posts'),
      where('status', '==', 'published'),
      orderBy('date', 'desc'),
      limit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BlogPost));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'posts');
    return [];
  }
};

export const getFeaturedPosts = async (count: number = 3) => {
  try {
    const q = query(
      collection(db, 'posts'),
      where('status', '==', 'published'),
      where('featured', '==', true),
      orderBy('date', 'desc'),
      limit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BlogPost));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'posts');
    return [];
  }
};

export const getPostBySlug = async (slug: string) => {
  try {
    const q = query(
      collection(db, 'posts'),
      where('slug', '==', slug),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as BlogPost;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'posts');
    return null;
  }
};

export const getRelatedPosts = async (category: string | undefined, currentPostId: string, count: number = 3) => {
  if (!category) return [];
  
  try {
    const q = query(
      collection(db, 'posts'),
      where('status', '==', 'published'),
      where('category', '==', category),
      orderBy('date', 'desc'),
      limit(count + 1)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as BlogPost))
      .filter(post => post.id !== currentPostId)
      .slice(0, count);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'posts');
    return [];
  }
};
