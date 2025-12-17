import { useState, useCallback } from 'react';
import { VideoState, ExportStatus } from '../types';

export const useVideoPlayer = () => {
  const [videoState, setVideoState] = useState<VideoState>({
    file: null,
    url: null,
    duration: 0,
    currentTime: 0,
    isPlaying: false,
  });
  const [exportStatus, setExportStatus] = useState<ExportStatus>(ExportStatus.IDLE);

  const handleVideoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoState((prev) => ({
        ...prev,
        file,
        url,
        currentTime: 0,
        isPlaying: false,
        videoError: null,
      }));
      setExportStatus(ExportStatus.IDLE);
    }
  }, []);

  const handleTimeUpdate = useCallback((time: number) => {
    setVideoState((prev) => ({ ...prev, currentTime: time }));
  }, []);

  const handleDurationChange = useCallback((duration: number) => {
    setVideoState((prev) => ({ ...prev, duration }));
  }, []);

  const handlePlayStateChange = useCallback((isPlaying: boolean) => {
    setVideoState((prev) => ({ ...prev, isPlaying }));
  }, []);

  const setExporting = useCallback((status: ExportStatus) => {
    setExportStatus(status);
  }, []);

  return {
    videoState,
    setVideoState, // Exposed for cases like seeking from outside
    exportStatus,
    setExportStatus,
    handleVideoUpload,
    handleTimeUpdate,
    handleDurationChange,
    handlePlayStateChange,
  };
};
