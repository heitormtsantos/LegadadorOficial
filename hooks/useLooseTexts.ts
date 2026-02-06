import { useState, useCallback, useEffect } from 'react';
import { LooseText } from '../types';

const STORAGE_KEY = 'subcine_loose_texts';

export const useLooseTexts = () => {
  const [looseTexts, setLooseTexts] = useState<LooseText[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to parse loose texts from local storage', error);
      return [];
    }
  });

  // Save to local storage whenever loose texts change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(looseTexts));
  }, [looseTexts]);

  const addLooseText = useCallback((text: LooseText) => {
    setLooseTexts(prev => [...prev, text]);
  }, []);

  const updateLooseText = useCallback((id: number, updates: Partial<LooseText>) => {
    setLooseTexts(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const deleteLooseText = useCallback((id: number) => {
    setLooseTexts(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearLooseTexts = useCallback(() => {
      setLooseTexts([]);
  }, []);

  const downloadLooseTexts = useCallback(() => {
    const element = document.createElement("a");
    const file = new Blob([JSON.stringify(looseTexts, null, 2)], {
      type: "application/json",
    });
    element.href = URL.createObjectURL(file);
    element.download = `loose_texts_${Date.now()}.json`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }, [looseTexts]);

  return {
    looseTexts,
    addLooseText,
    updateLooseText,
    deleteLooseText,
    clearLooseTexts,
    downloadLooseTexts
  };
};
