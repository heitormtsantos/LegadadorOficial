import React, { useEffect, useRef } from 'react';
import { Subtitle } from '../types';
import { secondsToSrtTime, srtTimeToSeconds } from '../utils/srtHelper';
import { Clock, Trash2, Plus, Type, ChevronLeft, ChevronRight, Timer, ArrowRight, Watch, Languages, Loader2 } from 'lucide-react';

interface SubtitleListProps {
  subtitles: Subtitle[];
  currentTime: number;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  outlineSize: number;
  onOutlineSizeChange: (size: number) => void;
  shadowSize: number;
  onShadowSizeChange: (size: number) => void;
  letterSpacing: number;
  onLetterSpacingChange: (size: number) => void;
  onUpdateSubtitle: (id: number, updated: Partial<Subtitle>) => void;
  onDeleteSubtitle: (id: number) => void;
  onAddSubtitle: () => void;
  onSeek: (time: number) => void;
  onShiftAll: (amount: number) => void;
  selectedSubtitleId: number | null;
  onSelect: (id: number) => void;
  onTranslate: () => Promise<void>;
  isTranslating: boolean;
}

export const SubtitleList: React.FC<SubtitleListProps> = ({
  subtitles,
  currentTime,
  fontSize,
  onFontSizeChange,
  outlineSize,
  onOutlineSizeChange,
  shadowSize,
  onShadowSizeChange,
  letterSpacing,
  onLetterSpacingChange,
  onUpdateSubtitle,
  onDeleteSubtitle,
  onAddSubtitle,
  onSeek,
  onShiftAll,
  selectedSubtitleId,
  onSelect,
  onTranslate,
  isTranslating,
}) => {
  const activeSubtitleRef = useRef<HTMLDivElement>(null);
  const selectedSubtitleRef = useRef<HTMLDivElement>(null);

  const activeSubId = subtitles.find(s => currentTime >= s.startTime && currentTime <= s.endTime)?.id;

  // Auto-scroll to active subtitle
  useEffect(() => {
    // Prefer scrolling to selected if user is navigating manually
    if (selectedSubtitleId && selectedSubtitleRef.current) {
        selectedSubtitleRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
        });
    } else if (activeSubtitleRef.current) {
      activeSubtitleRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeSubId, selectedSubtitleId]);

  const isActive = (sub: Subtitle) =>
    currentTime >= sub.startTime && currentTime <= sub.endTime;

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-800">
      <div className="p-4 border-b border-gray-800 bg-gray-850 space-y-3">
        <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">Legendas</h2>
            <div className="flex gap-2">
              <button
                onClick={onTranslate}
                disabled={isTranslating || subtitles.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Traduzir legendas com Gemini"
              >
                {isTranslating ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Languages size={14} />
                )}
                Traduzir
              </button>
              <button
                onClick={onAddSubtitle}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-500 transition-colors"
              >
                <Plus size={14} />
                Adicionar
              </button>
            </div>
        </div>
        
        {/* Global Time Shift */}
        <div className="flex flex-col gap-1 bg-gray-900 p-2 rounded border border-gray-700">
           <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
              <Timer size={12} />
              <span>Ajustar Tempo (Todos)</span>
           </div>
           <div className="flex justify-between gap-1">
              <button onClick={() => onShiftAll(-1)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-xs py-1 rounded text-gray-300 transition-colors">-1s</button>
              <button onClick={() => onShiftAll(-0.5)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-xs py-1 rounded text-gray-300 transition-colors">-0.5s</button>
              <button onClick={() => onShiftAll(0.5)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-xs py-1 rounded text-gray-300 transition-colors">+0.5s</button>
              <button onClick={() => onShiftAll(1)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-xs py-1 rounded text-gray-300 transition-colors">+1s</button>
           </div>
        </div>

        {/* Font Size, Outline, and Shadow Controls */}
        <div className="grid grid-cols-2 gap-2">
            {/* Font Size */}
            <div className="flex flex-col gap-1 bg-gray-900 p-2 rounded border border-gray-700">
                <div className="flex justify-between items-center text-xs text-gray-400 mb-1">
                    <div className="flex items-center gap-1">
                        <Type size={12} />
                        <span>Tamanho</span>
                    </div>
                    <span>{fontSize}</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="40"
                  step="1"
                  value={fontSize}
                  onChange={(e) => onFontSizeChange(Number(e.target.value))}
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:hover:bg-blue-400"
                />
            </div>

            {/* Outline Size */}
            <div className="flex flex-col gap-1 bg-gray-900 p-2 rounded border border-gray-700">
                <div className="flex justify-between items-center text-xs text-gray-400 mb-1">
                    <div className="flex items-center gap-1">
                        <Type size={12} className="stroke-[3]" />
                        <span>Contorno</span>
                    </div>
                    <span>{outlineSize}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="1"
                  value={outlineSize}
                  onChange={(e) => onOutlineSizeChange(Number(e.target.value))}
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-green-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:hover:bg-green-400"
                />
            </div>

            {/* Shadow Size */}
            <div className="flex flex-col gap-1 bg-gray-900 p-2 rounded border border-gray-700 col-span-2">
                <div className="flex justify-between items-center text-xs text-gray-400 mb-1">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-gray-400 rounded-sm shadow-md" />
                        <span>Sombra</span>
                    </div>
                    <span>{shadowSize}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="0.1"
                  value={shadowSize}
                  onChange={(e) => onShadowSizeChange(Number(e.target.value))}
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:hover:bg-purple-400"
                />
            </div>
            <div className="flex flex-col gap-1 bg-gray-900 p-2 rounded border border-gray-700 col-span-2">
                <div className="flex justify-between items-center text-xs text-gray-400 mb-1">
                    <div className="flex items-center gap-1">
                        <Type size={12} />
                        <span>Espaçamento</span>
                    </div>
                    <span>{letterSpacing.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={letterSpacing}
                  onChange={(e) => onLetterSpacingChange(Number(e.target.value))}
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-pink-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:hover:bg-pink-400"
                />
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {subtitles.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">
            <p>Nenhuma legenda carregada.</p>
            <p className="text-sm">Carregue um arquivo .srt ou adicione manualmente.</p>
          </div>
        ) : (
          subtitles.map((sub) => {
            const active = isActive(sub);
            const selected = sub.id === selectedSubtitleId;
            return (
              <div
                key={sub.id}
                ref={selected ? selectedSubtitleRef : active ? activeSubtitleRef : null}
                onClick={() => {
                  onSelect(sub.id);
                  onSeek(sub.startTime);
                }}
                className={`p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                  selected
                    ? 'bg-gray-800 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                    : active
                    ? 'bg-gray-800 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.2)]'
                    : 'bg-gray-850 border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="flex flex-col gap-2 mb-2">
                  <div className="flex items-center justify-between gap-1">
                    {/* Start Time */}
                    <div className="flex items-center gap-1 bg-gray-900 rounded p-1 border border-gray-800">
                      <button 
                        onClick={() => onUpdateSubtitle(sub.id, { startTime: currentTime })}
                        title="Definir início como tempo atual"
                        className="text-gray-500 hover:text-blue-400 p-0.5"
                      >
                        <Watch size={12} />
                      </button>
                      <input
                        type="text"
                        className="bg-transparent text-xs text-gray-300 font-mono focus:text-blue-400 focus:outline-none w-[70px] text-center"
                        value={secondsToSrtTime(sub.startTime)}
                        onChange={(e) =>
                          onUpdateSubtitle(sub.id, {
                            startTime: srtTimeToSeconds(e.target.value),
                          })
                        }
                        onBlur={() => onSeek(sub.startTime)} 
                      />
                    </div>

                    <ArrowRight size={12} className="text-gray-600" />

                    {/* End Time */}
                    <div className="flex items-center gap-1 bg-gray-900 rounded p-1 border border-gray-800">
                      <input
                        type="text"
                        className="bg-transparent text-xs text-gray-300 font-mono focus:text-blue-400 focus:outline-none w-[70px] text-center"
                        value={secondsToSrtTime(sub.endTime)}
                        onChange={(e) =>
                          onUpdateSubtitle(sub.id, {
                            endTime: srtTimeToSeconds(e.target.value),
                          })
                        }
                      />
                      <button 
                        onClick={() => onUpdateSubtitle(sub.id, { endTime: currentTime })}
                        title="Definir fim como tempo atual"
                        className="text-gray-500 hover:text-blue-400 p-0.5"
                      >
                         <Watch size={12} />
                      </button>
                    </div>

                    <div className="ml-1">
                      <button
                        onClick={() => onDeleteSubtitle(sub.id)}
                        className="text-gray-500 hover:text-red-400 p-1"
                        title="Excluir"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <textarea
                  className="w-full bg-gray-900 text-gray-200 text-sm p-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none resize-none"
                  rows={2}
                  value={sub.text}
                  onChange={(e) =>
                    onUpdateSubtitle(sub.id, { text: e.target.value })
                  }
                  onFocus={() => onSeek(sub.startTime)}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
