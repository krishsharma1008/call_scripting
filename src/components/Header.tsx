import { Button } from "./ui/button";

export const Header = () => {
  return (
    <header className="h-14 px-6 flex items-center justify-between bg-gradient-to-r from-primary to-[hsl(250,80%,65%)] text-primary-foreground shadow-md">
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-bold">neighborly</h1>
        <nav className="flex items-center gap-4 text-sm">
          <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/10">
            CALL A NEIGHBOR
          </Button>
          <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/10">
            STUDIO
          </Button>
          <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/10">
            SYSTEM SETTINGS
          </Button>
        </nav>
      </div>
    </header>
  );
};
