"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronDown, MessageSquare } from "lucide-react";
import { APP_CONFIG } from "@/lib/constants";

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: "Who is LAMLA Guide designed for?",
      a: "LAMLA Guide is built for students across Ghana—including SHS candidates preparing for WASSCE, university and college students, and candidates studying for professional exams such as ICAG, Law, and ACCA.",
    },
    {
      q: "How does the WhatsApp subscription process work?",
      a: "When you choose Standard or Premium on the pricing page, a unique request reference is created. You open WhatsApp with the administrator, complete your Mobile Money transfer, and your subscription is activated immediately upon verification.",
    },
    {
      q: "What happens to my notes if a paid plan expires?",
      a: "Your uploaded files, summaries, study notes, flashcards, and past quiz attempts are never deleted. Your account simply returns to the Free plan limits and you keep access to your saved work.",
    },
    {
      q: "Are my uploaded documents private?",
      a: "Yes. Files are stored in private Supabase Storage protected by Row Level Security. Other students cannot view your documents, notes, or private AI Tutor chats.",
    },
    {
      q: "Can I upload photos of handwritten lecture notes?",
      a: "Yes. You can upload JPEG or PNG photos of notebooks and classroom whiteboards. Optical Character Recognition extracts legible text and alerts you if an image is too blurry rather than guessing.",
    },
    {
      q: "How do Live Quiz Study Groups work?",
      a: "Create a study group for your class (up to 100 members) and share the invite code. The group admin or assistant admin uploads a slide deck, sets a countdown timer, and starts a live quiz synchronized across every participant's screen.",
    },
    {
      q: "Does the platform work well on mobile phones?",
      a: "Yes. The interface is lightweight and responsive across Android phones, iPhones, tablets, and laptops with low mobile data usage.",
    },
  ];

  return (
    <div className="flex flex-col w-full bg-white text-slate-900 py-16 sm:py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-10">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h1>
          <p className="text-base text-slate-600">
            Clear answers about study tools, privacy, and Mobile Money subscriptions.
          </p>
        </div>

        <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={index}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full py-4 text-left flex items-center justify-between gap-4 font-medium text-slate-900 text-base hover:text-blue-600 transition-colors cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
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

        <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Still have a question?
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Reach out to our support team by email or directly on WhatsApp.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
            <Link
              href="/contact"
              className="w-full sm:w-auto px-5 py-2.5 bg-white border border-slate-200 text-slate-800 font-medium text-sm rounded-lg hover:bg-slate-100 transition-colors"
            >
              Contact Support
            </Link>
            <a
              href={`https://wa.me/${APP_CONFIG.adminWhatsApp.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Ask on WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
