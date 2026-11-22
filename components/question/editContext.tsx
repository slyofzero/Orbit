"use client";
// Lets a screen switch on the Edit button of every question under it (v1's per-question Edit). A screen wraps its
// questions in <EditQuestionHost> (components/manage/EditQuestionHost.tsx), which provides `edit`; QuestionFrame
// shows the button only when a provider is there, so mock exams and reviews stay without it.

import { createContext, useContext } from "react";

/** Opens the editor for the question with this id; null = no editing on this screen. */
export const EditQuestionContext = createContext<((id: string) => void) | null>(null);

export const useEditQuestion = () => useContext(EditQuestionContext);
