import { useState } from "react";
import { Header } from "@/components/Header";
import { DialogueBox } from "@/components/DialogueBox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useCustomer } from "@/contexts/CustomerContext";

// Generate unique phone number from customer data (deterministic)
function generatePhoneFromCustomer(firstName: string, lastName: string, zipcode: string): string {
  // Create hash from name + zipcode
  const seed = `${firstName}${lastName}${zipcode}`.toLowerCase();
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Generate phone number components
  const area = String(Math.abs(hash % 900) + 100).padStart(3, '0');
  const exchange = String(Math.abs(hash * 17 % 900) + 100).padStart(3, '0');
  const number = String(Math.abs(hash * 31 % 10000)).padStart(4, '0');
  
  return `(${area}) ${exchange}-${number}`;
}

const IntroScript = () => {
  const navigate = useNavigate();
  const { setCustomerData } = useCustomer();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [zipcode, setZipcode] = useState("");
  
  const handleNext = () => {
    // Generate unique phone number from customer data
    const generatedPhone = generatePhoneFromCustomer(firstName, lastName, zipcode);
    setCustomerData({
      firstName,
      lastName,
      zipcode,
      phone: generatedPhone
    });
    navigate("/service");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">DVW EMMA TRAINING - Intro Script</h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Active</span>
            <div className="w-12 h-6 bg-primary rounded-full relative">
              <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
            </div>
          </div>
        </div>

        <DialogueBox>
          <p>
            It's a great day at the <span className="text-primary">@brandName</span> scheduling center. 
            This is <span className="text-primary">@agentFirstName</span>. How can I help you today?
          </p>
        </DialogueBox>

        <div className="border-2 border-dashed rounded-lg p-4 bg-card">
          <Label className="text-sm font-medium mb-2 block">Notes</Label>
          <Textarea 
            placeholder="Add notes here..." 
            className="min-h-[80px] resize-none"
          />
          <div className="mt-4 p-4 border-2 border-dashed rounded-lg text-center text-sm text-muted-foreground">
            Drop Here
          </div>
        </div>

        <DialogueBox>
          <p>May I please have your first and last name?</p>
        </DialogueBox>

        <div className="border-2 border-dashed rounded-lg p-4 bg-card">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="firstName" className="text-sm mb-2 block">
                First Name<span className="text-destructive">*</span>
              </Label>
              <Input 
                id="firstName" 
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First Name"
              />
            </div>
            <div>
              <Label htmlFor="lastName" className="text-sm mb-2 block">
                Last Name<span className="text-destructive">*</span>
              </Label>
              <Input 
                id="lastName" 
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last Name"
              />
            </div>
          </div>
          <div className="p-4 border-2 border-dashed rounded-lg text-center text-sm text-muted-foreground">
            Drop Here
          </div>
        </div>

        <DialogueBox>
          <p>I can certainly assist you. Can I please have the zip code of the property so I can pull up the correct office in your area?</p>
        </DialogueBox>

        <div className="border-2 border-dashed rounded-lg p-4 bg-card">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <Label htmlFor="zipcode" className="text-sm mb-2 block">
                Zipcode<span className="text-destructive">*</span>
              </Label>
              <Input 
                id="zipcode" 
                value={zipcode}
                onChange={(e) => setZipcode(e.target.value)}
                placeholder="Zipcode"
              />
            </div>
            <div className="p-4 border-2 border-dashed rounded-lg text-center text-sm text-muted-foreground flex items-center justify-center">
              Drop Here
            </div>
            <div className="p-4 border-2 border-dashed rounded-lg text-center text-sm text-muted-foreground flex items-center justify-center">
              Drop Here
            </div>
          </div>
          <div className="p-4 border-2 border-dashed rounded-lg text-center text-sm text-muted-foreground">
            Drop Here
          </div>
        </div>

        <div className="border-2 border-dashed rounded-lg p-4 bg-card">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="p-4 border-2 border-dashed rounded-lg text-center text-sm text-muted-foreground flex items-center justify-center">
              Drop Here
            </div>
            <div className="p-4 border-2 border-dashed rounded-lg text-center text-sm text-muted-foreground flex items-center justify-center">
              Drop Here
            </div>
            <div className="p-4 border-2 border-dashed rounded-lg text-center text-sm text-muted-foreground flex items-center justify-center">
              Drop Here
            </div>
          </div>
          <Label className="text-sm mb-2 block">Call Type<span className="text-destructive">*</span></Label>
          <select className="w-full p-2 border rounded-md bg-background">
            <option>New Service</option>
            <option>Reschedule Service</option>
            <option>Cancel Service</option>
            <option>Follow up</option>
          </select>
          <div className="mt-4 p-4 border-2 border-dashed rounded-lg text-center text-sm text-muted-foreground">
            Drop Here
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Button 
            variant="default" 
            size="lg"
            className="    border-2 border-primary
    text-primary
    bg-transparent
    hover:bg-primary/10
    transition-all duration-200"
            onClick={handleNext}
            disabled={!firstName || !lastName || !zipcode}
          >
            NEXT
          </Button>
        </div>
      </div>
    </div>
  );
};

export default IntroScript;
