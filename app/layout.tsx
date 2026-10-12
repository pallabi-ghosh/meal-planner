import type { Metadata } from "next";
import "./globals.css";
import { AppDataProvider } from "./components/AppData";
import TabShell from "./components/TabShell";

export const metadata: Metadata = {
  title: "Meal Planner",
  description: "Family meal planner: plan the week, shop, and log what you ate",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppDataProvider>
          <TabShell>{children}</TabShell>
        </AppDataProvider>
      </body>
    </html>
  );
}
