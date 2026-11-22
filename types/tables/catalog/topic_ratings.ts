// Table `topic_ratings`: how the user feels about a topic (state).
// Shown next to the computed strength (docs/STATS.md) to spot over- or under-confidence.
// No row = not rated. v2 kept this inside the question pack; the importer moves it here.
// PRIMARY KEY (topic_id): one rating per topic.

import type { TopicId, TopicRating } from "@/types/tables/common";

export interface TopicRatingRow {
  topic_id: TopicId; // PRIMARY KEY → topics.id
  rating: TopicRating; // know | shaky | no_idea
  updated_at: number;
}
