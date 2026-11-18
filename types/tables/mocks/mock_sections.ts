// Table `mock_sections`: the parts of a mock, e.g. "General Aptitude", "Core" (content).
// A mock with no real sections still has one.
// PRIMARY KEY (id). Listed by (mock_id, position).

import type { MockId, MockSectionId } from "@/types/tables/common";

export interface MockSectionRow {
  id: MockSectionId; // PRIMARY KEY
  mock_id: MockId; // → mocks.id
  name: string;
  position: number; // REAL: order inside the mock
  minutes: number | null; // own time limit for this section; null = shares the mock's clock
}
