import { Heading, Text } from "@/components/ui";

export default function Home() {
  return (
    <main className="home-wrap">
      <Heading level={1} className="home-title">Orbit</Heading>
      <Text variant="muted">Fresh start. Storage is being rebuilt on SQLite (see `docs/STORAGE.md`).</Text>
    </main>
  );
}
