import React, { useState, useCallback } from 'react';
import { Subtitle, VideoState, ExportStatus } from './types';
import { parseSRT, srtTimeToSeconds } from './utils/srtHelper';
import { SubtitleList } from './components/SubtitleList';
import { VideoPlayer } from './components/VideoPlayer';
import { Upload, FileText, Film } from 'lucide-react';

const App: React.FC = () => {
  // State
  const [videoState, setVideoState] = useState<VideoState>({
    file: null,
    url: null,
    duration: 0,
    currentTime: 0,
    isPlaying: false,
  });
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [exportStatus, setExportStatus] = useState<ExportStatus>(ExportStatus.IDLE);
  const [fontSize, setFontSize] = useState<number>(50); // Default scale value (approx 5% of height)

  // Handlers
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoState((prev) => ({
        ...prev,
        file,
        url,
        currentTime: 0,
        isPlaying: false,
      }));
      setExportStatus(ExportStatus.IDLE);
    }
  };

  const handleSrtUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          const parsed = parseSRT(text);
          setSubtitles(parsed);
        }
      };
      reader.readAsText(file);
    }
  };

  const updateSubtitle = (id: number, updated: Partial<Subtitle>) => {
    setSubtitles((prev) =>
      prev.map((sub) => (sub.id === id ? { ...sub, ...updated } : sub))
    );
  };

  const deleteSubtitle = (id: number) => {
    setSubtitles((prev) => prev.filter((sub) => sub.id !== id));
  };

  const addSubtitle = () => {
    const newId = subtitles.length > 0 ? Math.max(...subtitles.map((s) => s.id)) + 1 : 1;
    // Add after current time or at 0
    const start = videoState.currentTime;
    const end = start + 3; // default 3 seconds duration
    
    const newSub: Subtitle = {
      id: newId,
      startTime: start,
      endTime: end,
      text: 'Nova Legenda',
    };
    
    setSubtitles((prev) => [...prev, newSub].sort((a, b) => a.startTime - b.startTime));
  };

  const handleTimeUpdate = useCallback((time: number) => {
    setVideoState((prev) => ({ ...prev, currentTime: time }));
  }, []);

  const handleDurationChange = useCallback((duration: number) => {
    setVideoState((prev) => ({ ...prev, duration }));
  }, []);

  const handlePlayStateChange = useCallback((isPlaying: boolean) => {
    setVideoState((prev) => ({ ...prev, isPlaying }));
  }, []);

  const handleSeek = (time: number) => {
     // This function is tricky because we need to imperatively tell the video element to seek.
     // However, the video element is inside VideoPlayer.
     // To keep it clean, we will update the state, but we really need a way to pass this down effectively.
     // For this architecture, let's just update the video element directly via a DOM selection if we wanted to be dirty,
     // but a better way is accessing the video ref. 
     // Since VideoPlayer owns the ref, we actually need to change logic: 
     // Let's rely on VideoPlayer detecting a prop change? No, seeking is imperative.
     // We will cheat slightly for simplicity: find the video element in DOM. 
     // In a production app, use a Context or forwardRef.
     const videoEl = document.querySelector('video');
     if (videoEl) {
       videoEl.currentTime = time;
     }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      {/* Header */}
      <header className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-2">
          <Film className="text-blue-500" />
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            SubCine Studio
          </h1>
        </div>
        
        <div className="flex gap-4">
          <label className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors text-sm border border-gray-700">
            <Upload size={16} />
            <span className="truncate max-w-[150px]">
              {videoState.file ? videoState.file.name : 'Carregar Vídeo'}
            </span>
            <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
          </label>
          
          <label className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors text-sm border border-gray-700">
            <FileText size={16} />
             <span className="truncate max-w-[150px]">
              {subtitles.length > 0 ? `${subtitles.length} Legendas` : 'Carregar SRT'}
            </span>
            <input type="file" accept=".srt" onChange={handleSrtUpload} className="hidden" />
          </label>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left: Video Player */}
        <div className="flex-1 p-6 flex flex-col min-w-0">
          <VideoPlayer
            videoState={videoState}
            subtitles={subtitles}
            exportStatus={exportStatus}
            fontSize={fontSize}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={handleDurationChange}
            onPlayStateChange={handlePlayStateChange}
            onExportStart={() => setExportStatus(ExportStatus.RECORDING)}
            onExportFinish={() => setExportStatus(ExportStatus.COMPLETED)}
          />
        </div>

        {/* Right: Subtitle Editor */}
        <div className="w-[400px] shrink-0 h-full border-l border-gray-800 bg-gray-900">
          <SubtitleList
            subtitles={subtitles}
            currentTime={videoState.currentTime}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
            onUpdateSubtitle={updateSubtitle}
            onDeleteSubtitle={deleteSubtitle}
            onAddSubtitle={addSubtitle}
            onSeek={handleSeek}
          />
        </div>
      </main>
    </div>
  );
};

export default App;