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

  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  
  // Subtitle Positioning State
  const [subtitlePos, setSubtitlePos] = useState({ x: 0.5, y: 0.85 });
  const [isDragging, setIsDragging] = useState(false);
  const [isHoveringSubtitle, setIsHoveringSubtitle] = useState(false);
  const subtitleRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  // Setup video source
  useEffect(() => {
    if (videoState.url && videoRef.current) {
      videoRef.current.src = videoState.url;
      // Reset download state when video changes
      setDownloadUrl(null);
    }
  }, [videoState.url]);

  // Helper function to wrap text
  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    // Basic protection against empty text
    if (!text) return [];

    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0] || '';

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
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Match canvas size to video size
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    // 1. Draw Video Frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 2. Draw Subtitles
    const currentTime = video.currentTime;
    const activeSubs = subtitles.filter(
      (s) => currentTime >= s.startTime && currentTime <= s.endTime
    );

    if (activeSubs.length > 0) {
      // Style settings
      // Calculate font size relative to video height based on the scale prop
      const calculatedFontSize = Math.max(12, Math.round(canvas.height * (fontSizeScale / 1000)));
      
      // CapCut style: Arial Black / Heavy weight, Sans-serif
      ctx.font = `900 ${calculatedFontSize}px Arial, "Helvetica Neue", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle'; 
      ctx.fillStyle = '#FFFFFF'; // Pure white
      ctx.strokeStyle = '#000000'; // Pure black
      ctx.lineWidth = calculatedFontSize * 0.25; // Thick stroke for readability
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;

      // Hard Shadow (CapCut style often uses a crisp drop shadow or just thick stroke)
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 0; // Hard edge
      ctx.shadowOffsetX = 2; // Slight offset
      ctx.shadowOffsetY = 2;

      // Max width logic (85% of screen width to be safe)
      const maxLineWidth = canvas.width * 0.85;

      // Process Text Block with Wrapping
      const rawLines = activeSubs.map(s => s.text.split('\n')).flat();
      const wrappedLines: string[] = [];
      
      rawLines.forEach(line => {
          wrappedLines.push(...wrapText(ctx, line, maxLineWidth));
      });

      // Measure final block size
      let maxWidth = 0;
      wrappedLines.forEach(line => {
         const metrics = ctx.measureText(line);
         if (metrics.width > maxWidth) maxWidth = metrics.width;
      });

      const lineHeight = calculatedFontSize * 1.25;
      const totalHeight = wrappedLines.length * lineHeight;
      
      // Calculate Position
      const centerX = canvas.width * subtitlePos.x;
      const anchorY = canvas.height * subtitlePos.y; 
      const startY = anchorY - totalHeight;

      // Update Hit Rect for Dragging
      const padding = calculatedFontSize * 0.5;
      subtitleRectRef.current = {
          x: centerX - maxWidth / 2 - padding,
          y: startY - padding,
          w: maxWidth + padding * 2,
          h: totalHeight + padding * 2
      };

      // Draw Visual Feedback for Interaction (No shadow for UI elements)
      ctx.shadowColor = "transparent";
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      if (isDragging || isHoveringSubtitle) {
        ctx.save();
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'; // Blue
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.strokeRect(
           subtitleRectRef.current.x,
           subtitleRectRef.current.y,
           subtitleRectRef.current.w,
           subtitleRectRef.current.h
        );
        
        // Draw drag handle indicator if hovering
        if (isHoveringSubtitle && !isDragging) {
           ctx.fillStyle = 'rgba(59, 130, 246, 0.8)';
           ctx.fillRect(
             subtitleRectRef.current.x + subtitleRectRef.current.w / 2 - 20, 
             subtitleRectRef.current.y - 10, 
             40, 
             4
           );
        }
        ctx.restore();
      }
      
      // Restore Shadow for text
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      // Draw Text Lines
      wrappedLines.forEach((line, index) => {
        const lineY = startY + (index * lineHeight) + (lineHeight / 2); 
        const x = centerX;
        // Stroke first (outline)
        ctx.strokeText(line, x, lineY);
        // Fill second (text face)
        ctx.fillText(line, x, lineY);
      });
    } else {
      subtitleRectRef.current = null;
    }

    // Loop
    animationFrameRef.current = requestAnimationFrame(drawFrame);
  };

  // Start/Stop Rendering loop based on play state
  useEffect(() => {
    if (videoState.url) {
        animationFrameRef.current = requestAnimationFrame(drawFrame);
    }
    
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  });

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

  // Mouse Interaction Handlers
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
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      const { x, y } = getMousePos(e);
      const canvas = canvasRef.current;

      if (isDragging && canvas) {
          // Update position (clamp to 0-1)
          const newX = Math.max(0, Math.min(1, x / canvas.width));
          const newY = Math.max(0, Math.min(1, y / canvas.height));
          setSubtitlePos({ x: newX, y: newY });
          return;
      }

      // Check hover
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
          togglePlay();
      }
  };

  const handleMouseLeave = () => {
      setIsDragging(false);
      setIsHoveringSubtitle(false);
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Viewer Area */}
      <div className="relative bg-black rounded-lg overflow-hidden shadow-2xl border border-gray-800 flex-1 flex items-center justify-center group">
        
        <video
          ref={videoRef}
          className="absolute opacity-0 pointer-events-none w-0 h-0"
          onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
          onDurationChange={(e) => onDurationChange(e.currentTarget.duration)}
          onPlay={() => onPlayStateChange(true)}
          onPause={() => onPlayStateChange(false)}
          onEnded={() => onPlayStateChange(false)}
          playsInline
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
        
        {/* Overlay Instruction for Dragging */}
        {videoState.url && subtitles.length > 0 && !isDragging && !videoState.isPlaying && (
             <div className="absolute top-4 right-4 bg-black/60 text-white text-xs px-2 py-1 rounded border border-white/20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                <Move size={12} />
                Arraste a legenda para mover
             </div>
        )}

        {exportStatus === ExportStatus.RECORDING && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50 text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-lg font-semibold">Renderizando Vídeo...</p>
            <p className="text-sm text-gray-400">Por favor aguarde, o vídeo está tocando para capturar.</p>
            <p className="text-xs text-gray-500 mt-2">Não troque de aba.</p>
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
             className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors"
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