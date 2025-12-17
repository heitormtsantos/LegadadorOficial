import React, { useState } from 'react';
import { X, Plus, Trash2, Save, ToggleLeft, ToggleRight, Book } from 'lucide-react';
import { ReplacementRule } from '../types';

interface GlossaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: ReplacementRule[];
  onAddRule: (find: string, replace: string) => void;
  onRemoveRule: (id: string) => void;
  onToggleRule: (id: string) => void;
  onApplyRules: () => void;
}

export const GlossaryModal: React.FC<GlossaryModalProps> = ({
  isOpen,
  onClose,
  rules,
  onAddRule,
  onRemoveRule,
  onToggleRule,
  onApplyRules,
}) => {
  const [newFind, setNewFind] = useState('');
  const [newReplace, setNewReplace] = useState('');

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFind) {
      onAddRule(newFind, newReplace);
      setNewFind('');
      setNewReplace('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 p-6 rounded-lg w-full max-w-2xl shadow-2xl relative flex flex-col max-h-[80vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
          <Book size={20} className="text-yellow-500" />
          Glossário de Substituições
        </h2>
        <p className="text-sm text-gray-400 mb-6">
          Defina regras para substituir nomes automaticamente em novos arquivos.
        </p>

        {/* Add New Rule Form */}
        <form onSubmit={handleAdd} className="flex gap-2 mb-6 p-4 bg-gray-800 rounded border border-gray-700">
          <div className="flex-1">
            <input
              type="text"
              value={newFind}
              onChange={(e) => setNewFind(e.target.value)}
              className="w-full bg-gray-900 text-white p-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
              placeholder="Nome original (ex: Shen Zize)"
            />
          </div>
          <div className="flex items-center text-gray-500">→</div>
          <div className="flex-1">
            <input
              type="text"
              value={newReplace}
              onChange={(e) => setNewReplace(e.target.value)}
              className="w-full bg-gray-900 text-white p-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
              placeholder="Novo nome (ex: Gabriel)"
            />
          </div>
          <button
            type="submit"
            disabled={!newFind}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={18} />
          </button>
        </form>

        {/* Rules List */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-2 mb-4 pr-2">
          {rules.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              Nenhuma regra definida ainda.
            </div>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id}
                className={`flex items-center gap-3 p-3 rounded border ${
                  rule.isActive
                    ? 'bg-gray-800 border-gray-700'
                    : 'bg-gray-900/50 border-gray-800 opacity-60'
                }`}
              >
                <button
                  onClick={() => onToggleRule(rule.id)}
                  className={`text-gray-400 hover:text-white transition-colors ${
                    rule.isActive ? 'text-green-400' : ''
                  }`}
                  title={rule.isActive ? 'Desativar Regra' : 'Ativar Regra'}
                >
                  {rule.isActive ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </button>
                
                <div className="flex-1 grid grid-cols-2 gap-4 text-sm">
                  <div className="font-mono text-red-300 truncate" title={rule.find}>{rule.find}</div>
                  <div className="font-mono text-green-300 truncate" title={rule.replace}>{rule.replace}</div>
                </div>

                <button
                  onClick={() => onRemoveRule(rule.id)}
                  className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-gray-700/50 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end pt-4 border-t border-gray-800">
           <button
            onClick={() => {
                onApplyRules();
                onClose();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-medium transition-colors"
           >
             <Save size={16} />
             Aplicar Agora nas Legendas
           </button>
        </div>
      </div>
    </div>
  );
};
