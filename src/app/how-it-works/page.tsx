import type { Metadata } from "next";
import { HowItWorksPage } from "@/components/bento-app";

export const metadata: Metadata = {
  title: "How boxes work | Bento",
  description: "1:1 backed vs synthetic Bento boxes: what you own, how mint and redeem work, and the trust model for each.",
};

export default function Page() {
  return <HowItWorksPage />;
}
