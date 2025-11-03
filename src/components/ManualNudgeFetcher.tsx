import { Button } from "@/components/ui/button";
import { useLLMPolling } from "@/hooks/useLLMPolling";

export function ManualNudgeFetcher() {
  const { fetchLatestNudge, isLoading, serverAvailable } = useLLMPolling();

  const handleFetchNudge = async () => {
    await fetchLatestNudge();
  };

  if (!serverAvailable) {
    return (
      <div className="fixed top-4 right-4 z-[9999]">
        <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded-md text-sm">
          Server unavailable
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-[9999]">
      <Button
        onClick={handleFetchNudge}
        disabled={isLoading}
        variant="outline"
        size="sm"
        className="bg-white shadow-md"
      >
        {isLoading ? "Fetching..." : "Get Latest Nudge"}
      </Button>
    </div>
  );
}
