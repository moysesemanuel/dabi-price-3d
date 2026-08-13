import type { Metadata } from "next";
import { SegmentLandingPage } from "@/components/public/segment-landing-page";
import { segmentLandings } from "@/lib/public/segment-landings";

const config = segmentLandings.revenda;

export const metadata: Metadata = {
  title: config.metadataTitle,
  description: config.metadataDescription,
};

export default function ResaleLandingPage() {
  return <SegmentLandingPage config={config} />;
}
