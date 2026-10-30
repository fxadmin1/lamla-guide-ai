"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  UploadCloud,
  FileText,
  BookOpen,
  HelpCircle,
  Timer,
  BrainCircuit,
  Layers,
  TrendingUp,
  Award,
  ArrowRight,
  Calendar,
  Users,
} from "lucide-react";

export default function FeaturesPage() {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const features = [
    {
      category: "materials",
      title: "Document & Note Extraction",
      icon: <UploadCloud className="w-5 h-5 text-blue-600" />,
      desc: "Upload PDFs, PowerPoint decks, Word files, or clear photos of handwritten notes while preserving slide and page numbers.",
    },
    {
      category: "materials",
      title: "Adaptive Exam Summaries",
      icon: <FileText className="w-5 h-5 text-blue-600" />,
      desc: "Generate concise overviews or detailed exam-focused summaries with curated educational video links at the end.",
    },
    {
      category: "materials",
      title: "Source-Grounded Study Notes",
      icon: <BookOpen className="w-5 h-5 text-blue-600" />,
      desc: "Read structured notes with definitions, worked examples, and clickable slide citations to verify original wording.",
    },
    {
      category: "practice",
      title: "Practice Question Generator",
      icon: <HelpCircle className="w-5 h-5 text-blue-600" />,
      desc: "Create multiple-choice, multi-select, true/false, short-answer, and matching questions directly from your slides.",
    },
    {
      category: "practice",
      title: "Timed Mock Quizzes",
      icon: <Timer className="w-5 h-5 text-blue-600" />,
      desc: "Practice under real countdown timers with automatic scoring, detailed explanations, and a mistake notebook for retesting.",
    },
    {
      category: "practice",
      title: "Live Group Quizzes",
      icon: <Users className="w-5 h-5 text-blue-600" />,
      desc: "Host synchronized timed quizzes for up to 100 classmates in a study group by uploading a slide deck and setting a timer.",
    },
    {
      category: "tutoring",
      title: "Personal AI Tutor",
      icon: <BrainCircuit className="w-5 h-5 text-blue-600" />,
      desc: "Ask questions about any slide or concept and receive clear, step-by-step explanations grounded in your course files.",
    },
    {
      category: "planning",
      title: "Spaced-Repetition Flashcards",
      icon: <Layers className="w-5 h-5 text-blue-600" />,
      desc: "Convert key definitions and concepts into flashcard decks scheduled around your memory retention.",
    },
    {
      category: "planning",
      title: "Examination Countdown Tracker",
      icon: <Calendar className="w-5 h-5 text-blue-600" />,
      desc: "Track your upcoming exam dates with live countdowns, topic checklists, and daily revision targets.",
    },
    {
      category: "planning",
      title: "Progress & Student Rankings",
      icon: <TrendingUp className="w-5 h-5 text-blue-600" />,
      desc: "Monitor quiz accuracy, weak topics, and study consistency, with optional student leaderboard rankings.",
    },
  ];

  const categories = [
    { id: "all", label: "All" },
    { id: "materials", label: "Summaries & Notes" },
    { id: "practice", label: "Quizzes & Groups" },
    { id: "tutoring", label: "AI Tutor" },
    { id: "planning", label: "Flashcards & Planning" },
  ];

  const filtered =
    activeCategory === "all"
      ? features
      : features.filter((f) => f.category === activeCategory);

  return (
    <div className="flex flex-col w-full bg-white text-slate-900">
      {/* Header */}
      <section className="py-16 sm:py-20 border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-4">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Platform Features
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
            Practical tools designed to turn your lecture materials into structured revision and active recall.
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  activeCategory === cat.id
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((feat, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 bg-white p-6 space-y-3"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  {feat.icon}
                </div>
                <h2 className="text-base font-semibold text-slate-900">
                  {feat.title}
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 bg-slate-50/70 border-t border-slate-100 text-center">
        <div className="max-w-xl mx-auto px-4 space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">
            Start studying with your own course files
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            Create a free account to upload slides, generate notes, and take timed quizzes.
          </p>
          <div className="pt-1">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors"
            >
              <span>Get started free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
