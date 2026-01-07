import React, { useRef, useMemo } from 'react';
import { Subtitle } from '../types';

interface TimelineProps {
  duration: number;
  currentTime: number;
  subtitles: Subtitle[];
  onSeek: (time: number) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  duration,
  currentTime,
  subtitles,
  onSeek,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current || duration <= 0) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    onSeek(percentage * duration);
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="h-12 bg-gray-900 border-t border-gray-800 relative select-none">
      <div 
        ref={containerRef}
        className="absolute inset-0 cursor-pointer"
        onMouseDown={handleMouseDown}
      >
        {/* Background Grid/Ruler (Optional) */}
        
        {/* Subtitle Blocks */}
        {subtitles.map((sub) => {
           if (sub.endTime > duration && duration > 0) return null; // Safety check
           
           const left = (sub.startTime / duration) * 100;
           const width = ((sub.endTime - sub.startTime) / duration) * 100;
           const isActive = currentTime >= sub.startTime && currentTime <= sub.endTime;

           return (
             <div
               key={sub.id}
               className={`absolute top-2 h-4 rounded-sm text-[8px] overflow-hidden whitespace-nowrap px-1 border-l border-r border-black/20
                 ${isActive ? 'bg-blue-500 text-white z-10' : 'bg-blue-500/30 text-blue-200'}
               `}
               style={{
                 left: `${left}%`,
                 width: `${Math.max(width, 0.2)}%`, // Min width for visibility
               }}
               title={`${sub.text} (${sub.startTime.toFixed(1)}s - ${sub.endTime.toFixed(1)}s)`}
             >
               {sub.text}
             </div>
           );
        })}

        {/* Playhead */}
        <div 
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none shadow-[0_0_4px_rgba(239,68,68,0.8)]"
            style={{ left: `${progressPercentage}%` }}
        >
            <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 transform rotate-45" />
        </div>
      </div>
      
      {/* Time Labels */}
      <div className="absolute bottom-0 left-2 text-[10px] text-gray-500 font-mono pointer-events-none">
         {new Date(currentTime * 1000).toISOString().substr(14, 5)}
      </div>
      <div className="absolute bottom-0 right-2 text-[10px] text-gray-500 font-mono pointer-events-none">
         {new Date(duration * 1000).toISOString().substr(14, 5)}
      </div>
    </div>
  );
};
