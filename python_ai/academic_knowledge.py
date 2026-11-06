"""
LAMLA Guide AI - Unified Academic Knowledge Representation & Graph Engine
"It's Never Too Late To Study."

Constructs a multi-dimensional academic blueprint from uploaded lecture presentations,
PDFs, and textbooks. Consumed identically across Summary, Notes, Flashcards,
Practice Quizzes, and the AI Tutor to ensure shared conceptual grounding.

Features:
- Concept Node Extraction & Precursor-Successor Threading
- Multi-Stage Mechanism Flow Mapping
- Structure-Function-Application Triads
- Comparison Matrices (e.g., Sympathetic vs. Parasympathetic, Competitive vs. Non-competitive)
- Common Academic Misconceptions & Pitfalls
- Administrative Content Filtering (Lecturers, Greetings, Course Codes, Departmental info)
- Honest Document Coverage Tracking
"""

import re
import math
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Set, Tuple


# Administrative tokens that must never be presented as academic study content
ADMIN_PATTERNS = [
    r"\b(?:university|college|department|faculty|school|institute|polytechnic)\b",
    r"\b(?:lecturer|professor|instructor|tutor|dr\.|prof\.|presented by|course instructor)\b",
    r"\b(?:course code|course title|credit hours|semester|academic year|academic session)\b",
    r"\b(?:welcome to|thank you|any questions|questions\?|office hours|recommended textbooks?)\b",
    r"\b(?:table of contents|outline|course outline|overview of presentation)\b",
    r"\b(?:slide \d+ of \d+|all rights reserved|copyright \d{4})\b",
]

_ADMIN_REGEX = re.compile("|".join(ADMIN_PATTERNS), re.IGNORECASE)


@dataclass
class ConceptNode:
    name: str
    category: str  # definition, mechanism, classification, process, clinical_application, principle, formula
    slide_occurrences: List[int] = field(default_factory=list)
    precursor_concepts: List[str] = field(default_factory=list)
    successor_concepts: List[str] = field(default_factory=list)
    summary_definition: str = ""
    key_distinctions: List[str] = field(default_factory=list)
    source_quotes: List[str] = field(default_factory=list)
    is_fully_explained_in_source: bool = True
    needs_supplementary_context: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "category": self.category,
            "slides": self.slide_occurrences,
            "summary": self.summary_definition,
            "precursors": self.precursor_concepts,
            "successors": self.successor_concepts,
            "key_distinctions": self.key_distinctions,
            "fully_explained": self.is_fully_explained_in_source,
            "needs_supplementary": self.needs_supplementary_context,
        }


@dataclass
class MechanismStep:
    step_number: int
    stage_name: str
    description: str
    trigger_or_stimulus: str = ""
    intermediate_molecules_or_actors: List[str] = field(default_factory=list)
    consequence_or_output: str = ""
    slide_source: int = 1

    def to_dict(self) -> Dict[str, Any]:
        return {
            "step": self.step_number,
            "stage": self.stage_name,
            "description": self.description,
            "trigger": self.trigger_or_stimulus,
            "actors": self.intermediate_molecules_or_actors,
            "output": self.consequence_or_output,
            "slide": self.slide_source,
        }


@dataclass
class MechanismFlow:
    name: str
    steps: List[MechanismStep] = field(default_factory=list)
    physiological_or_realworld_significance: str = ""
    regulatory_factors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "steps": [s.to_dict() for s in self.steps],
            "significance": self.physiological_or_realworld_significance,
            "regulation": self.regulatory_factors,
        }


@dataclass
class ComparisonMatrix:
    subject_a: str
    subject_b: str
    dimension: str
    distinction_point: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "subject_a": self.subject_a,
            "subject_b": self.subject_b,
            "dimension": self.dimension,
            "distinction": self.distinction_point,
        }


@dataclass
class AcademicStructure:
    component_name: str
    location_or_anatomy: str
    composition_or_features: str
    functional_role: str
    clinical_or_practical_relevance: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.component_name,
            "location": self.location_or_anatomy,
            "composition": self.composition_or_features,
            "function": self.functional_role,
            "clinical_relevance": self.clinical_or_practical_relevance,
        }


