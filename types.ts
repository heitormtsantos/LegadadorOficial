export interface Subtitle {
  id: number;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
}

export interface LooseText {
  id: number;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
  x?: number; // 0-1 percentage
  y?: number; // 0-1 percentage
  fontSize?: number;
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

export interface ReplacementRule {
  id: string;
  find: string;
  replace: string;
  isActive: boolean;
}
