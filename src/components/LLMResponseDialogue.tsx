import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LLMResponseDialogueProps {
  responses: Array<{ id: string; message: string }>;
  onDismiss: (id: string) => void;
  onClearAll: () => void;
}

export function LLMResponseDialogue({ responses, onDismiss, onClearAll }: LLMResponseDialogueProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  if (responses.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <Card className="bg-white shadow-2xl border-2 border-blue-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-blue-800 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
              <span className="text-green-700 text-xs">● LIVE</span>
              AI Coaching Tips ({responses.length})
            </CardTitle>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                className="h-6 w-6 p-0 text-blue-600 hover:bg-blue-50"
              >
                {isMinimized ? '+' : '−'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearAll}
                className="h-6 w-6 p-0 text-red-600 hover:bg-red-50"
                title="Clear all tips"
              >
                ×
              </Button>
            </div>
          </div>
        </CardHeader>

        {!isMinimized && (
          <CardContent className="pt-0">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {responses.map((response, index) => (
                <div
                  key={response.id}
                  className="relative bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 text-blue-900">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-blue-700">
                          Tip #{index + 1}
                        </span>
                      </div>
                      {response.message}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDismiss(response.id)}
                      className="h-6 w-6 p-0 text-blue-600 hover:bg-blue-100 flex-shrink-0"
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
