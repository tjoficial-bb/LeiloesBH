import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Edit2, Save, X } from 'lucide-react';

export default function Sobre({ onNavigate, isAdmin }: { onNavigate: (path: string) => void, isAdmin: boolean }) {
  const [aboutText, setAboutText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState('');

  useEffect(() => {
    const unsubAbout = onSnapshot(doc(db, 'settings', 'site'), (doc) => {
      if (doc.exists() && doc.data().aboutText) {
        setAboutText(doc.data().aboutText);
      } else {
        setAboutText(`A TJ INVEST é referência no mercado de leilões de imóveis. 
        
        Nossa missão é proporcionar oportunidades seguras, transparentes e lucrativas para nossos clientes. Com anos de experiência, nossa equipe de especialistas analisa minuciosamente cada leilão para garantir que você faça o melhor negócio.
        
        Oferecemos suporte completo, desde a análise jurídica até a arrematação e entrega das chaves.`);
      }
    });
    
    return () => {
      unsubAbout();
    };
  }, []);

  const handleSave = async () => {
    await updateDoc(doc(db, 'settings', 'site'), { aboutText: editData });
    setAboutText(editData);
    setIsEditing(false);
  };

  return (
      <div className="max-w-3xl mx-auto py-12">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Sobre a TJ INVEST</h1>
          {isAdmin && !isEditing && (
            <button onClick={() => { setIsEditing(true); setEditData(aboutText); }} className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2">
              <Edit2 size={20} /> Editar
            </button>
          )}
        </div>
        
        <div className="bg-white p-8 rounded-xl shadow-sm border border-stone-100 space-y-4 mb-12">
          {isEditing ? (
            <div className="space-y-4">
              <textarea value={editData} onChange={e => setEditData(e.target.value)} className="w-full border p-4 rounded h-64" />
              <div className="flex gap-2">
                <button onClick={handleSave} className="bg-primary text-white px-4 py-2 rounded flex items-center gap-1"><Save size={16}/> Salvar</button>
                <button onClick={() => setIsEditing(false)} className="border px-4 py-2 rounded flex items-center gap-1"><X size={16}/> Cancelar</button>
              </div>
            </div>
          ) : (
            <p className="text-stone-600 whitespace-pre-line">
              {aboutText}
            </p>
          )}
        </div>
      </div>
  );
}
