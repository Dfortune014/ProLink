import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { profilesApi } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Settings, HelpCircle, LogOut, ChevronRight, Copy, Check, Menu, Eye, EyeOff } from "lucide-react";
import DashboardSidebar from "@/components/DashboardSidebar";
import ProfilePreview from "@/components/ProfilePreview";
import DashboardTabs from "@/components/DashboardTabs";
import { Link, useLocation, Outlet } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [copied, setCopied] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [userProfile, setUserProfile] = useState<{ 
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
      order?: number;
    }>;
    email?: string;
    phone?: string;
    show_email?: boolean;
    show_phone?: boolean;
    resume_url?: string | null;
    resume_key?: string | null;
  } | null>(null);

  // Function to load profile data
  const loadProfileData = async () => {
    try {
      // Check profile completion status from users table (source of truth)
      try {
        const userProfileData = await profilesApi.getCurrentUser();
        
        // If profile is not complete, redirect to complete-profile
        if (!userProfileData.profile_complete || !userProfileData.username) {
          navigate("/auth/complete-profile", { replace: true });
          return;
        }
        
        // Profile is complete, fetch full profile data from profiles table
        try {
          const fullProfile = await profilesApi.getByUsername(userProfileData.username);
          
          // Use resume URL from profile (should be presigned URL from backend)
          // Don't generate direct S3 URLs - backend should provide presigned URLs
          const resumeUrl = fullProfile.resume_url || fullProfile.resumeUrl || null;
          const resumeKey = fullProfile.resume_key;
          // If resume_url is missing but resume_key exists, backend should have provided it
          // If it's still missing, we'll need to fetch it separately (but backend should handle this)
          
          // Set user profile data from profiles table (has more complete data)
          const imageUrl = fullProfile.avatar_url || fullProfile.profile_image_url || fullProfile.avatarUrl || "";
          
          const newUserProfile = {
            full_name: fullProfile.displayName || fullProfile.full_name || userProfileData.fullname,
            username: fullProfile.username || userProfileData.username,
            profile_image_url: imageUrl,
            title: fullProfile.title,
            bio: fullProfile.bio,
            social_links: fullProfile.social_links,
            skills: fullProfile.skills,
            projects: fullProfile.projects,
            email: fullProfile.email || userProfileData.email,
            phone: fullProfile.phone,
            show_email: fullProfile.show_email,
            show_phone: fullProfile.show_phone,
            resume_url: resumeUrl,
            resume_key: resumeKey,
          };
          
          setUserProfile(newUserProfile);
        } catch (profileError: unknown) {
          // If profile doesn't exist in profiles table, use data from users table
          setUserProfile({
            full_name: userProfileData.fullname,
            username: userProfileData.username
          });
        }
      } catch (profileError: unknown) {
        // If user doesn't exist in users table (404), redirect to complete-profile
        if (profileError && typeof profileError === 'object' && 'response' in profileError && profileError.response && typeof profileError.response === 'object' && 'status' in profileError.response && profileError.response.status === 404) {
          navigate("/auth/complete-profile", { replace: true });
          return;
        }
      }
    } catch (err) {
      console.error("Dashboard: Failed to load profile:", err);
      // Don't redirect on error - allow user to see dashboard
    }
  };

  // Check if profile is complete on mount and fetch profile data
  useEffect(() => {
    const checkProfile = async () => {
      setIsCheckingProfile(true);
      await loadProfileData();
      setIsCheckingProfile(false);
    };

    // Only check if user is authenticated
    if (user) {
      checkProfile();
    } else {
      setIsCheckingProfile(false);
    }
  }, [user, navigate]);

  // Listen for profile update events
  useEffect(() => {
    const handleProfileUpdate = () => {
      loadProfileData();
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, []);

  // Redirect /dashboard to /dashboard/profile
  useEffect(() => {
    if (location.pathname === "/dashboard" && !isCheckingProfile) {
      navigate("/dashboard/profile", { replace: true });
    }
  }, [location.pathname, navigate, isCheckingProfile]);

  if (isCheckingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = "/";
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  const getInitials = () => {
    if (userProfile?.full_name) {
      return userProfile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  const getProfileUrl = () => {
    const baseUrl = window.location.origin;
    const username = userProfile?.username || "username";
    return `${baseUrl}/${username}`;
  };

  const handleCopyLink = async () => {
    const profileUrl = getProfileUrl();
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "Your profile link has been copied to clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex flex-1">
        {/* Left Sidebar - Hidden on mobile, shown via sheet */}
        <div className="hidden lg:block">
          <DashboardSidebar userProfile={userProfile || undefined} />
        </div>

        {/* Main Content Area - Center */}
        <div className="flex-1 flex flex-col lg:ml-60">
          {/* Top Header - Profile and Settings */}
          <header className="h-16 border-b border-border/50 bg-white flex items-center justify-between lg:justify-end px-4 lg:px-6 fixed top-0 left-0 lg:left-60 right-0 xl:right-[500px] z-30">
            {/* Mobile Menu Button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-60 p-0">
                <DashboardSidebar userProfile={userProfile || undefined} />
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-2 lg:gap-3">
              {/* Help Button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                asChild
              >
                <Link to="/dashboard/help">
                  <HelpCircle className="h-5 w-5" />
                </Link>
              </Button>

              {/* Settings Button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                asChild
              >
                <Link to="/dashboard/settings">
                  <Settings className="h-5 w-5" />
                </Link>
              </Button>

              {/* Share Link - Hidden on small mobile */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                <span className="text-sm font-medium text-foreground">
                  prolynk.ee/{userProfile?.username || "username"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-background"
                  onClick={handleCopyLink}
                  title="Copy link"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>

              {/* Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 hover:bg-muted/50"
                  >
                    <Avatar className="h-8 w-8" key={userProfile?.profile_image_url}>
                      {userProfile?.profile_image_url ? (
                        <AvatarImage 
                          src={userProfile.profile_image_url} 
                          alt={userProfile?.full_name || user?.email}
                          onError={(e) => {
                            // Image failed to load - silently handle
                          }}
                        />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {getInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard/profile" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Main Content with Tabs */}
          <main className="flex-1 overflow-y-auto pt-16">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
              {/* Tab Navigation */}
              <div className="mb-6">
                <DashboardTabs currentPath={location.pathname} />
              </div>

              {/* Content Area */}
              <div className="bg-background">
                <Outlet />
              </div>
            </div>
          </main>
        </div>

        {/* Right Column - Preview Panel - Hidden on mobile/tablet, visible on xl+ */}
        <aside className="hidden xl:block w-[500px] flex-shrink-0 border-l border-border/50 bg-background/30 overflow-y-auto">
          <div className="p-6">
            <ProfilePreview 
              profile={userProfile || undefined}
              onAddSection={(section) => {
                // Navigate to appropriate section
                const sectionMap: Record<string, string> = {
                  bio: "/dashboard/profile",
                  contact: "/dashboard/contact",
                  links: "/dashboard/social-links",
                  skills: "/dashboard/profile",
                  projects: "/dashboard/projects",
                  resume: "/dashboard/resume"
                };
                navigate(sectionMap[section] || "/dashboard/profile");
              }}
            />
          </div>
        </aside>
      </div>
      
      {/* Mobile Preview Toggle Button - Floating */}
      <Button
        variant="default"
        size="icon"
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg xl:hidden"
        onClick={() => setShowPreview(true)}
      >
        <Eye className="h-6 w-6" />
      </Button>
      
      {/* Mobile Preview Sheet */}
      <Sheet open={showPreview} onOpenChange={setShowPreview}>
        <SheetContent side="right" className="w-full sm:w-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Live Preview</h3>
          </div>
          <ProfilePreview 
            profile={userProfile || undefined}
            onAddSection={(section) => {
              const sectionMap: Record<string, string> = {
                bio: "/dashboard/profile",
                contact: "/dashboard/contact",
                links: "/dashboard/social-links",
                skills: "/dashboard/profile",
                projects: "/dashboard/projects",
                resume: "/dashboard/resume"
              };
              navigate(sectionMap[section] || "/dashboard/profile");
              setShowPreview(false);
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Dashboard;

