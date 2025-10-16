import { useState } from "react";
import { DialogueBox } from "@/components/DialogueBox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const ServiceInformation = () => {
  const [usedBefore, setUsedBefore] = useState("no");
  const [primarySource, setPrimarySource] = useState("Online Ad");
  const [secondarySource, setSecondarySource] = useState("Google");

  return (
    <div className="space-y-6">
      <DialogueBox>
        <p>Have you used Dryer Vent Wizard before?</p>
      </DialogueBox>

      <div className="bg-card p-6 rounded-lg border">
        <RadioGroup value={usedBefore} onValueChange={setUsedBefore}>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="yes" />
              <Label htmlFor="yes">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="no" />
              <Label htmlFor="no">No</Label>
            </div>
          </div>
        </RadioGroup>
      </div>

      <DialogueBox>
        <p>May I ask how you heard about us?</p>
      </DialogueBox>

      <div className="bg-card p-6 rounded-lg border space-y-4">
        <div>
          <Label htmlFor="primarySource" className="text-sm mb-2 block">
            Primary Lead Source<span className="text-destructive">*</span>
          </Label>
          <select 
            id="primarySource"
            value={primarySource}
            onChange={(e) => setPrimarySource(e.target.value)}
            className="w-full p-2 border rounded-md bg-background"
          >
            <option>Online Ad</option>
            <option>Referral</option>
            <option>Social Media</option>
          </select>
        </div>

        <div>
          <Label htmlFor="secondarySource" className="text-sm mb-2 block">
            Secondary Lead Source<span className="text-destructive">*</span>
          </Label>
          <select 
            id="secondarySource"
            value={secondarySource}
            onChange={(e) => setSecondarySource(e.target.value)}
            className="w-full p-2 border rounded-md bg-background"
          >
            <option>Google</option>
            <option>Facebook</option>
            <option>Yelp</option>
          </select>
        </div>
      </div>

      <DialogueBox>
        <p>
          Let me give you a quick overview of our call today. I'll gather your street address 
          so I can pull up correct pricing and availability in your area, explain our process, 
          and answer any questions.
        </p>
      </DialogueBox>

      <div className="bg-card p-6 rounded-lg border">
        <Label htmlFor="phone" className="text-sm mb-2 block">
          Phone<span className="text-destructive">*</span>
        </Label>
        <Input 
          id="phone"
          placeholder="(232) 323-2323"
          defaultValue="(232) 323-2323"
        />
      </div>

      <DialogueBox>
        <p>
          I show the number you are calling in on today is <span className="text-primary">(232) 323-2323</span>. 
          Is this the best number to reach you?
        </p>
      </DialogueBox>

      <DialogueBox>
        <p>May I please have the street address of the service location?</p>
      </DialogueBox>
    </div>
  );
};

export default ServiceInformation;