@dataclass
class AcademicMisconception:
    pitfall: str
    correct_understanding: str
    why_confused: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "pitfall": self.pitfall,
            "correct_understanding": self.correct_understanding,
            "explanation": self.why_confused,
        }


@dataclass
class ExtractionCoverage:
    total_elements: int
    analyzed_elements: int
    visual_only_elements: List[int] = field(default_factory=list)
    unreadable_elements: List[int] = field(default_factory=list)
    coverage_percentage: float = 100.0
    honest_notes: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_slides_or_pages": self.total_elements,
            "analyzed_count": self.analyzed_elements,
            "visual_only_slides": self.visual_only_elements,
            "unreadable_slides": self.unreadable_elements,
            "coverage_percentage": round(self.coverage_percentage, 1),
            "honest_notes": self.honest_notes,
        }


@dataclass
class AcademicKnowledgeRepresentation:
    """
    The Single Unified Academic Blueprint for an uploaded document.
    """
    domain_topic: str
    summary_overview: str
    core_concepts: List[ConceptNode] = field(default_factory=list)
    mechanisms: List[MechanismFlow] = field(default_factory=list)
    comparisons: List[ComparisonMatrix] = field(default_factory=list)
    structures: List[AcademicStructure] = field(default_factory=list)
    misconceptions: List[AcademicMisconception] = field(default_factory=list)
    slide_source_map: Dict[int, str] = field(default_factory=dict)
    slide_titles: Dict[int, str] = field(default_factory=dict)
    coverage: ExtractionCoverage = field(default_factory=lambda: ExtractionCoverage(0, 0))
    administrative_filtered: List[str] = field(default_factory=list)
    high_yield_exam_targets: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "domain_topic": self.domain_topic,
            "summary_overview": self.summary_overview,
            "concepts": [c.to_dict() for c in self.core_concepts],
            "mechanisms": [m.to_dict() for m in self.mechanisms],
            "comparisons": [c.to_dict() for c in self.comparisons],
            "structures": [s.to_dict() for s in self.structures],
            "misconceptions": [m.to_dict() for m in self.misconceptions],
            "slide_count": len(self.slide_source_map),
            "coverage": self.coverage.to_dict(),
            "filtered_admin_items": self.administrative_filtered,
            "exam_targets": self.high_yield_exam_targets,
        }

    def render_blueprint_markdown(self) -> str:
        """
        Renders a clean, high-density academic blueprint Markdown representation
        used as master context for generating summaries, notes, flashcards, quizzes, and tutor chats.
        """
        lines = [
            f"# ACADEMIC BLUEPRINT: {self.domain_topic.upper()}",
            f"**Core Subject Scope**: {self.summary_overview}",
            f"**Coverage Fidelity**: {self.coverage.coverage_percentage:.1f}% across {self.coverage.total_elements} slides/pages.",
            "",
            "## 1. CORE ACADEMIC CONCEPTS",
        ]

        for c in self.core_concepts[:25]:
            status_tag = ""
            if c.needs_supplementary_context:
                status_tag = " *(Introduced in slides, requires supplementary academic explanation)*"
            slides_str = ", ".join(str(s) for s in c.slide_occurrences) or "Deck"
            lines.append(f"- **{c.name}** [{c.category.upper()}] (Slide {slides_str}){status_tag}")
            if c.summary_definition:
                lines.append(f"  - *Definition/Function*: {c.summary_definition}")
            if c.key_distinctions:
                lines.append(f"  - *Key Distinctions*: {'; '.join(c.key_distinctions)}")

        if self.mechanisms:
            lines.append("\n## 2. KEY MECHANISMS & STEP-BY-STEP PROCESSES")
            for m in self.mechanisms[:8]:
                lines.append(f"### Mechanism: {m.name}")
                if m.physiological_or_realworld_significance:
                    lines.append(f"*Significance*: {m.physiological_or_realworld_significance}")
                for s in m.steps:
                    actors = f" (Key factors: {', '.join(s.intermediate_molecules_or_actors)})" if s.intermediate_molecules_or_actors else ""
                    lines.append(f"  {s.step_number}. **{s.stage_name}**: {s.description}{actors} [Source: Slide {s.slide_source}]")

        if self.comparisons:
            lines.append("\n## 3. COMPARATIVE MATRICES & CRUCIAL DISTINCTIONS")
            lines.append("| Subject A | Subject B | Dimension | Crucial Difference |")
            lines.append("|---|---|---|---|")
            for comp in self.comparisons[:15]:
                lines.append(f"| {comp.subject_a} | {comp.subject_b} | {comp.dimension} | {comp.distinction_point} |")

        if self.misconceptions:
            lines.append("\n## 4. COMMON ACADEMIC MISCONCEPTIONS & PITFALLS")
            for misc in self.misconceptions[:8]:
                lines.append(f"- **Pitfall**: {misc.pitfall}")
                lines.append(f"  - **Correct Academic Reality**: {misc.correct_understanding}")
                if misc.why_confused:
                    lines.append(f"  - *Why Students Confuse It*: {misc.why_confused}")

        if self.high_yield_exam_targets:
            lines.append("\n## 5. HIGH-YIELD EXAMINATION TARGETS")
            for target in self.high_yield_exam_targets[:12]:
                lines.append(f"- {target}")

        return "\n".join(lines)


