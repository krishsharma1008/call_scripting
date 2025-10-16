import { Button } from '@/components/ui/button';
import { useCall } from '@/contexts/CallContext';

export function CallControls() {
  const { status, startCall, endCall } = useCall();

  return (
    <div className="flex gap-2">
      <Button
        variant="default"
        size="sm"
        onClick={startCall}
        disabled={status === 'connecting' || status === 'active'}
      >
        {status === 'connecting' ? 'Connecting...' : 'Start Call'}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={endCall}
        disabled={status !== 'active'}
      >
        End Call
      </Button>
    </div>
  );
}


