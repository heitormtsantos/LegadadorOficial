import React, { useEffect, useRef } from 'react';
import { Subtitle } from '../types';
import { secondsToSrtTime, srtTimeToSeconds } from '../utils/srtHelper';
import { Clock, Trash2, Plus, Type } from 'lucide-react';

interface SubtitleListProps {
  subtitles: Subtitle[];
  currentTime: number;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  onUpdateSubtitle: (id: number, updated: Partial<Subtitle>) => void;
  onDeleteSubtitle: (id: number) => void;
  onAddSubtitle: () => void;
  onSeek: (time: number) => void;
}

export const SubtitleList: React.FC<SubtitleListProps> = ({
  subtitles,
  currentTime,
  fontSize,
  onFontSizeChange,
  onUpdateSubtitle,
  onDeleteSubtitle,
  onAddSubtitle,
  onSeek,
}) => {
  const activeSubtitleRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active subtitle
  useEffect(() => {
    if (activeSubtitleRef.current) {
      activeSubtitleRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentTime]);

  const isActive = (sub: Subtitle) =>
    currentTime >= sub.startTime && currentTime <= sub.endTime;

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-800">
      <div className="p-4 border-b border-gray-800 bg-gray-850">
        <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-white">Legendas</h2>
            <button
            onClick={onAddSubtitle}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-500 transition-colors"
            >
            <Plus size={14} />
            Adicionar
            </button>
        </div>
        
        {/* Font Size Control */}
        <div className="flex flex-col gap-1 bg-gray-900 p-2 rounded border border-gray-700">
            <div className="flex justify-between items-center text-xs text-gray-400">
                <div className="flex items-center gap-1">
                    <Type size={12} />
                    <span>Tamanho da Fonte</span>
                </div>
                <span>{fontSize}%</span>
            </div>
            <input 
                type="range" 
                min="20" 
                max="150" 
                value={fontSize} 
                onChange={(e) => onFontSizeChange(Number(e.target.value))}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
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
            return (
              <div
                key={sub.id}
                ref={active ? activeSubtitleRef : null}
                className={`p-3 rounded-lg border transition-all duration-200 ${
                  active
                    ? 'bg-gray-800 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                    : 'bg-gray-850 border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={14} className="text-gray-400" />
                  <input
                    type="text"
                    className="bg-transparent text-xs text-gray-400 font-mono focus:text-blue-400 focus:outline-none w-24"
                    value={secondsToSrtTime(sub.startTime)}
                    onChange={(e) =>
                      onUpdateSubtitle(sub.id, {
                        startTime: srtTimeToSeconds(e.target.value),
                      })
                    }
                    onBlur={() => onSeek(sub.startTime)} 
                  />
                  <span className="text-gray-600 text-xs">→</span>
                  <input
                    type="text"
                    className="bg-transparent text-xs text-gray-400 font-mono focus:text-blue-400 focus:outline-none w-24"
                    value={secondsToSrtTime(sub.endTime)}
                    onChange={(e) =>
                      onUpdateSubtitle(sub.id, {
                        endTime: srtTimeToSeconds(e.target.value),
                      })
                    }
                  />
                  <div className="ml-auto">
                    <button
                      onClick={() => onDeleteSubtitle(sub.id)}
                      className="text-gray-500 hover:text-red-400 p-1"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
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