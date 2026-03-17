import React, { useState } from 'react';
import { ExportStatus } from './types';
import { SubtitleList } from './components/SubtitleList';
import { LooseTextList } from './components/LooseTextList';
import { VideoPlayer } from './components/VideoPlayer';
import { Timeline } from './components/Timeline';
import { FindReplaceModal } from './components/FindReplaceModal';
import { useGlossary } from './hooks/useGlossary';
import { GlossaryModal } from './components/GlossaryModal';
import { Upload, FileText, Film, Download, Trash2, Search, Book, Layers, AlignLeft, Key } from 'lucide-react';
import { useVideoPlayer } from './hooks/useVideoPlayer';
import { useSubtitles } from './hooks/useSubtitles';
import { useLooseTexts } from './hooks/useLooseTexts';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { translateSubtitlesWithGemini } from './utils/geminiHelper';
import { useApiKeys } from './hooks/useApiKeys';
import { ApiKeyModal } from './components/ApiKeyModal';

const App: React.FC = () => {
  const {
    rules,
    addRule,
    removeRule,
    toggleRule,
    exportGlossary,
    importGlossary,
    applyRulesToSubtitles,
  } = useGlossary();

  const {
    videoState,
    exportStatus,
    setExportStatus,
    handleVideoUpload,
    handleTimeUpdate,
    handleDurationChange,
    handlePlayStateChange,
  } = useVideoPlayer();

  const {
    subtitles,
    handleSrtUpload,
    updateSubtitle,
    deleteSubtitle,
    addSubtitle,
    clearSubtitles,
    downloadSrt,
    replaceText,
    applyGlossaryToCurrent,
    shiftAllSubtitles,
    undo,
    redo,
    setAllSubtitles,
  } = useSubtitles(videoState.currentTime, rules);

  const {
    looseTexts,
    addLooseText,
    updateLooseText,
    deleteLooseText,
    clearLooseTexts,
    downloadLooseTexts
  } = useLooseTexts();

  const {
    apiKeys,
    activeKeyId,
    addApiKey,
    removeApiKey,
    selectApiKey,
    getActiveKey,
  } = useApiKeys();

  const [fontSize, setFontSize] = useState<number>(11);
  const [outlineSize, setOutlineSize] = useState<number>(6);
  const [shadowSize, setShadowSize] = useState<number>(0);
  const [letterSpacing, setLetterSpacing] = useState<number>(0.15);
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<number | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'subtitles' | 'looseTexts'>('subtitles');


  const handleSeek = (time: number) => {
    const videoEl = document.querySelector('video');
    if (videoEl) {
      videoEl.currentTime = time;
    }
  };

  const handleTogglePlay = () => {
    const videoEl = document.querySelector('video');
    if (videoEl) {
      if (videoEl.paused) {
        videoEl.play();
      } else {
        videoEl.pause();
      }
    }
  };

  const handleRelativeSeek = (seconds: number) => {
    const videoEl = document.querySelector('video');
    if (videoEl) {
      videoEl.currentTime += seconds;
    }
  };

  const handleTranslate = async () => {
    if (subtitles.length === 0) return;

    const apiKey = getActiveKey();
    if (!apiKey) {
      alert('Por favor, configure uma chave da API Gemini primeiro.');
      setIsApiKeyModalOpen(true);
      return;
    }

    setIsTranslating(true);
    try {
      const translated = await translateSubtitlesWithGemini(subtitles, apiKey);
      setAllSubtitles(translated);
      alert('Tradução concluída com sucesso!');
    } catch (error: any) {
      alert(`Erro na tradução: ${error.message}`);
    } finally {
      setIsTranslating(false);
    }
  };

  // Shortcut Handlers
  const handleSetStart = () => {
    const targetId = selectedSubtitleId || subtitles.find(s => videoState.currentTime >= s.startTime && videoState.currentTime <= s.endTime)?.id;
    if (targetId) {
        updateSubtitle(targetId, { startTime: videoState.currentTime });
    }
  };

  const handleSetEnd = () => {
    const targetId = selectedSubtitleId || subtitles.find(s => videoState.currentTime >= s.startTime && videoState.currentTime <= s.endTime)?.id;
    if (targetId) {
        updateSubtitle(targetId, { endTime: videoState.currentTime });
    }
  };

  const handleSelectNext = () => {
      if (!subtitles.length) return;
      const sorted = [...subtitles].sort((a, b) => a.startTime - b.startTime);
      const currentIndex = selectedSubtitleId 
        ? sorted.findIndex(s => s.id === selectedSubtitleId)
        : -1;
      
      // If none selected, pick the first one
      if (currentIndex === -1) {
          setSelectedSubtitleId(sorted[0].id);
          return;
      }
      
      const nextIndex = currentIndex + 1;
      if (nextIndex < sorted.length) {
        setSelectedSubtitleId(sorted[nextIndex].id);
      }
  };

  const handleSelectPrev = () => {
      if (!subtitles.length) return;
      const sorted = [...subtitles].sort((a, b) => a.startTime - b.startTime);
      const currentIndex = selectedSubtitleId 
        ? sorted.findIndex(s => s.id === selectedSubtitleId)
        : -1;
      
      if (currentIndex > 0) {
        setSelectedSubtitleId(sorted[currentIndex - 1].id);
      } else if (currentIndex === -1) {
         setSelectedSubtitleId(sorted[0].id);
      }
  };

  useKeyboardShortcuts({
    onPlayPause: handleTogglePlay,
    onSeek: handleRelativeSeek,
    onUndo: undo,
    onRedo: redo,
    onSetStart: handleSetStart,
    onSetEnd: handleSetEnd,
    onPrevSub: handleSelectPrev,
    onNextSub: handleSelectNext,
    enabled: !!videoState.url,
  });

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      <FindReplaceModal 
        isOpen={isFindReplaceOpen} 
        onClose={() => setIsFindReplaceOpen(false)}
        onReplace={replaceText}
      />
      
      <GlossaryModal
        isOpen={isGlossaryOpen}
        onClose={() => setIsGlossaryOpen(false)}
        rules={rules}
        onAddRule={addRule}
        onRemoveRule={removeRule}
        onToggleRule={toggleRule}
        onApplyRules={() => applyGlossaryToCurrent(rules)}
        onExportGlossary={exportGlossary}
        onImportGlossary={importGlossary}
      />

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        apiKeys={apiKeys}
        activeKeyId={activeKeyId}
        onAddKey={addApiKey}
        onRemoveKey={removeApiKey}
        onSelectKey={selectApiKey}
      />

      {/* Header */}
      <header className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-2">
          <Film className="text-blue-500" />
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            SubCine Studio
          </h1>
        </div>
        
        <div className="flex gap-4">
          {/* Action Buttons */}
          <button
              onClick={() => setIsApiKeyModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-900/30 hover:bg-purple-900/50 text-purple-400 rounded-lg transition-colors text-sm border border-purple-900/50"
              title="Gerenciar Chaves API Gemini"
            >
              <Key size={16} />
              <span className="hidden sm:inline">Chaves API</span>
          </button>

          <button
              onClick={() => setIsGlossaryOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-900/30 hover:bg-yellow-900/50 text-yellow-400 rounded-lg transition-colors text-sm border border-yellow-900/50"
              title="Gerenciar Glossário de Substituições"
            >
              <Book size={16} />
              <span className="hidden sm:inline">Glossário</span>
          </button>

          {subtitles.length > 0 && (
            <>
              <button
                onClick={() => setIsFindReplaceOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors text-sm border border-gray-700"
                title="Substituir Texto"
              >
                <Search size={16} />
                <span className="hidden sm:inline">Substituir</span>
              </button>

              <button
                onClick={clearSubtitles}
                className="flex items-center gap-2 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors text-sm border border-red-900/50"
                title="Apagar todas as legendas"
              >
                <Trash2 size={16} />
              </button>

              <button
                onClick={downloadSrt}
                className="flex items-center gap-2 px-4 py-2 bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 rounded-lg transition-colors text-sm border border-blue-900/50"
              >
                <Download size={16} />
                <span>Baixar SRT</span>
              </button>
            </>
          )}

          <label className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors text-sm border border-gray-700">
            <Upload size={16} />
            <span className="truncate max-w-[150px]">
              {videoState.file ? videoState.file.name : 'Carregar Vídeo'}
            </span>
            <input type="file" accept="video/mp4,video/webm,video/ogg,video/*" onChange={handleVideoUpload} className="hidden" />
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
            looseTexts={looseTexts}
            exportStatus={exportStatus}
            fontSize={fontSize}
            outlineSize={outlineSize}
            shadowSize={shadowSize}
            letterSpacing={letterSpacing}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={handleDurationChange}
            onPlayStateChange={handlePlayStateChange}
            onExportStart={() => setExportStatus(ExportStatus.RECORDING)}
            onExportFinish={() => setExportStatus(ExportStatus.COMPLETED)}
            onUpdateLooseText={updateLooseText}
          />
          
          <div className="mt-4 bg-black rounded-lg border border-gray-800 overflow-hidden">
            <Timeline 
                duration={videoState.duration} 
                currentTime={videoState.currentTime}
                subtitles={subtitles}
                onSeek={handleSeek}
            />
          </div>
        </div>

        {/* Right: Subtitle Editor */}
        <div className="w-[400px] shrink-0 h-full border-l border-gray-800 bg-gray-900 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-gray-800 shrink-0">
             <button 
               className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'subtitles' ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800/50' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'}`}
               onClick={() => setActiveTab('subtitles')}
             >
               <AlignLeft size={16} />
               Legendas
             </button>
             <button 
               className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'looseTexts' ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800/50' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'}`}
               onClick={() => setActiveTab('looseTexts')}
             >
               <Layers size={16} />
               Textos Avulsos
             </button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === 'subtitles' ? (
              <SubtitleList
                subtitles={subtitles}
                currentTime={videoState.currentTime}
                fontSize={fontSize}
                onFontSizeChange={setFontSize}
                outlineSize={outlineSize}
                onOutlineSizeChange={setOutlineSize}
                shadowSize={shadowSize}
                onShadowSizeChange={setShadowSize}
                letterSpacing={letterSpacing}
                onLetterSpacingChange={setLetterSpacing}
                onUpdateSubtitle={updateSubtitle}
                onDeleteSubtitle={deleteSubtitle}
                onAddSubtitle={addSubtitle}
                onSeek={handleSeek}
                onShiftAll={shiftAllSubtitles}
                selectedSubtitleId={selectedSubtitleId}
                onSelect={setSelectedSubtitleId}
                onTranslate={handleTranslate}
                isTranslating={isTranslating}
              />
            ) : (
              <LooseTextList 
                 looseTexts={looseTexts}
                 currentTime={videoState.currentTime}
                 onUpdateLooseText={updateLooseText}
                 onDeleteLooseText={deleteLooseText}
                 onClearLooseTexts={clearLooseTexts}
                 onDownloadLooseTexts={downloadLooseTexts}
                 onAddLooseText={() => addLooseText({
                     id: Date.now(),
                     startTime: videoState.currentTime,
                     endTime: videoState.currentTime + 3,
                     text: 'Novo texto avulso',
                     x: 0.5,
                     y: 0.5,
                     fontSize: fontSize || 11
                 })}
                 onSeek={handleSeek}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
