import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource/atkinson-hyperlegible-next/400.css";
import "@fontsource/atkinson-hyperlegible-next/600.css";
import "@fontsource/atkinson-hyperlegible-next/700.css";
import "./site.css";
import "./arena.css";
import Veil from "@/components/Veil";

export const metadata: Metadata = {
  title: "Orbit: study planner and mock tests",
  description: "A day planner, topic practice and exam-style mock tests for anyone preparing for an exam",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("gate.theme");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}try{if(sessionStorage.getItem("gate.veil"))document.documentElement.dataset.switching="1"}catch(e){}`,
          }}
        />
      </head>
      <body>
        {children}
        <Veil />
      </body>
    </html>
  );
}
