import React, { useState } from 'react';
import { Search, X } from 'lucide-react';

interface FindReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReplace: (find: string, replace: string) => void;
}

export const FindReplaceModal: React.FC<FindReplaceModalProps> = ({
  isOpen,
  onClose,
  onReplace,
}) => {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onReplace(findText, replaceText);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 p-6 rounded-lg w-full max-w-md shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>
        
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Search size={20} className="text-blue-500" />
          Substituir Texto
        </h2>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Localizar:</label>
            <input
              type="text"
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              className="w-full bg-gray-800 text-white p-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
              placeholder="Ex: Shen Zize"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Substituir por:</label>
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              className="w-full bg-gray-800 text-white p-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
              placeholder="Ex: Gabriel Azevedo"
            />
          </div>
          
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!findText}
            >
              Substituir Tudo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
