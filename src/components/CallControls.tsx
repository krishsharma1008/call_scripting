import { Button } from '@/components/ui/button';
import { useCall } from '@/contexts/CallContext';
import { useCustomer } from '@/contexts/CustomerContext';

export function CallControls() {
  const { status, startCall, endCall } = useCall();
  const { customerData } = useCustomer();

  const handleStartCall = () => {
    if (customerData.phone) {
      startCall(customerData.phone, customerData);
    } else {
      startCall();
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="default"
        size="sm"
        className='    border-2 border-primary
    text-primary
    bg-transparent
    hover:bg-primary/10
    transition-all duration-200'
        onClick={handleStartCall}
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




