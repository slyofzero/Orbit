// `import schema from "@/db/schema.sql"` gives the file's text (next.config.mjs loads .sql as source).
declare module "*.sql" {
  const text: string;
  export default text;
}
