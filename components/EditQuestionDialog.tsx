"use client";
import { createPortal } from "react-dom";
import QuestionEditor from "@/components/admin/QuestionEditor";
import { ImageProfile } from "@/components/Img";
import { PackData, locate } from "@/lib/packs";
import { activeProfileId } from "@/lib/profiles";
import { KEYS, usePersisted } from "@/lib/store";

/** The question editor as a dialog on top of whatever page you are on. Saving writes the pack, so every open page updates at once. */
export default function EditQuestionDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const [stored, setStored, ready] = usePersisted<PackData | null>(KEYS.pack, null);
  if (!ready || !stored) return null;
  const pack = { ...stored, mockTests: stored.mockTests ?? [], mocks: stored.mocks ?? [] };
  const loc = locate(pack, id);
  if (!loc) return null;
  const profile = activeProfileId();
  return createPortal(
    <ImageProfile.Provider value={profile}>
      <QuestionEditor profile={profile} pack={pack} loc={loc} onClose={onClose} onSave={(next) => { setStored(next); onClose(); }} />
    </ImageProfile.Provider>,
    document.body
  );
}
