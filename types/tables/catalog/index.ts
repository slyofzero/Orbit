// The catalog: how questions are organised and where they came from.
//
//   subjects ──< topics ──< questions          (topics.subject_id, questions.topic_id)
//                  └── topic_ratings           (state: the user's own rating)
//   tags ──< question_tags >── questions
//   packs ──< questions, mocks                  (pack_id; null = added by hand)

export type { SubjectRow } from "@/types/tables/catalog/subjects";
export type { TopicRow } from "@/types/tables/catalog/topics";
export type { TopicRatingRow } from "@/types/tables/catalog/topic_ratings";
export type { TagRow } from "@/types/tables/catalog/tags";
export type { PackRow } from "@/types/tables/catalog/packs";
