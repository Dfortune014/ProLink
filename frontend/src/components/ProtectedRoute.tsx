import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading } = useAuth();

  console.log("ProtectedRoute: Rendering, isAuthenticated:", isAuthenticated, "isLoading:", isLoading);
  console.log("ProtectedRoute: Current path:", window.location.pathname);

  if (isLoading) {
    console.log("ProtectedRoute: Still loading, showing loading screen");
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log("ProtectedRoute: Not authenticated, redirecting to /auth");
    console.log("ProtectedRoute: Checking localStorage for tokens...");
    const accessToken = localStorage.getItem("cognito_access_token");
    const idToken = localStorage.getItem("cognito_id_token");
    console.log("ProtectedRoute: Access token exists:", !!accessToken);
    console.log("ProtectedRoute: ID token exists:", !!idToken);
    return <Navigate to="/auth" replace />;
  }

  console.log("ProtectedRoute: Authenticated, rendering children");
  return <>{children}</>;
};

