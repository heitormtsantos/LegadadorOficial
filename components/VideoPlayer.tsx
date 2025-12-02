import React, { useRef, useEffect, useState } from 'react';
import { Subtitle, VideoState, ExportStatus } from '../types';
import { secondsToSrtTime } from '../utils/srtHelper';
import { Play, Pause, Download, MonitorPlay, Move } from 'lucide-react';

interface VideoPlayerProps {
  videoState: VideoState;
  subtitles: Subtitle[];
  exportStatus: ExportStatus;
  fontSize: number;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onPlayStateChange: (playing: boolean) => void;
  onExportStart: () => void;
  onExportFinish: (blobUrl: string) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoState,
  subtitles,
  exportStatus,
  fontSize: fontSizeScale,
  onTimeUpdate,
  onDurationChange,
  onPlayStateChange,
  onExportStart,
  onExportFinish,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number>();

  // Refs for rendering loop to avoid stale closures
  const subtitlesRef = useRef(subtitles);
  const fontSizeRef = useRef(fontSizeScale);
  const subtitlePosRef = useRef({ x: 0.5, y: 0.85 });

  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  
  // Subtitle Positioning State
  const [subtitlePos, setSubtitlePos] = useState({ x: 0.5, y: 0.85 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isHoveringSubtitle, setIsHoveringSubtitle] = useState(false);
  const subtitleRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  // Sync refs
  useEffect(() => { subtitlesRef.current = subtitles; }, [subtitles]);
  useEffect(() => { fontSizeRef.current = fontSizeScale; }, [fontSizeScale]);
  useEffect(() => { subtitlePosRef.current = subtitlePos; }, [subtitlePos]);

  // Setup video source safely
  useEffect(() => {
    const video = videoRef.current;
    if (video && videoState.url) {
      // Only set src if it's different to avoid reloading/errors
      if (video.src !== videoState.url) {
          video.src = videoState.url;
          video.load(); // Explicit load
          setDownloadUrl(null);
      }
    }
  }, [videoState.url]);

  // Helper function to wrap text
  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    if (!text || text.trim() === '') return [];

    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + " " + word).width;
      if (width < maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  };

  // The Rendering Loop
  const drawFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Use requestAnimationFrame at the end, or early return
    if (!video || !canvas) {
        animationFrameRef.current = requestAnimationFrame(drawFrame);
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
         animationFrameRef.current = requestAnimationFrame(drawFrame);
         return;
    }

