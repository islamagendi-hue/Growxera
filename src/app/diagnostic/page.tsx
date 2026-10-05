import type { Metadata } from "next";
import { DiagnosticApp } from "@/components/diagnostic/DiagnosticApp";

export const metadata: Metadata = {
  title: "Growth Diagnostic",
  description:
    "Get a free, preliminary Growth Score across seven dimensions, find your primary growth bottleneck, and see where your biggest opportunities may be.",
  alternates: { canonical: "/diagnostic" },
};

export default function DiagnosticPage() {
  return <DiagnosticApp />;
}
