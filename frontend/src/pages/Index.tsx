import Navigation from "@/components/Navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { 
  ArrowRight, 
  Check, 
  Link2, 
  Brain, 
  FileText, 
  BarChart3, 
  Mail, 
  Sparkles,
  Users,
  Briefcase,
  Target,
  Zap,
  Shield,
  TrendingUp,
  Download,
  Eye,
  MessageSquare,
  Code,
  Palette,
  Heart,
  GraduationCap,
  Building2,
  Stethoscope,
  ChevronRight,
  Star,
  Quote
} from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import heroImage from "@/assets/hero2.png";
import painPointGif from "@/assets/herogif.gif";
import resumes from "@/assets/resumes.jpg";
import burnout from "@/assets/burnout.jpg";
import second from "@/assets/2.jpg";
import phone from "@/assets/phone.png";

const Index = () => {
  const [email, setEmail] = useState("");

  const handleGetStarted = () => {
    if (email.trim()) {
      window.location.href = `/auth?email=${encodeURIComponent(email.trim())}`;
    } else {
      window.location.href = "/auth";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Theme Toggle - Fixed position */}
      <div className="fixed bottom-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* 🌟 HERO SECTION */}
      <section className="relative bg-white overflow-hidden">
        <div className="relative min-h-[400px] lg:min-h-[720px]">
          
          {/* Constrained content */}
          <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 py-12 lg:py-32">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              
              {/* Left Column */}
              <div className="text-center lg:text-left lg:-ml-32 flex flex-col justify-center h-full lg:pt-24">
                <h1 className="text-[32px] md:text-[40px] lg:text-[48px] font-semibold text-[#0F172A] leading-[1.1] tracking-[-0.02em] max-w-[560px] mx-auto lg:mx-0">
                  Your professional identity. One link.
                </h1>

                <p className="text-base md:text-[17px] lg:text-[18px] text-[#475569] leading-[1.6] max-w-[520px] mt-5 mx-auto lg:mx-0">
                  prolynk.me lets job seekers share their resume, projects, skills, and links in one clean, recruiter-ready profile.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mt-7">
                  <Button 
                    asChild
                    className="h-12 px-5 rounded-lg font-medium text-[15px] bg-[#2563EB] text-white hover:bg-[#1F4FD8] active:bg-[#1E40AF] active:translate-y-0.5 transition-all duration-200 shadow-none"
                  >
                    <Link to="/auth">Get Started</Link>
                  </Button>
                  <Link 
                    to="/auth" 
                    className="h-12 flex items-center font-medium text-[15px] text-[#334155] hover:text-[#1E293B] hover:underline transition-colors duration-200"
                  >
                    Sign In
                  </Link>
                </div>
              </div>

              {/* Mobile Image - Shows below text on mobile, hidden on desktop */}
              <div className="lg:hidden order-last mt-8">
                <div className="w-full h-[300px] sm:h-[400px] rounded-2xl overflow-hidden">
                  <img
                    src={heroImage}
                    alt="Professional Profile Example - ProLynk"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Spacer column so grid stays balanced on desktop */}
              <div className="hidden lg:block" />

            </div>
          </div>

          {/* FULL-BLEED RIGHT IMAGE - Desktop only */}
          <div className="hidden lg:block absolute top-0 right-0 h-full w-[55vw] min-w-[600px] bg-white">
            <div className="h-full rounded-tl-[24px] rounded-bl-[24px] overflow-hidden">
              <img
                src={heroImage}
                alt="Professional Profile Example - ProLynk"
                className="w-full h-full object-cover object-right"
              />
            </div>
          </div>

        </div>
      </section>




      {/* 🔥 PAIN POINTS SECTION */}
      <section className="relative bg-white py-20 lg:py-32">
        <div className="max-w-[1200px] mx-auto px-6">
          
          {/* Optional Top Row - Muted Text */}
          <div className="text-center mb-12">
            <p className="text-sm text-[#94A3B8] font-medium">
              Used by students, graduates, and early-career professionals
            </p>
          </div>

          {/* Main Headline */}
          <div className="text-center mb-6">
            <h2 className="text-4xl md:text-5xl lg:text-5xl font-semibold text-[#0F172A] leading-[1.2] tracking-[-0.02em]">
              One profile, <span className="text-[#2563EB]">your entire professional story</span>
            </h2>
          </div>

          {/* Supporting Subheadline */}
          <div className="text-center mb-16">
            <p className="text-lg md:text-xl text-[#475569] leading-[1.6] max-w-[700px] mx-auto">
              ProLynk replaces scattered resumes, portfolios, and links with one clean, recruiter-ready profile built for job seekers.
            </p>
          </div>

          {/* Three-Column Content Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">
            
            {/* Column 1: Scattered professional information */}
            <div className="text-center md:text-left">
              <div className="mb-6 rounded-[18px] bg-[#F8FAFC] p-6 aspect-video flex items-center justify-center overflow-hidden">
                <img
                  src={resumes}
                  alt="Scattered professional information"
                  className="w-full h-full object-contain"
                />
              </div>
              <h3 className="text-xl font-semibold text-[#0F172A] mb-3">
                Scattered professional information
              </h3>
              <p className="text-base text-[#475569] leading-[1.6]">
                Resumes, LinkedIn profiles, GitHub, portfolios, and certifications live in separate places — making it hard for recruiters to see the full picture.
              </p>
            </div>

            {/* Column 2: Important work gets overlooked */}
            <div className="text-center md:text-left">
              <div className="mb-6 rounded-[18px] bg-[#F8FAFC] p-6 aspect-video flex items-center justify-center overflow-hidden">
                <img
                  src={second}
                  alt="Important work gets overlooked"
                  className="w-full h-full object-contain rounded-lg"
                />
              </div>
              <h3 className="text-xl font-semibold text-[#0F172A] mb-3">
                Important work gets overlooked
              </h3>
              <p className="text-base text-[#475569] leading-[1.6]">
                Strong projects and real skills are often buried under feeds, links, and outdated formats that don't highlight what matters most.
              </p>
            </div>

            {/* Column 3: Too much effort to look professional */}
            <div className="text-center md:text-left md:col-span-2 lg:col-span-1">
              <div className="mb-6 rounded-[18px] bg-[#F8FAFC] p-6 aspect-video flex items-center justify-center overflow-hidden">
                <img
                  src={burnout}
                  alt="Too much effort to look professional"
                  className="w-full h-full object-contain"
                />
              </div>
              <h3 className="text-xl font-semibold text-[#0F172A] mb-3">
                Too much effort to look professional
              </h3>
              <p className="text-base text-[#475569] leading-[1.6]">
                Presenting yourself clearly shouldn't require website builders, design tools, or hours of setup — especially when you're actively job searching.
              </p>
            </div>

          </div>

        </div>
      </section>

      

      {/* Footer */}
      <footer className="py-12 border-t border-border/50 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link to="/" className="flex items-center gap-2">
                <span className="text-lg font-bold">ProLynk</span>
              </Link>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/auth" className="hover:text-foreground transition-colors">
                Log in
              </Link>
              <Link to="/auth" className="hover:text-foreground transition-colors">
                Sign up
              </Link>
            </div>
          </div>
          <div className="mt-8 text-center text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} ProLynk. Your Professional Identity, Simplified.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
