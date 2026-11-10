import { Suspense } from "react";
import PackManager from "@/components/PackManager";

// Manage pack: /practice/manage?tab=questions|mock-tests|topics|plan|upload (and &q=<question id> to open one question)
export default function ManagePage() {
  return <Suspense fallback={null}><PackManager /></Suspense>;
}
