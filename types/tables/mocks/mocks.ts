// Table `mocks`: one row per mock test (content): its name, rules and time limit.
// Which questions it holds is in mock_sections and mock_items; questions are referenced,
// never copied. Taking a mock is state, in mock_attempts.
// PRIMARY KEY (id)

import type { MockId, PackId } from "@/types/tables/common";

export interface MockRow {
  id: MockId; // PRIMARY KEY
  pack_id: PackId | null; // → packs.id; null = made by hand
  name: string;
  instructions: string | null; // shown before the test starts (markdown + LaTeX)
  minutes: number; // > 0: the whole test's time limit
  full_screen: boolean; // true = leaving full screen warns, then fails the attempt
  position: number; // REAL: order in the mock list
  legacy_id: string | null; // v2 ID, never shown in the UI
  created_at: number;
  updated_at: number;
  retired_at: number | null; // set = hidden; past attempts are kept
}
