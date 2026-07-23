import type { Metadata } from "next";
import { RoadmapPage } from "@/components/bento-app";

export const metadata: Metadata = {
  title: "Roadmap | Bento",
  description: "The Bento roadmap: what is live, what is in progress, and what ships next. No dates promised; everything ships through the 24h timelock.",
};

export default function Page() {
  return <RoadmapPage />;
}
