import { createContext, useContext, useState, ReactNode } from 'react';

interface LLMResponse {
  id: string;
  message: string;
}

interface LLMContextType {
  responses: LLMResponse[];
  addResponse: (message: string) => void;
  removeResponse: (id: string) => void;
  clearResponses: () => void;
}

const LLMContext = createContext<LLMContextType | undefined>(undefined);

export function LLMProvider({ children }: { children: ReactNode }) {
  const [responses, setResponses] = useState<LLMResponse[]>([]);

  const addResponse = (message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setResponses(prev => [...prev, { id, message }]);
  };

  const removeResponse = (id: string) => {
    setResponses(prev => prev.filter(r => r.id !== id));
  };

  const clearResponses = () => {
    setResponses([]);
  };

  return (
    <LLMContext.Provider value={{ responses, addResponse, removeResponse, clearResponses }}>
      {children}
    </LLMContext.Provider>
  );
}

export const useLLM = () => {
  const context = useContext(LLMContext);
  if (context === undefined) {
    throw new Error('useLLM must be used within an LLMProvider');
  }
  return context;
};
