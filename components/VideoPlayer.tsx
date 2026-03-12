import React, { useRef, useEffect, useState } from "react";
import { Subtitle, VideoState, ExportStatus, LooseText } from "../types";
import { secondsToSrtTime } from "../utils/srtHelper";
import { Play, Pause, Download, MonitorPlay, Move } from "lucide-react";

interface VideoPlayerProps {
  videoState: VideoState;
  subtitles: Subtitle[];
  looseTexts?: LooseText[];
  exportStatus: ExportStatus;
  fontSize: number;
  outlineSize?: number;
  shadowSize?: number;
  letterSpacing?: number;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onPlayStateChange: (playing: boolean) => void;
  onExportStart: () => void;
  onExportFinish: (blobUrl: string) => void;
  onUpdateLooseText?: (id: number, updates: Partial<LooseText>) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoState,
  subtitles,
  looseTexts = [],
  exportStatus,
  fontSize: fontSizeScale,
  outlineSize: outlineSizeScale = 24,
  shadowSize: shadowSizeScale = 2,
  letterSpacing: letterSpacingScale = 0,
  onTimeUpdate,
  onDurationChange,
  onPlayStateChange,
  onExportStart,
  onExportFinish,
  onUpdateLooseText,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const downloadFileName = videoState.file?.name
    ? `${videoState.file.name.replace(/\.[^/.]+$/, "")}.webm`
    : "video.webm";

  // Subtitle Positioning State
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

  // Loose Text Dragging State
  const [draggingLooseTextId, setDraggingLooseTextId] = useState<number | null>(null);
  const [hoveringLooseTextId, setHoveringLooseTextId] = useState<number | null>(null);
  const looseTextRectsRef = useRef<Map<number, { x: number; y: number; w: number; h: number }>>(new Map());

  // Setup video source
  useEffect(() => {
    if (videoState.url && videoRef.current) {
      setVideoError(null);
      videoRef.current.src = videoState.url;
      setDownloadUrl(null);
    }
  }, [videoState.url]);

  const measureTextWidthWithSpacing = (
    ctx: CanvasRenderingContext2D,
    text: string,
    extraSpacing: number
  ): number => {
    if (!text) return 0;
    if (extraSpacing <= 0) {
      return ctx.measureText(text).width;
    }
    const chars = Array.from(text);
    let width = 0;
    for (const ch of chars) {
      width += ctx.measureText(ch).width;
    }
    if (chars.length > 1) {
      width += extraSpacing * (chars.length - 1);
    }
    return width;
  };

