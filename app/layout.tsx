import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";
import { AppDataProvider } from "./components/AppData";
import TabShell from "./components/TabShell";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });

export const metadata: Metadata = {
  title: "Meal Planner",
  description: "Family meal planner: plan the week, shop, and log what you ate",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={figtree.variable}>
      <body>
        <AppDataProvider>
          <TabShell>{children}</TabShell>
        </AppDataProvider>
      </body>
    </html>
  );
}
