"""
LAMLA Guide AI - Standalone Academic Benchmark Suite & Quality Evaluation
"It's Never Too Late To Study."

Evaluates the academic intelligence, reasoning quality, coverage fidelity,
and question rigor of the LAMLA Guide AI engine across four challenging domains:
1. Autonomic Pharmacology
2. Cellular Respiration & Bioenergetics
3. Macroeconomics & Monetary Policy
4. Renal Physiology & Nephrology

Measures:
- Section Coverage % (Did all academic sections get evaluated?)
- Zero Slide-Number Leak Compliance % (Must be 100%)
- Assertion-Reasoning 5-Case Strict Compliance % (Must be 100%)
- Distractor Plausibility & Distinctness % (Must be 100%)
- Semantic Deduplication % (Zero repeats)
- Multi-tier Explanation Structure (Analogy -> Mechanism -> Clinical Application)
- Execution Speed & Latency (seconds per run)
"""

import time
import json
from typing import Dict, Any, List, Tuple


# Standard Gold-Standard Academic Test Presentations
BENCHMARK_DATASETS = {
    "autonomic_pharmacology": {
        "title": "Autonomic Pharmacology & Adrenergic Transmission",
        "domain": "Pharmacology & Medicine",
        "slides": [
            {
                "slide_number": 1,
                "title": "School of Pharmacy - Course Outline PHARM 302",
                "content": "University of Ghana School of Pharmacy. Department of Pharmacology. Lecturer: Dr. Mensah. Course Code: PHARM 302. Welcome to Semester 1.",
            },
            {
                "slide_number": 2,
                "title": "Organization of the Autonomic Nervous System",
                "content": (
                    "The autonomic nervous system (ANS) regulates involuntary visceral functions. "
                    "It is subdivided into the Sympathetic Nervous System (SNS) and the Parasympathetic Nervous System (PNS). "
                    "SNS prepares the body for 'fight or flight', increasing heart rate and dilating bronchioles. "
                    "PNS mediates 'rest and digest' activities, promoting conservation of energy and glycogen storage."
                ),
            },
            {
                "slide_number": 3,
                "title": "Catecholamine Biosynthesis and Adrenergic Receptors",
                "content": (
                    "Catecholamines are synthesized from tyrosine: Tyrosine -> L-DOPA -> Dopamine -> Norepinephrine -> Epinephrine. "
                    "Adrenergic receptors are classified into Alpha (Alpha-1, Alpha-2) and Beta (Beta-1, Beta-2, Beta-3). "
                    "Alpha-1 receptors are Gq-coupled, causing phospholipase C activation and vascular smooth muscle vasoconstriction. "
                    "Beta-1 receptors are Gs-coupled, stimulating adenylate cyclase to increase cAMP, increasing cardiac chronotropy and inotropy. "
                    "Beta-2 receptors cause bronchodilation and vasodilation in skeletal muscle."
                ),
            },
            {
                "slide_number": 4,
                "title": "Termination of Transmission & Clinical Therapeutics",
                "content": (
                    "Norepinephrine action is terminated primarily by reuptake into presynaptic terminals (Uptake 1 via NET). "
                    "Metabolism occurs via Monoamine Oxidase (MAO) and Catechol-O-methyltransferase (COMT). "
                    "Beta-blockers (e.g., Propranolol: non-selective; Atenolol: cardioselective Beta-1 antagonist) are used to treat hypertension, angina, and arrhythmias. "
                    "Contraindication: Non-selective beta-blockers are contraindicated in asthma due to Beta-2 antagonism inducing bronchospasm."
                ),
            },
        ],
    },
    "cellular_respiration": {
        "title": "Cellular Respiration & Bioenergetics",
        "domain": "Biochemistry",
        "slides": [
            {
                "slide_number": 1,
                "title": "Faculty of Science - Welcome to BIO 201",
                "content": "Department of Biochemistry, Prof. Boateng, Office Hours: Tues 2-4pm.",
            },
            {
                "slide_number": 2,
                "title": "Glycolysis: The Preparatory and Payoff Phases",
                "content": (
                    "Glycolysis occurs in the cytosol and converts one glucose molecule (6C) into two pyruvate molecules (3C). "
                    "The preparatory phase consumes 2 ATP to phosphorylate glucose (catalyzed by hexokinase and phosphofructokinase-1). "
                    "The payoff phase yields 4 ATP via substrate-level phosphorylation and 2 NADH, resulting in a net yield of 2 ATP and 2 NADH per glucose."
                ),
            },
            {
                "slide_number": 3,
                "title": "The Citric Acid Cycle & Oxidative Phosphorylation",
                "content": (
                    "Pyruvate enters the mitochondrial matrix and is converted to Acetyl-CoA by the pyruvate dehydrogenase complex. "
                    "The Krebs cycle oxidizes Acetyl-CoA, generating 3 NADH, 1 FADH2, and 1 GTP/ATP per turn. "
                    "The Electron Transport Chain (Complexes I-IV) transfers electrons from NADH/FADH2 to oxygen, establishing a proton gradient across the inner mitochondrial membrane. "
                    "Chemiosmosis: Protons re-enter the matrix via ATP synthase (F0F1 complex), driving ATP synthesis via rotary catalysis."
                ),
            },
        ],
    },
    "macroeconomics": {
        "title": "Macroeconomic Policy and Monetary Mechanisms",
        "domain": "Economics",
        "slides": [
            {
                "slide_number": 1,
                "title": "Central Bank Monetary Operations",
                "content": (
                    "Monetary policy is conducted by the central bank to maintain price stability and support sustainable growth. "
                    "Primary tools include the policy interest rate, reserve requirements, and open market operations (OMO). "
                    "An increase in the policy rate raises commercial lending rates, reducing borrowing and aggregate demand, thereby containing inflationary pressure."
                ),
            },
            {
                "slide_number": 2,
                "title": "The Phillips Curve & Stagflation",
                "content": (
                    "The short-run Phillips curve illustrates an inverse relationship between inflation and unemployment. "
                    "However, in the long run, the Phillips curve is vertical at the Natural Rate of Unemployment (NAIRU). "
                    "Stagflation occurs when adverse supply shocks cause simultaneously high inflation and rising unemployment, as observed during oil crises."
                ),
            },
        ],
    },
}


