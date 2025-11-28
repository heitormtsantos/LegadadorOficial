import { Subtitle } from '../types';

/**
 * Converts a time string (00:00:00,000 or 00:00:00.000) to seconds.
 */
export const srtTimeToSeconds = (timeString: string): number => {
  if (!timeString) return 0;
  
  // Normalize comma to dot for decimal parsing to handle both 00:00:10,000 and 00:00:10.000
  const normalized = timeString.replace(',', '.');
  const parts = normalized.split(':');
  
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    
    // Check for NaNs
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return 0;

    return hours * 3600 + minutes * 60 + seconds;
  }
  
  return 0;
};

/**
 * Converts seconds to SRT time string (00:00:00,000).
 */
export const secondsToSrtTime = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = Math.round((totalSeconds % 1) * 1000);

  const pad = (num: number, size: number) => num.toString().padStart(size, '0');

  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(millis, 3)}`;
};

/**
 * Parses raw SRT file content into Subtitle objects.
 */
export const parseSRT = (data: string): Subtitle[] => {
  // Normalize line endings
  const normalizedData = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalizedData.trim().split('\n\n');

  const subtitles: Subtitle[] = [];

  blocks.forEach((block) => {
    const lines = block.split('\n');
    if (lines.length >= 3) {
      const id = parseInt(lines[0], 10);
      const timeLine = lines[1];
      const text = lines.slice(2).join('\n');

      const [startStr, endStr] = timeLine.split(' --> ');

      if (startStr && endStr) {
        subtitles.push({
          id: isNaN(id) ? subtitles.length + 1 : id,
          startTime: srtTimeToSeconds(startStr.trim()),
          endTime: srtTimeToSeconds(endStr.trim()),
          text: text,
        });
      }
    }
  });

  return subtitles;
};

/**
 * Generates raw SRT content from Subtitle objects.
 */
export const generateSRT = (subtitles: Subtitle[]): string => {
  return subtitles
    .map((sub, index) => {
      return `${index + 1}\n${secondsToSrtTime(sub.startTime)} --> ${secondsToSrtTime(
        sub.endTime
      )}\n${sub.text}`;
    })
    .join('\n\n');
};