  const wrapText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    extraSpacing: number
  ): string[] => {
    if (!text || text.trim() === "") return [];

    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = measureTextWidthWithSpacing(
        ctx,
        currentLine + " " + word,
        extraSpacing
      );
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

  const drawFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || videoError) {
      animationFrameRef.current = requestAnimationFrame(drawFrame);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(drawFrame);
      return;
    }

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

    const currentTime = video.currentTime;

    // --- SHARED STYLE CONFIG ---
    // Base scale for "Size 11" = 35/1000 of height
    const BASE_SCALE_11 = 35;
    const userSizeMultiplier = fontSizeScale / 11;
    const currentScale = BASE_SCALE_11 * userSizeMultiplier;
    const baseSize = canvas.height * (currentScale / 1000);
    const calculatedFontSize = Math.max(16, Math.round(baseSize));
    const letterSpacingPx =
      letterSpacingScale > 0
        ? (calculatedFontSize * letterSpacingScale) / 10
        : 0;

    // Common Text Settings
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const outlineBaseFactor = calculatedFontSize / 60;
    const targetStrokeWidth = outlineSizeScale * outlineBaseFactor;
    
    // Shadow
    const safeShadowScale = typeof shadowSizeScale === "number" && isFinite(shadowSizeScale) ? shadowSizeScale : 0;
    const normalizedShadow = Math.max(0, safeShadowScale / 5);

    // 2. Draw Subtitles
    const activeSubs = subtitles.filter(
      (s) => currentTime >= s.startTime && currentTime <= s.endTime
    );

    if (activeSubs.length > 0) {
      ctx.font = `500 ${calculatedFontSize}px Roboto, sans-serif`;
      ctx.fillStyle = "#FFFFFF";
      ctx.lineWidth = Math.max(0.5, targetStrokeWidth);
      ctx.strokeStyle = "#000000";
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;

      if (normalizedShadow <= 0) {
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      } else {
        ctx.shadowColor = "rgba(0,0,0,0.85)";
        const baseShadowBlur = calculatedFontSize * 0.25;
        ctx.shadowBlur = baseShadowBlur * normalizedShadow;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      const maxLineWidth = canvas.width * 0.9;
      const rawLines = activeSubs.map((s) => s.text.split("\n")).flat();
      const wrappedLines: string[] = [];

      rawLines.forEach((line) => {
        wrappedLines.push(...wrapText(ctx, line, maxLineWidth, letterSpacingPx));
      });

      if (wrappedLines.length > 3) {
         ctx.fillStyle = "#FFD700"; 
      }

      let maxTextWidth = 0;
      wrappedLines.forEach((line) => {
        const width = measureTextWidthWithSpacing(ctx, line, letterSpacingPx);
        if (width > maxTextWidth) maxTextWidth = width;
      });

      const lineHeight = calculatedFontSize * 1.25;
      const totalHeight = wrappedLines.length * lineHeight;

      let centerX = canvas.width * subtitlePos.x;
      let bottomY = canvas.height * subtitlePos.y;

      const padding = Math.max(20, canvas.width * 0.05);
      const halfWidth = maxTextWidth / 2;

      if (centerX - halfWidth < padding) {
        centerX = halfWidth + padding;
      } else if (centerX + halfWidth > canvas.width - padding) {
        centerX = canvas.width - padding - halfWidth;
      }

      if (bottomY - totalHeight < padding) {
        bottomY = totalHeight + padding;
      }
      if (bottomY > canvas.height - padding) {
        bottomY = canvas.height - padding;
      }

      const bboxTopY = bottomY - totalHeight;
      const touchPadding = calculatedFontSize * 0.8;
      subtitleRectRef.current = {
        x: centerX - halfWidth - touchPadding,
        y: bboxTopY - touchPadding,
        w: maxTextWidth + touchPadding * 2,
        h: totalHeight + touchPadding * 2,
      };

      if (isDragging || isHoveringSubtitle) {
        ctx.save();
        ctx.shadowColor = "transparent";
        ctx.strokeStyle = "rgba(59, 130, 246, 0.9)";
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

      wrappedLines.forEach((line, index) => {
        const lineY = bboxTopY + index * lineHeight + lineHeight / 2;
        drawTextLine(ctx, line, centerX, lineY, letterSpacingPx, safeShadowScale, calculatedFontSize);
      });
    } else {
      subtitleRectRef.current = null;
    }

    // 3. Draw Loose Texts
    const activeLooseTexts = looseTexts.filter(
        (t) => currentTime >= t.startTime && currentTime <= t.endTime
    );

    looseTextRectsRef.current.clear();

    if (activeLooseTexts.length > 0) {
        activeLooseTexts.forEach(text => {
            // Default position if not set (Center)
            const posX = text.x !== undefined ? text.x : 0.5;
            const posY = text.y !== undefined ? text.y : 0.5;

            // Calculate font size for this specific text
            // If text has its own fontSize, use it relative to base scale (similar to global fontSize)
            // Default global fontSize is usually around 11 in the UI which maps to BASE_SCALE_11 = 35
            const localFontSize = text.fontSize || fontSizeScale;
            const localUserSizeMultiplier = localFontSize / 11;
            const localCurrentScale = BASE_SCALE_11 * localUserSizeMultiplier;
            const localBaseSize = canvas.height * (localCurrentScale / 1000);
            const localCalculatedFontSize = Math.max(16, Math.round(localBaseSize));
            
            // Recalculate derived values with local font size
            const localOutlineBaseFactor = localCalculatedFontSize / 60;
            const localTargetStrokeWidth = outlineSizeScale * localOutlineBaseFactor;
            const localLetterSpacingPx = letterSpacingScale > 0
                ? (localCalculatedFontSize * letterSpacingScale) / 10
                : 0;

            ctx.font = `500 ${localCalculatedFontSize}px Roboto, sans-serif`;
            ctx.fillStyle = "#FFFFFF";
            ctx.lineWidth = Math.max(0.5, localTargetStrokeWidth);
            ctx.strokeStyle = "#000000";
            ctx.lineJoin = "round";
            ctx.miterLimit = 2;
            
             if (normalizedShadow <= 0) {
                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
            } else {
                ctx.shadowColor = "rgba(0,0,0,0.85)";
                const baseShadowBlur = localCalculatedFontSize * 0.25;
                ctx.shadowBlur = baseShadowBlur * normalizedShadow;
            }

            const maxLineWidth = canvas.width * 0.9;
            // Handle newlines by splitting first
            const rawLines = text.text.split('\n');
            const wrappedLines: string[] = [];
            
            rawLines.forEach(line => {
                wrappedLines.push(...wrapText(ctx, line, maxLineWidth, localLetterSpacingPx));
            });

            let maxTextWidth = 0;
            wrappedLines.forEach((line) => {
                const width = measureTextWidthWithSpacing(ctx, line, localLetterSpacingPx);
                if (width > maxTextWidth) maxTextWidth = width;
            });

            const lineHeight = localCalculatedFontSize * 1.25;
            const totalHeight = wrappedLines.length * lineHeight;

            let centerX = canvas.width * posX;
            let centerY = canvas.height * posY;
            
            // Anchor center-center for loose texts (easier for placement "on objects")
            // Or maybe center-bottom to match subtitles?
            // Let's stick to center-center for "labels" on objects.
            
            // Padding
            const padding = 10;
            const halfWidth = maxTextWidth / 2;
            const halfHeight = totalHeight / 2;
            
            // Clamp
            if (centerX - halfWidth < padding) centerX = halfWidth + padding;
            if (centerX + halfWidth > canvas.width - padding) centerX = canvas.width - padding - halfWidth;
            if (centerY - halfHeight < padding) centerY = halfHeight + padding;
            if (centerY + halfHeight > canvas.height - padding) centerY = canvas.height - padding - halfHeight;

            // Store Hit Rect
            const touchPadding = localCalculatedFontSize * 0.5;
            looseTextRectsRef.current.set(text.id, {
                x: centerX - halfWidth - touchPadding,
                y: centerY - halfHeight - touchPadding,
                w: maxTextWidth + touchPadding * 2,
                h: totalHeight + touchPadding * 2
            });

            // Visual Feedback
            const isBeingDragged = draggingLooseTextId === text.id;
            const isHovered = hoveringLooseTextId === text.id;

            if (isBeingDragged || isHovered) {
                ctx.save();
                ctx.shadowColor = "transparent";
                ctx.strokeStyle = "rgba(255, 165, 0, 0.9)"; // Orange for loose texts
                ctx.lineWidth = 3;
                ctx.setLineDash([5, 3]);
                 const rect = looseTextRectsRef.current.get(text.id)!;
                ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
                ctx.restore();
            }

            // Draw Lines
            const startY = centerY - (totalHeight / 2) + (lineHeight / 2);
            wrappedLines.forEach((line, index) => {
                const lineY = startY + index * lineHeight;
                drawTextLine(ctx, line, centerX, lineY, localLetterSpacingPx, safeShadowScale, localCalculatedFontSize);
            });
        });
    }

    animationFrameRef.current = requestAnimationFrame(drawFrame);
  };

  const drawTextLine = (
    ctx: CanvasRenderingContext2D, 
    line: string, 
    x: number, 
    y: number, 
    letterSpacingPx: number,
    safeShadowScale: number,
    calculatedFontSize: number
  ) => {
        if (letterSpacingPx <= 0) {
          if (safeShadowScale > 0) {
            ctx.save();
            ctx.shadowColor = "rgba(0,0,0,1.0)";
            ctx.shadowBlur = calculatedFontSize * 0.15 * (safeShadowScale / 3);
            ctx.strokeStyle = "black";
            ctx.strokeText(line, x, y);
            ctx.restore();
          }

          ctx.save();
          ctx.shadowColor = "transparent";
          ctx.strokeStyle = "black";
          ctx.strokeText(line, x, y);
          ctx.restore();

          ctx.save();
          ctx.shadowColor = "transparent";
          ctx.fillStyle = "#FFFFFF";
          ctx.globalAlpha = 0.95;
          ctx.fillText(line, x, y);
          ctx.globalAlpha = 1;
          ctx.restore();
        } else {
          const totalWidth = measureTextWidthWithSpacing(ctx, line, letterSpacingPx);
          let currentX = x - totalWidth / 2;
          const chars = Array.from(line);

          chars.forEach((ch) => {
            const charWidth = ctx.measureText(ch).width;
            const charCenterX = currentX + charWidth / 2;

            if (safeShadowScale > 0) {
              ctx.save();
              ctx.shadowColor = "rgba(0,0,0,1.0)";
              ctx.shadowBlur = calculatedFontSize * 0.15 * (safeShadowScale / 3);
              ctx.strokeStyle = "black";
              ctx.strokeText(ch, charCenterX, y);
              ctx.restore();
            }

            ctx.save();
            ctx.shadowColor = "transparent";
            ctx.strokeStyle = "black";
            ctx.strokeText(ch, charCenterX, y);
            ctx.restore();

            ctx.save();
            ctx.shadowColor = "transparent";
            ctx.fillStyle = "#FFFFFF";
            ctx.globalAlpha = 0.95;
            ctx.fillText(ch, charCenterX, y);
            ctx.globalAlpha = 1;
            ctx.restore();

            currentX += charWidth + letterSpacingPx;
          });
        }
  }

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(drawFrame);
    return () => {
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
    };
  }, [subtitles, looseTexts, subtitlePos, draggingLooseTextId, hoveringLooseTextId, fontSizeScale, outlineSizeScale, shadowSizeScale, letterSpacingScale, videoError]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (video) {
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    }
  };

  const handleVideoError = () => {
      if (videoRef.current && videoRef.current.error) {
          setVideoError(`Error ${videoRef.current.error.code}: ${videoRef.current.error.message}`);
      } else {
          setVideoError("An unknown video error occurred");
      }
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video) return;
    
    if (!MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        alert('Seu navegador não suporta a exportação de vídeo em WebM/VP9.');
        return;
    }

    onExportStart();
    
    video.currentTime = 0;
    if (video.paused) video.play();

    const stream = canvas.captureStream(30);
    
    // Tenta capturar o áudio do elemento de vídeo
    let finalStream = stream;
    try {
        // @ts-ignore - captureStream/mozCaptureStream podem não estar na definição de tipos padrão
        const videoStream = video.captureStream ? video.captureStream() : video.mozCaptureStream ? video.mozCaptureStream() : null;
        if (videoStream) {
            const audioTracks = videoStream.getAudioTracks();
            if (audioTracks.length > 0) {
                // Cria um novo stream combinando o vídeo do canvas e o áudio do elemento video
                finalStream = new MediaStream([...stream.getVideoTracks(), ...audioTracks]);
            }
        }
    } catch (e) {
        console.warn("Não foi possível capturar o áudio do vídeo:", e);
    }

    const mediaRecorder = new MediaRecorder(finalStream, {
      mimeType: "video/webm;codecs=vp9",
      videoBitsPerSecond: 5000000 
    });

    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: "video/webm",
      });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      onExportFinish(url);
      mediaRecorderRef.current = null;
    };

    mediaRecorder.start();

    const onEnded = () => {
        if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        video.removeEventListener('ended', onEnded);
    };
    
    video.addEventListener('ended', onEnded);
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
    const { x, y } = getMousePos(e);

    // 1. Check Loose Texts first (they are usually overlays)
    let hitLooseTextId: number | null = null;
    looseTextRectsRef.current.forEach((rect, id) => {
        if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
            hitLooseTextId = id;
        }
    });

    if (hitLooseTextId !== null) {
        setDraggingLooseTextId(hitLooseTextId);
        
        // Calculate offset from CENTER of the text
        const rect = looseTextRectsRef.current.get(hitLooseTextId)!;
        const centerX = rect.x + rect.w / 2;
        const centerY = rect.y + rect.h / 2;
        
        setDragOffset({
            x: x - centerX,
            y: y - centerY
        });
        return;
    }

    // 2. Check Subtitles
    if (subtitleRectRef.current) {
      if (
        x >= subtitleRectRef.current.x &&
        x <= subtitleRectRef.current.x + subtitleRectRef.current.w &&
        y >= subtitleRectRef.current.y &&
        y <= subtitleRectRef.current.y + subtitleRectRef.current.h
      ) {
        setIsDragging(true);

        const rect = subtitleRectRef.current;
        const currentAnchorX = rect.x + rect.w / 2;
        const currentAnchorY = rect.y + rect.h - rect.h * 0.1; 

        setDragOffset({
          x: x - currentAnchorX,
          y: y - currentAnchorY,
        });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { x, y } = getMousePos(e);
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Handle Loose Text Drag
    if (draggingLooseTextId !== null && onUpdateLooseText) {
        const targetCenterX = x - dragOffset.x;
        const targetCenterY = y - dragOffset.y;
        
        const newX = targetCenterX / canvas.width;
        const newY = targetCenterY / canvas.height;
        
        onUpdateLooseText(draggingLooseTextId, { x: newX, y: newY });
        return;
    }

    // Handle Subtitle Drag
    if (isDragging) {
      const targetAnchorX = x - dragOffset.x;
      const targetAnchorY = y - dragOffset.y;

      const newX = targetAnchorX / canvas.width;
      const newY = targetAnchorY / canvas.height;

      setSubtitlePos({ x: newX, y: newY });
      return;
    }

    // Handle Hover
    let hitLooseTextId: number | null = null;
    looseTextRectsRef.current.forEach((rect, id) => {
        if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
            hitLooseTextId = id;
        }
    });
    setHoveringLooseTextId(hitLooseTextId);

    if (hitLooseTextId === null && subtitleRectRef.current) {
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
    if (draggingLooseTextId !== null) {
        setDraggingLooseTextId(null);
    } else if (isDragging) {
      setIsDragging(false);
    } else {
      if (!isHoveringSubtitle && hoveringLooseTextId === null) {
        togglePlay();
      }
    }
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setDraggingLooseTextId(null);
    setIsHoveringSubtitle(false);
    setHoveringLooseTextId(null);
  };

  return (
    <div className="relative flex-1 flex flex-col min-h-0 bg-black group">
      <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        {/* Hidden Video Element */}
        <video
          ref={videoRef}
          className="absolute opacity-0 pointer-events-none"
          onTimeUpdate={() => onTimeUpdate(videoRef.current?.currentTime || 0)}
          onDurationChange={() => onDurationChange(videoRef.current?.duration || 0)}
          onPlay={() => onPlayStateChange(true)}
          onPause={() => onPlayStateChange(false)}
          onEnded={() => onPlayStateChange(false)}
          onError={handleVideoError}
          playsInline
        />

        {/* Rendering Canvas */}
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full object-contain cursor-pointer touch-none select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
        
        {/* Exporting Overlay */}
        {/* {exportStatus === ExportStatus.RECORDING && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-6"></div>
                <p className="text-white font-semibold text-lg animate-pulse">Exportando Vídeo...</p>
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded px-4 py-3 mt-4 max-w-sm text-center">
                    <p className="text-yellow-200 text-sm font-medium">⚠️ IMPORTANTE</p>
                    <p className="text-yellow-100/80 text-xs mt-1">
                        Mantenha esta aba aberta e visível. A renderização é feita em tempo real e pode falhar se a aba for minimizada.
                    </p>
                </div>
            </div>
        )} */}

        {/* Error Overlay */}
        {videoError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 z-50 p-6">
                <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 max-w-md text-center">
                    <p className="text-red-400 font-medium mb-2">Video Error</p>
                    <p className="text-gray-300 text-sm">{videoError}</p>
                </div>
            </div>
        )}

        {/* Loading / No Video State */}
        {!videoState.url && !videoError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-4">
             <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center">
                <MonitorPlay size={32} className="opacity-50" />
             </div>
             <p className="text-sm font-medium">Carregue um vídeo para começar</p>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="h-14 bg-gray-900 border-t border-gray-800 flex items-center px-4 gap-4 shrink-0 z-10">
        <button
          onClick={togglePlay}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-lg shadow-blue-900/20"
          disabled={!videoState.url}
        >
          {videoState.isPlaying ? (
            <Pause size={20} fill="currentColor" />
          ) : (
            <Play size={20} fill="currentColor" className="ml-1" />
          )}
        </button>

        <div className="flex-1 flex flex-col justify-center">
          <div className="text-xs font-medium text-gray-400 mb-1 flex justify-between">
            <span>{secondsToSrtTime(videoState.currentTime)}</span>
            <span>{secondsToSrtTime(videoState.duration)}</span>
          </div>
          <div className="relative h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-blue-500 rounded-full"
              style={{
                width: `${(videoState.currentTime / videoState.duration) * 100}%`,
              }}
            />
          </div>
        </div>

        {downloadUrl && (
            <a
                href={downloadUrl}
                download={downloadFileName}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-xs font-medium transition-colors animate-pulse"
            >
                <Download size={14} />
                Baixar
            </a>
        )}

        {exportStatus === ExportStatus.IDLE && videoState.url && (
            <button
                onClick={handleExport}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-xs font-medium border border-gray-700 transition-colors"
                title="Gravar e Baixar Vídeo"
            >
                <MonitorPlay size={14} />
                Exportar
            </button>
        )}
        
        {exportStatus === ExportStatus.RECORDING && (
             <div className="flex items-center gap-2 px-3 py-1.5 bg-red-900/30 text-red-400 rounded text-xs font-medium border border-red-900/50 animate-pulse">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                Gravando...
            </div>
        )}
      </div>
    </div>
  );
};
