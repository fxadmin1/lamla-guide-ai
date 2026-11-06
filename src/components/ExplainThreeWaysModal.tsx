"use client";

import React, { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface ExplainThreeWaysModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialConcept?: string;
  contextText?: string;
}

export default function ExplainThreeWaysModal({
  isOpen,
  onClose,
  initialConcept = "",
  contextText = "",
}: ExplainThreeWaysModalProps) {
  const [concept, setConcept] = useState(initialConcept);
  const [activeMode, setActiveMode] = useState<"simple" | "academic" | "analogy">("simple");
  const [loading, setLoading] = useState(false);
  const [explanations, setExplanations] = useState<{
    simple?: string;
    academic?: string;
    analogy?: string;
  } | null>(null);

  React.useEffect(() => {
    if (isOpen && initialConcept) {
      setConcept(initialConcept);
      handleExplain(initialConcept);
    }
  }, [initialConcept, isOpen]);

  const handleExplain = async (conceptToExplain?: string) => {
    const target = conceptToExplain || concept;
    if (!target.trim()) return;

    setLoading(true);
    setExplanations(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/ai", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "explain_three_ways",
          options: {
            concept: target,
            context: contextText,
          },
        }),
      });
      const data = await res.json();
      if (data?.explanations) {
        setExplanations(data.explanations);
      } else {
        throw new Error(data.error || "Failed to generate explanation");
      }
    } catch (err: any) {
      alert("Could not generate explanation: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="explain-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-lg overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
          <div>
            <h3 id="explain-modal-title" className="text-base font-semibold text-slate-900 dark:text-white">
              Explain a concept three ways
            </h3>
            <p className="text-xs text-slate-500">
              Simple summary, exam-level definition, and everyday analogy
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

        {/* Concept Input */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleExplain();
            }}
            className="flex gap-2.5"
          >
            <input
              type="text"
              aria-label="Concept to explain"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Enter a concept, formula, or topic..."
              className="flex-1 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            />
            <button
              type="submit"
              disabled={loading || !concept.trim()}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm disabled:opacity-50 flex items-center gap-1.5 shrink-0 transition-colors"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Explain</span>
            </button>
          </form>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 gap-5 bg-white dark:bg-slate-900">
          {[
            { id: "simple", label: "Simple" },
            { id: "academic", label: "Academic" },
            { id: "analogy", label: "Everyday analogy" },
          ].map((tab) => {
            const active = activeMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveMode(tab.id as any)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-white dark:bg-slate-900">
          {loading ? (
            <div className="py-14 text-center space-y-2.5">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Generating explanations for &ldquo;{concept}&rdquo;...
              </p>
            </div>
          ) : explanations ? (
            <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm leading-relaxed whitespace-pre-line">
              {activeMode === "simple" && (explanations.simple || "No simple explanation generated.")}
              {activeMode === "academic" && (explanations.academic || "No academic explanation generated.")}
              {activeMode === "analogy" && (explanations.analogy || "No analogy generated.")}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 text-sm">
              Enter a concept above to compare simple, academic, and analogy explanations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
