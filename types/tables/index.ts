// Every table of the Orbit database, one file per table, named after the table.
// Import from "@/types/tables"; it re-exports everything below.
//
//   common.ts                 shared IDs and enums
//   images.ts                 images (one row per distinct picture, shared by any feature)
//   settings.ts               settings (the user's own settings, one row per key)
//   catalog/                  subjects, topics, tags, packs, topic ratings
//   questions/                the question tables (layout in questions/index.ts)
//   mocks/                    mock tests and attempts (layout in mocks/index.ts)
//   plans/                    the study plan tables (layout in plans/index.ts)

export * from "@/types/tables/common";
export type { ImageRow } from "@/types/tables/images";
export type { SettingRow } from "@/types/tables/settings";
export * from "@/types/tables/catalog";
export * from "@/types/tables/questions";
export * from "@/types/tables/mocks";
export * from "@/types/tables/plans";
