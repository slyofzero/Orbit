import { Heading, Text } from "@/components/ui";

export default function Home() {
  return (
    <main className="mx-auto grid max-w-160 gap-2 px-4 py-16">
      <Heading level={1} className="text-accent">
        Orbit
      </Heading>
      <Text variant="muted">Fresh start. Storage is being rebuilt on SQLite (see `docs/STORAGE.md`).</Text>
    </main>
  );
}
