import { Question } from "../types";

export type QBody = Omit<Question, "id">;

export const R = String.raw; // raw strings so LaTeX backslashes need no escaping

export const mcq = (topic: string, marks: 1 | 2, text: string, options: string[], answer: number, explanation: string): QBody => ({
  topic, type: "mcq", marks, text, options, answer, explanation,
});

export const msq = (topic: string, marks: 1 | 2, text: string, options: string[], answer: number[], explanation: string): QBody => ({
  topic, type: "msq", marks, text, options, answer, explanation,
});

export const nat = (topic: string, marks: 1 | 2, text: string, value: number, tol: number, explanation: string): QBody => ({
  topic, type: "nat", marks, text, answer: { value, tol }, explanation,
});
