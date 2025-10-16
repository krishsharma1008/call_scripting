import { useState } from "react";
import { DialogueBox } from "@/components/DialogueBox";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const AppointmentTab = () => {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  
  const schedule = [
    { date: "10/12/2025", slots: [] },
    { date: "10/13/2025", slots: [] },
    { date: "10/14/2025", slots: [] },
    { date: "10/15/2025", slots: [] },
    { date: "10/16/2025", slots: [] },
    { date: "10/17/2025", slots: ["1 pm - 3 pm"] },
    { date: "10/18/2025", slots: ["8:30 am - 9:30 am", "10 am - 1 pm", "1 pm - 4 pm"] },
    { date: "10/19/2025", slots: [] },
    { date: "10/20/2025", slots: ["8 am - 9 am", "9:30 am - 12:30 pm", "1 pm - 3 pm"] },
    { date: "10/21/2025", slots: ["8 am - 9 am", "9:30 am - 12:30 pm", "1 pm - 3 pm"] },
    { date: "10/22/2025", slots: ["8 am - 9 am", "9:30 am - 12:30 pm", "1 pm - 3 pm"] },
    { date: "10/23/2025", slots: ["8 am - 9 am", "9:30 am - 12:30 pm", "1 pm - 3 pm"] },
    { date: "10/24/2025", slots: ["8 am - 9 am", "9:30 am - 12:30 pm", "1 pm - 3 pm"] },
    { date: "10/25/2025", slots: ["8:30 am - 9:30 am", "10 am - 1 pm", "1 pm - 4 pm"] },
  ];

  return (
    <div className="space-y-6">
      <DialogueBox>
        <p>
          Okay, let's take a look at the schedule for you. It looks like the first available appointment I have is [day & date] 
          with the service professional arriving between _____ and _____.
        </p>
      </DialogueBox>

      <div className="bg-card p-6 rounded-lg border">
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" size="sm">
            <ChevronLeft className="h-4 w-4 mr-2" />
            PREVIOUS TWO WEEKS
          </Button>
          <Button variant="outline" size="sm">
            NEXT TWO WEEKS
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>

        {!selectedSlot && (
          <div className="flex justify-end mb-4">
            <div className="bg-orange-500 text-white px-4 py-2 rounded-full text-sm flex items-center gap-2">
              <span className="w-2 h-2 bg-white rounded-full"></span>
              No appointment selected
            </div>
          </div>
        )}

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day, idx) => (
            <div key={idx} className="text-center">
              <div className="font-medium text-sm mb-2">{day}</div>
            </div>
          ))}

          {schedule.map((day, idx) => (
            <div key={idx} className="border rounded-lg p-2 min-h-[120px]">
              <div className="text-xs text-muted-foreground mb-2 text-center">{day.date}</div>
              <div className="space-y-1">
                {day.slots.length === 0 ? (
                  <div className="text-xs text-center text-muted-foreground">No slots</div>
                ) : (
                  day.slots.map((slot, slotIdx) => (
                    <button
                      key={slotIdx}
                      onClick={() => setSelectedSlot(`${day.date} ${slot}`)}
                      className={`w-full text-xs py-1.5 px-2 rounded text-white transition-colors ${
                        selectedSlot === `${day.date} ${slot}`
                          ? "bg-blue-700"
                          : "bg-blue-600 hover:bg-blue-700"
                      }`}
                    >
                      {slot}
                    </button>
                  ))
                )}
                {day.slots.length > 3 && (
                  <div className="text-xs text-center text-muted-foreground">+ more</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedSlot && (
        <div className="bg-green-50 border border-green-200 rounded p-4">
          <p className="text-sm">
            <span className="font-medium">Selected appointment:</span> {selectedSlot}
          </p>
        </div>
      )}
    </div>
  );
};

export default AppointmentTab;
