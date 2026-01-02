import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";
import { profilesApi, uploadApi } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import ImageUpload from "@/components/forms/ImageUpload";
import SkillsInput from "@/components/forms/SkillsInput";

const ProfilePage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    username: "",
    title: "",
    bio: "",
    profile_image_url: "",
    avatar_key: "",
    skills: [] as string[],
    social_links: {} as Record<string, string>,
  });
  const { toast } = useToast();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const userData = await profilesApi.getCurrentUser();
      
      if (userData.username) {
        try {
          const profile = await profilesApi.getByUsername(userData.username);
          setFormData({
            full_name: profile.displayName || profile.full_name || userData.fullname || "",
            username: profile.username || userData.username || "",
            title: profile.title || "",
            bio: profile.bio || "",
            profile_image_url: profile.avatar_url || profile.profile_image_url || profile.avatarUrl || "",
            avatar_key: profile.avatar_key || "",
            skills: profile.skills || [],
            social_links: profile.social_links || {}, // Load social_links to preserve them
          });
        } catch (error) {
          // If profile doesn't exist, use user data
          setFormData({
            full_name: userData.fullname || "",
            username: userData.username || "",
            title: "",
            bio: "",
            profile_image_url: "",
            skills: [],
          });
        }
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
      toast({
        title: "Error",
        description: "Failed to load profile data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.full_name.trim()) {
      toast({
        title: "Validation error",
        description: "Full name is required.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      await profilesApi.createOrUpdate({
        full_name: formData.full_name,
        username: formData.username,
        title: formData.title,
        bio: formData.bio,
        avatar_key: formData.avatar_key,
        profile_image_url: formData.profile_image_url,
        skills: formData.skills,
        // Include social_links if they exist to preserve them
        ...(formData.social_links && Object.keys(formData.social_links).length > 0 && { social_links: formData.social_links }),
      });

      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully.",
      });
      
      // Reload profile data to get latest from server
      await loadProfile();
      
      // Notify Dashboard to refresh
      window.dispatchEvent(new CustomEvent('profileUpdated'));
    } catch (error: unknown) {
      console.error("Failed to save profile:", error);
      toast({
        title: "Save failed",
        description: error.response?.data?.message || "Failed to save profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getInitials = () => {
    if (formData.full_name) {
      return formData.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return "U";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Profile</h2>
        <p className="text-muted-foreground">
          Manage your profile information and how others see you.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Image */}
          <ImageUpload
            currentImageUrl={formData.profile_image_url}
            onImageUploaded={async (data) => {
              // Update local state
              setFormData({ 
                ...formData, 
                profile_image_url: data.url,
                avatar_key: data.key
              });
              
              // Immediately save to DynamoDB
              // Load existing profile first to preserve social_links and other fields
              try {
                let existingProfile = null;
                try {
                  existingProfile = await profilesApi.getByUsername(formData.username);
                } catch (e) {
                  // Username doesn't exist yet, which is fine - we'll create it
                }
                
                await profilesApi.createOrUpdate({
                  username: formData.username,
                  profile_image_url: data.url,
                  avatar_key: data.key,
                  // Preserve existing fields
                  ...(existingProfile?.full_name && { full_name: existingProfile.full_name }),
                  ...(existingProfile?.title && { title: existingProfile.title }),
                  ...(existingProfile?.bio && { bio: existingProfile.bio }),
                  ...(existingProfile?.skills && existingProfile.skills.length > 0 && { skills: existingProfile.skills }),
                  ...(existingProfile?.social_links && Object.keys(existingProfile.social_links).length > 0 && { social_links: existingProfile.social_links }),
                });
                
                toast({
                  title: "Profile image saved",
                  description: "Your profile image has been updated.",
                });
                
                // Reload profile data to get latest from server
                await loadProfile();
                
                // Notify Dashboard to refresh
                window.dispatchEvent(new CustomEvent('profileUpdated'));
              } catch (error: unknown) {
                console.error("Failed to save image metadata:", error);
                toast({
                  title: "Warning",
                  description: "Image uploaded but failed to save metadata. Please save your profile.",
                  variant: "destructive",
                });
              }
            }}
            getInitials={getInitials}
          />

          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name *</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) =>
                setFormData({ ...formData, full_name: e.target.value })
              }
              placeholder="Enter your full name"
              required
            />
          </div>

          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={formData.username}
              disabled
              className="bg-muted cursor-not-allowed"
              placeholder="Username"
            />
            <p className="text-xs text-muted-foreground">
              Username cannot be changed after creation.
            </p>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="e.g., Software Engineer, Designer"
            />
            <p className="text-xs text-muted-foreground">
              Your professional title or role.
            </p>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) =>
                setFormData({ ...formData, bio: e.target.value })
              }
              placeholder="Tell us about yourself..."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              A brief description about yourself.
            </p>
          </div>

          {/* Skills */}
          <SkillsInput
            skills={formData.skills}
            onSkillsChange={(skills) =>
              setFormData({ ...formData, skills })
            }
          />

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default ProfilePage;

