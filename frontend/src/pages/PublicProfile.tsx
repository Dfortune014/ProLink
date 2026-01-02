import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { profilesApi, type Profile } from "@/services/api";
import ProfilePreview from "@/components/ProfilePreview";
import { Loader2, AlertCircle } from "lucide-react";
import Navigation from "@/components/Navigation";

const PublicProfile = () => {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!username) {
        setError("Username is required");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        console.log("📥 PublicProfile: Fetching profile for username:", username);
        const profileData = await profilesApi.getByUsername(username);
        console.log("📥 PublicProfile: Profile data received:", {
          profile: profileData,
          resume_url: profileData?.resume_url,
          resumeUrl: profileData?.resumeUrl,
          resume_key: profileData?.resume_key,
          show_resume: profileData?.show_resume,
          allKeys: Object.keys(profileData || {}),
        });
        setProfile(profileData);
      } catch (err: unknown) {
        console.error("❌ PublicProfile: Failed to load profile:", {
          error: err,
          message: err?.message,
          response: err?.response?.data,
          status: err?.response?.status,
        });
        if (err.response?.status === 404) {
          setError("Profile not found");
        } else {
          setError("Failed to load profile. Please try again later.");
        }
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [username]);

  // Get profile image for backdrop - check multiple possible field names
  // Must be declared before conditional returns to maintain hook order
  const profileImage = profile?.profile_image_url || profile?.avatar_url || profile?.avatarUrl || null;
  

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Profile Not Found</h1>
            <p className="text-muted-foreground mb-4">{error || "This profile does not exist."}</p>
            <Link 
              to="/" 
              className="text-primary hover:underline"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <Navigation />
      
      {/* Soft Blurred Image Backdrop */}
      {profileImage && (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <img
            src={profileImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              filter: 'blur(120px)',
              opacity: 0.15,
              transform: 'scale(1.2)',
              minWidth: '100%',
              minHeight: '100%',
            }}
            onError={(e) => {
              console.error("PublicProfile - Failed to load backdrop image:", profileImage);
              e.currentTarget.style.display = 'none';
            }}
          />
          {/* Additional overlay for better contrast */}
          <div className="absolute inset-0 bg-background/40" />
        </div>
      )}
      
      {/* Content Layer */}
      <div className="relative z-10 flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl xl:max-w-4xl 2xl:max-w-5xl">
          <ProfilePreview profile={profile} />
        </div>
      </div>
    </div>
  );
};

export default PublicProfile;
