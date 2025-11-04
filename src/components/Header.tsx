import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";

export const Header = () => {
  const navigate = useNavigate();

  return (
    <header className="h-14 px-6 flex items-center justify-between bg-gradient-to-r from-primary to-[hsl(250,80%,65%)] text-primary-foreground shadow-md">
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-bold cursor-pointer" onClick={() => navigate('/')}>neighborly</h1>
        <nav className="flex items-center gap-4 text-sm">
          <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/10" onClick={() => navigate('/')}>
            CALL A NEIGHBOR
          </Button>
          <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/10">
            STUDIO
          </Button>
          <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/10" onClick={() => navigate('/dashboard')}>
            DASHBOARD
          </Button>
          <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/10">
            SYSTEM SETTINGS
          </Button>
        </nav>
      </div>
    </header>
  );
};
