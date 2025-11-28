// src/types.ts
export interface Subtitle {
  id: number;
  startTime: number; // em segundos
  endTime: number;   // em segundos
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
