import { DialogueBox } from "@/components/DialogueBox";

const FeesTab = () => {
  return (
    <div className="space-y-6">
      <DialogueBox>
        <p>Let me go over the pricing for the services you've selected.</p>
      </DialogueBox>

      <div className="bg-card p-6 rounded-lg border">
        <h3 className="text-lg font-semibold mb-4">Service Fees</h3>
        
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b">
            <span>Dryer Vent Cleaning</span>
            <span className="font-medium">$149.00</span>
          </div>
          
          <div className="flex justify-between py-2 border-b">
            <span>Dryer Vent Inspection</span>
            <span className="font-medium">$89.00</span>
          </div>
          
          <div className="flex justify-between py-2 border-b">
            <span>Service Fee</span>
            <span className="font-medium">$0.00</span>
          </div>
          
          <div className="flex justify-between py-3 text-lg font-bold border-t-2 mt-4">
            <span>Total</span>
            <span className="text-primary">$238.00</span>
          </div>
        </div>
      </div>

      <DialogueBox>
        <p>Does this pricing work for you? We can schedule your appointment at your convenience.</p>
      </DialogueBox>
    </div>
  );
};

export default FeesTab;
