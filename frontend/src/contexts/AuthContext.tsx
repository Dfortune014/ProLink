import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authService } from "@/services/auth";

interface User {
  email: string;
  username: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullname: string, dateOfBirth: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize auth state on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  // Auto-refresh token logic
  useEffect(() => {
    if (!isAuthenticated) return;

    // Check token expiration every minute
    const interval = setInterval(async () => {
      try {
        const token = await authService.getAccessToken();
        if (!token) {
          // Token refresh failed, user needs to re-authenticate
          await handleSignOut();
        }
      } catch (err) {
        console.error("Token refresh check failed:", err);
        await handleSignOut();
      }
    }, 60 * 1000); // Check every minute

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const initializeAuth = async () => {
    try {
      console.log("AuthContext: Initializing auth...");
      setIsLoading(true);
      setError(null);

      const currentUser = await authService.getCurrentUser();
      console.log("AuthContext: getCurrentUser result:", currentUser ? "User found" : "No user");
      if (currentUser) {
        console.log("AuthContext: Setting user and isAuthenticated to true");
        setUser(currentUser);
        setIsAuthenticated(true);
      } else {
        console.log("AuthContext: No user found, setting isAuthenticated to false");
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error("AuthContext: Failed to initialize auth:", err);
      setUser(null);
      setIsAuthenticated(false);
      setError(err instanceof Error ? err : new Error("Failed to initialize authentication"));
    } finally {
      console.log("AuthContext: Auth initialization complete, setting isLoading to false");
      setIsLoading(false);
    }
  };

  const handleSignIn = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);

      await authService.signIn(email, password);
      const currentUser = await authService.getCurrentUser();

      if (currentUser) {
        setUser(currentUser);
        setIsAuthenticated(true);
      } else {
        throw new Error("Failed to get user after sign in");
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Sign in failed");
      setError(error);
      setUser(null);
      setIsAuthenticated(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSignUp = useCallback(async (
    email: string, 
    password: string, 
    fullname: string, 
    dateOfBirth: string, 
    username: string
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      await authService.signUp(email, password, fullname, dateOfBirth, username);
      
      // Note: After sign up, user needs to confirm email before signing in
      // Don't auto-sign in - user will need to confirm email first
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Sign up failed");
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      await authService.signOut();
      setUser(null);
      setIsAuthenticated(false);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Sign out failed");
      setError(error);
      console.error("Sign out error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRefreshAuth = useCallback(async () => {
    try {
      console.log("AuthContext: Refreshing auth...");
      setError(null);
      const currentUser = await authService.getCurrentUser();
      console.log("AuthContext: getCurrentUser result:", currentUser ? "User found" : "No user");
      
      if (currentUser) {
        console.log("AuthContext: Setting user and isAuthenticated to true");
        setUser(currentUser);
        setIsAuthenticated(true);
      } else {
        console.log("AuthContext: No user found, setting isAuthenticated to false");
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error("AuthContext: Failed to refresh auth:", err);
      const error = err instanceof Error ? err : new Error("Failed to refresh auth");
      setError(error);
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    error,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
    refreshAuth: handleRefreshAuth,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;