import { useState, useCallback, useEffect } from 'react';
import { Subtitle, ReplacementRule } from '../types';
import { parseSRT, generateSRT } from '../utils/srtHelper';

const STORAGE_KEY = 'subcine_subtitles';

export const useSubtitles = (currentTime: number, glossaryRules?: ReplacementRule[]) => {
  const [subtitles, setSubtitles] = useState<Subtitle[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to parse subtitles from local storage', error);
      return [];
    }
  });

  const [history, setHistory] = useState<Subtitle[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Initialize history
  useEffect(() => {
    if (history.length === 0) {
       setHistory([subtitles]);
       setHistoryIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const commitToHistory = useCallback((newSubs: Subtitle[]) => {
    setHistory(prev => {
        const upToCurrent = prev.slice(0, historyIndex + 1);
        const next = [...upToCurrent, newSubs];
        if (next.length > 50) next.shift();
        return next;
    });
    setHistoryIndex(prev => {
         const nextIdx = prev + 1;
         // If we were at max capacity (49 because 0-based index for 50 items), we stay at 49 after shift
         // But if we just grew, we increment.
         // Simplified: The new index is always the last element of the NEW history.
         // We calculate length inside setHistory, but here we can't access it easily.
         // Let's trust that history length grows by 1 unless capped.
         // Actually, safer to just use setHistory callback logic, but we can't sync state easily.
         // Let's just increment, clamping at 49.
         return Math.min(prev + 1, 49);
    });
    setSubtitles(newSubs);
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setSubtitles(history[newIndex]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setSubtitles(history[newIndex]);
    }
  }, [history, historyIndex]);

  
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

          commitToHistory(parsed);
        }
      };
      reader.readAsText(file);
    }
  }, [glossaryRules, applyGlossary, commitToHistory]);

  const updateSubtitle = useCallback((id: number, updated: Partial<Subtitle>) => {
    const newSubs = subtitles.map((sub) => (sub.id === id ? { ...sub, ...updated } : sub));
    commitToHistory(newSubs);
  }, [subtitles, commitToHistory]);

  const deleteSubtitle = useCallback((id: number) => {
    const newSubs = subtitles.filter((sub) => sub.id !== id);
    commitToHistory(newSubs);
  }, [subtitles, commitToHistory]);

  const addSubtitle = useCallback(() => {
      const newId = subtitles.length > 0 ? Math.max(...subtitles.map((s) => s.id)) + 1 : 1;
      const start = currentTime;
      const end = start + 3;
      
      const newSub: Subtitle = {
        id: newId,
        startTime: start,
        endTime: end,
        text: 'Nova Legenda',
      };
      
      const newSubs = [...subtitles, newSub].sort((a, b) => a.startTime - b.startTime);
      commitToHistory(newSubs);
  }, [currentTime, subtitles, commitToHistory]);

  const clearSubtitles = useCallback(() => {
    if (window.confirm('Tem certeza que deseja apagar todas as legendas?')) {
      commitToHistory([]);
    }
  }, [commitToHistory]);

  const shiftAllSubtitles = useCallback((amount: number) => {
    const newSubs = subtitles.map((sub) => ({
        ...sub,
        startTime: Math.max(0, sub.startTime + amount),
        endTime: Math.max(0, sub.endTime + amount),
      }));
    commitToHistory(newSubs);
  }, [subtitles, commitToHistory]);

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
    
    let count = 0;
    const newSubtitles = subtitles.map((sub) => {
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
        commitToHistory(newSubtitles);
    } else {
        alert('Nenhuma ocorrência encontrada.');
    }
  }, [subtitles, commitToHistory]);

  const applyGlossaryToCurrent = useCallback((rules: ReplacementRule[]) => {
      const { subtitles: newSubs, changes } = applyGlossary(subtitles, rules);
      if (changes > 0) {
        alert(`Glossário aplicado: ${changes} alterações realizadas.`);
        commitToHistory(newSubs);
      } else {
        alert('Nenhuma alteração necessária com as regras atuais.');
      }
  }, [applyGlossary, subtitles, commitToHistory]);

  const setAllSubtitles = useCallback((newSubs: Subtitle[]) => {
    commitToHistory(newSubs);
  }, [commitToHistory]);

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
    shiftAllSubtitles,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    setAllSubtitles
  };
};
