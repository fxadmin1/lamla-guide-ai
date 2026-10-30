import React from "react";
import Link from "next/link";
import {
  UploadCloud,
  Cpu,
  GraduationCap,
  TrendingUp,
  ArrowRight,
  Check,
  Smartphone,
  ShieldCheck,
  Clock,
} from "lucide-react";

export default function HowItWorksPage() {
  const steps = [
    {
      stepNumber: "01",
      icon: <UploadCloud className="w-5 h-5 text-blue-600" />,
      title: "Upload your study material",
      summary: "Import lecture slides, PDFs, Word documents, or note photos.",
      details: [
        "Supports PDF, PPTX, DOCX, TXT, and clear photos (JPEG/PNG).",
        "Files are stored privately in your account under Row Level Security.",
      ],
    },
    {
      stepNumber: "02",
      icon: <Cpu className="w-5 h-5 text-blue-600" />,
      title: "Extract and organize content",
      summary: "Text and diagrams are parsed while preserving slide numbers.",
      details: [
        "Keeps slide and page labels intact so notes can cite exact pages.",
        "Reads handwritten notes and diagrams using optical character recognition.",
      ],
    },
    {
      stepNumber: "03",
      icon: <GraduationCap className="w-5 h-5 text-blue-600" />,
      title: "Study notes, tutor, and timed quizzes",
      summary: "Turn passive reading into active recall.",
      details: [
        "Generate concise summaries and structured notes with inline slide citations.",
        "Take timed practice quizzes individually or live with your study group.",
        "Ask the AI Study Tutor questions for step-by-step explanations.",
      ],
    },
    {
      stepNumber: "04",
      icon: <TrendingUp className="w-5 h-5 text-blue-600" />,
      title: "Review mistakes and track exams",
      summary: "Focus revision on weak areas before exam day.",
      details: [
        "Missed quiz questions are saved to your Mistake Notebook for retesting.",
        "Track real examination dates with live countdowns and syllabus checklists.",
      ],
    },
  ];

  return (
    <div className="flex flex-col w-full bg-white text-slate-900">
      {/* Header */}
      <section className="py-16 sm:py-20 border-b border-slate-100 text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            How LAMLA Guide Works
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
            A straightforward four-step workflow from lecture files to exam readiness.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
          {steps.map((step) => (
            <div
              key={step.stepNumber}
              className="bg-white rounded-xl border border-slate-200 p-6 sm:p-7 space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                    {step.icon}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {step.title}
                    </h2>
                    <p className="text-sm text-slate-600 mt-0.5">
                      {step.summary}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-mono font-semibold text-slate-400">
                  {step.stepNumber}
                </span>
              </div>

              <ul className="space-y-2 pt-3 border-t border-slate-100 text-sm text-slate-700">
                {step.details.map((d, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Clean Light Info Strip */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-sm text-slate-900">
                <Smartphone className="w-4 h-4 text-blue-600" />
                <span>Mobile friendly</span>
              </div>
              <p className="text-sm text-slate-600">
                Fast and lightweight on phones, tablets, and laptops.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-sm text-slate-900">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Available 24/7</span>
              </div>
              <p className="text-sm text-slate-600">
                Revise on your own schedule anytime before lectures or exams.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-sm text-slate-900">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>Private vault</span>
              </div>
              <p className="text-sm text-slate-600">
                Your uploaded files and study records stay private to your account.
              </p>
            </div>
          </div>

          <div className="text-center pt-6">
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
