"use client";
import { useParams } from "next/navigation";
import Exam from "@/components/Exam";

export default function ExamPage() {
  const { id } = useParams<{ id: string }>();
  return <Exam id={id} />;
}
