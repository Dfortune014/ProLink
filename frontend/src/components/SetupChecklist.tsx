import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle } from "lucide-react";
import { Link } from "react-router-dom";

interface SetupChecklistProps {
  profile?: {
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

const SetupChecklist = ({ profile }: SetupChecklistProps) => {
  const checklistItems = [
    {
      id: "profile",
      label: "Complete your profile",
      completed: !!(profile?.full_name && profile?.username && profile?.bio),
      path: "/dashboard/profile",
    },
    {
      id: "image",
      label: "Add profile image",
      completed: !!profile?.profile_image_url,
      path: "/dashboard/profile",
    },
    {
      id: "social",
      label: "Add social links",
      completed: !!(profile?.social_links && Object.keys(profile.social_links).length > 0),
      path: "/dashboard/social-links",
    },
    {
      id: "contact",
      label: "Add contact info",
      completed: !!(profile?.email || profile?.phone),
      path: "/dashboard/contact",
    },
    {
      id: "skills",
      label: "Add skills",
      completed: !!(profile?.skills && profile.skills.length > 0),
      path: "/dashboard/profile",
    },
    {
      id: "projects",
      label: "Add projects",
      completed: !!(profile?.projects && profile.projects.length > 0),
      path: "/dashboard/projects",
    },
    {
      id: "resume",
      label: "Upload resume",
      completed: !!(profile?.resume_url || profile?.resume_key),
      path: "/dashboard/resume",
    },
  ];

  const completedCount = checklistItems.filter((item) => item.completed).length;
  const totalCount = checklistItems.length;
  const percentage = Math.round((completedCount / totalCount) * 100);

  return (
    <Card className="p-4 bg-card/50 border-border/50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          Your setup checklist
        </h3>
        <span className="text-xs font-medium text-muted-foreground">
          {percentage}%
        </span>
      </div>
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>{completedCount} of {totalCount} complete</span>
        </div>
        <div className="w-full bg-muted/50 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
      <ul className="space-y-2 mb-4">
        {checklistItems.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            {item.completed ? (
              <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            <span
              className={`text-xs ${
                item.completed
                  ? "text-muted-foreground line-through"
                  : "text-foreground"
              }`}
            >
              {item.label}
            </span>
          </li>
        ))}
      </ul>
      {percentage < 100 && (
        <Button
          asChild
          size="sm"
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Link to="/dashboard/profile">Finish setup</Link>
        </Button>
      )}
    </Card>
  );
};

export default SetupChecklist;

