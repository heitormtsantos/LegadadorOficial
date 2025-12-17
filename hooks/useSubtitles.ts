import { useState, useCallback, useEffect } from 'react';
import { Subtitle, ReplacementRule } from '../types';
import { parseSRT, generateSRT } from '../utils/srtHelper';

const STORAGE_KEY = 'subcine_subtitles';

export const useSubtitles = (currentTime: number, glossaryRules?: ReplacementRule[]) => {
  const [subtitles, setSubtitles] = useState<Subtitle[]>(() => {
    // Load from local storage on init
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to parse subtitles from local storage', error);
      return [];
    }
  });

  // Save to local storage whenever subtitles change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(subtitles));
  }, [subtitles]);

  const applyGlossary = useCallback((subs: Subtitle[], rules: ReplacementRule[]): { subtitles: Subtitle[], changes: number } => {
    let changes = 0;
    const activeRules = rules.filter(r => r.isActive && r.find.trim());

    if (activeRules.length === 0) return { subtitles: subs, changes: 0 };

    const newSubs = subs.map(sub => {
      let newText = sub.text;
      activeRules.forEach(rule => {
         if (newText.includes(rule.find)) {
            const escapedFind = rule.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedFind, 'g');
            newText = newText.replace(regex, rule.replace);
         }
      });
      
      if (newText !== sub.text) {
        changes++;
        return { ...sub, text: newText };
      }
      return sub;
    });
    
    return { subtitles: newSubs, changes };
  }, []);

  const handleSrtUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          let parsed = parseSRT(text);
          
          if (parsed.length > 0) {
            parsed.sort((a, b) => a.startTime - b.startTime);

            // PASS 1: Global Broadcast Fix
            if (parsed[0].startTime >= 3600) {
               const hoursToShift = Math.floor(parsed[0].startTime / 3600) * 3600;
               parsed = parsed.map(sub => ({
                 ...sub,
                 startTime: Math.max(0, sub.startTime - hoursToShift),
                 endTime: Math.max(0, sub.endTime - hoursToShift)
               }));
            }

            // PASS 2: Mixed Timecode Artifact Fix
            for (let i = 1; i < parsed.length; i++) {
                const prev = parsed[i-1];
                const curr = parsed[i];
                
                if (curr.startTime >= 3600 && prev.endTime < 3600) {
                    const gap = curr.startTime - prev.endTime;
                    if (gap > 3500 && gap < 3700) {
                        const shift = 3600;
                        for (let j = i; j < parsed.length; j++) {
                            parsed[j].startTime -= shift;
                            parsed[j].endTime -= shift;
                        }
                    }
                }
            }

            // PASS 3: Validation & Clean up
            parsed = parsed.map(sub => {
                if (sub.endTime <= sub.startTime) {
                    sub.endTime = sub.startTime + 2.5;
                }
                return sub;
            });

            parsed.sort((a, b) => a.startTime - b.startTime);

            // PASS 4: Auto-Apply Glossary
            if (glossaryRules && glossaryRules.length > 0) {
              const { subtitles: replaced, changes } = applyGlossary(parsed, glossaryRules);
              parsed = replaced;
              if (changes > 0) {
                 // We can notify user via toast or alert later, or just console log for now
                 console.log(`Auto-applied glossary: ${changes} changes made.`);
                 alert(`Glossário aplicado automaticamente: ${changes} legendas alteradas.`);
              }
            }
          }

          setSubtitles(parsed);
        }
      };
      reader.readAsText(file);
    }
  }, [glossaryRules, applyGlossary]);

  const updateSubtitle = useCallback((id: number, updated: Partial<Subtitle>) => {
    setSubtitles((prev) =>
      prev.map((sub) => (sub.id === id ? { ...sub, ...updated } : sub))
    );
  }, []);

  const deleteSubtitle = useCallback((id: number) => {
    setSubtitles((prev) => prev.filter((sub) => sub.id !== id));
  }, []);

  const addSubtitle = useCallback(() => {
    setSubtitles((prev) => {
      const newId = prev.length > 0 ? Math.max(...prev.map((s) => s.id)) + 1 : 1;
      const start = currentTime;
      const end = start + 3;
      
      const newSub: Subtitle = {
        id: newId,
        startTime: start,
        endTime: end,
        text: 'Nova Legenda',
      };
      
      return [...prev, newSub].sort((a, b) => a.startTime - b.startTime);
    });
  }, [currentTime]);

  const clearSubtitles = useCallback(() => {
    if (window.confirm('Tem certeza que deseja apagar todas as legendas?')) {
      setSubtitles([]);
    }
  }, []);

  const shiftAllSubtitles = useCallback((amount: number) => {
    setSubtitles((prev) =>
      prev.map((sub) => ({
        ...sub,
        startTime: Math.max(0, sub.startTime + amount),
        endTime: Math.max(0, sub.endTime + amount),
      }))
    );
  }, []);

  const downloadSrt = useCallback(() => {
    const content = generateSRT(subtitles);
    const blob = new Blob([content], { type: 'text/srt' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'legendas.srt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [subtitles]);

  const replaceText = useCallback((find: string, replace: string) => {
    if (!find) return;
    
    setSubtitles((prev) => {
      let count = 0;
      const newSubtitles = prev.map((sub) => {
        if (sub.text.includes(find)) {
          // Use regex with 'g' flag to replace all occurrences in the text
          const regex = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
          const newText = sub.text.replace(regex, replace);
          if (newText !== sub.text) {
            count++;
            return { ...sub, text: newText };
          }
        }
        return sub;
      });
      
      if (count > 0) {
        alert(`${count} substituições realizadas.`);
      } else {
        alert('Nenhuma ocorrência encontrada.');
      }
      
      return newSubtitles;
    });
  }, []);

  const applyGlossaryToCurrent = useCallback((rules: ReplacementRule[]) => {
    setSubtitles(prev => {
      const { subtitles: newSubs, changes } = applyGlossary(prev, rules);
      if (changes > 0) {
        alert(`Glossário aplicado: ${changes} alterações realizadas.`);
        return newSubs;
      } else {
        alert('Nenhuma alteração necessária com as regras atuais.');
        return prev;
      }
    });
  }, [applyGlossary]);

  return {
    subtitles,
    setSubtitles,
    handleSrtUpload,
    updateSubtitle,
    deleteSubtitle,
    addSubtitle,
    clearSubtitles,
    downloadSrt,
    replaceText,
    applyGlossaryToCurrent,
    shiftAllSubtitles
  };
};
