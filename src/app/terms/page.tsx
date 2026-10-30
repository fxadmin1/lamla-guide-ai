import React from "react";
import { APP_CONFIG } from "@/lib/constants";

export default function TermsOfServicePage() {
  return (
    <div className="w-full bg-white py-14 sm:py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <header className="space-y-2 border-b border-slate-200 pb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Terms of Service
          </h1>
          <p className="text-sm text-slate-500">
            Effective date: October 2026 &bull; {APP_CONFIG.name}
          </p>
        </header>

        <div className="space-y-8 text-sm sm:text-base text-slate-700 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">
              1. Educational purpose and academic integrity
            </h2>
            <p>
              {APP_CONFIG.name} helps students study course materials, test comprehension, and prepare for examinations.
            </p>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 space-y-1">
              <p className="font-semibold text-slate-900">Academic disclaimer</p>
              <p>
                All summaries, flashcards, and practice quizzes are generated from the materials you upload. We do not distribute leaked or official WAEC, WASSCE, or university examination papers. Use generated study aids alongside your official lectures and textbooks.
              </p>
            </div>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-lg font-semibold text-slate-900">
              2. Student accounts
            </h2>
            <p>
              You are responsible for keeping your login credentials secure and providing accurate account details. Do not share your password or attempt to access another student&apos;s workspace.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-lg font-semibold text-slate-900">
              3. Subscriptions and Mobile Money activation
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>
                Paid plans (Standard and Premium) are activated after Mobile Money payment confirmation via WhatsApp.
              </li>
              <li>
                Submitting a request without completing payment does not activate paid plan quotas.
              </li>
              <li>
                When a paid period ends, your account returns to the Free plan while preserving your existing study sessions, notes, and quiz records.
              </li>
            </ul>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-lg font-semibold text-slate-900">
              4. Acceptable use
            </h2>
            <p>
              You agree not to upload unlawful or malicious files, disrupt live group quiz sessions, or attempt to bypass platform security controls and usage limits.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-lg font-semibold text-slate-900">
              5. Governing law
            </h2>
            <p>
              These terms are governed by the laws of the Republic of Ghana.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
