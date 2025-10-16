import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  label: string;
  completed: boolean;
  active: boolean;
}

interface ProgressStepperProps {
  steps: Step[];
}

export const ProgressStepper = ({ steps }: ProgressStepperProps) => {
  return (
    <div className="flex items-center justify-between mb-6">
      {steps.map((step, index) => (
        <div key={index} className="flex items-center flex-1">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                step.completed
                  ? "bg-primary text-primary-foreground"
                  : step.active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {step.completed ? <Check className="w-4 h-4" /> : index + 1}
            </div>
            <span
              className={cn(
                "text-sm font-medium whitespace-nowrap",
                step.active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className="flex-1 h-0.5 bg-border mx-4" />
          )}
        </div>
      ))}
    </div>
  );
};
