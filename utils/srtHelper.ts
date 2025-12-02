import { Subtitle } from '../types';

/**
 * Converts a time string (00:00:00,000 or 00:00:00.000) to seconds.
 */
export const srtTimeToSeconds = (timeString: string): number => {
  if (!timeString) return 0;
  
  // Normalize comma to dot for decimal parsing
  const normalized = timeString.replace(',', '.');
  const parts = normalized.split(':');
  
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    
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
  const normalizedData = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalizedData.trim().split('\n\n');

  const subtitles: Subtitle[] = [];

  blocks.forEach((block) => {
    const lines = block.split('\n');
    if (lines.length >= 2) {
      // Sometimes index is missing or weird, but usually lines[0] is index, lines[1] is time
      // But we should check regex for time
      
      let timeIndex = -1;
      const timeRegex = /(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/;

      for(let i=0; i<lines.length; i++) {
          if (timeRegex.test(lines[i])) {
              timeIndex = i;
              break;
          }
      }

      if (timeIndex !== -1) {
          const match = lines[timeIndex].match(timeRegex);
          if (match) {
             const startStr = match[1];
             const endStr = match[2];
             
             // Text is everything after time line
             const text = lines.slice(timeIndex + 1).join('\n');
             
             // ID is line before time line, or auto-gen
             const idStr = timeIndex > 0 ? lines[timeIndex-1] : "";
             const id = parseInt(idStr) || (subtitles.length + 1);
             
             subtitles.push({
                 id,
                 startTime: srtTimeToSeconds(startStr),
                 endTime: srtTimeToSeconds(endStr),
                 text: text.trim()
             });
          }
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