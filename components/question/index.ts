// One component per question type, all sharing QuestionFrame. Shown at /dev/components.
export { QuestionFrame, type FrameResult } from "@/components/question/QuestionFrame";
export { OptionList } from "@/components/question/OptionList";
export { McqQuestion } from "@/components/question/McqQuestion";
export { MsqQuestion } from "@/components/question/MsqQuestion";
export { NatQuestion } from "@/components/question/NatQuestion";
export { StrQuestion } from "@/components/question/StrQuestion";
export { CodeQuestion } from "@/components/question/CodeQuestion";
export { TYPE_LABEL, DIFFICULTY_LABEL, DIFFICULTY_TONE, fmtMarks, letter } from "@/components/question/format";
