import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { authApi, profilesApi } from "@/services/api";
import { authService } from "@/services/auth";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import logo from "@/assets/prolynk.png";

const CompleteProfile = () => {
  const [username, setUsername] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "unavailable" | "invalid">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const navigate = useNavigate();

  // Check if user is authenticated and if profile is already complete
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await authService.getAccessToken();
        if (!token) {
          // No token, redirect to auth
          navigate("/auth", { replace: true });
          return;
        }
        
        // Check if profile is already complete by checking profile_complete in users table
        try {
          const userProfile = await profilesApi.getCurrentUser();
          
          if (userProfile.profile_complete && userProfile.username) {
            // Redirect immediately and return - don't set isCheckingAuth to false
            navigate("/dashboard", { replace: true });
            return; // Exit early, don't continue
          }
          // Profile not complete, show form
          setIsCheckingAuth(false);
        } catch (checkError: unknown) {
          // If user doesn't exist in users table (404) or other error, show form
          if (checkError.response?.status === 404) {
            // User doesn't exist, show form - this is expected
          } else {
            console.warn("CompleteProfile: Error checking profile completion:", checkError);
            // Continue to show form if check fails
          }
          setIsCheckingAuth(false);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        navigate("/auth", { replace: true });
      }
    };
    checkAuth();
  }, [navigate]);

  // Username availability check with debounce
  useEffect(() => {
    if (!username.trim()) {
      setUsernameStatus("idle");
      return;
    }

    // Validate username format first
    const usernameRegex = /^[a-z0-9_-]{3,20}$/i;
    if (!usernameRegex.test(username)) {
      setUsernameStatus("invalid");
      return;
    }

    // Debounce API call
    const timeoutId = setTimeout(async () => {
      setUsernameStatus("checking");
      try {
        const result = await authApi.checkUsernameAvailability(username.toLowerCase());
        setUsernameStatus(result.available ? "available" : "unavailable");
      } catch (err) {
        setUsernameStatus("idle");
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate form
    if (!username || !month || !day || !year) {
      setError("All fields are required");
      return;
    }

    if (usernameStatus !== "available") {
      setError("Please choose an available username");
      return;
    }

    // Format date as YYYY-MM-DD
    const dateOfBirth = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

    setIsSubmitting(true);
    try {
      // Debug: Check if tokens exist
      const idToken = authService.getIdToken();
      const accessToken = await authService.getAccessToken();
      
      if (!accessToken) {
        throw new Error("No access token found. Please sign in again.");
      }

      // Decode ID token to get email and fullname
      let idTokenPayload;
      try {
        idTokenPayload = JSON.parse(atob(idToken.split(".")[1]));
        
        // Check if token is expired
        if (idTokenPayload['exp'] && idTokenPayload['exp'] * 1000 < Date.now()) {
          throw new Error("Token has expired. Please sign in again.");
        }
      } catch (err) {
        console.error("Failed to decode ID token:", err);
        throw new Error("Invalid authentication token. Please sign in again.");
      }
      
      const email = idTokenPayload['email'] || idTokenPayload['cognito:username'] || '';
      const fullname = idTokenPayload['name'] || idTokenPayload['custom:fullname'] || '';

      // Use the profilesApi which uses axios instance with automatic Authorization header
      // The axios interceptor will add "Bearer <accessToken>" automatically
      await profilesApi.createOrUpdate({
        username: username.toLowerCase(),
        date_of_birth: dateOfBirth,
        email: email,
        full_name: fullname,
      });

      // Redirect to dashboard
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-white flex items-center justify-center p-6">
      {/* Animated Gradient Glows */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/20 blur-[150px] rounded-full animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary/15 blur-[120px] rounded-full animate-pulse delay-1000" />

      <div className="relative z-10 w-full max-w-md">
        <Card className="bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl p-8 md:p-10">
          {/* Logo */}
          <div className="text-left mb-8">
            <div className="inline-flex items-center gap-1">
              <img 
                src={logo} 
                alt="ProLynk" 
                className="h-10 w-auto"
              />
              
            </div>
          </div>

          {/* Title */}
          <div className="text-left mb-8 space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Complete Your Profile</h1>
            <p className="text-muted-foreground text-sm md:text-base">
              Just a few more details to get started
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-[14px] text-sm text-destructive animate-fade-in">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div className="space-y-2">
              <div className="relative">
                <Input
                  id="username"
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => {
                    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
                    setUsername(value);
                  }}
                  className="h-12 rounded-[14px] bg-muted/30 border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all duration-300 pr-10"
                  required
                  minLength={3}
                  maxLength={20}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameStatus === "checking" && (
                    <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                  )}
                  {usernameStatus === "available" && (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  )}
                  {usernameStatus === "unavailable" && (
                    <XCircle className="w-4 h-4 text-destructive" />
                  )}
                  {usernameStatus === "invalid" && username.length > 0 && (
                    <XCircle className="w-4 h-4 text-destructive" />
                  )}
                </div>
              </div>
              {usernameStatus === "available" && (
                <p className="text-xs text-green-500">Username is available</p>
              )}
              {usernameStatus === "unavailable" && (
                <p className="text-xs text-destructive">Username is already taken</p>
              )}
              {usernameStatus === "invalid" && username.length > 0 && (
                <p className="text-xs text-destructive">3-20 characters, letters, numbers, _, - only</p>
              )}
            </div>

            {/* Date of Birth */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <Select value={month} onValueChange={setMonth} required>
                  <SelectTrigger 
                    className={`h-12 rounded-[14px] bg-muted/30 border transition-all duration-300 ${
                      !month ? 'border-destructive/50' : 'border-border/50 focus:border-primary/50'
                    }`}
                  >
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={m.toString()}>
                        {new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={day} onValueChange={setDay} required>
                  <SelectTrigger 
                    className={`h-12 rounded-[14px] bg-muted/30 border transition-all duration-300 ${
                      !day ? 'border-destructive/50' : 'border-border/50 focus:border-primary/50'
                    }`}
                  >
                    <SelectValue placeholder="Day" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <SelectItem key={d} value={d.toString()}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={year} onValueChange={setYear} required>
                  <SelectTrigger 
                    className={`h-12 rounded-[14px] bg-muted/30 border transition-all duration-300 ${
                      !year ? 'border-destructive/50' : 'border-border/50 focus:border-primary/50'
                    }`}
                  >
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - 18 - i).map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={isSubmitting || usernameStatus !== "available"}
              className="w-full h-12 rounded-[14px] text-base font-medium bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Completing profile...
                </>
              ) : (
                "Complete Profile"
              )}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default CompleteProfile;