    // Match canvas size to video size
    if (video.videoWidth > 0 && video.videoHeight > 0) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        }
    }

    // 1. Clear & Draw Video Frame
    ctx.clearRect(0,0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 2. Draw Subtitles using Refs (latest state)
    const currentTime = video.currentTime;
    const currentSubtitles = subtitlesRef.current;
    const currentFontSize = fontSizeRef.current;
    const currentPos = subtitlePosRef.current;

    const activeSubs = currentSubtitles.filter(
      (s) => currentTime >= s.startTime && currentTime <= s.endTime
    );

    if (activeSubs.length > 0) {
      ctx.save(); // Save state to prevent leaking styles

      // Style settings
      // Calculate font size relative to video height
      const baseSize = canvas.height * (currentFontSize / 1000);
      const calculatedFontSize = Math.max(12, Math.round(baseSize));
      
      // CapCut style: Arial Black / Heavy weight
      ctx.font = `900 ${calculatedFontSize}px Arial, "Helvetica Neue", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle'; 
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = calculatedFontSize * 0.15; // Thick stroke
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;

      // Hard Shadow
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 0; 
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;

      // Max width logic (90% of screen width)
      const maxLineWidth = canvas.width * 0.90;

      // Process Text Block
      const rawLines = activeSubs.map(s => s.text.split('\n')).flat();
      const wrappedLines: string[] = [];
      
      rawLines.forEach(line => {
          wrappedLines.push(...wrapText(ctx, line, maxLineWidth));
      });

      // Measure final block size
      let maxTextWidth = 0;
      wrappedLines.forEach(line => {
         const metrics = ctx.measureText(line);
         if (metrics.width > maxTextWidth) maxTextWidth = metrics.width;
      });

      const lineHeight = calculatedFontSize * 1.25;
      const totalHeight = wrappedLines.length * lineHeight;
      
      // --- POSITIONING LOGIC WITH CLAMPING ---
      
      let centerX = canvas.width * currentPos.x;
      let bottomY = canvas.height * currentPos.y; 

      // Safe Zone (padding from edges)
      const padding = Math.max(20, canvas.width * 0.05); 
      const halfWidth = maxTextWidth / 2;

      // Clamp Horizontal
      if (centerX - halfWidth < padding) {
          centerX = halfWidth + padding;
      } else if (centerX + halfWidth > canvas.width - padding) {
          centerX = canvas.width - padding - halfWidth;
      }

      // Clamp Vertical
      const bboxTopY = bottomY - totalHeight;
      if (bboxTopY < padding) {
          bottomY = totalHeight + padding;
      }
      if (bottomY > canvas.height - padding) {
          bottomY = canvas.height - padding;
      }
      
      const clampedTopY = bottomY - totalHeight;

      // Update Hit Rect for Dragging
      const touchPadding = calculatedFontSize * 0.8; 
      subtitleRectRef.current = {
          x: centerX - halfWidth - touchPadding,
          y: clampedTopY - touchPadding,
          w: maxTextWidth + touchPadding * 2,
          h: totalHeight + touchPadding * 2
      };

      // Draw Visual Feedback for Dragging
      if (isDragging || isHoveringSubtitle) {
        ctx.save();
        ctx.shadowColor = "transparent";
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)'; // Bright Blue
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);
        ctx.strokeRect(
           subtitleRectRef.current.x,
           subtitleRectRef.current.y,
           subtitleRectRef.current.w,
           subtitleRectRef.current.h
        );
        ctx.restore();
      }
      
      // Draw Text Lines
      wrappedLines.forEach((line, index) => {
        const lineY = clampedTopY + (index * lineHeight) + (lineHeight / 2); 
        
        ctx.strokeText(line, centerX, lineY);
        ctx.fillText(line, centerX, lineY);
      });
      
      ctx.restore(); // Restore context

    } else {
      subtitleRectRef.current = null;
    }

    // Loop
    animationFrameRef.current = requestAnimationFrame(drawFrame);
  };

  // Start/Stop Rendering loop
  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(drawFrame);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const handleExport = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    onExportStart();
    setDownloadUrl(null);

    const stream = canvas.captureStream(30); 
    
    let audioTrack: MediaStreamTrack | undefined;
    try {
      // @ts-ignore
      const videoStream = video.captureStream ? video.captureStream() : video.mozCaptureStream ? video.mozCaptureStream() : null;
      if (videoStream) {
        audioTrack = videoStream.getAudioTracks()[0];
        if (audioTrack) {
          stream.addTrack(audioTrack);
        }
      }
    } catch (e) {
      console.warn("Could not capture audio track.", e);
    }

    const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
    });
    
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      onExportFinish(url);
      
      video.currentTime = 0;
      onPlayStateChange(false);
    };

    video.currentTime = 0;
    video.play();
    mediaRecorder.start();

    video.onended = () => {
      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    };
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoState.isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  // --- MOUSE INTERACTION ---

  const getMousePos = (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY
      };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      if (!subtitleRectRef.current) return;
      const { x, y } = getMousePos(e);
      
      if (
          x >= subtitleRectRef.current.x &&
          x <= subtitleRectRef.current.x + subtitleRectRef.current.w &&
          y >= subtitleRectRef.current.y &&
          y <= subtitleRectRef.current.y + subtitleRectRef.current.h
      ) {
          setIsDragging(true);
          
          const rect = subtitleRectRef.current;
          const currentAnchorX = rect.x + rect.w / 2;
          const currentAnchorY = rect.y + rect.h - (rect.h * 0.1); 
          
          setDragOffset({
              x: x - currentAnchorX,
              y: y - currentAnchorY
          });
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      const { x, y } = getMousePos(e);
      const canvas = canvasRef.current;

      if (isDragging && canvas) {
          const targetAnchorX = x - dragOffset.x;
          const targetAnchorY = y - dragOffset.y;

          const newX = targetAnchorX / canvas.width;
          const newY = targetAnchorY / canvas.height;
          
          // Update via setSubtitlePos (React State) which will sync to ref
          setSubtitlePos({ x: newX, y: newY });
          return;
      }

      if (subtitleRectRef.current) {
          const isHit = (
              x >= subtitleRectRef.current.x &&
              x <= subtitleRectRef.current.x + subtitleRectRef.current.w &&
              y >= subtitleRectRef.current.y &&
              y <= subtitleRectRef.current.y + subtitleRectRef.current.h
          );
          setIsHoveringSubtitle(isHit);
      } else {
          setIsHoveringSubtitle(false);
      }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
      if (isDragging) {
          setIsDragging(false);
      } else {
          if (!isHoveringSubtitle) {
              togglePlay();
          }
      }
  };

  const handleMouseLeave = () => {
      setIsDragging(false);
      setIsHoveringSubtitle(false);
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Viewer Area */}
      <div className="relative bg-black rounded-lg overflow-hidden shadow-2xl border border-gray-800 flex-1 flex items-center justify-center group select-none">
        
        <video
          ref={videoRef}
          className="absolute opacity-0 pointer-events-none w-0 h-0"
          onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
          onDurationChange={(e) => onDurationChange(e.currentTarget.duration)}
          onPlay={() => onPlayStateChange(true)}
          onPause={() => onPlayStateChange(false)}
          onEnded={() => onPlayStateChange(false)}
          playsInline
          preload="metadata"
          crossOrigin="anonymous"
        />

        {!videoState.url ? (
          <div className="text-gray-500 flex flex-col items-center">
            <MonitorPlay size={48} className="mb-4 opacity-50" />
            <p>Selecione um video para começar</p>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className={`max-w-full max-h-full object-contain touch-none ${
                isHoveringSubtitle || isDragging ? 'cursor-move' : 'cursor-pointer'
            }`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          />
        )}
        
        {videoState.url && subtitles.length > 0 && !isDragging && !videoState.isPlaying && (
             <div className="absolute top-4 right-4 bg-black/60 text-white text-xs px-2 py-1 rounded border border-white/20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 z-10">
                <Move size={12} />
                Arrastar Legenda
             </div>
        )}

        {exportStatus === ExportStatus.RECORDING && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-lg font-semibold">Renderizando Vídeo...</p>
            <p className="text-sm text-gray-400">Por favor aguarde o fim da reprodução.</p>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-between bg-gray-900 p-4 rounded-lg border border-gray-800">
        <div className="flex items-center gap-4">
          <button
            onClick={togglePlay}
            disabled={!videoState.url || exportStatus === ExportStatus.RECORDING}
            className="p-3 bg-gray-800 rounded-full hover:bg-gray-700 disabled:opacity-50 text-white transition-colors"
          >
            {videoState.isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <div className="text-sm font-mono text-gray-400">
            {secondsToSrtTime(videoState.currentTime).split(',')[0]} /{' '}
            {secondsToSrtTime(videoState.duration).split(',')[0]}
          </div>
        </div>

        <div className="flex gap-3">
          {downloadUrl && exportStatus === ExportStatus.COMPLETED && (
             <a
             href={downloadUrl}
             download="video_legendado.webm"
             className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors animate-pulse"
           >
             <Download size={18} />
             Baixar Resultado
           </a>
          )}
          
          <button
            onClick={handleExport}
            disabled={!videoState.url || exportStatus === ExportStatus.RECORDING}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
             {exportStatus === ExportStatus.RECORDING ? 'Processando...' : 'Renderizar & Baixar'}
          </button>
        </div>
      </div>
    </div>
  );
};