class AcademicKnowledgeBuilder:
    """
    Constructs an AcademicKnowledgeRepresentation from slide/page structures.
    Performs administrative stripping, concept graph building, mechanism detection,
    and cross-slide context linking.
    """

    @staticmethod
    def is_administrative_text(text: str) -> bool:
        """Determines if a paragraph or heading is purely administrative/introductory."""
        if not text:
            return False
        clean = text.strip()
        if len(clean) < 4:
            return True
        lines = [ln.strip() for ln in clean.split("\n") if ln.strip()]
        admin_match_count = sum(1 for ln in lines if _ADMIN_REGEX.search(ln))
        return (admin_match_count / max(len(lines), 1)) >= 0.5

    @classmethod
    def filter_administrative_content(
        cls, slides: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Filters out opening administrative slides (lecturer titles, university logos, course greetings)
        while preserving any academic concept introduced.
        """
        filtered_slides: List[Dict[str, Any]] = []
        admin_items_caught: List[str] = []

        for idx, slide in enumerate(slides):
            title = slide.get("title", "")
            content = slide.get("content", "")
            full_text = f"{title}\n{content}"

            # If slide 1 or 2 is purely department/lecturer info with zero academic definitions
            if idx in (0, 1) and cls.is_administrative_text(full_text):
                admin_items_caught.append(f"Slide {slide.get('slide_number', idx+1)} ({title})")
                continue

            # Strip administrative lines from the slide content
            cleaned_lines = []
            for line in content.split("\n"):
                if _ADMIN_REGEX.search(line) and not re.search(r"\b(?:mechanism|function|receptor|enzyme|formula|theorem|law)\b", line, re.I):
                    admin_items_caught.append(line[:60])
                else:
                    cleaned_lines.append(line)

            cleaned_slide = dict(slide)
            cleaned_slide["content"] = "\n".join(cleaned_lines).strip()
            filtered_slides.append(cleaned_slide)

        return filtered_slides, admin_items_caught

    @classmethod
    def build_from_parsed_document(
        cls,
        doc_data: Dict[str, Any],
        domain_hint: str = ""
    ) -> AcademicKnowledgeRepresentation:
        """
        Constructs the complete AcademicKnowledgeRepresentation from document_processor output.
        """
        raw_slides = doc_data.get("slides") or doc_data.get("pages") or []
        doc_type = doc_data.get("document_type", "document")
        total_count = len(raw_slides)

        # 1. Filter Administrative Cruft
        clean_slides, admin_filtered = cls.filter_administrative_content(raw_slides)

        # 2. Extract Document Topic and Overview
        topic = domain_hint or doc_data.get("title", "Academic Subject")
        topic = re.sub(r"\.(?:pptx?|pdf|docx?|txt)$", "", topic, flags=re.IGNORECASE)
        topic = re.sub(r"^[0-9_\-\s]+", "", topic)
        if topic.lower() in ("document", "presentation", "slide image", "pasted notes"):
            # Derive topic from first non-administrative slide title
            for s in clean_slides:
                t = s.get("title", "").strip()
                if t and not _ADMIN_REGEX.search(t):
                    topic = t
                    break

        # 3. Slide Source Mapping & Tracking
        slide_source_map: Dict[int, str] = {}
        slide_titles: Dict[int, str] = {}
        unreadable_slides: List[int] = doc_data.get("unreadable_slides", []) or doc_data.get("unreadable_pages", [])
        visual_only_slides: List[int] = []

        for s in clean_slides:
            num = s.get("slide_number") or s.get("page_number") or 1
            content = s.get("content", "")
            slide_source_map[num] = content
            slide_titles[num] = s.get("title", f"Slide {num}")
            if s.get("has_visual_warning"):
                visual_only_slides.append(num)

        # Calculate Honest Coverage
        processed_count = max(total_count - len(unreadable_slides), 0)
        coverage_pct = (processed_count / max(total_count, 1)) * 100.0 if total_count > 0 else 100.0
        honest_notes = []
        if unreadable_slides:
            honest_notes.append(
                f"Slide(s)/Page(s) {', '.join(str(n) for n in unreadable_slides)} contained visual-only graphics or scans with low OCR selectable text."
            )

        coverage = ExtractionCoverage(
            total_elements=total_count,
            analyzed_elements=processed_count,
            visual_only_elements=visual_only_slides,
            unreadable_elements=unreadable_slides,
            coverage_percentage=coverage_pct,
            honest_notes=honest_notes,
        )

        # 4. Multi-Slide Concept Extraction & Threading
        concept_nodes: List[ConceptNode] = []
        concept_index: Dict[str, ConceptNode] = {}
        full_text = doc_data.get("full_text", "")

        # Candidate detection: capitalized multi-word terms, bold items, definition patterns
        def_pattern = re.compile(
            r"(?:^|\n)\s*(?:•|\*|-)?\s*([A-Z][a-zA-Z0-9\-\s]{2,40}?)\s*(?::|—|-|\bis\s+defined\s+as\b|\brefers\s+to\b)\s*([^\n\.]+)",
            re.MULTILINE
        )

        for s in clean_slides:
            s_num = s.get("slide_number") or s.get("page_number") or 1
            s_content = s.get("content", "")
            s_title = s.get("title", "")

            # Look for definitions
            for m in def_pattern.finditer(s_content):
                term = m.group(1).strip()
                meaning = m.group(2).strip()
                if _ADMIN_REGEX.search(term) or len(term) < 3 or len(meaning) < 10:
                    continue
                term_lower = term.lower()
                if term_lower not in concept_index:
                    node = ConceptNode(
                        name=term,
                        category="definition",
                        slide_occurrences=[s_num],
                        summary_definition=meaning,
                        source_quotes=[f"Slide {s_num}: {term} - {meaning}"]
                    )
                    concept_index[term_lower] = node
                    concept_nodes.append(node)
                else:
                    existing = concept_index[term_lower]
                    if s_num not in existing.slide_occurrences:
                        existing.slide_occurrences.append(s_num)

            # Look for classification lists (e.g., Types of X, Classes of Y)
            class_matches = re.findall(r"(?:Types|Classification|Categories|Classes|Subtypes)\s+of\s+([A-Za-z\s]+)", s_title + " " + s_content, re.I)
            for cm in class_matches:
                cm_term = cm.strip()
                if cm_term and not _ADMIN_REGEX.search(cm_term) and len(cm_term) > 3:
                    cm_lower = cm_term.lower()
                    if cm_lower not in concept_index:
                        node = ConceptNode(
                            name=cm_term,
                            category="classification",
                            slide_occurrences=[s_num],
                            summary_definition=f"Taxonomy and classification framework for {cm_term}.",
                        )
                        concept_index[cm_lower] = node
                        concept_nodes.append(node)

        # 5. Extract Step-by-Step Mechanisms
        mechanisms: List[MechanismFlow] = []
        step_pattern = re.compile(r"(?:^|\n)\s*(?:Step\s*\d+|\d+[\.\)])\s*([^\n]+)", re.IGNORECASE)
        for s in clean_slides:
            s_num = s.get("slide_number") or s.get("page_number") or 1
            s_content = s.get("content", "")
            s_title = s.get("title", "")

            # If title or content suggests a mechanism or cycle or pathway
            is_mech = bool(re.search(r"\b(?:mechanism|pathway|cascade|cycle|synthesis|action|sequence|stages?)\b", s_title, re.I))
            step_matches = step_pattern.findall(s_content)
            if (is_mech or len(step_matches) >= 3) and step_matches:
                steps: List[MechanismStep] = []
                for idx, sm in enumerate(step_matches, start=1):
                    stage_title = sm.split(":", 1)[0].strip() if ":" in sm else f"Stage {idx}"
                    steps.append(MechanismStep(
                        step_number=idx,
                        stage_name=stage_title[:40],
                        description=sm.strip(),
                        slide_source=s_num
                    ))
                mech_name = s_title if is_mech else f"Process of {s_title}"
                mechanisms.append(MechanismFlow(
                    name=mech_name,
                    steps=steps,
                    physiological_or_realworld_significance=f"Detailed in Slide {s_num} regarding {mech_name}."
                ))

        # 6. Extract Comparisons (vs, compared with, differs from)
        comparisons: List[ComparisonMatrix] = []
        comp_pattern = re.compile(r"([A-Za-z0-9\s\-]+)\s+(?:vs\.?|versus|compared\s+(?:to|with)|distinction\s+between)\s+([A-Za-z0-9\s\-]+)", re.IGNORECASE)
        for s in clean_slides:
            s_num = s.get("slide_number") or s.get("page_number") or 1
            s_content = s.get("content", "")
            for match in comp_pattern.finditer(s_content):
                sub_a = match.group(1).strip()
                sub_b = match.group(2).strip()
                if len(sub_a) > 2 and len(sub_b) > 2 and not _ADMIN_REGEX.search(sub_a) and not _ADMIN_REGEX.search(sub_b):
                    comparisons.append(ComparisonMatrix(
                        subject_a=sub_a[:35],
                        subject_b=sub_b[:35],
                        dimension=f"Functional & Structural Contrast (Slide {s_num})",
                        distinction_point=f"Direct contrast established in source Slide {s_num}."
                    ))

        # 7. High-Yield Exam Targets
        exam_targets: List[str] = []
        for c in concept_nodes[:10]:
            exam_targets.append(f"Definition, mechanism, and clinical/practical significance of {c.name}")
        for m in mechanisms[:5]:
            exam_targets.append(f"Sequential stages and rate-limiting factors in {m.name}")
        for comp in comparisons[:5]:
            exam_targets.append(f"Differential diagnostic / functional comparison between {comp.subject_a} and {comp.subject_b}")

        # Summary Overview
        first_few = [c.name for c in concept_nodes[:6]]
        if first_few:
            overview = f"Core academic curriculum covering {topic}, specifically investigating {', '.join(first_few)}."
        else:
            overview = f"Structured academic curriculum on {topic}."

        return AcademicKnowledgeRepresentation(
            domain_topic=topic,
            summary_overview=overview,
            core_concepts=concept_nodes,
            mechanisms=mechanisms,
            comparisons=comparisons,
            structures=[],
            misconceptions=[],
            slide_source_map=slide_source_map,
            slide_titles=slide_titles,
            coverage=coverage,
            administrative_filtered=admin_filtered,
            high_yield_exam_targets=exam_targets,
        )
