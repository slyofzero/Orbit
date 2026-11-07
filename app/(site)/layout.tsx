import Nav from "@/components/Nav";
import Ambient from "@/components/Ambient";
import Cosmos from "@/components/Cosmos";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <Ambient />
      <Cosmos />
      <Nav />
      <main className="page">{children}</main>
    </div>
  );
}
