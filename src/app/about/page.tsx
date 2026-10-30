import React from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, BookOpen, Smartphone, Compass } from "lucide-react";
import { APP_CONFIG } from "@/lib/constants";

export default function AboutPage() {
  const principles = [
    {
      title: "Grounded in your materials",
      desc: "Summaries, notes, and practice questions are built directly from your uploaded slides and textbooks so you study what your syllabus actually covers.",
      icon: <BookOpen className="w-5 h-5 text-blue-600" />,
    },
    {
      title: "Patient and encouraging",
      desc: "Guided by our motto, “It's Never Too Late To Study,” every tool is designed to help you catch up and master tough courses step by step.",
      icon: <Compass className="w-5 h-5 text-blue-600" />,
    },
    {
      title: "Fast on mobile devices",
      desc: "Engineered to load quickly and use minimal mobile data across phones, tablets, and laptops across Ghana.",
      icon: <Smartphone className="w-5 h-5 text-blue-600" />,
    },
    {
      title: "Private and honest",
      desc: "Your documents stay strictly private to your account. Practice questions are genuine study aids—never leaked examination papers.",
      icon: <ShieldCheck className="w-5 h-5 text-blue-600" />,
    },
  ];

  return (
    <div className="flex flex-col w-full bg-white text-slate-900">
      <section className="py-16 sm:py-20 border-b border-slate-100 text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-4">
          <p className="text-sm font-medium text-blue-600">{APP_CONFIG.slogan}</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            About LAMLA Guide
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Built for students across Ghana facing dense lecture slides, tight semester schedules, and demanding examinations.
          </p>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-2.5">
              <h2 className="text-lg font-semibold text-slate-900">
                Our mission
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                To help SHS candidates, university students, and professional examinees turn heavy course files into clear notes, active recall practice, and steady academic progress.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 space-y-2.5">
              <h2 className="text-lg font-semibold text-slate-900">
                Why we built it
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Falling behind on lecture slides is stressful. With structured summaries, targeted practice quizzes, and collaborative live group quizzes, students can organize revision and catch up effectively.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <h2 className="text-xl font-semibold text-slate-900">
              Core principles
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {principles.map((p, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-slate-200 p-5 space-y-2.5"
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                    {p.icon}
                  </div>
                  <h3 className="font-semibold text-slate-900 text-base">
                    {p.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {p.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 text-center">
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
