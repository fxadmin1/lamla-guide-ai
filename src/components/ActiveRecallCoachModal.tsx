"use client";

import React, { useState } from "react";
import { X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface ActiveRecallCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionText: string;
  referenceText?: string;
}

export default function ActiveRecallCoachModal({
  isOpen,
  onClose,
  questionText,
  referenceText = "",
}: ActiveRecallCoachModalProps) {
  const [studentAnswer, setStudentAnswer] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setStudentAnswer("");
      setResult(null);
    }
  }, [isOpen, questionText]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentAnswer.trim()) return;

    setEvaluating(true);
    setResult(null);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "active_recall_coach",
          options: {
            question: questionText,
            student_answer: studentAnswer,
            reference_text: referenceText,
          },
        }),
      });
      const data = await res.json();
      if (data?.evaluation) {
        setResult(data.evaluation);
      } else {
        throw new Error(data.error || "Evaluation failed");
      }
    } catch (err: any) {
      alert("Error evaluating answer: " + (err.message || err));
    } finally {
      setEvaluating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recall-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
          <div>
            <h3 id="recall-modal-title" className="text-base font-semibold text-slate-900 dark:text-white">
              Active recall check
            </h3>
            <p className="text-xs text-slate-500">
              Write your answer from memory and compare it against your notes
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div className="text-xs font-medium text-slate-500 mb-1">Prompt</div>
            <p className="text-sm font-medium text-slate-900 dark:text-white leading-relaxed">
              {questionText}
            </p>
          </div>

          {!result && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <label
                htmlFor="recall-answer-input"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Your explanation
              </label>
              <textarea
                id="recall-answer-input"
                rows={4}
                value={studentAnswer}
                onChange={(e) => setStudentAnswer(e.target.value)}
                placeholder="Write what you remember in your own words..."
                className="w-full p-3.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                required
              />

              <button
                type="submit"
                disabled={evaluating || !studentAnswer.trim()}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {evaluating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Evaluating your answer...</span>
                  </>
                ) : (
                  <span>Check my answer</span>
                )}
              </button>
            </form>
          )}

          {result && (() => {
            const displayScore =
              result.scoreOutOf10 !== undefined ? result.scoreOutOf10 * 10 : result.score ?? 75;
            const displayVerdict =
              result.verdict ||
              (displayScore >= 80 ? "Strong recall" : displayScore >= 50 ? "Good foundation" : "Needs review");
            const correctText = result.whatWasCorrect || result.correct_elements;
            const missingText = result.whatWasMissing || result.missing_elements;
            const feedbackText = result.encouragementTip || result.feedback;
            const modelAnswerText = result.modelAnswer || result.memory_hook;

            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div>
                    <div className="text-xs font-medium text-slate-500">Recall score</div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                      {displayScore}/100
                    </div>
                  </div>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {displayVerdict}
                  </span>
                </div>

                {correctText && (
                  <div className="p-4 rounded-xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-1.5">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Points covered well
                    </span>
                    {Array.isArray(correctText) ? (
                      <ul className="list-disc pl-5 text-sm text-slate-700 dark:text-slate-300 space-y-1">
                        {correctText.map((el: string, idx: number) => (
                          <li key={idx}>{el}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-700 dark:text-slate-300">{correctText}</p>
                    )}
                  </div>
                )}

                {missingText && (
                  <div className="p-4 rounded-xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-1.5">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
                      Key details to add
                    </span>
                    {Array.isArray(missingText) ? (
                      <ul className="list-disc pl-5 text-sm text-slate-700 dark:text-slate-300 space-y-1">
                        {missingText.map((el: string, idx: number) => (
                          <li key={idx}>{el}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-700 dark:text-slate-300">{missingText}</p>
                    )}
                  </div>
                )}

                {modelAnswerText && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                      Model answer
                    </span>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {modelAnswerText}
                    </p>
                  </div>
                )}

                {feedbackText && (
                  <p className="text-xs text-slate-500 leading-relaxed">{feedbackText}</p>
                )}

                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="w-full py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium text-sm transition-colors"
                >
                  Try again
                </button>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
