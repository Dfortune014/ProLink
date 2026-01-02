import { useEffect, useRef } from "react";
import student1 from "@/assets/student-1.jpg";
import student2 from "@/assets/student-2.jpg";
import student3 from "@/assets/student-3.jpg";
import student4 from "@/assets/student-4.jpg";

const students = [
  { name: "Andrea Adams", role: "Fine Artist", image: student1, flag: "🇺🇸" },
  { name: "Sunjay Singh", role: "Creative Director", image: student2, flag: "🇨🇦" },
  { name: "Oliver Wilson", role: "Interior Design Director @ gensler", image: student3, flag: "🇬🇧" },
  { name: "Sophia Lee", role: "Junior designer @ Microsoft", image: student4, flag: "🇦🇺" },
];

const HeroCarousel = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    let animationId: number;
    let position = 0;
    const speed = 0.8; // pixels per frame
    const gap = 24; // gap between items in pixels
    const itemWidth = 320; // width of each card (w-80 = 320px)
    const totalWidth = (itemWidth + gap) * students.length;

    const animate = () => {
      position -= speed;
      
      // Reset position when we've scrolled one full set (seamless loop)
      if (Math.abs(position) >= totalWidth) {
        position = 0;
      }
      
      container.style.transform = `translateX(${position}px)`;
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  return (
    <div className="overflow-hidden w-full">
      <div 
        ref={containerRef}
        className="flex gap-6 will-change-transform"
        style={{ width: 'fit-content' }}
      >
        {/* Render items twice for seamless loop */}
        {[...students, ...students].map((student, idx) => (
          <div
            key={idx}
            className="flex-shrink-0 w-80"
          >
            <div className="relative rounded-2xl overflow-hidden border border-border/50 shadow-lg bg-card">
              <div className="aspect-[3/4] relative">
                <img
                  src={student.image}
                  alt={student.name}
                  className="w-full h-full object-cover"
                />
                {/* Name and Job Title Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-4">
                  <p className="text-white font-bold text-base mb-1">{student.name}</p>
                  <p className="text-white/90 font-medium text-sm">{student.role}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HeroCarousel;
