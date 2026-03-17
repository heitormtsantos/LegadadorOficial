import { useState, useEffect, useCallback } from 'react';

export interface ApiKey {
  id: string;
  name: string;
  key: string;
}

const STORAGE_KEY = 'subcine_gemini_api_keys';
const ACTIVE_KEY_ID = 'subcine_active_gemini_key_id';

const DEFAULT_KEYS: ApiKey[] = [
  { id: 'default-1', name: 'Gemini Key 1', key: 'AIzaSyBxMGn9y2MyursTAgnKMo7I6FLLYDF32co' },
  { id: 'default-2', name: 'Gemini Key 2', key: 'AIzaSyAbZqWY71p36xIvG-gDqa9-Lp1L5XNdkMA' },
  { id: 'default-3', name: 'Gemini Key 3', key: 'AIzaSyBWo_HFZU1y6ZfyrQ-uB6QAQ5YicMjLvnE' },
];

export const useApiKeys = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      
      // Se não houver chaves salvas, retorna as chaves padrão
      if (parsed.length === 0) {
        return DEFAULT_KEYS;
      }
      
      return parsed;
    } catch (error) {
      console.error('Failed to parse API keys from local storage', error);
      return DEFAULT_KEYS;
    }
  });

  const [activeKeyId, setActiveKeyId] = useState<string | null>(() => {
    const savedActiveId = localStorage.getItem(ACTIVE_KEY_ID);
    // Se houver um ID salvo, verifica se ele existe nas chaves atuais
    if (savedActiveId) return savedActiveId;
    // Caso contrário, ativa a primeira chave por padrão
    return DEFAULT_KEYS[0].id;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(apiKeys));
  }, [apiKeys]);

  useEffect(() => {
    if (activeKeyId) {
      localStorage.setItem(ACTIVE_KEY_ID, activeKeyId);
    } else {
      localStorage.removeItem(ACTIVE_KEY_ID);
    }
  }, [activeKeyId]);

  const addApiKey = useCallback((name: string, key: string) => {
    const newKey: ApiKey = {
      id: crypto.randomUUID(),
      name: name.trim() || `Key ${apiKeys.length + 1}`,
      key: key.trim(),
    };
    setApiKeys(prev => [...prev, newKey]);
    if (!activeKeyId) {
      setActiveKeyId(newKey.id);
    }
  }, [apiKeys, activeKeyId]);

  const removeApiKey = useCallback((id: string) => {
    setApiKeys(prev => prev.filter(k => k.id !== id));
    if (activeKeyId === id) {
      setActiveKeyId(null);
    }
  }, [activeKeyId]);

  const selectApiKey = useCallback((id: string) => {
    setActiveKeyId(id);
  }, []);

  const getActiveKey = useCallback(() => {
    return apiKeys.find(k => k.id === activeKeyId)?.key || null;
  }, [apiKeys, activeKeyId]);

  return {
    apiKeys,
    activeKeyId,
    addApiKey,
    removeApiKey,
    selectApiKey,
    getActiveKey,
  };
};
