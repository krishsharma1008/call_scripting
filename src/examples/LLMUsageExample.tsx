// Example usage in any component
import { useLLM } from '@/contexts/LLMContext';

function YourComponent() {
  const { addResponse } = useLLM();

  // Example function to show a message
  const showMessage = () => {
    addResponse("This is a test message from the LLM");
  };

  return (
    <button
      onClick={showMessage}
      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
    >
      Show Message
    </button>
  );
}
