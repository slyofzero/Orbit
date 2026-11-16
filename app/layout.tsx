import type { Metadata } from "next";
import "./site.css";

export const metadata: Metadata = {
  title: "Orbit",
  description: "A personal study hub: planner, practice, mock tests and stats.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
