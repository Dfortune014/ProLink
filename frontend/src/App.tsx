import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import VerifyEmail from "./pages/VerifyEmail";
import CompleteProfile from "./pages/CompleteProfile";
import PublicProfile from "./pages/PublicProfile";
import Dashboard from "./pages/Dashboard";
import ProfilePage from "./pages/dashboard/ProfilePage";
import SocialLinksPage from "./pages/dashboard/SocialLinksPage";
import ContactPage from "./pages/dashboard/ContactPage";
import ProjectsPage from "./pages/dashboard/ProjectsPage";
import ResumePage from "./pages/dashboard/ResumePage";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/auth/verify" element={<VerifyEmail />} />
              <Route
                path="/auth/complete-profile"
                element={<CompleteProfile />}
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              >
                <Route index element={<ProfilePage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="social-links" element={<SocialLinksPage />} />
                <Route path="resume" element={<ResumePage />} />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="contact" element={<ContactPage />} />
                <Route path="analytics" element={<div className="p-6"><h2 className="text-2xl font-bold">Analytics</h2><p className="text-muted-foreground">Coming soon...</p></div>} />
                <Route path="settings" element={<div className="p-6"><h2 className="text-2xl font-bold">Settings</h2><p className="text-muted-foreground">Coming soon...</p></div>} />
                <Route path="help" element={<div className="p-6"><h2 className="text-2xl font-bold">Help</h2><p className="text-muted-foreground">Coming soon...</p></div>} />
              </Route>
              {/* Public Profile Route - Must be after all specific routes but before catch-all */}
              <Route path="/:username" element={<PublicProfile />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
