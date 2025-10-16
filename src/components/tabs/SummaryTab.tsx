import { DialogueBox } from "@/components/DialogueBox";
import { useCustomer } from "@/contexts/CustomerContext";

const SummaryTab = () => {
  const { customerData } = useCustomer();

  return (
    <div className="space-y-6">
      <DialogueBox>
        <p>Perfect! Let me confirm all the details for your appointment.</p>
      </DialogueBox>

      <div className="bg-card p-6 rounded-lg border space-y-4">
        <h3 className="text-lg font-semibold mb-4">Appointment Summary</h3>
        
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 py-2 border-b">
            <span className="text-muted-foreground">Customer Name:</span>
            <span className="font-medium">{customerData.firstName} {customerData.lastName}</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 py-2 border-b">
            <span className="text-muted-foreground">Phone:</span>
            <span className="font-medium">{customerData.phone}</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 py-2 border-b">
            <span className="text-muted-foreground">Zipcode:</span>
            <span className="font-medium">{customerData.zipcode}</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 py-2 border-b">
            <span className="text-muted-foreground">Service:</span>
            <span className="font-medium">Dryer Vent Cleaning & Inspection</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 py-2 border-b">
            <span className="text-muted-foreground">Appointment Date:</span>
            <span className="font-medium">10/17/2025</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 py-2 border-b">
            <span className="text-muted-foreground">Time Window:</span>
            <span className="font-medium">1 pm - 3 pm</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 py-3 text-lg font-bold border-t-2 mt-4">
            <span>Total Cost:</span>
            <span className="text-primary">$238.00</span>
          </div>
        </div>
      </div>

      <DialogueBox>
        <p>
          Great! Your appointment is confirmed. You'll receive a confirmation email shortly. 
          Is there anything else I can help you with today?
        </p>
      </DialogueBox>
    </div>
  );
};

export default SummaryTab;
