import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CustomerProvider } from "./contexts/CustomerContext";
import { LLMProvider } from "./contexts/LLMContext";
import Index from "./pages/Index";
import IntroScript from "./pages/IntroScript";
import ServicePageTabs from "./pages/ServicePageTabs";
import NotFound from "./pages/NotFound";
import CallDashboard from "./pages/CallDashboard";
import CallsHistory from "./pages/CallsHistory";
import { CallProvider } from "./contexts/CallContext";
import { NudgesTray } from "./components/NudgesTray";

const queryClient = new QueryClient();

const App = () => {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <CustomerProvider>
          <LLMProvider>
            <CallProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <div className="relative min-h-screen">
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/intro" element={<IntroScript />} />
                    <Route path="/service" element={<ServicePageTabs />} />
                    <Route path="/calls-history" element={<CallsHistory />} />
                    <Route path="/dashboard" element={<CallDashboard />} />
                    <Route path="/dashboard/:callId" element={<CallDashboard />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                  {/* Global nudges overlay (bottom-right), visible on any page */}
                  {/* Disabled - nudges now shown in CustomerSidebar */}
                  {/* <NudgesTray /> */}
                </div>
              </TooltipProvider>
            </CallProvider>
          </LLMProvider>
        </CustomerProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

export default App;
