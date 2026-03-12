import React, { useRef, useEffect } from 'react';
import { LooseText } from '../types';
import { secondsToSrtTime, srtTimeToSeconds } from '../utils/srtHelper';
import { Trash2, Plus, Clock, Download, Type, ArrowRightToLine, ArrowLeftToLine } from 'lucide-react';

interface LooseTextListProps {
  looseTexts: LooseText[];
  currentTime: number;
  onUpdateLooseText: (id: number, updated: Partial<LooseText>) => void;
  onDeleteLooseText: (id: number) => void;
  onClearLooseTexts: () => void;
  onAddLooseText: () => void;
  onDownloadLooseTexts: () => void;
  onSeek: (time: number) => void;
}

export const LooseTextList: React.FC<LooseTextListProps> = ({
  looseTexts,
  currentTime,
  onUpdateLooseText,
  onDeleteLooseText,
  onClearLooseTexts,
  onAddLooseText,
  onDownloadLooseTexts,
  onSeek,
}) => {
  const activeTextRef = useRef<HTMLDivElement>(null);

  const activeTextId = looseTexts.find(t => currentTime >= t.startTime && currentTime <= t.endTime)?.id;

  // Auto-scroll to active text
  useEffect(() => {
    if (activeTextRef.current) {
      activeTextRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeTextId]);

  const isActive = (text: LooseText) =>
    currentTime >= text.startTime && currentTime <= text.endTime;

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-800">
      <div className="p-4 border-b border-gray-800 bg-gray-850 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">Textos Avulsos</h2>
        <div className="flex gap-2">
            <button
            onClick={() => {
              if (looseTexts.length === 0) return;
              const confirmed = window.confirm('Apagar todos os textos avulsos?');
              if (confirmed) onClearLooseTexts();
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-300 bg-red-900/20 border border-red-900/50 rounded hover:bg-red-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Apagar todos os textos avulsos"
            disabled={looseTexts.length === 0}
            >
            <Trash2 size={14} />
            Apagar tudo
            </button>
            <button
            onClick={onDownloadLooseTexts}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 transition-colors"
            title="Exportar como JSON"
            >
            <Download size={14} />
            Exportar
            </button>
            <button
            onClick={onAddLooseText}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-500 transition-colors"
            >
            <Plus size={14} />
            Adicionar
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {looseTexts.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>Nenhum texto avulso.</p>
            <p className="text-sm">Adicione textos para tradução de placas, sinais, etc.</p>
          </div>
        ) : (
          looseTexts.map((text) => (
            <div
              key={text.id}
              ref={isActive(text) ? activeTextRef : null}
              className={`relative group p-3 rounded-lg border transition-all duration-200 ${
                isActive(text)
                  ? 'bg-blue-900/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                  : 'bg-gray-800/50 border-gray-700 hover:border-gray-600 hover:bg-gray-800'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1.5 bg-gray-900/50 rounded px-1.5 py-0.5 border border-gray-700/50">
                  <Clock size={12} className="text-gray-400" />
                  <input
                    type="text"
                    value={secondsToSrtTime(text.startTime).replace(',', '.')}
                    onChange={(e) => {
                      const seconds = srtTimeToSeconds(e.target.value.replace('.', ','));
                      if (!isNaN(seconds)) {
                        onUpdateLooseText(text.id, { startTime: seconds });
                      }
                    }}
                    className="w-20 bg-transparent text-xs font-mono text-gray-300 focus:text-blue-400 focus:outline-none text-center"
                    onFocus={(e) => e.target.select()}
                  />
                  
                   <button
                    onClick={() => onUpdateLooseText(text.id, { startTime: currentTime })}
                    className="p-0.5 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
                    title="Definir início no tempo atual"
                  >
                    <ArrowRightToLine size={10} />
                  </button>

                  <span className="text-gray-500 text-xs">→</span>

                   <button
                    onClick={() => onUpdateLooseText(text.id, { endTime: currentTime })}
                    className="p-0.5 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
                    title="Definir fim no tempo atual"
                  >
                    <ArrowLeftToLine size={10} />
                  </button>

                  <input
                    type="text"
                    value={secondsToSrtTime(text.endTime).replace(',', '.')}
                    onChange={(e) => {
                      const seconds = srtTimeToSeconds(e.target.value.replace('.', ','));
                      if (!isNaN(seconds)) {
                        onUpdateLooseText(text.id, { endTime: seconds });
                      }
                    }}
                    className="w-20 bg-transparent text-xs font-mono text-gray-300 focus:text-blue-400 focus:outline-none text-center"
                    onFocus={(e) => e.target.select()}
                  />
                </div>
                
                <button
                   onClick={() => onSeek(text.startTime)}
                   className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                   title="Ir para tempo"
                >
                   <Clock size={12} />
                </button>

                <div className="w-px h-4 bg-gray-700 mx-1" />

                <div className="flex items-center gap-1 bg-gray-900/50 rounded px-1.5 py-0.5 border border-gray-700/50" title="Tamanho da fonte">
                    <Type size={12} className="text-gray-400" />
                    <input
                        type="number"
                        value={text.fontSize || 11}
                        onChange={(e) => {
                            const size = parseInt(e.target.value);
                            if (!isNaN(size) && size > 0) {
                                onUpdateLooseText(text.id, { fontSize: size });
                            }
                        }}
                        className="w-8 bg-transparent text-xs font-mono text-gray-300 focus:text-blue-400 focus:outline-none text-center"
                        min={1}
                        max={100}
                    />
                </div>

                <div className="flex-1" />
                
                <button
                  onClick={() => onDeleteLooseText(text.id)}
                  className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                  title="Excluir texto"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <textarea
                value={text.text}
                onChange={(e) => onUpdateLooseText(text.id, { text: e.target.value })}
                className="w-full bg-transparent text-sm text-gray-200 resize-none focus:outline-none placeholder-gray-600 min-h-[40px]"
                placeholder="Digite o texto avulso..."
                rows={2}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};
