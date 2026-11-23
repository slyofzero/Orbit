import { Suspense } from "react";
import { HomePage } from "@/components/home";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomePage />
    </Suspense>
  );
}
