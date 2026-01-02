import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authService } from "@/services/auth";
import { useAuth } from "@/hooks/useAuth";
import { authApi } from "@/services/api";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import logo from "@/assets/prolynk.png";

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullname, setFullname] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "unavailable" | "invalid">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check if user just verified their email
  useEffect(() => {
    if (searchParams.get("verified") === "true") {
      setSuccessMessage("Email verified successfully! You can now sign in.");
      // Clear the verified param from URL
      navigate("/auth", { replace: true });
    }
  }, [searchParams, navigate]);

  // Username availability check with debounce
  useEffect(() => {
    if (!isSignUp || !username.trim()) {
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
  }, [username, isSignUp]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isSignUp) {
      // Validate sign-up form
      if (!email || !password || !fullname || !username || !month || !day || !year) {
        setError("All fields are required");
        return;
      }

      if (password.length < 8) {
        setError("Password must be at least 8 characters");
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
        await signUp(email, password, fullname, dateOfBirth, username);
        // Store email for verification page
        localStorage.setItem("cognito_user_email", email);
        // Redirect to verification page
        navigate(`/auth/verify?email=${encodeURIComponent(email)}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sign up failed. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Sign in
      if (!email || !password) {
        setError("Email and password are required");
        return;
      }

      setIsSubmitting(true);
      setError(null); // Clear any previous errors
      try {
        await signIn(email, password);
        navigate("/dashboard", { replace: true });
      } catch (err) {
        console.error("Sign in error:", err);
        // Check if user is not verified
        const errorMessage = err instanceof Error ? err.message : String(err);
        const errorCode = (err && typeof err === 'object' && 'code' in err) ? String(err.code) : "";
        
        // Cognito returns "UserNotConfirmedException" or similar messages for unverified users
        if (
          errorCode === "UserNotConfirmedException" ||
          errorMessage.toLowerCase().includes("not confirmed") ||
          errorMessage.toLowerCase().includes("user is not confirmed") ||
          errorMessage.toLowerCase().includes("email not verified")
        ) {
          // Store email for verification page
          localStorage.setItem("cognito_user_email", email);
          // Redirect to verification page with from=signin parameter
          navigate(`/auth/verify?email=${encodeURIComponent(email)}&from=signin`);
          return;
        }
        
        setError(errorMessage || "Sign in failed. Please check your credentials.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-background flex items-center justify-center p-6">
      {/* Animated Purple Gradient Glows */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/20 blur-[150px] rounded-full animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary/15 blur-[120px] rounded-full animate-pulse delay-1000" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 blur-[100px] rounded-full animate-pulse delay-500" />

      {/* Floating Orbs Animation */}
      <div className="absolute top-20 left-20 w-32 h-32 bg-primary/30 rounded-full blur-3xl animate-bounce delay-300" style={{ animationDuration: '6s' }} />
      <div className="absolute bottom-32 right-32 w-40 h-40 bg-primary/25 rounded-full blur-3xl animate-bounce delay-700" style={{ animationDuration: '8s' }} />

      <div className="relative z-10 w-full max-w-md">
        <Card className="bg-white backdrop-blur-xl border-border/50 shadow-2xl p-8 md:p-10">
          {/* Logo */}
          <div className="text-left mb-8">
            <Link to="/" className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity duration-300">
              <img 
                src={logo} 
                alt="ProLynk" 
                className="h-10 w-auto"
              />
            </Link>
          </div>

          {/* Title Section */}
          {!isSignUp && (
            <div className="text-left mb-8 space-y-2">
              <p className="text-sm md:text-base text-muted-foreground">
                Sign in to continue to your account
              </p>
            </div>
          )}

          {/* Social Login Buttons - Icons Only */}
          <div className="flex gap-4 justify-center mb-6">
            <Button 
              variant="outline" 
              size="icon"
              className="w-12 h-12 bg-card hover:bg-muted/50 border-border/50 transition-all duration-300 hover:scale-110 hover:border-primary/50" 
              type="button"
              onClick={() => {
                try {
                  const redirectUrl = authService.getOAuthRedirectUrl("Google");
                  window.location.href = redirectUrl;
                } catch (error) {
                  console.error("Failed to redirect to Google OAuth:", error);
                  alert("Failed to initiate Google login. Please check your configuration.");
                }
              }}
              title="Sign in with Google"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            </Button>

            <Button 
              variant="outline" 
              size="icon"
              className="w-12 h-12 bg-card hover:bg-muted/50 border-border/50 transition-all duration-300 hover:scale-110 hover:border-primary/50" 
              type="button"
              onClick={() => {
                try {
                  const redirectUrl = authService.getOAuthRedirectUrl("LinkedIn");
                  window.location.href = redirectUrl;
                } catch (error) {
                  console.error("Failed to redirect to LinkedIn OAuth:", error);
                  alert("Failed to initiate LinkedIn login. Please check your configuration.");
                }
              }}
              title="Sign in with LinkedIn"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </Button>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/50"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-card text-muted-foreground">or continue with email</span>
            </div>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-3 bg-success/10 border border-success/20 rounded-[14px] text-sm text-success animate-fade-in">
              {successMessage}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-[14px] text-sm text-destructive animate-fade-in">
              {error}
            </div>
          )}

          {/* Email/Password Form with Animation */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2 animate-fade-in">
              <Input
                id="email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-[14px] bg-muted/30 border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all duration-300"
                required
              />
            </div>

            {isSignUp && (
              <>
                <div className="space-y-2 animate-fade-in delay-100">
                  <Input
                    id="fullname"
                    type="text"
                    placeholder="Full Name"
                    value={fullname}
                    onChange={(e) => setFullname(e.target.value)}
                    className="h-12 rounded-[14px] bg-muted/30 border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all duration-300"
                    required
                  />
                </div>

                <div className="space-y-2 animate-fade-in delay-150">
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

                <div className="space-y-2 animate-fade-in delay-200">
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
              </>
            )}

            <div className="space-y-2 animate-fade-in delay-300">
              <Input
                id="password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-[14px] bg-muted/30 border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all duration-300"
                required
                minLength={8}
              />
            </div>

            {!isSignUp && (
              <div className="flex items-center justify-end animate-fade-in delay-400">
                <button
                  type="button"
                  className="text-sm text-primary hover:text-primary/80 hover:underline transition-colors duration-300"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <Button 
              type="submit" 
              disabled={isSubmitting || (isSignUp && usernameStatus === "unavailable")}
              className="w-full h-12 rounded-[14px] text-base font-medium bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isSignUp ? "Creating account..." : "Signing in..."}
                </>
              ) : (
                isSignUp ? "Create account" : "Sign in"
              )}
            </Button>
          </form>

          {/* Toggle Sign In/Sign Up */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {isSignUp ? "Already have an account? " : "Don't have an account? "}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                  setUsernameStatus("idle");
                  // Clear form fields when switching
                  if (!isSignUp) {
                    setFullname("");
                    setMonth("");
                    setDay("");
                    setYear("");
                    setUsername("");
                  }
                }}
                className="text-primary hover:text-primary/80 font-medium hover:underline transition-all duration-300"
              >
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </p>
          </div>

          {/* Terms */}
          {isSignUp && (
            <p className="text-xs text-center text-muted-foreground mt-4 animate-fade-in">
              By signing up, you agree to our{" "}
              <a href="#" className="text-primary hover:text-primary/80 hover:underline transition-colors duration-300">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="text-primary hover:text-primary/80 hover:underline transition-colors duration-300">
                Privacy Policy
              </a>
            </p>
          )}
        </Card>
      </div>

      <style>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-slide-up {
          animation: slide-up 0.5s ease-out;
        }

        .animate-slide-down {
          animation: slide-down 0.5s ease-out;
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }

        .delay-100 {
          animation-delay: 0.1s;
        }

        .delay-100 {
          animation-delay: 0.1s;
        }

        .delay-150 {
          animation-delay: 0.15s;
        }

        .delay-200 {
          animation-delay: 0.2s;
        }

        .delay-300 {
          animation-delay: 0.3s;
        }

        .delay-400 {
          animation-delay: 0.4s;
        }

        .delay-500 {
          animation-delay: 0.5s;
        }

        .delay-700 {
          animation-delay: 0.7s;
        }

        .delay-1000 {
          animation-delay: 1s;
        }
      `}</style>
    </div>
  );
};

export default Auth;
