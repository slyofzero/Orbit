// The mock test tables. Content = the test; state = the user's attempts at it.
//
//   mocks ──< mock_sections ──< mock_items >── questions
//     └──< mock_attempts ──< mock_attempt_items >── questions
//                └──< question_answers          (written at submit; attempt_id set)

export type { MockRow } from "@/types/tables/mocks/mocks";
export type { MockSectionRow } from "@/types/tables/mocks/mock_sections";
export type { MockItemRow } from "@/types/tables/mocks/mock_items";
export type { MockAttemptRow } from "@/types/tables/mocks/mock_attempts";
export type { MockAttemptItemRow } from "@/types/tables/mocks/mock_attempt_items";
