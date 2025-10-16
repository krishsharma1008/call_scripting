import { Separator } from "./ui/separator";
import { Button } from "./ui/button";
import { useCustomer } from "@/contexts/CustomerContext";

export const CustomerSidebar = () => {
  const { customerData } = useCustomer();
  const hasCustomerData = customerData.firstName || customerData.lastName;

  return (
    <aside className="w-80 bg-card border-l p-6 overflow-y-auto">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <span className="text-muted-foreground">👤</span>
            Customer Details
          </h2>
          {hasCustomerData ? (
            <>
              <p className="font-medium text-lg">{customerData.firstName} {customerData.lastName}</p>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <p>📞 {customerData.phone}</p>
                <p>📍 Zipcode: {customerData.zipcode}</p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No customer data available</p>
          )}
          <Button variant="link" className="text-xs p-0 h-auto text-primary mt-2">
            EDIT
          </Button>
        </div>

        <Separator />

        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <span className="text-muted-foreground">📅</span>
            Appointments
          </h3>
          <div className="flex gap-2 mb-4">
            <Button variant="default" size="sm" className="flex-1 text-xs">
              PENDING
            </Button>
            <Button variant="ghost" size="sm" className="flex-1 text-xs">
              PAST
            </Button>
            <Button variant="ghost" size="sm" className="flex-1 text-xs">
              CANCELLED
            </Button>
          </div>
          <p className="text-sm text-destructive text-center py-4">
            Select a customer or enter license number for pending appointments
          </p>
        </div>

        <Separator />

        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <span className="text-muted-foreground">🕐</span>
            History
          </h3>
          <Button variant="default" size="sm" className="w-full text-xs mb-4">
            CALLS
          </Button>
          <p className="text-sm text-destructive text-center py-4">
            No call history found
          </p>
        </div>
      </div>
    </aside>
  );
};
