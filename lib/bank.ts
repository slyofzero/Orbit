// Looking up questions inside whichever pack is loaded (see lib/packs.ts). Nothing is built in.
import { Question } from "./types";
import { PackData } from "./packs";
import { GENERATORS, generate, generatorsForTopic } from "./generators";

export const staticForTopic = (pack: PackData, topic: string) => pack.questions.filter((q) => q.topic === topic);

// The GATE DA pack asks for fresh numeric questions made by code. Other packs never do.
export const hasGenerator = (pack: PackData, topic: string) => pack.useBuiltinGenerators && generatorsForTopic(topic).length > 0;

export function newGenerated(pack: PackData, topic: string, seed: number): Question | undefined {
  if (!pack.useBuiltinGenerators) return undefined;
  const gens = generatorsForTopic(topic);
  if (!gens.length) return undefined;
  return generate(gens[seed % gens.length], seed);
}

export function findQuestion(pack: PackData, byId: Map<string, Question>, id: string): Question | undefined {
  if (id.startsWith("g:")) {
    if (!pack.useBuiltinGenerators) return undefined;
    const [, gid, seed] = id.split(":");
    const gen = GENERATORS.find((g) => g.id === gid);
    return gen ? generate(gen, Number(seed)) : undefined;
  }
  return byId.get(id);
}
