import { useEffect, useRef } from 'react';
import { useLLM } from '@/contexts/LLMContext';

export function useRealTimeNudges() {
  const { addResponse, responses, clearResponses } = useLLM();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Create EventSource connection to the real-time SSE endpoint
    const eventSource = new EventSource('http://localhost:3001/api/realtime-nudges');
    eventSourceRef.current = eventSource;

    // Handle incoming nudge events
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'nudge' && data.nudge) {
          // Check if this nudge is not already in responses
          if (!responses.some(r => r.message === data.nudge)) {
            console.log('📨 Real-time nudge received:', data.nudge);
            addResponse(data.nudge);
          }
        } else if (data.type === 'connected') {
          console.log('🔗 Connected to real-time nudge stream');
        }
      } catch (error) {
        console.error('❌ Error parsing SSE data:', error);
      }
    };

    // Handle connection errors
    eventSource.onerror = (error) => {
      console.error('❌ SSE connection error:', error);
      // Attempt to reconnect after a delay
      setTimeout(() => {
        if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
          console.log('🔄 Attempting to reconnect to real-time stream...');
        }
      }, 5000);
    };

    // Handle connection open
    eventSource.onopen = () => {
      console.log('✅ Real-time nudge stream connected');
    };

    // Cleanup function
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [addResponse, responses]);

  return null;
}
