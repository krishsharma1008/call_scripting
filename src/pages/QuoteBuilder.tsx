import { useState } from "react";
import { Header } from "@/components/Header";
import { ProgressStepper } from "@/components/ProgressStepper";
import { CustomerSidebar } from "@/components/CustomerSidebar";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const QuoteBuilder = () => {
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [notes, setNotes] = useState("asdfasd");

  const steps = [
    { label: "Information", completed: true, active: false },
    { label: "Quote Builder", completed: false, active: true },
    { label: "Fees", completed: false, active: false },
    { label: "Appointment", completed: false, active: false },
    { label: "Summary", completed: false, active: false },
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
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[80px] resize-none"
              />
            </div>

            <ProgressStepper steps={steps} />

            <div className="grid grid-cols-[300px_1fr] gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="category" className="text-sm mb-2 block">
                    Select Category
                  </Label>
                  <select 
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2 border rounded-md bg-background"
                  >
                    <option value="">Select Category</option>
                    <option value="cleaning">Cleaning</option>
                    <option value="inspection">Inspection</option>
                    <option value="repair">Repair</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="subCategory" className="text-sm mb-2 block">
                    Select Sub Category
                  </Label>
                  <select 
                    id="subCategory"
                    value={subCategory}
                    onChange={(e) => setSubCategory(e.target.value)}
                    className="w-full p-2 border rounded-md bg-background"
                  >
                    <option value="">Select Sub Category</option>
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                  </select>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-primary text-primary-foreground p-2 text-xs font-medium grid grid-cols-3 gap-2">
                    <div>Item Description</div>
                    <div>Unit Price</div>
                    <div>Action</div>
                  </div>
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No rows
                  </div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-primary text-primary-foreground p-2 text-xs font-medium">
                  <div className="grid grid-cols-9 gap-2">
                    <div>Item Name</div>
                    <div>Category</div>
                    <div>Sub-Category</div>
                    <div>Item Description</div>
                    <div>Line Price</div>
                    <div>Unit Cost</div>
                    <div>Qty</div>
                    <div>Total Item</div>
                    <div>Action</div>
                  </div>
                </div>
                <div className="p-16 text-center text-sm text-muted-foreground">
                  No rows
                </div>
                <div className="border-t p-2 text-center text-sm text-muted-foreground">
                  No rows
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-6">
              <Button variant="default" className="bg-primary">
                Discounts
              </Button>
              <Button variant="default" className="bg-primary">
                Total Cost
              </Button>
            </div>
          </div>
        </main>

        <CustomerSidebar />
      </div>
    </div>
  );
};

export default QuoteBuilder;
