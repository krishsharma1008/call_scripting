import { useEffect, useRef } from 'react';
import { useLLM } from '@/contexts/LLMContext';

export function useLLMPolling() {
  const { addResponse, responses, clearResponses } = useLLM();
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const pollForResponses = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/latest-response');
        if (response.ok) {
          const data = await response.json();

          if (data.reply && data.reply !== '' && !responses.some(r => r.message === data.reply)) {
            addResponse(data.reply);
          }
        } else if (response.status === 503 || response.status >= 500) {
          // Server error - likely stopped, clear old responses
          clearResponses();
          console.warn('Server appears to be stopped, clearing old responses');
        }
      } catch (error) {
        // Network error - server might be down
        clearResponses();
        console.warn('Server unavailable, clearing old responses');
      }
    };

    // Poll every 3 seconds (more frequent for live conversation simulation)
    pollingInterval.current = setInterval(pollForResponses, 3000);

    // Initial poll
    pollForResponses();

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [addResponse, responses]);

  return null;
}
