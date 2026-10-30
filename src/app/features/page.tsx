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
  ArrowRight,
  Calendar,
  Users,
  Sparkles,
  Download,
  CheckCircle2,
  Zap,
  Clock,
  Smartphone,
  ShieldCheck,
  Search,
  MessageSquare,
  Play,
} from "lucide-react";

export default function FeaturesPage() {
  const [activeTab, setActiveTab] = useState<
    "slides" | "tutor" | "quiz" | "live_quiz" | "tracker" | "pwa"
  >("tutor");

  return (
    <div className="flex flex-col w-full bg-white text-slate-900">
      {/* ─── Hero Section ─── */}
      <section className="py-16 sm:py-20 border-b border-slate-100 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>LAMLA Guide AI Features</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
            Engineered For Pure Exam Mastery
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Every feature is designed to eliminate academic overload. From 1 GB slide ingestion to live synchronized class quizzes and AI concept drawings.
          </p>

          {/* Interactive Feature Category Tabs */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-2">
            {[
              { id: "slides", label: "1 GB Slide Ingestion", icon: <UploadCloud className="w-4 h-4" /> },
              { id: "tutor", label: "AI Tutor & Vector Drawing", icon: <BrainCircuit className="w-4 h-4" /> },
              { id: "quiz", label: "Zero-Repeat Quizzes", icon: <HelpCircle className="w-4 h-4" /> },
              { id: "live_quiz", label: "Live Synced Quizzes (1,000 Students)", icon: <Users className="w-4 h-4" /> },
              { id: "tracker", label: "Focus Study Tracker", icon: <Timer className="w-4 h-4" /> },
              { id: "pwa", label: "1-Tap Mobile PWA", icon: <Smartphone className="w-4 h-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white shadow-blue-500/20"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Interactive Feature Showcase Viewport ─── */}
      <section className="py-12 sm:py-16 bg-slate-50/60 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* TAB 1: SLIDE INGESTION & EVERY-SLIDE NOTES */}
          {activeTab === "slides" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-in fade-in">
              <div className="lg:col-span-5 space-y-4">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  Document Intelligence
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  1 GB Multi-Format Uploads with Zero Storage Bloat
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Upload PowerPoint decks, PDFs, Word documents, and textbook photos up to 1 GB. Files are processed in temporary memory and wiped immediately, storing only high-yield text in your database.
                </p>
                <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span><strong>Every Slide Covered:</strong> Never skips important definitions or formulas.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span><strong>Multi-Format Ingestion:</strong> .pptx, .pdf, .docx, images, & plain text.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span><strong>Zero Disk Exhaustion:</strong> Ephemeral buffers unlinked immediately.</span>
                  </li>
                </ul>
              </div>

              {/* Visual Mockup Card */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    <span className="text-xs font-semibold text-slate-700 ml-2">Lecture_04_Cell_Metabolism.pptx</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    28 Slides Extracted
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-900">
                      <span>Slide 1: Cellular Respiration Overview</span>
                      <span className="text-blue-600 font-bold">Key Concept</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      ATP synthesis occurs through substrate-level phosphorylation and oxidative phosphorylation across the inner mitochondrial membrane.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-900">
                      <span>Slide 2: Glycolysis & The Citric Acid Cycle</span>
                      <span className="text-emerald-600 font-bold">Examinable Formula</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Glucose (6C) splits into 2 Pyruvate (3C) molecules in the cytoplasm with a net yield of 2 ATP and 2 NADH.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AI TUTOR & SVG DRAWING */}
          {activeTab === "tutor" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-in fade-in">
              <div className="lg:col-span-5 space-y-4">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  Unrestricted Intelligence
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  Personal AI Tutor & Vector Concept Drawing
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Ask any question—whether inside your slides or completely outside them. The AI searches Wikipedia and DuckDuckGo in real time and can write clean, labeled vector SVG diagrams on demand.
                </p>
                <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span><strong>Draw & Visualize:</strong> Generates crisp labeled schematics and vector diagrams.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span><strong>Live Web Enrichment:</strong> Pulls verified facts from Wikipedia and DuckDuckGo.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span><strong>Multi-Modal Voice:</strong> Speech recognition and voice synthesis enabled.</span>
                  </li>
                </ul>
              </div>

              {/* Visual Mockup Card */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-800">LAMLA Socratic Tutor</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active • Web Enriched
                  </span>
                </div>

                {/* Simulated Chat Message with Vector Diagram */}
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-blue-600 text-white text-xs max-w-sm ml-auto">
                    Draw and visualize the internal structure of the Earth with crust, mantle, and core.
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>Here is a labeled schematic diagram:</span>
                    </div>

                    {/* Clean Inline SVG Mockup */}
                    <div className="bg-white rounded-lg p-3 border border-slate-200 flex justify-center">
                      <svg viewBox="0 0 320 160" width="300" height="150" className="max-w-full">
                        <circle cx="160" cy="80" r="70" fill="#3b82f6" fillOpacity="0.1" stroke="#3b82f6" strokeWidth="2" />
                        <circle cx="160" cy="80" r="48" fill="#f59e0b" fillOpacity="0.15" stroke="#f59e0b" strokeWidth="2" />
                        <circle cx="160" cy="80" r="24" fill="#ef4444" fillOpacity="0.2" stroke="#ef4444" strokeWidth="2" />
                        <text x="160" y="84" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#dc2626">Core</text>
                        <text x="160" y="50" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#d97706">Mantle</text>
                        <text x="160" y="24" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#2563eb">Crust</text>
                      </svg>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Diagram rendered live via script-inert SVG with full-screen zoom and download options.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PRACTICE QUIZZES & DEDUPLICATION */}
          {activeTab === "quiz" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-in fade-in">
              <div className="lg:col-span-5 space-y-4">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  Active Recall Drills
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  Up to 50 Questions with Zero Repeats
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Generate multiple-choice, true/false, and short-answer questions. Jaccard token-similarity deduplication guarantees no repeated questions, with every option carrying a clear explanation.
                </p>
                <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span><strong>Zero Duplicate Questions:</strong> Every question tests a distinct examinable fact.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span><strong>Deep Explanations:</strong> Clarifies why the right answer is correct and others are traps.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span><strong>Schema Safe:</strong> Robust database inserts without column mismatch errors.</span>
                  </li>
                </ul>
              </div>

              {/* Visual Mockup Card */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-500">Question 3 of 20</span>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-50 text-blue-700 text-xs font-semibold">
                    <Clock className="w-3.5 h-3.5" />
                    <span>00:45 Remaining</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-900">
                    Which enzyme is responsible for catalyzing the synthesis of ATP during oxidative phosphorylation?
                  </h4>
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50">
                      A) Hexokinase
                    </div>
                    <div className="p-2.5 rounded-lg border-2 border-emerald-500 bg-emerald-50 text-xs font-semibold text-emerald-900 flex items-center justify-between">
                      <span>B) ATP Synthase</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50">
                      C) Pyruvate Dehydrogenase
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                    <strong className="text-slate-900">Explanation:</strong> ATP Synthase utilizes the proton gradient across the inner membrane to synthesize ATP from ADP and inorganic phosphate.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LIVE SYNCHRONIZED CLASS QUIZZES */}
          {activeTab === "live_quiz" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-in fade-in">
              <div className="lg:col-span-5 space-y-4">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  Real-Time Study Circles
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  Synchronized Class Quizzes for up to 1,000 Students
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Teachers and group leaders can launch spontaneous timed quizzes or schedule them in advance. The host takes the quiz alongside everyone, and the system automatically marks every student's paper when time expires.
                </p>
                <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span><strong>1,000 Member Capacity:</strong> Scaled WebSockets for whole lecture halls.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span><strong>Independent Auto-Marking:</strong> Scorecards and rank revealed when timer hits zero.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span><strong>Shareable Join Links:</strong> Pre-auth preview and instant redirect for easy joining.</span>
                  </li>
                </ul>
              </div>

              {/* Visual Mockup Card */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-slate-900">KNUST Level 200 • Cell Biology Circle</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">84 Students Active</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>LIVE ROUND IN PROGRESS</span>
                    <span className="text-amber-400 font-mono font-bold text-sm">⏱ 00:28</span>
                  </div>
                  <h4 className="text-sm font-semibold">
                    Question 4: What is the primary electron acceptor in aerobic respiration?
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-slate-800 border border-slate-700">A) Oxygen (O2)</div>
                    <div className="p-2 rounded bg-slate-800 border border-slate-700">B) Carbon Dioxide</div>
                    <div className="p-2 rounded bg-slate-800 border border-slate-700">C) Water</div>
                    <div className="p-2 rounded bg-slate-800 border border-slate-700">D) Glucose</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>Host is participating in the quiz</span>
                  <span className="text-blue-600 font-semibold">Code: BIO201-4419</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: FOCUS TIME & STUDY TRACKER */}
          {activeTab === "tracker" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-in fade-in">
              <div className="lg:col-span-5 space-y-4">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  Page Visibility API
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  True Foreground Study Tracker & Streak Shield
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Only active study time is counted. If a student leaves the tab, minimizes the window, or locks their device, the study clock pauses automatically and resumes continuing from their progress upon return.
                </p>
                <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span><strong>Anti-Cheating Visibility Engine:</strong> Counts strictly foreground seconds.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span><strong>Streak Protection:</strong> Shields your study momentum even on rest days.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span><strong>Global Leaderboard Sync:</strong> Accumulated XP drives competitive group standings.</span>
                  </li>
                </ul>
              </div>

              {/* Visual Mockup Card */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium">Foreground Time</span>
                    <div className="text-lg font-bold text-slate-900 mt-0.5">2h 45m</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium">Daily Streak</span>
                    <div className="text-lg font-bold text-amber-600 mt-0.5">🔥 12 Days</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium">XP Earned</span>
                    <div className="text-lg font-bold text-blue-600 mt-0.5">1,420 XP</div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-blue-900 font-semibold">
                    <Timer className="w-4 h-4 text-blue-600" />
                    <span>Status: Actively learning in foreground</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-bold text-[11px]">
                    Auto-Pauses on Exit
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: PWA & MOBILE INSTALL */}
          {activeTab === "pwa" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-in fade-in">
              <div className="lg:col-span-5 space-y-4">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  Mobile Progressive Web App
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  1-Tap Mobile App with Zero App Store Delays
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Students can install LAMLA Guide directly from their web browser to their iPhone, Android, or PC home screen. Enjoy full-screen standalone study with service worker offline caching.
                </p>
                <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span><strong>1-Tap Installation:</strong> Works directly on Chrome, Safari, and Edge.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span><strong>Offline Shell Cache:</strong> Access slide notes even when data runs low.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span><strong>Push Reminders:</strong> Alerts when scheduled live class quizzes begin.</span>
                  </li>
                </ul>
              </div>

              {/* Visual Mockup Card */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-center">
                <div className="w-64 bg-slate-900 rounded-3xl p-3 shadow-xl border-4 border-slate-800 text-white space-y-3">
                  <div className="w-20 h-4 bg-slate-800 rounded-full mx-auto" />
                  <div className="bg-white rounded-2xl p-4 text-slate-900 space-y-3 text-center">
                    <div className="w-12 h-12 bg-blue-600 rounded-xl mx-auto flex items-center justify-center text-white shadow-md">
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold">LAMLA Guide AI</h4>
                      <p className="text-[10px] text-slate-500">“It's Never Too Late To Study.”</p>
                    </div>
                    <button className="w-full py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold">
                      Add to Home Screen
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* ─── Bottom CTA ─── */}
      <section className="py-16 bg-white border-t border-slate-100 text-center">
        <div className="max-w-xl mx-auto px-4 space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">
            Ready to Study with Pure Speed?
          </h2>
          <p className="text-sm text-slate-600">
            Create your account in 30 seconds and upload your course materials.
          </p>
          <div className="pt-2">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