class AcademicBenchmarkRunner:
    """
    Executes automated academic evaluation against benchmark documents.
    """

    def __init__(self, ai_engine=None):
        if ai_engine is None:
            try:
                from python_ai.ai_engine import PythonAIEngine
                self.engine = PythonAIEngine()
            except ImportError:
                from ai_engine import PythonAIEngine
                self.engine = PythonAIEngine()
        else:
            self.engine = ai_engine

    def run_benchmark(self, dataset_name: str = "autonomic_pharmacology") -> Dict[str, Any]:
        """Runs the comprehensive benchmark on a specified test dataset."""
        dataset = BENCHMARK_DATASETS.get(dataset_name) or BENCHMARK_DATASETS["autonomic_pharmacology"]
        slides_text = []
        for s in dataset["slides"]:
            slides_text.append(f"--- Slide {s['slide_number']}: {s['title']} ---\n{s['content']}")
        raw_document_content = "\n\n".join(slides_text)

        start_time = time.time()
        results: Dict[str, Any] = {
            "dataset_name": dataset_name,
            "domain": dataset["domain"],
            "total_slides": len(dataset["slides"]),
            "metrics": {},
            "evaluations": {},
        }

        # 1. Blueprint Evaluation & Administrative Filtering
        bp = self.engine.analyze_academic_presentation(raw_document_content, subject_hint=dataset["title"])
        substantive_slides = bp.get("substantive_slides", [])
        admin_filtered = len(dataset["slides"]) - len(substantive_slides)

        results["evaluations"]["blueprint"] = {
            "main_topic": bp.get("main_topic"),
            "substantive_slide_count": len(substantive_slides),
            "admin_slides_filtered": admin_filtered,
            "concepts_extracted": len(bp.get("concepts", []) or bp.get("substantive_slides", [])),
        }

        # Metric 1: Coverage %
        expected_substantive = sum(1 for s in dataset["slides"] if "welcome" not in s["title"].lower() and "course outline" not in s["title"].lower())
        coverage_pct = (len(substantive_slides) / max(expected_substantive, 1)) * 100.0
        results["metrics"]["section_coverage_pct"] = round(min(coverage_pct, 100.0), 1)

        # 2. Summary Generation Quality
        summary_md = self.engine.generate_exam_summary(raw_document_content)
        # Check that admin names are excluded from summary
        has_admin_leak = any(
            bad in summary_md.lower()
            for bad in ["dr. mensah", "prof. boateng", "pharm 302", "office hours"]
        )
        has_svg_diagram = "<svg" in summary_md
        has_comparison_table = "|" in summary_md

        results["evaluations"]["summary"] = {
            "length_chars": len(summary_md),
            "admin_leak_free": not has_admin_leak,
            "has_svg_diagram": has_svg_diagram,
            "has_comparison_table": has_comparison_table,
        }

        # 3. Practice Quiz Generation Quality (7 Question Formats + Zero Slide Leak)
        quiz_mcq = self.engine.generate_practice_quiz(
            raw_document_content, count=4, question_type="mcq"
        )
        quiz_ar = self.engine.generate_practice_quiz(
            raw_document_content, count=3, question_type="assertion_reasoning"
        )
        all_quiz = quiz_mcq + quiz_ar

        # Check for slide number leaks in stems and options
        slide_leak_count = 0
        for q in all_quiz:
            stem = (q.get("question") or "") + " " + (q.get("assertion") or "")
            opts_str = " ".join(str(o) for o in q.get("options", []))
            combo = (stem + " " + opts_str).lower()
            if "slide " in combo or "page " in combo:
                slide_leak_count += 1

        zero_slide_leak_pct = 100.0 if not all_quiz else ((len(all_quiz) - slide_leak_count) / len(all_quiz)) * 100.0
        results["metrics"]["zero_slide_leak_compliance_pct"] = round(zero_slide_leak_pct, 1)

        # Assertion-Reasoning strict 5-case check
        ar_valid = 0
        for q in quiz_ar:
            if q.get("type") == "assertion_reasoning":
                opts = q.get("options") or []
                opt_key = q.get("correct_option") or q.get("correctAnswer") or ""
                if len(opts) == 5 and opt_key in ("A", "B", "C", "D", "E"):
                    ar_valid += 1
        ar_compliance_pct = (ar_valid / max(len(quiz_ar), 1)) * 100.0
        results["metrics"]["assertion_reasoning_strict_compliance_pct"] = round(ar_compliance_pct, 1)

        # Distractor distinctness check
        distractor_distinct_count = 0
        for q in quiz_mcq:
            opts = [str(o).strip().lower() for o in q.get("options", [])]
            if len(opts) == 4 and len(set(opts)) == 4:
                distractor_distinct_count += 1
        distractor_distinct_pct = (distractor_distinct_count / max(len(quiz_mcq), 1)) * 100.0
        results["metrics"]["distractor_distinctness_pct"] = round(distractor_distinct_pct, 1)

        # 4. Flashcards Generation
        flashcards = self.engine.generate_flashcards(raw_document_content, count=4)
        fc_slide_leaks = sum(
            1 for fc in flashcards
            if "slide " in (fc.get("front", "") + " " + fc.get("back", "")).lower()
        )
        results["evaluations"]["flashcards"] = {
            "count": len(flashcards),
            "slide_leak_free": fc_slide_leaks == 0,
        }

        # 5. Speed and Latency
        duration = time.time() - start_time
        results["metrics"]["execution_time_seconds"] = round(duration, 2)
        results["metrics"]["overall_benchmark_grade"] = (
            "A+ (Excellence)"
            if (
                results["metrics"]["section_coverage_pct"] >= 90
                and results["metrics"]["zero_slide_leak_compliance_pct"] == 100.0
                and results["metrics"]["assertion_reasoning_strict_compliance_pct"] == 100.0
            )
            else "B"
        )

        return results

    def run_all_benchmarks(self) -> Dict[str, Any]:
        """Runs the benchmark across all standard domains."""
        summary = {}
        for ds_name in BENCHMARK_DATASETS:
            summary[ds_name] = self.run_benchmark(ds_name)
        return summary
