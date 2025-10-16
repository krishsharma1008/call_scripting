import { useState } from 'react';
import { useLLM } from '@/contexts/LLMContext';

export function useLLMResponse() {
  const { addResponse } = useLLM();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getResponse = async (input: string, context: string = '') => {
    if (!input.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          context
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();
      addResponse(data.reply);
      return data.reply;
    } catch (err) {
      console.error('Error getting LLM response:', err);
      setError('Failed to get response from AI');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { getResponse, isLoading, error };
}
