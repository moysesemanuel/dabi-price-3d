import type { Metadata } from "next";
import { SegmentLandingPage } from "@/components/public/segment-landing-page";
import { ConfectioneryLandingCalculator } from "@/components/public/confectionery-landing-calculator";
import { segmentLandings } from "@/lib/public/segment-landings";

const config = segmentLandings.confeitaria;

export const metadata: Metadata = {
  title: config.metadataTitle,
  description: config.metadataDescription,
};

export default function ConfectioneryLandingPage() {
  return (
    <SegmentLandingPage config={config}>
      <ConfectioneryLandingCalculator />
    </SegmentLandingPage>
  );
}
