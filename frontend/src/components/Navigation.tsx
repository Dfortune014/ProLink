import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import logo from "@/assets/prolynk.png";

const Navigation = () => {
  return (
    <nav className="w-full z-50 bg-white border-b border-border/50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img 
              src={logo} 
              alt="ProLynk" 
              className="h-8 md:h-10 w-auto"
            />
            
          </Link>

          <div className="flex items-center gap-3">
            {/* Secondary CTA - Text Link */}
            <Link 
              to="/auth" 
              className="h-8 flex items-center font-medium text-base text-[#334155] hover:text-[#1E293B] hover:underline transition-colors duration-200"
            >
              Sign In
            </Link>
            
            {/* Primary CTA - Button */}
            <Button 
              variant="default" 
              size="default" 
              asChild
              className="h-8 px-5 rounded-md font-semibold text-base bg-[#2563EB] text-white hover:bg-[#1F4FD8] active:bg-[#1E40AF] active:translate-y-0.5 transition-all duration-200 shadow-none"
            >
              <Link to="/auth">Get Started</Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
