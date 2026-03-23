import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from './firebase';

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

export default function FAQDetail({ faqId, onNavigate }: { faqId: string, onNavigate: (path: string) => void }) {
  const [faq, setFaq] = useState<any>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'faqs', faqId), (doc) => {
      if (doc.exists()) {
        setFaq({ id: doc.id, ...doc.data() });
      } else {
        const defaultFaqs = [
          { id: '1', question: 'Como funciona um leilão de imóveis?', answer: 'É um processo público onde imóveis são vendidos pelo maior lance.' },
          { id: '2', question: 'Quais os riscos de comprar em leilão?', answer: 'Existem riscos jurídicos e de desocupação, mas com análise profissional são mitigados.' },
          { id: '3', question: 'Como posso visitar o imóvel?', answer: 'Geralmente não é possível visitar o interior, apenas o exterior.' },
          { id: '4', question: 'O que é leilão extrajudicial?', answer: 'Realizado diretamente pelo credor, sem intervenção judicial.' },
          { id: '5', question: 'O que é leilão judicial?', answer: 'Determinado por um juiz para pagamento de dívidas.' },
          { id: '6', question: 'Como é feito o pagamento?', answer: 'Geralmente à vista ou com sinal e parcelamento, conforme edital.' },
          { id: '7', question: 'Quem paga as dívidas do imóvel?', answer: 'Depende do edital, mas em leilões judiciais muitas dívidas são sub-rogadas.' },
          { id: '8', question: 'Como é a desocupação?', answer: 'Caso o imóvel esteja ocupado, o arrematante deve solicitar a desocupação.' },
          { id: '9', question: 'Posso usar financiamento?', answer: 'Sim, em alguns casos, mas deve ser aprovado previamente pelo banco.' },
          { id: '10', question: 'Como recebo a escritura?', answer: 'Após o pagamento e registro da carta de arrematação no cartório.' },
        ];
        const found = defaultFaqs.find(f => f.id === faqId);
        if (found) setFaq(found);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `faqs/${faqId}`);
    });
    return () => unsub();
  }, [faqId]);

  return (
      <div className="max-w-3xl mx-auto py-12">
        <button onClick={() => onNavigate('/faq')} className="text-primary mb-6 hover:underline">&larr; Voltar para FAQs</button>
        {faq ? (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-stone-100">
            <h1 className="text-3xl font-bold mb-4">{faq.question}</h1>
            <p className="text-stone-600 text-lg">{faq.answer}</p>
          </div>
        ) : (
          <p>Carregando...</p>
        )}
      </div>
  );
}
