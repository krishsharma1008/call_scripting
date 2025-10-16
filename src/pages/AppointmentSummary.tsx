import { Header } from "@/components/Header";
import { DialogueBox } from "@/components/DialogueBox";
import { ProgressStepper } from "@/components/ProgressStepper";
import { CustomerSidebar } from "@/components/CustomerSidebar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const AppointmentSummary = () => {
  const steps = [
    { label: "Information", completed: true, active: false },
    { label: "Quote Builder", completed: true, active: false },
    { label: "Fees", completed: true, active: false },
    { label: "Appointment", completed: true, active: false },
    { label: "Summary", completed: false, active: true },
  ];

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
                <div>
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
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
                <span className="text-primary mr-2">ℹ️</span>
                <span className="font-medium">Scheduling Requests: 972-839-6618</span>
                <br />
                <span className="ml-6">Same Day Requests: Schedule</span>
              </div>
            </div>

            <div className="bg-card p-4 rounded-lg mb-6">
              <Textarea 
                defaultValue="asdfasd"
                className="min-h-[80px] resize-none"
              />
            </div>

            <ProgressStepper steps={steps} />

            <div className="space-y-6">
              <DialogueBox>
                <p>Thank you, what is your preferred email address for appointment confirmation?</p>
              </DialogueBox>

              <div className="bg-card p-6 rounded-lg border">
                <Label htmlFor="email" className="text-sm mb-2 block">
                  Email<span className="text-destructive">*</span>
                </Label>
                <Input 
                  id="email"
                  type="email"
                  defaultValue="refusedemail@nomail.com"
                  placeholder="email@example.com"
                />
              </div>

              <DialogueBox>
                <p>
                  And finally, what floor is the dryer on? <span className="text-muted-foreground italic">(*Add details to notes below)</span>
                </p>
              </DialogueBox>

              <div className="bg-card p-6 rounded-lg border">
                <Textarea 
                  defaultValue="asdfasd"
                  className="min-h-[100px] resize-none"
                />
              </div>

              <DialogueBox className="bg-green-50 border-green-200">
                <p className="font-medium">
                  Great! I have you scheduled on <span className="font-bold">Friday, Oct 17</span> with the service 
                  professional arriving between <span className="font-bold">1:00 PM</span> and <span className="font-bold">3:00 PM</span>
                </p>
              </DialogueBox>

              <div className="flex gap-4 pt-4">
                <Button 
                  variant="outline" 
                  className="flex items-center gap-2"
                >
                  <span>←</span> APPOINTMENT
                </Button>
                <Button 
                  variant="default" 
                  className="flex items-center gap-2 ml-auto bg-primary"
                >
                  CLOSING <span>→→</span>
                </Button>
              </div>
            </div>
          </div>
        </main>

        <CustomerSidebar />
      </div>
    </div>
  );
};

export default AppointmentSummary;
