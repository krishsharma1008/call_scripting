import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogueBoxProps {
  children: React.ReactNode;
  className?: string;
}

export const DialogueBox = ({ children, className }: DialogueBoxProps) => {
  return (
    <div className={cn("border-2 border-dashed rounded-lg p-4 bg-card", className)}>
      <div className="flex items-start gap-3">
        <MessageSquare className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-sm text-foreground">{children}</div>
      </div>
    </div>
  );
};
