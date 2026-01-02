import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import HeroCarousel from "./HeroCarousel";
import { Link } from "react-router-dom";

const HeroSection = () => {
  const [linkName, setLinkName] = useState("");

  const handleGetStarted = () => {
    if (linkName.trim()) {
      // Navigate to sign up with the link name
      window.location.href = `/auth?link=${encodeURIComponent(linkName.trim())}`;
    } else {
      window.location.href = "/auth";
    }
  };

  return (
    <section className="relative min-h-screen bg-background">
      <div className="container mx-auto px-6 py-16 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Text Content */}
          <div className="space-y-8 lg:space-y-10">
            {/* Headline */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-tight tracking-tight">
              Showcase your work to the world
            </h1>
            
            {/* Supporting Paragraph */}
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl">
              A simple, beautiful way for professionals to share their skills, projects, and professional identity — all in one personalized link.
            </p>

            {/* Input Field and CTA */}
            <div className="space-y-4 pt-4">
              <div className="flex flex-col sm:flex-row gap-3 max-w-lg">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="yourname"
                    value={linkName}
                    onChange={(e) => setLinkName(e.target.value)}
                    className="h-12 text-base"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleGetStarted();
                      }
                    }}
                  />
                  <p className="text-sm text-muted-foreground mt-2 ml-1">
                    prolink.com/{linkName || "yourname"}
                  </p>
                </div>
                <Button 
                  size="lg" 
                  className="h-12 px-8 text-base font-medium"
                  onClick={handleGetStarted}
                >
                  Get started for free
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column - Carousel (Desktop) / Below (Mobile) */}
          <div className="lg:order-last order-first">
            <div className="relative">
              <HeroCarousel />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
