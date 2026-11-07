import Nav from "@/components/Nav";
import Ambient from "@/components/Ambient";
import Cosmos from "@/components/Cosmos";
import PageTransitions from "@/components/PageTransitions";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <Ambient />
      <Cosmos />
      <PageTransitions />
      <Nav />
      <main className="page">{children}</main>
    </div>
  );
}
