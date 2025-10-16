import { useEffect, useRef } from 'react';
import { useLLM } from '@/contexts/LLMContext';

export function useLLMPolling() {
  const { addResponse } = useLLM();
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const pollForResponses = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/latest-response');
        if (response.ok) {
          const data = await response.json();

          if (data.reply && data.reply !== '') {
            addResponse(data.reply);
          }
        }
      } catch (error) {
        // Silently handle polling errors
      }
    };

    // Poll every 2 seconds
    pollingInterval.current = setInterval(pollForResponses, 2000);

    // Initial poll
    pollForResponses();

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [addResponse]);

  return null;
}
