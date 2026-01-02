import { 
  User, 
  Link2, 
  FileText, 
  FolderKanban, 
  Phone, 
  BarChart3
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import logo from "@/assets/prolynk.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import SetupChecklist from "@/components/SetupChecklist";

interface DashboardSidebarProps {
  userProfile?: {
    full_name?: string;
    username?: string;
    profile_image_url?: string;
    title?: string;
    bio?: string;
    social_links?: Record<string, string>;
    skills?: string[];
    projects?: Array<{
      id?: string;
      title: string;
      description?: string;
      link: string;
      image_url?: string;
      image_key?: string;
      tech_stack?: string[];
      order?: number;
    }>;
    email?: string;
    phone?: string;
    resume_url?: string | null;
    resume_key?: string | null;
  };
}

const DashboardSidebar = ({ userProfile }: DashboardSidebarProps) => {
  const location = useLocation();

  const myProLinkItems = [
    {
      label: "Profile",
      icon: User,
      path: "/dashboard/profile",
      active: location.pathname === "/dashboard/profile" || location.pathname === "/dashboard",
    },
    {
      label: "Social Links",
      icon: Link2,
      path: "/dashboard/social-links",
      active: location.pathname === "/dashboard/social-links",
    },
    {
      label: "Resume",
      icon: FileText,
      path: "/dashboard/resume",
      active: location.pathname === "/dashboard/resume",
    },
    {
      label: "Projects",
      icon: FolderKanban,
      path: "/dashboard/projects",
      active: location.pathname === "/dashboard/projects",
    },
    {
      label: "Contact",
      icon: Phone,
      path: "/dashboard/contact",
      active: location.pathname === "/dashboard/contact",
    },
  ];

  const analyticsItems = [
    {
      label: "Insights",
      icon: BarChart3,
      path: "/dashboard/analytics",
      active: location.pathname === "/dashboard/analytics",
    },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-white bg-card/80 backdrop-blur-xl border-r border-border/50 flex flex-col z-40">
      {/* Logo Section */}
      <div className="p-6 border-b border-border/50">
        <Link to="/" className="flex items-center gap-3">
          <img
            src={logo}
            alt="ProLink"
            className="h-8 w-auto"
          />
          
        </Link>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {/* My ProLink Section */}
        <div className="mb-6">
          <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            My ProLynk
          </h3>
          <ul className="space-y-1">
            {myProLinkItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                      transition-colors duration-200
                      ${
                        item.active
                          ? "bg-primary/10 text-primary border-l-2 border-primary"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }
                    `}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Analytics Section */}
        <div className="mb-6">
          <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Audience
          </h3>
          <ul className="space-y-1">
            {analyticsItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                      transition-colors duration-200
                      ${
                        item.active
                          ? "bg-primary/10 text-primary border-l-2 border-primary"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }
                    `}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Setup Checklist Card */}
      <div className="p-4 border-t border-border/50">
        <SetupChecklist profile={userProfile} />
      </div>

      {/* Footer - Theme Toggle */}
      <div className="p-3 border-t border-border/50">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
};

export default DashboardSidebar;

