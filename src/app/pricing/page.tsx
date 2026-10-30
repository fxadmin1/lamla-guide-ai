"use client";

import React, { useState } from "react";
import { Check, ShieldCheck } from "lucide-react";
import { SUBSCRIPTION_PLANS } from "@/lib/constants";
import { formatGHS } from "@/lib/utils";
import WhatsAppPaymentModal from "@/components/WhatsAppPaymentModal";

export default function PricingPage() {
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<any | null>(null);

  const handlePlanSelect = (plan: any) => {
    if (plan.id === "free") {
      window.location.href = "/auth/signup";
      return;
    }
    setSelectedPlanForPayment(plan);
  };

  return (
    <div className="flex flex-col w-full bg-white text-slate-900">
      {/* Header */}
      <section className="py-16 sm:py-20 border-b border-slate-100 text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Pricing &amp; Plans
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
            Start with the Free plan. Upgrade anytime via Mobile Money on WhatsApp when you need higher capacity and flashcards.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {SUBSCRIPTION_PLANS.map((plan) => {
              const isPopular = plan.popular;
              return (
                <div
                  key={plan.id}
                  className={`rounded-xl bg-white p-7 flex flex-col justify-between ${
                    isPopular
                      ? "border-2 border-blue-600"
                      : "border border-slate-200"
                  }`}
                >
                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-900">
                          {plan.name}
                        </h2>
                        {isPopular && (
                          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                            Recommended
                          </span>
                        )}
                      </div>

                      <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-bold text-slate-900">
                          {plan.price === 0 ? "GHS 0" : formatGHS(plan.price)}
                        </span>
                        <span className="text-sm text-slate-500">
                          / {plan.duration}
                        </span>
                      </div>

                      <p className="text-sm text-slate-600 mt-2">
                        {plan.description}
                      </p>
                    </div>

                    <ul className="space-y-2.5 pt-4 border-t border-slate-100 text-sm text-slate-700">
                      {plan.features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-7">
                    <button
                      type="button"
                      onClick={() => handlePlanSelect(plan)}
                      className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        isPopular
                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                          : "border border-slate-200 hover:bg-slate-50 text-slate-800"
                      }`}
                    >
                      {plan.id === "free" ? "Get started free" : `Request ${plan.name} via WhatsApp`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How Activation Works */}
      <section className="py-16 bg-slate-50/70 border-t border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-slate-900">
              How Mobile Money activation works
            </h2>
            <p className="text-sm text-slate-600">
              Direct verification keeps subscriptions simple without automatic card charges.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-1.5">
              <div className="font-semibold text-slate-900">1. Request upgrade</div>
              <p className="text-slate-600 leading-relaxed">
                Select Standard or Premium to generate a prefilled WhatsApp request with your account email and reference.
              </p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-1.5">
              <div className="font-semibold text-slate-900">2. Pay via Mobile Money</div>
              <p className="text-slate-600 leading-relaxed">
                Complete your transfer using the payment instructions shared on WhatsApp by the administrator.
              </p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-1.5">
              <div className="font-semibold text-slate-900">3. Account activated</div>
              <p className="text-slate-600 leading-relaxed">
                Once verified, your plan is activated immediately. If a plan expires later, your saved notes and quizzes are never deleted.
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 text-sm text-slate-600 flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Your uploaded files, study notes, and quiz records remain intact even if a paid plan expires.</span>
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
