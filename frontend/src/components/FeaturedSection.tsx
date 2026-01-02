import { Zap, Palette, TrendingUp, Sparkles, Package, Target } from "lucide-react";

const brands = [
  { name: "Flash", icon: Zap },
  { name: "hues", icon: Palette },
  { name: "Rise", icon: TrendingUp },
  { name: "Sitemark", icon: Sparkles },
  { name: "Product", icon: Package },
  { name: "PinPoint", icon: Target },
];

const FeaturedSection = () => {
  return (
    <section className="py-20 border-t border-border">
      <div className="container mx-auto px-6">
        <p className="text-sm text-muted-foreground mb-8 uppercase tracking-wider">
          FEATURED ON
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 items-center">
          {brands.map((brand) => {
            const Icon = brand.icon;
            return (
              <div
                key={brand.name}
                className="flex items-center gap-2 text-foreground/80 hover:text-foreground transition-colors"
              >
                <Icon className="h-6 w-6" />
                <span className="text-lg font-semibold">{brand.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturedSection;
