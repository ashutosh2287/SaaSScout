import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/landing/Hero";
import { CoreValue } from "@/components/landing/CoreValue";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Philosophy } from "@/components/landing/Philosophy";
import { DashboardPreview } from "@/components/landing/DashboardPreview";
import { FinalCta } from "@/components/landing/FinalCta";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <CoreValue />
        <HowItWorks />
        <Philosophy />
        <DashboardPreview />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}