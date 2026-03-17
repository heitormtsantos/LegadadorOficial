import React, { useState } from 'react';
import { X, Plus, Trash2, Key, Check } from 'lucide-react';
import { ApiKey } from '../hooks/useApiKeys';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeys: ApiKey[];
  activeKeyId: string | null;
  onAddKey: (name: string, key: string) => void;
  onRemoveKey: (id: string) => void;
  onSelectKey: (id: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  apiKeys,
  activeKeyId,
  onAddKey,
  onRemoveKey,
  onSelectKey,
}) => {
  const [newName, setNewName] = useState('');
  const [newKey, setNewKey] = useState('');

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newKey.trim()) {
      onAddKey(newName, newKey);
      setNewName('');
      setNewKey('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 p-6 rounded-lg w-full max-w-md shadow-2xl relative flex flex-col max-h-[80vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
          <Key size={20} className="text-purple-500" />
          Configurar Chaves Gemini
        </h2>
        <p className="text-sm text-gray-400 mb-6">
          Adicione e selecione as chaves da API do Gemini para tradução automática.
        </p>

        {/* Add New Key Form */}
        <form onSubmit={handleAdd} className="space-y-3 mb-6 p-4 bg-gray-800 rounded border border-gray-700">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Nome (opcional)</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-gray-900 text-white p-2 rounded border border-gray-600 focus:border-purple-500 focus:outline-none text-sm"
              placeholder="Ex: Minha Chave 1"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Chave API</label>
            <input
              type="password"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="w-full bg-gray-900 text-white p-2 rounded border border-gray-600 focus:border-purple-500 focus:outline-none text-sm"
              placeholder="AIza..."
              required
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            Adicionar Chave
          </button>
        </form>

        {/* Keys List */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-2 mb-4 pr-2">
          {apiKeys.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              Nenhuma chave cadastrada.
            </div>
          ) : (
            apiKeys.map((key) => (
              <div
                key={key.id}
                className={`flex items-center gap-3 p-3 rounded border transition-colors cursor-pointer ${
                  activeKeyId === key.id
                    ? 'bg-purple-900/20 border-purple-500/50'
                    : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                }`}
                onClick={() => onSelectKey(key.id)}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeKeyId === key.id ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
                  {activeKeyId === key.id ? <Check size={16} /> : <Key size={16} />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{key.name}</div>
                  <div className="text-xs text-gray-500 truncate">••••••••{key.key.slice(-4)}</div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveKey(key.id);
                  }}
                  className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-gray-700/50 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="text-[10px] text-gray-500 text-center">
          As chaves são salvas apenas no seu navegador (localStorage).
        </div>
      </div>
    </div>
  );
};
