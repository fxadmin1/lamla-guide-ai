"use client";

import React from "react";
import Link from "next/link";
import { X, Check, ArrowRight } from "lucide-react";
import { SUBSCRIPTION_PLANS } from "@/lib/constants";
import { formatGHS } from "@/lib/utils";

interface UpgradePaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string;
  currentCount?: number;
  maxLimit?: number;
  onSelectPlan: (plan: any) => void;
}

export default function UpgradePaywallModal({
  isOpen,
  onClose,
  reason,
  currentCount = 5,
  maxLimit = 5,
  onSelectPlan,
}: UpgradePaywallModalProps) {
  if (!isOpen) return null;

  const paidPlans = SUBSCRIPTION_PLANS.filter((p) => p.id !== "free");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <h3 id="upgrade-modal-title" className="text-base font-semibold text-slate-900">
              Upgrade your study plan
            </h3>
            <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
              {currentCount}/{maxLimit} used
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          <p className="text-sm text-slate-600 leading-relaxed">
            {reason ||
              `You have reached the ${maxLimit}-session limit on the Free plan. Choose a plan below for higher upload capacity and unlimited quiz practice, or delete older sessions to free space.`}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {paidPlans.map((plan) => {
              const isRecommended = plan.id === "standard";
              return (
                <div
                  key={plan.id}
                  className={`rounded-xl p-5 border flex flex-col justify-between relative ${
                    isRecommended
                      ? "border-blue-600 bg-white ring-1 ring-blue-600"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-base text-slate-900">{plan.name}</h4>
                        {isRecommended && (
                          <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                            Recommended
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-900">
                          {formatGHS(plan.price)}
                        </span>
                        <span className="text-xs text-slate-500">/ {plan.duration.toLowerCase()}</span>
                      </div>
                    </div>

                    <ul className="space-y-2 text-xs text-slate-600">
                      {plan.features.slice(0, 5).map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectPlan(plan);
                    }}
                    className={`mt-5 w-full py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-1.5 ${
                      isRecommended
                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                        : "border border-slate-300 bg-white hover:bg-slate-50 text-slate-800"
                    }`}
                  >
                    <span>Choose {plan.name}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>You can also remove completed sessions to continue on Free.</span>
            <Link
              href="/pricing"
              onClick={onClose}
              className="text-blue-600 font-medium hover:underline shrink-0"
            >
              Full plan comparison
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
