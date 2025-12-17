import { Subtitle } from "@/types";

/**
 * Converts a time string (supports malformed formats) to seconds.
 */
export const srtTimeToSeconds = (time: string): number => {
  if (!time) return 0;

  time = time.trim().replace("\ufeff", "");

  // Formato correto do arquivo: MM:SS,mmm
  const mmss = time.match(/^(\d{2}):(\d{2})[,.](\d{3})$/);
  if (mmss) {
    const [, mm, ss, ms] = mmss;
    return Number(mm) * 60 + Number(ss) + Number(ms) / 1000;
  }

  // Formato SRT tradicional: HH:MM:SS,mmm
  const full = time.match(/^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})$/);
  if (full) {
    const [, hh, mm, ss, ms] = full;
    return Number(hh) * 3600 + Number(mm) * 60 + Number(ss) + Number(ms) / 1000;
  }

  // 🆕 Formato MALFORMADO específico mencionado pelo usuário: 0000:18,523
  // Ex.: 0000:18,523 --> 00:00:19,263
  // Parece ser HHHH:MM,mmm ou algo do tipo, mas no contexto é 00:00:18,523 com typo
  // Vamos tentar salvar convertendo 4 dígitos iniciais em HH:MM se fizer sentido
  const typoFormat = time.match(/^(\d{4}):(\d{2})[,.](\d{3})$/);
  if (typoFormat) {
    // Assumindo que 0000 é HHMM
    const [, prefix, ss, ms] = typoFormat;
    const hh = prefix.substring(0, 2);
    const mm = prefix.substring(2, 4);
    
    return Number(hh) * 3600 + Number(mm) * 60 + Number(ss) + Number(ms) / 1000;
  }

  // 🆕 Outro formato possível: SS:mmm (sem minutos)
  const short = time.match(/^(\d{2})[,.](\d{3})$/);
  if (short) {
    const [, ss, ms] = short;
    return Number(ss) + Number(ms) / 1000;
  }

  // 🆕 Formato MALFORMADO: MM:SS:mmm (o que parece ser HH:MM:mmm, mas pelo contexto de vídeos curtos é MM:SS:mmm)
  // Exemplo do usuário: 00:14:833 --> 14 segundos e 833ms
  // Como os vídeos são curtos (< 5 min), se o primeiro dígito for pequeno, assumimos que é minuto.
  const weirdFormat = time.match(/^(\d{2}):(\d{2}):(\d{3})$/);
  if (weirdFormat) {
    const [, mm, ss, ms] = weirdFormat;
    // Interpretar como Minuto:Segundo:Milissegundo
    return Number(mm) * 60 + Number(ss) + Number(ms) / 1000;
  }

  console.warn("Formato desconhecido:", time);
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

  const pad = (num: number, size: number) => num.toString().padStart(size, "0");

  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(
    millis,
    3
  )}`;
};

/**
 * Parses raw SRT file content into Subtitle objects.
 */
export const parseSRT = (data: string): Subtitle[] => {
  const normalizedData = data.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalizedData.trim().split("\n\n");

  const subtitles: Subtitle[] = [];

  blocks.forEach((block) => {
    const lines = block.split("\n");
    if (lines.length >= 2) {
      // Sometimes index is missing or weird, but usually lines[0] is index, lines[1] is time
      // But we should check regex for time

      let timeIndex = -1;
      // Regex principal para capturar tempos
      // Tenta ser o mais permissivo possível com os dígitos
      const timeRegex =
        /(\d{1,4}:\d{1,4}(?::\d{1,4})?(?:[,:.]\d{1,4})?)\s*-->\s*(\d{1,4}:\d{1,4}(?::\d{1,4})?(?:[,:.]\d{1,4})?)/;

      for (let i = 0; i < lines.length; i++) {
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
          const text = lines.slice(timeIndex + 1).join("\n");

          // ID is line before time line, or auto-gen
          const idStr = timeIndex > 0 ? lines[timeIndex - 1] : "";
          const id = parseInt(idStr) || subtitles.length + 1;

          subtitles.push({
            id,
            startTime: srtTimeToSeconds(startStr),
            endTime: srtTimeToSeconds(endStr),
            text: text.trim(),
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
      return `${index + 1}\n${secondsToSrtTime(
        sub.startTime
      )} --> ${secondsToSrtTime(sub.endTime)}\n${sub.text}`;
    })
    .join("\n\n");
};
