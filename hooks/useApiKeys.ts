import { useState, useEffect, useCallback } from 'react';

export interface ApiKey {
  id: string;
  name: string;
  key: string;
}

const STORAGE_KEY = 'subcine_gemini_api_keys';
const ACTIVE_KEY_ID = 'subcine_active_gemini_key_id';



export const useApiKeys = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      
      // Se não houver chaves salvas, retorna as chaves padrão
    
      
      return parsed;
    } catch (error) {
      console.error('Failed to parse API keys from local storage', error);
      
    }
  });

  const [activeKeyId, setActiveKeyId] = useState<string | null>(() => {
    const savedActiveId = localStorage.getItem(ACTIVE_KEY_ID);
    // Se houver um ID salvo, verifica se ele existe nas chaves atuais
    if (savedActiveId) return savedActiveId;
    // Caso contrário, ativa a primeira chave por padrão
    
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
