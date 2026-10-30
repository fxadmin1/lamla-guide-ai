"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  UploadCloud,
  FileText,
  Timer,
  BrainCircuit,
  Check,
  ChevronDown,
  Users,
} from "lucide-react";
import { APP_CONFIG, SUBSCRIPTION_PLANS } from "@/lib/constants";
import { formatGHS } from "@/lib/utils";
import WhatsAppPaymentModal from "@/components/WhatsAppPaymentModal";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function HomePage() {
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<any | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    if (isSupabaseConfigured()) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setCurrentUser(session?.user || null);
      });
    }
  }, []);

  const capabilities = [
    {
      icon: <UploadCloud className="w-5 h-5 text-blue-600" />,
      title: "Upload slides & notes",
      desc: "Import PDFs, PowerPoint decks, Word files, or clear photos of handwritten notes.",
    },
    {
      icon: <FileText className="w-5 h-5 text-blue-600" />,
      title: "Clear summaries & notes",
      desc: "Generate structured study notes and concise exam summaries grounded in your pages.",
    },
    {
      icon: <Timer className="w-5 h-5 text-blue-600" />,
      title: "Timed practice quizzes",
      desc: "Test yourself under real exam timing, or run synchronized live quizzes with your study group.",
    },
    {
      icon: <BrainCircuit className="w-5 h-5 text-blue-600" />,
      title: "Personal AI tutor",
      desc: "Ask questions about difficult topics and get step-by-step answers citing your slides.",
    },
  ];

  const steps = [
    {
      num: "1",
      title: "Upload your material",
      desc: "Add a lecture PDF, slide deck, or photo of your notes to a private study session.",
    },
    {
      num: "2",
      title: "Review structured notes",
      desc: "Read clear summaries and syllabus-aligned notes linked back to your source slides.",
    },
    {
      num: "3",
      title: "Practice and track progress",
      desc: "Take timed quizzes, review mistakes, and track upcoming examination countdowns.",
    },
  ];

  const faqs = [
    {
      q: "What files can I upload?",
      a: "You can upload PDF documents, PowerPoint presentations (.pptx), Word files (.docx), plain text, or photos of lecture whiteboards and handwritten notes.",
    },
    {
      q: "Are my uploaded study materials private?",
      a: "Yes. Every uploaded file and study session is private to your account and protected by Supabase Row Level Security.",
    },
    {
      q: "How do study group live quizzes work?",
      a: "Create a group and share the invite code with classmates. The group admin uploads a slide deck and sets a countdown timer so everyone starts and takes the quiz together.",
    },
    {
      q: "How do paid plan upgrades work?",
      a: "You can start on the Free plan at no cost. Paid plans (Standard and Premium) are requested on the pricing page and activated after direct Mobile Money confirmation on WhatsApp.",
    },
  ];

  return (
    <div className="flex flex-col w-full bg-white text-slate-900">
      {/* 1. Hero */}
      <section className="py-20 sm:py-28 border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <p className="text-sm font-medium text-blue-600">
            {APP_CONFIG.slogan}
          </p>

          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
            Turn your lecture slides into clear notes and timed practice quizzes
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Built for SHS, university, and professional students in Ghana. Upload your course materials, understand difficult concepts, and prepare with confidence.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={currentUser ? "/dashboard" : "/auth/signup"}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <span>{currentUser ? "Open Workspace" : "Get started free"}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pricing"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Core Capabilities */}
      <section className="py-20 bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
              Everything you need to study effectively
            </h2>
            <p className="text-base text-slate-600">
              Focused tools that work directly from your own course materials.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {capabilities.map((item, idx) => (
              <div
                key={idx}
                className="p-6 rounded-xl border border-slate-200 bg-white space-y-3"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  {item.icon}
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. How It Works */}
      <section className="py-20 bg-slate-50/70 border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
              How it works
            </h2>
            <p className="text-base text-slate-600">
              Go from raw lecture files to active exam preparation in minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step) => (
              <div
                key={step.num}
                className="bg-white rounded-xl border border-slate-200 p-6 space-y-3"
              >
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 text-sm font-semibold">
                  {step.num}
                </span>
                <h3 className="text-base font-semibold text-slate-900">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-900">
                  Study together with live timed group quizzes
                </h3>
                <p className="text-sm text-slate-600 max-w-xl">
                  Form a class group for up to 100 members. Group admins upload a slide deck, set a timer, and launch a synchronized quiz for everyone at once.
                </p>
              </div>
            </div>
            <Link
              href={currentUser ? "/dashboard" : "/auth/signup"}
              className="px-4 py-2.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors shrink-0 text-center"
            >
              Try study groups
            </Link>
          </div>
        </div>
      </section>

      {/* 4. Pricing Overview */}
      <section className="py-20 bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
              Simple, transparent pricing
            </h2>
            <p className="text-base text-slate-600">
              Start free. Upgrade anytime via Mobile Money on WhatsApp.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {SUBSCRIPTION_PLANS.map((plan) => {
              const isPopular = plan.popular;
              return (
                <div
                  key={plan.id}
                  className={`rounded-xl bg-white p-6 sm:p-7 flex flex-col justify-between ${
                    isPopular
                      ? "border-2 border-blue-600"
                      : "border border-slate-200"
                  }`}
                >
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {plan.name}
                      </h3>
                      {isPopular && (
                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                          Recommended
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-slate-900">
                        {plan.price === 0 ? "GHS 0" : formatGHS(plan.price)}
                      </span>
                      <span className="text-sm text-slate-500">
                        / {plan.duration}
                      </span>
                    </div>

                    <p className="text-sm text-slate-600">
                      {plan.description}
                    </p>

                    <ul className="space-y-2.5 pt-4 border-t border-slate-100 text-sm text-slate-700">
                      {plan.features.slice(0, 5).map((f, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-6">
                    {plan.id === "free" ? (
                      <Link
                        href="/auth/signup"
                        className="w-full text-center block py-2.5 px-4 border border-slate-200 hover:bg-slate-50 text-slate-800 font-medium rounded-lg text-sm transition-colors"
                      >
                        Get started free
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedPlanForPayment(plan)}
                        className={`w-full py-2.5 px-4 font-medium rounded-lg text-sm transition-colors cursor-pointer ${
                          isPopular
                            ? "bg-blue-600 hover:bg-blue-700 text-white"
                            : "border border-slate-200 hover:bg-slate-50 text-slate-800"
                        }`}
                      >
                        Choose {plan.name}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. FAQ */}
      <section className="py-20 bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
              Common questions
            </h2>
          </div>

          <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full py-4 text-left flex items-center justify-between gap-4 font-medium text-slate-900 text-base hover:text-blue-600 transition-colors cursor-pointer"
                    aria-expanded={isOpen}
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                        isOpen ? "rotate-180 text-blue-600" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="pb-4 text-sm text-slate-600 leading-relaxed">
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. Clean White Bottom CTA */}
      <section className="py-20 bg-slate-50/70">
        <div className="max-w-2xl mx-auto px-4 text-center space-y-5">
          <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
            Ready to organize your study sessions?
          </h2>
          <p className="text-base text-slate-600">
            Create a free account and upload your first lecture file in seconds.
          </p>
          <div className="pt-1">
            <Link
              href={currentUser ? "/dashboard" : "/auth/signup"}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <span>{currentUser ? "Open Workspace" : "Create free account"}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {selectedPlanForPayment && (
        <WhatsAppPaymentModal
          plan={selectedPlanForPayment}
          onClose={() => setSelectedPlanForPayment(null)}
        />
      )}
    </div>
  );
}
