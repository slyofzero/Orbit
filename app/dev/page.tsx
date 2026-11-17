import { Callout, Card, Heading, Link } from "@/components/ui";

export default function DevIndex() {
  return (
    <>
      <Heading level={1}>Dev workbench</Heading>
      <Callout tone="info" title="Only visible while running `bun run dev`.">
        Production builds return 404 for every page under /dev.
      </Callout>
      <div className="dv-index">
        <Card title="Components" subtitle="Buttons, fields, tables, dialogs and every question type, in light and dark."
          actions={<Link href="/dev/components" variant="nav">Open</Link>} />
      </div>
    </>
  );
}
