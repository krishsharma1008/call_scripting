import { Button } from "./ui/button";
import { useLocation, useNavigate } from "react-router-dom";

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // const isActive = (path: string) => location.pathname === path;
  const isActive = (...paths: string[]): boolean =>
    paths.includes(location.pathname);

  return (
    // <header className="h-14 px-6 flex items-center justify-between bg-gradient-to-r from-primary to-[hsl(250,80%,65%)] text-primary-foreground shadow-md">
    // <header className="h-14 px-6 flex items-center justify-between bg-gradient-to-r from-[#1a0000] via-[#8b1e00] to-[#ff5e00] text-white shadow-md">
    <header
      className="h-14 px-6 flex items-center justify-between text-white shadow-md"
      style={{
        background:
          "linear-gradient(90deg, rgb(0 0 0) 0%, rgba(231, 31, 31, 1) 50%, rgb(167 9 9) 100%)",
      }}
    >
      <div className="flex items-center gap-6">
        {/* <h1 className="text-xl font-bold cursor-pointer" onClick={() => navigate('/')}>neighborly</h1> */}
        <div
          className="flex items-center cursor-pointer"
          onClick={() => navigate("/")}
        >
          <img
            src="/assets/neighborlyLogo.png"
            alt="Neighborly Logo"
            className="h-8 w-auto object-contain" // 👈 keeps proportions & fits inside header
          />
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Button
            variant="ghost"
            size="sm"
            // className="text-primary-foreground hover:bg-white/10"
            className={`${
              isActive("/intro", "/service")
                ? "text-primary font-bold border-b-2 border-primary"
                : "text-white"
            } hover:bg-white/10`}
            onClick={() => navigate("/")}
          >
            CALL A NEIGHBOR
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary-foreground hover:bg-white/10"
          >
            STUDIO
          </Button>
          <Button
            variant="ghost"
            size="sm"
            // className="text-primary-foreground hover:bg-white/10"
            className={`${
              isActive("/dashboard")
                ? "text-primary font-bold border-b-2 border-primary"
                : "text-white"
            } hover:bg-white/10`}
            onClick={() => navigate("/dashboard")}
          >
            DASHBOARD
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary-foreground hover:bg-white/10"
          >
            SYSTEM SETTINGS
          </Button>
        </nav>
      </div>
    </header>
  );
};
