import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, Plus, Trash2 } from "lucide-react";
import { profilesApi } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { SOCIAL_PLATFORMS, SocialPlatformKey } from "@/components/icons/SocialIcons";

const SocialLinksPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    loadSocialLinks();
  }, []);

  const loadSocialLinks = async () => {
    try {
      setLoading(true);
      const userData = await profilesApi.getCurrentUser();
      
      if (userData.username) {
        try {
          const profile = await profilesApi.getByUsername(userData.username);
          setSocialLinks(profile.social_links || {});
        } catch (error) {
          console.error("Failed to load profile:", error);
          setSocialLinks({});
        }
      }
    } catch (error) {
      console.error("Failed to load social links:", error);
      toast({
        title: "Error",
        description: "Failed to load social links.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLinkChange = (platform: SocialPlatformKey, value: string) => {
    setSocialLinks((prev) => ({
      ...prev,
      [platform]: value,
    }));
  };

  const handleRemoveLink = (platform: SocialPlatformKey) => {
    setSocialLinks((prev) => {
      const updated = { ...prev };
      delete updated[platform];
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      const userData = await profilesApi.getCurrentUser();
      
      // Lambda now preserves existing fields, so we only need to send social_links
      await profilesApi.createOrUpdate({
        username: userData.username,
        social_links: socialLinks,
      });

      toast({
        title: "Social links updated",
        description: "Your social links have been saved successfully.",
      });
      
      // Reload to verify
      await loadSocialLinks();
      
      // Notify Dashboard to refresh
      window.dispatchEvent(new CustomEvent('profileUpdated'));
    } catch (error: unknown) {
      console.error("Failed to save social links:", error);
      console.error("Error details:", error.response?.data);
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to save social links.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatUrl = (url: string): string => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    return `https://${url}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Social Links</h1>
        <p className="text-muted-foreground mt-2">
          Add your social media profiles and portfolio links to your profile.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Social Media Profiles</CardTitle>
            <CardDescription>
              Connect your social media accounts. Links will be displayed on your public profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {SOCIAL_PLATFORMS.map((platform) => {
              const Icon = platform.icon;
              const value = socialLinks[platform.key] || "";
              const hasValue = !!value;

              return (
                <div key={platform.key} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <Label htmlFor={platform.key} className="flex-1">
                      {platform.label}
                    </Label>
                    {hasValue && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveLink(platform.key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id={platform.key}
                      type="url"
                      placeholder={`https://${platform.key === 'portfolio' ? 'yourwebsite.com' : platform.key === 'twitter' ? 'x.com/username' : `${platform.key}.com/username`}`}
                      value={value}
                      onChange={(e) => handleLinkChange(platform.key, e.target.value)}
                      className="flex-1"
                    />
                    {hasValue && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="flex-shrink-0"
                        onClick={() => window.open(formatUrl(value), '_blank')}
                      >
                        <Plus className="h-4 w-4 rotate-45" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="pt-4 border-t">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default SocialLinksPage;

