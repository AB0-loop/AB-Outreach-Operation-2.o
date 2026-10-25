import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
export const metadata: Metadata = { title: "Aurum Acquisition", description: "Evidence to consultation and revenue", robots: { index: false, follow: false } };
export default function Layout({ children }: { children: ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
