"use client";
// Wrap a screen's questions in this and each one gets an Edit button (QuestionFrame) that opens the Manage pack
// editor in a dialog: text, options, answer, explanation, marks… Saving runs the same checks as an import
// (manage.saveQuestion). The screen's own query refetches by itself, so the edit shows at once.

import { useState, type ReactNode } from "react";
import { QuestionEditor } from "@/components/manage/QuestionEditor";
import { EditQuestionContext } from "@/components/question/editContext";
import { useToast } from "@/components/ui";
import { useQuery } from "@/lib/db/client";

export function EditQuestionHost({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  return (
    <EditQuestionContext.Provider value={setId}>
      {children}
      {id && <Editing key={id} id={id} onDone={() => setId(null)} />}
    </EditQuestionContext.Provider>
  );
}

/** Loads the editor's pickers (topics, mocks) only once someone presses Edit. */
function Editing({ id, onDone }: { id: string; onDone: () => void }) {
  const toast = useToast();
  const { data: overview } = useQuery("manage.overview");
  if (!overview) return null;
  return (
    <QuestionEditor
      overview={overview}
      id={id}
      onClose={onDone}
      onSaved={(saved) => {
        toast(`Saved ${saved}.`, "success");
      }}
    />
  );
}
