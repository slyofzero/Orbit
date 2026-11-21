// Logic test suite. Must print "ALL OK". Run: bun run check
// Uses bun's built-in SQLite to verify db/schema.sql; the app itself uses the WASM build in a worker.
// One file per area in scripts/checks/ (each prints its own section when imported, in this order);
// shared helpers (ok, freshDb, seed…) are in scripts/checks/helpers.ts. Add a new area: a file there + a line here.
import { results } from "@/scripts/checks/helpers";
import "@/scripts/checks/schema";
import "@/scripts/checks/db";
import "@/scripts/checks/markdown";
import "@/scripts/checks/editing";
import "@/scripts/checks/dates";
import "@/scripts/checks/images";
import "@/scripts/checks/planFile";
import "@/scripts/checks/questionFile";
import "@/scripts/checks/backup";
import "@/scripts/checks/importFix";
import "@/scripts/checks/runway";
import "@/scripts/checks/quotes";
import "@/scripts/checks/grading";
import "@/scripts/checks/dashboard";
import "@/scripts/checks/planner";
import "@/scripts/checks/practice";
import "@/scripts/checks/session";

if (results.failed) {
  console.log(`\n${results.failed} FAILED`);
  process.exit(1);
}
console.log("\nALL OK");
