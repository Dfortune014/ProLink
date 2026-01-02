import { MonitorPlay } from "lucide-react";
import featureImage from "@/assets/feature-live-classes.jpg";

const LiveClassesSection = () => {
  return (
    <section className="py-20">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground leading-tight">
              The only design course you need to be among top
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {" "}
                1% designers
              </span>
            </h2>
          </div>

          <div className="space-y-6">
            <div className="relative rounded-2xl overflow-hidden">
              <img
                src={featureImage}
                alt="Live classes"
                className="w-full h-[400px] object-cover"
              />
            </div>

            <div className="bg-card/50 backdrop-blur-sm border border-border rounded-2xl p-8">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-xl">
                  <MonitorPlay className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">Live classes</h3>
                  <p className="text-muted-foreground">
                    The only design course you need to be among top 1% designers. The only design
                    course you need to be among
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LiveClassesSection;
