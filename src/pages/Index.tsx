import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-2xl px-6">
        <h1 className="mb-4 text-4xl font-bold bg-gradient-to-r from-primary to-[hsl(250,80%,65%)] bg-clip-text text-transparent">
          Customer Service Portal
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          Navigate through the service workflow
        </p>
        <Button
          onClick={() => navigate("/intro")}
          variant="default"
          size="lg"
          className="h-24 text-lg w-full max-w-md"
        >
          Start New Customer Service Call
        </Button>
      </div>
    </div>
  );
};

export default Index;
