import { Subtitle } from '../types';

/**
 * Converts a time string (00:00:00,000 or 00:00:00.000) to seconds.
 */
export const srtTimeToSeconds = (timeString: string): number => {
  if (!timeString) return 0;

  const trimmed = timeString.trim();

  // 1) Seu formato: "MM:SS:MMM"  (ex: 00:00:590, 00:59:800, 01:01:000)
  //    minutos : segundos : milissegundos  (SEM vírgula)
  const matchCapcut = trimmed.match(/^(\d{1,2}):(\d{2}):(\d{1,3})$/);
  if (!trimmed.includes(',') && !trimmed.includes('.') && matchCapcut) {
    const [, mm, ss, ms] = matchCapcut;
    const minutes = parseInt(mm, 10) || 0;
    const seconds = parseInt(ss, 10) || 0;
    const millis = parseInt(ms.padEnd(3, '0'), 10) || 0;

    return minutes * 60 + seconds + millis / 1000;
  }

  // 2) Formato SRT padrão: "HH:MM:SS,mmm" ou "HH:MM:SS.mmm"
  const normalized = trimmed.replace(',', '.');
  const matchStd = normalized.match(/^(\d{1,2}):(\d{2}):(\d{2})\.(\d{1,3})$/);

  if (matchStd) {
    const [, hh, mm, ss, ms] = matchStd;
    let hours = parseInt(hh, 10) || 0;
    let minutes = parseInt(mm, 10) || 0;
    const seconds = parseInt(ss, 10) || 0;
    const millis = parseInt(ms.padEnd(3, '0'), 10) || 0;

    // Heurística opcional pro SEU caso:
    // se o vídeo nunca tem 1h+ e aparecer algo tipo "01:00:04,000",
    // podemos tratar HORA como MINUTO quando minutes == 0 e hours <= 4
    if (hours > 0 && hours <= 4 && minutes === 0) {
      const pseudoMinutes = hours;
      return pseudoMinutes * 60 + seconds + millis / 1000;
    }

    return hours * 3600 + minutes * 60 + seconds + millis / 1000;
  }

  console.warn('Formato de tempo SRT não reconhecido:', timeString);
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
