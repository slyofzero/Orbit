import { redirect } from "next/navigation";

// Mocks now live under Practice. This keeps old links and bookmarks working.
export default function MocksMoved() {
  redirect("/practice/mocks");
}
