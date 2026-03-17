import { Subtitle } from '../types';
import { generateSRT, parseSRT } from './srtHelper';

const MODELS_TO_TRY = [
  'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent',
  'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent',
  'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent',
];

export const translateSubtitlesWithGemini = async (
  subtitles: Subtitle[],
  apiKey: string,
  targetLanguage: string = 'Português (Brasil)'
): Promise<Subtitle[]> => {
  if (!apiKey) {
    throw new Error('Chave da API Gemini não configurada.');
  }

  const srtContent = generateSRT(subtitles);
  const prompt = `
Você é um tradutor profissional de legendas. 
Sua tarefa é traduzir o conteúdo do seguinte arquivo SRT para ${targetLanguage}.

REGRAS CRÍTICAS:
1. Mantenha EXATAMENTE os mesmos números de índice e os mesmos tempos (timecodes).
2. Traduza APENAS o texto das legendas.
3. Não adicione comentários, notas ou qualquer texto extra fora do formato SRT.
4. Mantenha quebras de linha dentro das legendas se elas existirem no original.
5. Preserve nomes próprios se eles parecerem ser nomes de personagens que não devem ser traduzidos, a menos que haja um equivalente comum.

CONTEÚDO SRT:
${srtContent}
`;

  let lastError = null;

  for (const apiUrl of MODELS_TO_TRY) {
    try {
      const response = await fetch(`${apiUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const message = errorData.error?.message || response.statusText;
        lastError = new Error(`Erro no modelo ${apiUrl.split('/models/')[1].split(':')[0]}: ${message}`);
        continue; // Tenta o próximo modelo
      }

      const data = await response.json();
      const translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!translatedText) {
        lastError = new Error('A API Gemini retornou uma resposta vazia.');
        continue;
      }

      const cleanSrt = translatedText
        .replace(/```srt/g, '')
        .replace(/```/g, '')
        .trim();

      return parseSRT(cleanSrt);
    } catch (error: any) {
      console.error(`Erro na tradução com ${apiUrl}:`, error);
      lastError = error;
      continue;
    }
  }

  throw lastError || new Error('Falha em todos os modelos de tradução Gemini.');
};
