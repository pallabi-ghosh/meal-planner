import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meal Planner",
  description: "Generate a week of meals from seeded preferences",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
