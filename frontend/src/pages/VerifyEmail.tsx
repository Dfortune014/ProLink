import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authService } from "@/services/auth";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import logo from "@/assets/prolynk.png";

const VerifyEmail = () => {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isResent, setIsResent] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [fromSignIn, setFromSignIn] = useState(false);

  useEffect(() => {
    // Get email from URL params or localStorage
    const emailParam = searchParams.get("email");
    const storedEmail = localStorage.getItem("cognito_user_email");
    setEmail(emailParam || storedEmail || "");
    
    // Check if user was redirected from sign-in
    const fromParam = searchParams.get("from");
    setFromSignIn(fromParam === "signin");
  }, [searchParams]);

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError(null);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    // Handle paste
    if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      navigator.clipboard.readText().then((text) => {
        const digits = text.replace(/\D/g, "").slice(0, 6);
        if (digits.length === 6) {
          const newCode = digits.split("");
          setCode(newCode);
          inputRefs.current[5]?.focus();
        }
      });
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError("Email is required");
      return;
    }

    const verificationCode = code.join("");
    if (verificationCode.length !== 6) {
      setError("Please enter the complete 6-digit code");
      return;
    }

    setIsVerifying(true);
    try {
      await authService.confirmSignUp(email, verificationCode);
      // Success - redirect to sign in
      navigate("/auth?verified=true");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Verification failed. Please check your code and try again."
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError("Email is required");
      return;
    }

    setIsResending(true);
    setIsResent(false);
    setError(null);
    try {
      await authService.resendVerificationCode(email);
      setIsResent(true);
      // Clear the code inputs
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to resend code. Please try again."
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-background flex items-center justify-center p-6">
      {/* Animated Purple Gradient Glows */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/20 blur-[150px] rounded-full animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary/15 blur-[120px] rounded-full animate-pulse delay-1000" />

      <div className="relative z-10 w-full max-w-md">
        <Card className="bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl p-8 md:p-10">
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

          {/* Back to Sign In */}
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </Link>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Verify your email
            </h1>
            {fromSignIn ? (
              <p className="text-muted-foreground mb-2">
                Please verify your email address to sign in. We've sent a 6-digit verification code to
              </p>
            ) : (
              <p className="text-muted-foreground mb-2">
                We've sent a 6-digit verification code to
              </p>
            )}
            {email && (
              <p className="text-foreground font-medium mt-1">{email}</p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 rounded-[14px] bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Success Message for Resend */}
          {isResent && (
            <div className="mb-6 p-3 rounded-[14px] bg-success/10 border border-success/20 text-success text-sm">
              Verification code resent! Please check your email.
            </div>
          )}

          {/* Verification Code Input */}
          <form onSubmit={handleVerify} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Enter verification code
              </label>
              <div className="flex gap-3 justify-center">
                {code.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-semibold rounded-[14px] bg-muted/30 border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all duration-300"
                    required
                  />
                ))}
              </div>
            </div>

            {/* Verify Button */}
            <Button
              type="submit"
              disabled={isVerifying || code.join("").length !== 6}
              className="w-full h-12 rounded-[14px] text-base font-medium bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify email"
              )}
            </Button>
          </form>

          {/* Resend Code */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Didn't receive the code?
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={handleResend}
              disabled={isResending || !email}
              className="w-full h-12 rounded-[14px] text-base font-medium border-border/50 hover:bg-muted/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Resend code"
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default VerifyEmail;

