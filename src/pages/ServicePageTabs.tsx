import { useState } from "react";
import { Header } from "@/components/Header";
import { CustomerSidebar } from "@/components/CustomerSidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { CallControls } from "@/components/CallControls";
import ServiceInformation from "@/components/tabs/ServiceInformation";
import QuoteBuilderTab from "@/components/tabs/QuoteBuilderTab";
import FeesTab from "@/components/tabs/FeesTab";
import AppointmentTab from "@/components/tabs/AppointmentTab";
import SummaryTab from "@/components/tabs/SummaryTab";

const ServicePageTabs = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("information");

  const tabs = ["information", "quote-builder", "fees", "appointment", "summary"];
  
  const handleNext = () => {
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex === 0) {
      navigate("/intro");
    } else {
      setActiveTab(tabs[currentIndex - 1]);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto p-6">
            <div className="bg-card rounded-lg shadow-sm p-6 mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded flex items-center justify-center">
                  <span className="text-2xl">🔧</span>
                </div>
                <div className="flex-1">
                  <h1 className="text-xl font-semibold">Dryer Vent Wizard of Central Dallas/Ft. Worth</h1>
                  <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <span className="text-primary">📍</span> Office
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-primary">🕐</span> Hours
                    </span>
                  </div>
                </div>
                <CallControls />
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
                <span className="text-primary mr-2">ℹ️</span>
                <span className="font-medium">Scheduling Requests: 972-839-6618</span>
                <br />
                <span className="ml-6">Same Day Requests: Schedule</span>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full justify-start mb-6">
                <TabsTrigger value="information">Information</TabsTrigger>
                <TabsTrigger value="quote-builder">Quote Builder</TabsTrigger>
                <TabsTrigger value="fees">Fees</TabsTrigger>
                <TabsTrigger value="appointment">Appointment</TabsTrigger>
                <TabsTrigger value="summary">Summary</TabsTrigger>
              </TabsList>

              <TabsContent value="information">
                <ServiceInformation />
              </TabsContent>

              <TabsContent value="quote-builder">
                <QuoteBuilderTab />
              </TabsContent>

              <TabsContent value="fees">
                <FeesTab />
              </TabsContent>

              <TabsContent value="appointment">
                <AppointmentTab />
              </TabsContent>

              <TabsContent value="summary">
                <SummaryTab />
              </TabsContent>
            </Tabs>

            <div className="flex justify-between gap-4 mt-6">
              <Button 
                variant="outline" 
                size="lg"
                onClick={handleBack}
              >
                BACK
              </Button>
              <Button 
                variant="default" 
                size="lg"
                onClick={handleNext}
                disabled={activeTab === "summary"}
              >
                {activeTab === "summary" ? "COMPLETE" : "NEXT"}
              </Button>
            </div>
          </div>
        </main>

        <CustomerSidebar />
      </div>
    </div>
  );
};

export default ServicePageTabs;
