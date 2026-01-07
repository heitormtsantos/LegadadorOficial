import React, { useRef, useEffect, useState } from "react";
import { Subtitle, VideoState, ExportStatus } from "../types";
import { secondsToSrtTime } from "../utils/srtHelper";
import { Play, Pause, Download, MonitorPlay, Move } from "lucide-react";

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
  const [videoError, setVideoError] = useState<string | null>(null);

  // Subtitle Positioning State
  // x: center percentage (0.0 - 1.0), y: bottom anchor percentage (0.0 - 1.0)
  const [subtitlePos, setSubtitlePos] = useState({ x: 0.5, y: 0.85 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isHoveringSubtitle, setIsHoveringSubtitle] = useState(false);
  const subtitleRectRef = useRef<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  // Setup video source
  useEffect(() => {
    if (videoState.url && videoRef.current) {
      setVideoError(null); // Reset error on new video
      videoRef.current.src = videoState.url;
      setDownloadUrl(null);
    }
  }, [videoState.url]);

  // Helper function to wrap text
  const wrapText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string[] => {
    if (!text || text.trim() === "") return [];

    const words = text.split(" ");
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

    // Safety check
    if (!video || !canvas || videoError) {
      animationFrameRef.current = requestAnimationFrame(drawFrame);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(drawFrame);
      return;
    }

    // Match canvas size to video size
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      if (
        canvas.width !== video.videoWidth ||
        canvas.height !== video.videoHeight
      ) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
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
      // Calculate font size relative to video height
      // "12px" in doc is likely reference size. We use relative scaling.
      const baseSize = canvas.height * (fontSizeScale / 1000);
      const calculatedFontSize = Math.max(12, Math.round(baseSize));

      // Standard Roboto Style
      // "Fonte: Roboto", "Espaçamento: 80px" (interpreted as wide tracking), "Contorno: 3px"
      ctx.font = `700 ${calculatedFontSize}px Roboto, sans-serif`;
      // @ts-ignore - letterSpacing might not be in all TS definitions yet
      if ('letterSpacing' in ctx) ctx.letterSpacing = "2px"; 
      
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = "#000000";
      // "Contorno externo 3px" -> Stroke width 6 (half inside, half outside) if drawn before fill
      // But for visibility on high res, we might want to scale it slightly or stick to literal 3px logic.
      // Let's use a proportional stroke that is roughly 3px at 720p/1080p?
      // actually, let's try to map "3px" to "3 pixels on the canvas".
      ctx.lineWidth = 6; 
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;

      // Hard Shadow (Optional, doc doesn't specify but good for readability. "Estabilidade" mentioned)
      // Doc doesn't say "Sombra", just "Contorno". Let's reduce shadow or remove it to be strict?
      // "Estilo e Fonte... Contorno (da fonte): contorno externo 3px". No shadow mentioned.
      // I will remove shadow to adhere to "Standard".
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Max width logic (90% of screen width)
      const maxLineWidth = canvas.width * 0.9;

      // Process Text Block
      const rawLines = activeSubs.map((s) => s.text.split("\n")).flat();
      const wrappedLines: string[] = [];

      rawLines.forEach((line) => {
        wrappedLines.push(...wrapText(ctx, line, maxLineWidth));
      });

      // Validation: Max 3 lines
      if (wrappedLines.length > 3) {
          ctx.fillStyle = "#FFD700"; // Gold warning
          // Optional: Render a warning icon or text?
      }

      // Measure final block size
      let maxTextWidth = 0;
      wrappedLines.forEach((line) => {
        const metrics = ctx.measureText(line);
        if (metrics.width > maxTextWidth) maxTextWidth = metrics.width;
      });

      const lineHeight = calculatedFontSize * 1.25;
      const totalHeight = wrappedLines.length * lineHeight;

      // --- POSITIONING LOGIC WITH CLAMPING ---

      // Target position based on user preference
      let centerX = canvas.width * subtitlePos.x;
      let bottomY = canvas.height * subtitlePos.y;

      // Safe Zone (padding from edges)
      const padding = Math.max(20, canvas.width * 0.05);
      const halfWidth = maxTextWidth / 2;

      // Clamp Horizontal (Keep text fully inside left/right)
      if (centerX - halfWidth < padding) {
        centerX = halfWidth + padding;
      } else if (centerX + halfWidth > canvas.width - padding) {
        centerX = canvas.width - padding - halfWidth;
      }

      // Clamp Vertical (Keep text fully inside top/bottom)
      // Note: We render from top down, but anchor is bottom.
      // Top of text block is (bottomY - totalHeight)

      // Prevent going off top
      if (bottomY - totalHeight < padding) {
        bottomY = totalHeight + padding;
      }
      // Prevent going off bottom
      if (bottomY > canvas.height - padding) {
        bottomY = canvas.height - padding;
      }

      // Final Render Start Y (Top of the first line)
      // Because we draw lines from top down, we need the Y of the top-most line's middle?
      // No, let's say startY is the top of the bounding box.
      const bboxTopY = bottomY - totalHeight;

      // Update Hit Rect for Dragging
      const touchPadding = calculatedFontSize * 0.8; // Larger touch area
      subtitleRectRef.current = {
        x: centerX - halfWidth - touchPadding,
        y: bboxTopY - touchPadding,
        w: maxTextWidth + touchPadding * 2,
        h: totalHeight + touchPadding * 2,
      };

      // Draw Visual Feedback for Dragging
      if (isDragging || isHoveringSubtitle) {
        ctx.save();
        ctx.shadowColor = "transparent";
        ctx.strokeStyle = "rgba(59, 130, 246, 0.9)"; // Bright Blue
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
        // center of the line vertically
        const lineY = bboxTopY + index * lineHeight + lineHeight / 2;

        ctx.strokeText(line, centerX, lineY);
        ctx.fillText(line, centerX, lineY);
      });
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
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
    };
  }, [subtitles, subtitlePos, fontSizeScale, videoError]); // Re-bind if these change

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
      const videoStream = video.captureStream
        ? video.captureStream()
        : video.mozCaptureStream
        ? video.mozCaptureStream()
        : null;
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
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm",
    });

    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      onExportFinish(url);

      video.currentTime = 0;
      onPlayStateChange(false);

      // Auto download
      const a = document.createElement("a");
      a.href = url;
      a.download = getDownloadFileName();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    video.currentTime = 0;
    video.play();
    mediaRecorder.start();

    video.onended = () => {
      if (mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
    };
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoState.isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current
          .play()
          .catch((err) =>
            setVideoError(
              `Error playing video: ${err.name} - ${err.message}`
            )
          );
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
      y: (e.clientY - rect.top) * scaleY,
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

      // Calculate offset relative to the Anchor Point (center bottom usually)
      // We reverse calculate where the anchor is currently onscreen
      const rect = subtitleRectRef.current;
      // Note: rect.x is left edge. center is rect.x + rect.w/2
      const currentAnchorX = rect.x + rect.w / 2;
      const currentAnchorY = rect.y + rect.h - rect.h * 0.1; // approx bottom, removing padding

      setDragOffset({
        x: x - currentAnchorX,
        y: y - currentAnchorY,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { x, y } = getMousePos(e);
    const canvas = canvasRef.current;

    if (isDragging && canvas) {
      // Apply offset to get back to anchor position
      const targetAnchorX = x - dragOffset.x;
      const targetAnchorY = y - dragOffset.y;

      // Normalize to 0-1
      const newX = targetAnchorX / canvas.width;
      const newY = targetAnchorY / canvas.height;

      // We do NOT clamp here (we let user drag anywhere), but render loop clamps visual.
      // This feels smoother.
      setSubtitlePos({ x: newX, y: newY });
      return;
    }

    // Check hover
    if (subtitleRectRef.current) {
      const isHit =
        x >= subtitleRectRef.current.x &&
        x <= subtitleRectRef.current.x + subtitleRectRef.current.w &&
        y >= subtitleRectRef.current.y &&
        y <= subtitleRectRef.current.y + subtitleRectRef.current.h;
      setIsHoveringSubtitle(isHit);
    } else {
      setIsHoveringSubtitle(false);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDragging) {
      setIsDragging(false);
    } else {
      // Only toggle play if we weren't dragging and not clicking a subtitle
      if (!isHoveringSubtitle) {
        togglePlay();
      }
    }
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setIsHoveringSubtitle(false);
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const error = e.currentTarget.error;
    let errorMessage = "An unknown video error occurred.";
    if (error) {
       switch (error.code) {
         case 1: // MEDIA_ERR_ABORTED
           errorMessage = "The video playback was aborted.";
           break;
         case 2: // MEDIA_ERR_NETWORK
           errorMessage = "A network error caused the video to fail to load.";
           break;
         case 3: // MEDIA_ERR_DECODE
           errorMessage = "The video could not be decoded, likely due to corruption or an unsupported format.";
           break;
         case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
           errorMessage = "The video format is not supported.";
           break;
         default:
            errorMessage = `An unexpected error occurred. Error code: ${error.code}`;
       }
    }
    setVideoError(errorMessage);
  }

  const getDownloadFileName = () => {
    if (videoState.file?.name) {
      const originalName = videoState.file.name;
      const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
      return `${nameWithoutExt}_legendado.webm`;
    }
    return "video_legendado.webm";
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
          onLoadedData={() => console.log("Video data loaded successfully!")}
          onError={handleVideoError}
          playsInline
        />

        {!videoState.url ? (
          <div className="text-gray-500 flex flex-col items-center">
            <MonitorPlay size={48} className="mb-4 opacity-50" />
            <p>Selecione um video para começar</p>
          </div>
        ) : videoError ? (
            <div className="text-red-400 text-center p-4">
                <p className="font-bold mb-2">Error Loading Video</p>
                <p className="text-sm">{videoError}</p>
            </div>
        ) : (
          <canvas
            ref={canvasRef}
            className={`max-w-full max-h-full object-contain touch-none ${
              isHoveringSubtitle || isDragging
                ? "cursor-move"
                : "cursor-pointer"
            }`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          />
        )}

        {/* Overlay Instruction for Dragging */}
        {videoState.url &&
          subtitles.length > 0 &&
          !isDragging &&
          !videoState.isPlaying && (
            <div className="absolute top-4 right-4 bg-black/60 text-white text-xs px-2 py-1 rounded border border-white/20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 z-10">
              <Move size={12} />
              Arrastar Legenda
            </div>
          )}

        {exportStatus === ExportStatus.RECORDING && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2  mb-4"></div>
            <p className="text-lg font-semibold">Renderizando Vídeo...</p>
            <p className="text-sm text-gray-400">
              Por favor aguarde o fim da reprodução.
            </p>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-between bg-gray-900 p-4 rounded-lg border border-gray-800">
        <div className="flex items-center gap-4">
          <button
            onClick={togglePlay}
            disabled={
              !videoState.url || exportStatus === ExportStatus.RECORDING || !!videoError
            }
            className="p-3 bg-gray-800 rounded-full hover:bg-gray-700 disabled:opacity-50 text-white transition-colors"
          >
            {videoState.isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <div className="text-sm font-mono text-gray-400">
            {secondsToSrtTime(videoState.currentTime).split(",")[0]} /{" "}
            {secondsToSrtTime(videoState.duration).split(",")[0]}
          </div>
        </div>

        <div className="flex gap-3">
          {downloadUrl && exportStatus === ExportStatus.COMPLETED && (
            <a
              href={downloadUrl}
              download={getDownloadFileName()}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors animate-pulse"
            >
              <Download size={18} />
              Baixar Resultado
            </a>
          )}

          <button
            onClick={handleExport}
            disabled={
              !videoState.url || exportStatus === ExportStatus.RECORDING || !!videoError
            }
            className="flex items-center gap-2 px-4 py-2 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            {exportStatus === ExportStatus.RECORDING
              ? "Processando..."
              : "Renderizar & Baixar"}
          </button>
        </div>
      </div>
    </div>
  );
};
