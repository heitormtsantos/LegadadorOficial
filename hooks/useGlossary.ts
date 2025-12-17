import { useState, useEffect, useCallback } from 'react';
import { ReplacementRule, Subtitle } from '../types';

const GLOSSARY_KEY = 'subcine_glossary';

export const useGlossary = () => {
  const [rules, setRules] = useState<ReplacementRule[]>(() => {
    try {
      const saved = localStorage.getItem(GLOSSARY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to parse glossary from local storage', error);
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(GLOSSARY_KEY, JSON.stringify(rules));
  }, [rules]);

  const addRule = useCallback((find: string, replace: string) => {
    if (!find.trim()) return;
    setRules((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        find: find.trim(),
        replace: replace.trim(),
        isActive: true,
      },
    ]);
  }, []);

  const removeRule = useCallback((id: string) => {
    setRules((prev) => prev.filter((rule) => rule.id !== id));
  }, []);

  const toggleRule = useCallback((id: string) => {
    setRules((prev) =>
      prev.map((rule) =>
        rule.id === id ? { ...rule, isActive: !rule.isActive } : rule
      )
    );
  }, []);

  const updateRule = useCallback((id: string, updates: Partial<ReplacementRule>) => {
    setRules((prev) =>
      prev.map((rule) => (rule.id === id ? { ...rule, ...updates } : rule))
    );
  }, []);

  /**
   * Applies all active rules to a list of subtitles.
   * Returns a NEW array of subtitles.
   */
  const applyRulesToSubtitles = useCallback((subtitles: Subtitle[]) => {
    const activeRules = rules.filter((r) => r.isActive && r.find.trim() !== '');
    if (activeRules.length === 0) return subtitles;

    let changesCount = 0;

    const newSubtitles = subtitles.map((sub) => {
      let newText = sub.text;
      
      activeRules.forEach((rule) => {
        if (newText.includes(rule.find)) {
          // Escape regex special characters
          const escapedFind = rule.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escapedFind, 'g');
          newText = newText.replace(regex, rule.replace);
        }
      });

      if (newText !== sub.text) {
        changesCount++;
        return { ...sub, text: newText };
      }
      return sub;
    });

    return { subtitles: newSubtitles, changesCount };
  }, [rules]);

  return {
    rules,
    addRule,
    removeRule,
    toggleRule,
    updateRule,
    applyRulesToSubtitles,
  };
};
