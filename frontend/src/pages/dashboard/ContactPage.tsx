import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Mail, Phone } from "lucide-react";
import { profilesApi } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

const ContactPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadContactInfo();
  }, []);

  const loadContactInfo = async () => {
    try {
      setLoading(true);
      const userData = await profilesApi.getCurrentUser();
      
      if (userData.username) {
        try {
          const profile = await profilesApi.getByUsername(userData.username);
          setEmail(profile.email || "");
          setPhone(profile.phone || "");
          setShowEmail(profile.show_email || false);
          setShowPhone(profile.show_phone || false);
        } catch (error) {
          console.error("Failed to load profile:", error);
          // Use email from userData if available
          setEmail(userData.email || "");
        }
      }
    } catch (error) {
      console.error("Failed to load contact info:", error);
      toast({
        title: "Error",
        description: "Failed to load contact information.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: "Validation error",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    // Validate phone format if provided (basic validation)
    if (phone && phone.trim().length > 0 && phone.trim().length < 10) {
      toast({
        title: "Validation error",
        description: "Please enter a valid phone number.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setSaving(true);
      const userData = await profilesApi.getCurrentUser();
      
      await profilesApi.createOrUpdate({
        username: userData.username,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        show_email: showEmail,
        show_phone: showPhone,
      });

      toast({
        title: "Contact information updated",
        description: "Your contact information has been saved successfully.",
      });
      
      // Reload to verify
      await loadContactInfo();
      
      // Notify Dashboard to refresh
      window.dispatchEvent(new CustomEvent('profileUpdated'));
    } catch (error: unknown) {
      console.error("Failed to save contact info:", error);
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to save contact information.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
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
        <h1 className="text-3xl font-bold">Contact Information</h1>
        <p className="text-muted-foreground mt-2">
          Manage your contact information and control what's visible on your public profile.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Contact Details</CardTitle>
            <CardDescription>
              Add your email and phone number. You can control whether they're visible on your public profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email Field */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                <div className="flex-1 space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pl-8">
                <div className="space-y-0.5">
                  <Label htmlFor="show-email" className="text-sm font-normal cursor-pointer">
                    Show email on public profile
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Allow visitors to see your email address
                  </p>
                </div>
                <Switch
                  id="show-email"
                  checked={showEmail}
                  onCheckedChange={setShowEmail}
                  disabled={!email.trim()}
                />
              </div>
            </div>

            {/* Phone Field */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                <div className="flex-1 space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pl-8">
                <div className="space-y-0.5">
                  <Label htmlFor="show-phone" className="text-sm font-normal cursor-pointer">
                    Show phone on public profile
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Allow visitors to see your phone number
                  </p>
                </div>
                <Switch
                  id="show-phone"
                  checked={showPhone}
                  onCheckedChange={setShowPhone}
                  disabled={!phone.trim()}
                />
              </div>
            </div>

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

export default ContactPage;

