import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation, useNavigate } from "react-router-dom";

interface DashboardTabsProps {
  currentPath: string;
}

const DashboardTabs = ({ currentPath }: DashboardTabsProps) => {
  const navigate = useNavigate();

  const tabs = [
    {
      id: "profile",
      label: "Profile",
      path: "/dashboard/profile",
    },
    {
      id: "social-links",
      label: "Social Links",
      path: "/dashboard/social-links",
    },
    {
      id: "resume",
      label: "Resume",
      path: "/dashboard/resume",
    },
    {
      id: "projects",
      label: "Projects",
      path: "/dashboard/projects",
    },
    {
      id: "contact",
      label: "Contact",
      path: "/dashboard/contact",
    },
    {
      id: "analytics",
      label: "Analytics",
      path: "/dashboard/analytics",
    },
  ];

  const activeTab = tabs.find((tab) => currentPath === tab.path || 
    (currentPath === "/dashboard" && tab.id === "profile"))?.id || "profile";

  const handleTabChange = (value: string) => {
    const tab = tabs.find((t) => t.id === value);
    if (tab) {
      navigate(tab.path);
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 h-auto p-1 bg-muted/50 overflow-x-auto">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:text-foreground whitespace-nowrap"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};

export default DashboardTabs;

