import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authService } from "@/services/auth";
import { profilesApi } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        setIsProcessing(true);
        setError(null);

        // Extract code and error from URL query params
        const code = searchParams.get("code");
        const errorParam = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        // Handle OAuth errors
        if (errorParam) {
          const errorMessage = errorDescription 
            ? decodeURIComponent(errorDescription) 
            : "Authentication failed. Please try again.";
          setError(errorMessage);
          setIsProcessing(false);
          return;
        }

        // Check if authorization code is present
        if (!code) {
          setError("No authorization code received. Please try logging in again.");
          setIsProcessing(false);
          return;
        }

        // Exchange authorization code for tokens
        let idToken: string;
        try {
          const result = await authService.handleOAuthCallback(code);
          idToken = result.idToken;
        } catch (tokenError: unknown) {
          console.error("AuthCallback: Token exchange failed:", tokenError);
          throw tokenError;
        }

        // Refresh auth context to update isAuthenticated state
        await refreshAuth();
        
        // Small delay to allow React state to update
        await new Promise(resolve => setTimeout(resolve, 200));

        // Small delay to ensure post-confirmation Lambda completes
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Check if profile is complete by querying the users table (source of truth)
        // This is more reliable than checking Cognito attributes
        try {
          const userProfile = await profilesApi.getCurrentUser();
          
          if (userProfile.profile_complete && userProfile.username) {
            setIsProcessing(false);
            // Use window.location.href to force full page reload so ProtectedRoute sees updated auth state
            window.location.href = "/dashboard";
            return;
          }
          
          setIsProcessing(false);
          navigate("/auth/complete-profile", { replace: true });
          return;
        } catch (checkError: unknown) {
          // If user doesn't exist in users table (404), redirect to complete profile
          if (checkError.response?.status === 404) {
            setIsProcessing(false);
            navigate("/auth/complete-profile", { replace: true });
            return;
          }
          
          // For other errors (e.g., 401), try to decode ID token as fallback
          try {
            // Decode ID token to get user attributes as fallback
            const payload = JSON.parse(atob(idToken.split(".")[1]));
            const username = payload['custom:username'];
            const dateOfBirth = payload['custom:date_of_birth'];
            
            // If missing attributes, redirect to complete profile
            if (!username || !dateOfBirth) {
              setIsProcessing(false);
              navigate("/auth/complete-profile", { replace: true });
              return;
            }
            
            // Profile appears complete from ID token
            setIsProcessing(false);
            // Use window.location.href to force full page reload so ProtectedRoute sees updated auth state
            window.location.href = "/dashboard";
            return;
          } catch (tokenError) {
            console.error("AuthCallback: Failed to decode ID token:", tokenError);
            // If we can't check, assume incomplete and redirect to complete profile
            setIsProcessing(false);
            navigate("/auth/complete-profile", { replace: true });
            return;
          }
        }
      } catch (err: unknown) {
        console.error("OAuth callback error:", err);
        console.error("OAuth callback error details:", {
          name: err?.name,
          message: err?.message,
          stack: err?.stack,
          response: err?.response,
          status: err?.status,
          statusText: err?.statusText,
        });
        
        let errorMessage = "Failed to complete authentication. Please try again.";
        
        if (err instanceof Error) {
          errorMessage = err.message;
          
          // Provide more user-friendly error messages
          if (err.message.includes("redirect_uri_mismatch")) {
            errorMessage = "Redirect URI mismatch. Please check your Cognito configuration.";
          } else if (err.message.includes("invalid_grant") || err.message.includes("invalid_code")) {
            errorMessage = "Invalid authorization code. The code may have expired. Please try logging in again.";
          } else if (err.message.includes("Missing OAuth configuration")) {
            errorMessage = "OAuth configuration is missing. Please check your environment variables.";
          } else if (err.message.includes("CORS") || err.message.includes("NetworkError")) {
            errorMessage = "Network error. Please check your connection and try again.";
          }
        }
        
        setError(errorMessage);
        setIsProcessing(false);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  const handleRetry = () => {
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-background flex items-center justify-center p-6">
      {/* Animated Purple Gradient Glows */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/20 blur-[150px] rounded-full animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary/15 blur-[120px] rounded-full animate-pulse delay-1000" />

      <div className="relative z-10 w-full max-w-md">
        <Card className="bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl p-8 md:p-10">
          {isProcessing ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Completing sign in...</h2>
              <p className="text-muted-foreground">
                Please wait while we complete your authentication.
              </p>
            </div>
          ) : error ? (
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <AlertCircle className="w-12 h-12 text-destructive" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-foreground">Authentication Failed</h2>
                <p className="text-muted-foreground">{error}</p>
              </div>
              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleRetry}
                  className="w-full"
                >
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/auth")}
                  className="w-full"
                >
                  Back to Sign In
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Success!</h2>
              <p className="text-muted-foreground">
                Redirecting you now...
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AuthCallback;

