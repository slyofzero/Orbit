// Every table of the Orbit database, one file per table, named after the table.
// Import from "@/types/tables"; it re-exports everything below.
//
//   common.ts                 shared IDs and enums
//   images.ts                 images (one row per distinct picture, shared by any feature)
//   questions/                the question tables (layout in questions/index.ts)
//   plans/                    the study plan tables (layout in plans/index.ts)

export * from "@/types/tables/common";
export type { ImageRow } from "@/types/tables/images";
export * from "@/types/tables/questions";
export * from "@/types/tables/plans";
