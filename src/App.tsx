import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CustomerProvider } from "./contexts/CustomerContext";
import { LLMProvider, useLLM } from "./contexts/LLMContext";
import Index from "./pages/Index";
import IntroScript from "./pages/IntroScript";
import ServicePageTabs from "./pages/ServicePageTabs";
import NotFound from "./pages/NotFound";
import { LLMResponseDialogue } from './components/LLMResponseDialogue';
import { useLLMPolling } from "./hooks/useLLMPolling";
import { useRealTimeNudges } from './hooks/useRealTimeNudges';

const queryClient = new QueryClient();

// Component to manage LLM responses
const LLMResponseManager = () => {
  const { responses, removeResponse, clearResponses } = useLLM();

  if (responses.length === 0) return null;

  return (
    <LLMResponseDialogue
      responses={responses}
      onDismiss={removeResponse}
      onClearAll={clearResponses}
    />
  );
};

// Component that sets up real-time nudges
const RealTimeNudgeProvider = ({ children }: { children: React.ReactNode }) => {
  useRealTimeNudges(); // This will receive real-time nudges from the server
  return <>{children}</>;
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <CustomerProvider>
        <LLMProvider>
          <RealTimeNudgeProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <div className="relative min-h-screen">
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/intro" element={<IntroScript />} />
                    <Route path="/service" element={<ServicePageTabs />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                  <LLMResponseManager />
                </div>
              </BrowserRouter>
            </TooltipProvider>
          </RealTimeNudgeProvider>
        </LLMProvider>
      </CustomerProvider>
    </QueryClientProvider>
  );
};

export default App;
