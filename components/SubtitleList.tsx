// src/components/SubtitleList.tsx
import React from 'react';
import { Subtitle } from '../types';
import { srtTimeToSeconds, secondsToSrtTime } from '../utils/srtHelper';
import { Plus, Trash2 } from 'lucide-react';

interface SubtitleListProps {
  subtitles: Subtitle[];
  currentTime: number;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  onUpdateSubtitle: (id: number, data: Partial<Subtitle>) => void;
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
  const handleChangeTime = (id: number, field: 'startTime' | 'endTime', value: string) => {
    const seconds = srtTimeToSeconds(value);
    onUpdateSubtitle(id, { [field]: seconds } as Partial<Subtitle>);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header / controles */}
      <div className="p-3 border-b border-gray-800 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-200">Legendas</span>
        <button
          onClick={onAddSubtitle}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium"
        >
          <Plus size={14} />
          Nova
        </button>
      </div>

      <div className="p-3 border-b border-gray-800 text-xs text-gray-300 flex items-center gap-2">
        <span>Tamanho da fonte:</span>
        <input
          type="range"
          min={24}
          max={80}
          value={fontSize}
          onChange={(e) => onFontSizeChange(Number(e.target.value))}
          className="flex-1"
        />
        <span>{Math.round(fontSize)}px</span>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {subtitles.length === 0 && (
          <div className="p-4 text-xs text-gray-500">
            Nenhuma legenda. Importe um SRT ou clique em <b>Nova</b>.
          </div>
        )}

        {subtitles.map((sub) => {
          const active =
            currentTime >= sub.startTime && currentTime <= sub.endTime;

          return (
            <div
              key={sub.id}
              className={`px-3 py-2 border-b border-gray-800 text-xs cursor-pointer ${
                active ? '' : 'hover:bg-gray-850'
              }`}
              onClick={() => onSeek(sub.startTime)}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">#{sub.id}</span>
                  <input
                    type="text"
                    className="bg-gray-800 border border-gray-700 rounded px-1 py-0.5 w-28 text-[10px]"
                    value={secondsToSrtTime(sub.startTime)}
                    onChange={(e) =>
                      handleChangeTime(sub.id, 'startTime', e.target.value)
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-gray-500 text-[10px]">→</span>
                  <input
                    type="text"
                    className="bg-gray-800 border border-gray-700 rounded px-1 py-0.5 w-28 text-[10px]"
                    value={secondsToSrtTime(sub.endTime)}
                    onChange={(e) =>
                      handleChangeTime(sub.id, 'endTime', e.target.value)
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <button
                  className="p-1 rounded bg-red-900/40 hover:bg-red-800 text-red-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSubtitle(sub.id);
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>

              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[11px] leading-snug resize-none"
                rows={2}
                value={sub.text}
                onChange={(e) =>
                  onUpdateSubtitle(sub.id, { text: e.target.value })
                }
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
