import { useState, useEffect } from 'react';
import { collection, onSnapshot, updateDoc, deleteDoc, doc, addDoc } from 'firebase/firestore';
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
import { ChevronDown, ChevronUp, Plus, Trash2, Edit2, Save, X } from 'lucide-react';

export default function FAQ({ isAdmin }: { isAdmin: boolean }) {
  const [faqs, setFaqs] = useState<any[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ question: '', answer: '' });
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'faqs'), (snapshot) => {
      if (!snapshot.empty) {
        setFaqs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } else {
        setFaqs([
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
        ]);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'faqs');
    });
    return () => unsub();
  }, []);

  const handleUpdate = async (id: string) => {
    try {
      await updateDoc(doc(db, 'faqs', id), editData);
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'faqs');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta pergunta?')) {
      try {
        await deleteDoc(doc(db, 'faqs', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'faqs');
      }
    }
  };

  const handleAdd = async () => {
    try {
      await addDoc(collection(db, 'faqs'), editData);
      setIsAdding(false);
      setEditData({ question: '', answer: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'faqs');
    }
  };

  return (
      <div className="max-w-3xl mx-auto py-12">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Perguntas Frequentes</h1>
          {isAdmin && !isAdding && (
            <button onClick={() => setIsAdding(true)} className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2">
              <Plus size={20} /> Nova Pergunta
            </button>
          )}
        </div>

        {isAdding && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200 mb-6 space-y-4">
            <input type="text" placeholder="Pergunta" value={editData.question} onChange={e => setEditData({...editData, question: e.target.value})} className="w-full border p-2 rounded" />
            <textarea placeholder="Resposta" value={editData.answer} onChange={e => setEditData({...editData, answer: e.target.value})} className="w-full border p-2 rounded" />
            <div className="flex gap-2">
              <button onClick={handleAdd} className="bg-primary text-white px-4 py-2 rounded">Salvar</button>
              <button onClick={() => setIsAdding(false)} className="border px-4 py-2 rounded">Cancelar</button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {faqs.map((faq) => (
            <div 
              key={faq.id} 
              className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden"
            >
              {editingId === faq.id ? (
                <div className="p-6 space-y-4">
                  <input type="text" value={editData.question} onChange={e => setEditData({...editData, question: e.target.value})} className="w-full border p-2 rounded" />
                  <textarea value={editData.answer} onChange={e => setEditData({...editData, answer: e.target.value})} className="w-full border p-2 rounded" />
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdate(faq.id)} className="bg-primary text-white px-4 py-2 rounded flex items-center gap-1"><Save size={16}/> Salvar</button>
                    <button onClick={() => setEditingId(null)} className="border px-4 py-2 rounded flex items-center gap-1"><X size={16}/> Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  <div 
                    onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                    className="w-full text-left p-6 flex justify-between items-center hover:bg-stone-50 transition cursor-pointer"
                  >
                    <h3 className="font-bold text-lg text-stone-900">{faq.question}</h3>
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <div className="flex items-center gap-2 mr-2">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setEditingId(faq.id); 
                              setEditData({question: faq.question, answer: faq.answer}); 
                            }} 
                            className="text-blue-600 p-1 hover:bg-blue-50 rounded transition"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              handleDelete(faq.id); 
                            }} 
                            className="text-red-600 p-1 hover:bg-red-50 rounded transition"
                            title="Excluir"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                      {openId === faq.id ? <ChevronUp className="text-primary" /> : <ChevronDown className="text-primary" />}
                    </div>
                  </div>
                  {openId === faq.id && (
                    <div className="p-6 pt-0 text-stone-600 border-t border-stone-100 bg-stone-50">
                      {faq.answer}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
  );
}
