import { DialogueBox } from "@/components/DialogueBox";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const QuoteBuilderTab = () => {
  return (
    <div className="space-y-6">
      <DialogueBox>
        <p>I'm going to ask you some questions to help build your service package. What type of services are you interested in today?</p>
      </DialogueBox>

      <div className="bg-card p-6 rounded-lg border space-y-4">
        <Label className="text-sm font-medium mb-4 block">Service Categories</Label>
        
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox id="cleaning" />
            <label htmlFor="cleaning" className="text-sm cursor-pointer">
              Dryer Vent Cleaning
            </label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox id="inspection" />
            <label htmlFor="inspection" className="text-sm cursor-pointer">
              Dryer Vent Inspection
            </label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox id="installation" />
            <label htmlFor="installation" className="text-sm cursor-pointer">
              New Dryer Vent Installation
            </label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox id="repair" />
            <label htmlFor="repair" className="text-sm cursor-pointer">
              Dryer Vent Repair
            </label>
          </div>
        </div>
      </div>

      <DialogueBox>
        <p>Great! Let me add those services to your quote. Is there anything specific about your dryer vent system you'd like me to know?</p>
      </DialogueBox>

      <div className="bg-card p-6 rounded-lg border">
        <Label className="text-sm mb-2 block">Additional Notes</Label>
        <textarea 
          className="w-full p-3 border rounded-md bg-background min-h-[100px] resize-none"
          placeholder="Add any additional details here..."
        />
      </div>
    </div>
  );
};

export default QuoteBuilderTab;
