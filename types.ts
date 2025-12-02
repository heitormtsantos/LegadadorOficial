export interface Subtitle {
  id: number;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
}

export interface VideoState {
  file: File | null;
  url: string | null;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
}

export enum ExportStatus {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  COMPLETED = 'COMPLETED',
}
