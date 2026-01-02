import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import AuthContext from "@/contexts/AuthContext";

/**
 * Hook to access the auth context
 * @throws Error if used outside AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  
  return context;
}

/**
 * Hook that redirects to login if user is not authenticated
 * @param redirectTo - Optional path to redirect to after login (default: "/auth")
 */
export function useRequireAuth(redirectTo: string = "/auth") {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, redirectTo]);

  return { isAuthenticated, isLoading };
}