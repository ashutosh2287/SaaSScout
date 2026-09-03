import type {
  ClassificationConfidence,
  MerchantCategory,
} from "@/lib/classification/types";

export const categoryLabel: Record<MerchantCategory, string> = {
  likely_saas: "Likely SaaS",
  likely_software: "Likely software",
  not_software: "Not software",
  unknown: "Unknown",
};

export const categoryTone: Record<MerchantCategory, string> = {
  likely_saas: "bg-emerald-50 text-emerald-700",
  likely_software: "bg-teal-50 text-teal-700",
  not_software: "bg-zinc-100 text-zinc-600",
  unknown: "bg-amber-50 text-amber-700",
};

export const confidenceTone: Record<ClassificationConfidence, string> = {
  high: "text-emerald-700",
  medium: "text-amber-700",
  low: "text-zinc-500",
};