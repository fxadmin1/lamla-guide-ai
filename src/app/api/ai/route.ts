import { NextRequest, NextResponse } from "next/server";
import { 
  generateSummaryWithAI, 
  generateQuestionsWithAI, 
  askStudyTutorWithAI, 
  generateStudyNotesWithAI,
  generateFlashcardsWithAI,
  generateDetailedExplanationWithAI,
  extractTextFromImageWithAI,
  explainThreeWaysWithAI,
  evaluateActiveRecallWithAI,
  generateTeachMeFromZeroWithAI,
  regenerateNotesSectionWithAI,
  getCandidatePythonUrls,
} from "@/lib/gemini";
import { curateEducationalVideos } from "@/lib/videoCurator";
import { generateLocalExamPlan, calculateLocalSpacedRepetition } from "@/lib/studyScheduler";

// Helper to attempt communication with the Python AI Engine across candidate runtime ports
async function callPythonAI(endpoint: string, method: string = "POST", body?: any, timeoutMs: number = 30000) {
  let lastErr: any = null;
  for (const base of getCandidatePythonUrls()) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${base}${endpoint}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        return await res.json();
      }
      const errText = await res.text();
      lastErr = new Error(`Python API (${base}) responded ${res.status}: ${errText}`);
    } catch (err: any) {
      clearTimeout(timer);
      lastErr = err;
    }
  }
  throw lastErr || new Error("Python AI engine unreachable across all candidate ports.");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "provider_status" || !action) {
    try {
      const data = await callPythonAI("/api/provider-status", "GET", undefined, 5000);
      return NextResponse.json({ success: true, ...data, python_online: true });
    } catch (err: any) {
      console.warn("callPythonAI failure in route.ts:", err?.message || err);
      return NextResponse.json({
        success: true,
        python_online: false,
        mode: "hosted_fallback",
        active_model: "gemini-flash (Direct Hosted)",
        ollama_online: false,
        zero_paid_api_enforced: false,
        error_detail: String(err?.message || err),
      });
    }

  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, content, options } = body;

    if (!action) {
      return NextResponse.json({ error: "Missing 'action' parameter." }, { status: 400 });
    }

    // ─── PROVIDER MODE CONTROL ───
    if (action === "set_provider_mode") {
      try {
        const pyRes = await callPythonAI("/api/set-provider-mode", "POST", { mode: options?.mode });
        return NextResponse.json({ success: true, ...pyRes });
      } catch (err: any) {
        return NextResponse.json({ error: "Failed to set provider mode on Python AI engine: " + err.message }, { status: 500 });
      }
    }

    if (action === "provider_status") {
      try {
        const data = await callPythonAI("/api/provider-status", "GET", undefined, 3000);
        return NextResponse.json({ success: true, ...data, python_online: true });
      } catch {
        return NextResponse.json({
          success: true,
          python_online: false,
          mode: "hosted_fallback",
          active_model: "gemini-flash (Direct Hosted)",
          ollama_online: false,
          zero_paid_api_enforced: false,
        });
      }
    }

    // ─── EXAM-ORIENTED SUMMARY ───
    if (action === "summary") {
      if (!content) return NextResponse.json({ error: "Content is required for summary generation." }, { status: 400 });
      const style = options?.style || "Exam-Oriented";
      const level = options?.educationalLevel || "Senior High School (SHS) & University";

      // 1. Try Python Engine
      try {
        const pyRes = await callPythonAI("/api/generate-summary", "POST", {
          content,
          document_title: options?.title || "Lecture Material",
          educational_level: level,
          style,
        });
        if (pyRes?.summary) {
          return NextResponse.json({ success: true, summary: pyRes.summary, handled_by: pyRes.handled_by });
        }
      } catch (e) {
        console.warn("Python engine unavailable for summary, falling back to direct Hosted AI.");
      }

      // 2. Fallback
      const result = await generateSummaryWithAI(content, style, level);
      return NextResponse.json({ success: true, summary: result, handled_by: "gemini-hosted-direct" });
    }

    // ─── STEP-BY-STEP EXPLANATION ───
    if (action === "explanation") {
      if (!content) return NextResponse.json({ error: "Content is required for explanation." }, { status: 400 });
      const level = options?.educationalLevel || "Senior High School (SHS) & University";

      try {
        const pyRes = await callPythonAI("/api/generate-explanation", "POST", {
          content,
          educational_level: level,
        });
        if (pyRes?.explanation) {
          return NextResponse.json({ success: true, explanation: pyRes.explanation, handled_by: pyRes.handled_by });
        }
      } catch (e) {
        console.warn("Python engine unavailable for explanation, falling back to direct Hosted AI.");
      }

      const explanation = await generateDetailedExplanationWithAI(content, level);
      return NextResponse.json({ success: true, explanation, handled_by: "gemini-hosted-direct" });
    }

    // ─── FLASHCARDS (Supports 10 to 200 cards) ───
    if (action === "flashcards") {
      if (!content) return NextResponse.json({ error: "Content is required for flashcards." }, { status: 400 });
      const count = Number(options?.count) || 10;

      try {
        const pyRes = await callPythonAI("/api/generate-flashcards", "POST", {
          content,
          count,
        });
        if (pyRes?.flashcards && pyRes.flashcards.length > 0) {
          return NextResponse.json({ success: true, flashcards: pyRes.flashcards, handled_by: pyRes.handled_by });
        }
      } catch (e) {
        console.warn("Python engine unavailable for flashcards, falling back to direct Hosted AI.");
      }

      const flashcards = await generateFlashcardsWithAI(content, count);
      return NextResponse.json({ success: true, flashcards, handled_by: "gemini-hosted-direct" });
    }

    // ─── PRACTICE QUIZ ───
    if (action === "quiz") {
      if (!content) return NextResponse.json({ error: "Content is required for quiz." }, { status: 400 });
      const count = Number(options?.count) || 5;
      const type = options?.type || "mcq";
      const difficulty = options?.difficulty || "intermediate";
      const level = options?.educationalLevel || "Senior High School (SHS)";
      const focusWeakTopics = options?.focusWeakTopics || null;

      try {
        const pyRes = await callPythonAI("/api/generate-quiz", "POST", {
          content,
          question_count: count,
          difficulty,
          question_type: type,
          focus_weak_topics: focusWeakTopics,
        });
        if (pyRes?.questions && pyRes.questions.length > 0) {
          return NextResponse.json({ success: true, questions: pyRes.questions, handled_by: pyRes.handled_by });
        }
      } catch (e) {
        console.warn("Python engine unavailable for quiz, falling back to direct Hosted AI.");
      }

      const questions = await generateQuestionsWithAI(content, count, type, difficulty, level);
      return NextResponse.json({ success: true, questions, handled_by: "gemini-hosted-direct" });
    }

    // ─── EXPLAIN THREE WAYS ───
    if (action === "explain_three_ways") {
      const concept = options?.concept || content;
      if (!concept) return NextResponse.json({ error: "Concept is required." }, { status: 400 });
      const context = options?.context || "";

      try {
        const pyRes = await callPythonAI("/api/explain-three-ways", "POST", {
          concept,
          context,
        });
        if (pyRes?.explanations) {
          return NextResponse.json({ success: true, ...pyRes });
        }
      } catch (e) {
        console.warn("Python engine unavailable for explain-three-ways, falling back.");
      }

      const explanations = await explainThreeWaysWithAI(concept, context);
      return NextResponse.json({ success: true, concept, explanations, handled_by: "gemini-hosted-direct" });
    }

    // ─── ACTIVE RECALL COACH EVALUATOR ───
    if (action === "active_recall_coach") {
      const question = options?.question || body.question;
      const studentAnswer = options?.student_answer || body.student_answer;
      if (!question || !studentAnswer) {
        return NextResponse.json({ error: "question and student_answer are required." }, { status: 400 });
      }
      const referenceText = options?.reference_text || content || "";

      try {
        const pyRes = await callPythonAI("/api/active-recall-coach", "POST", {
          question,
          student_answer: studentAnswer,
          reference_text: referenceText,
        });
        if (pyRes?.evaluation) {
          return NextResponse.json({ success: true, ...pyRes });
        }
      } catch (e) {
        console.warn("Python engine unavailable for active-recall-coach, falling back.");
      }

      const evaluation = await evaluateActiveRecallWithAI(question, studentAnswer, referenceText);
      return NextResponse.json({ success: true, evaluation, handled_by: "gemini-hosted-direct" });
    }

    // ─── STUDY NOTES ───
    if (action === "notes") {
      if (!content) return NextResponse.json({ error: "Content is required for study notes." }, { status: 400 });
      const subject = options?.subject || "General Science";
      const level = options?.educationalLevel || "Senior High School (SHS)";

      try {
        const pyRes = await callPythonAI("/api/generate-notes", "POST", {
          content,
          subject,
          educational_level: level,
        });
        if (pyRes?.notes) {
          return NextResponse.json({ success: true, notes: pyRes.notes, handled_by: pyRes.handled_by });
        }
      } catch (e) {
        console.warn("Python engine unavailable for notes, falling back.");
      }

      const notes = await generateStudyNotesWithAI(content, subject, level);
      return NextResponse.json({ success: true, notes, handled_by: "gemini-hosted-direct" });
    }

    // ─── REGENERATE SINGLE NOTES SECTION ───
    if (action === "regenerate_notes_section") {
      const sectionTitle = options?.section_title || body?.section_title || "";
      const currentSectionContent = options?.current_section_content || body?.current_section_content || "";
      const slideContext = options?.slide_context || body?.slide_context || content || "";
      const instruction = options?.instruction || body?.instruction || "standard_refresh";
      const level = options?.educationalLevel || body?.educationalLevel || "Senior High School (SHS) & University";

      if (!sectionTitle) {
        return NextResponse.json({ error: "section_title is required." }, { status: 400 });
      }

      try {
        const pyRes = await callPythonAI("/api/regenerate-notes-section", "POST", {
          section_title: sectionTitle,
          current_section_content: currentSectionContent,
          slide_context: slideContext,
          instruction,
          educational_level: level,
        });
        if (pyRes?.content) {
          return NextResponse.json({
            success: true,
            section_title: pyRes.section_title,
            content: pyRes.content,
            handled_by: pyRes.handled_by
          });
        }
      } catch (e) {
        console.warn("Python engine unavailable for regenerate-notes-section, falling back.");
      }

      const refreshed = await regenerateNotesSectionWithAI(sectionTitle, currentSectionContent, slideContext, instruction, level);
      return NextResponse.json({
        success: true,
        section_title: sectionTitle,
        content: refreshed,
        handled_by: "gemini-hosted-direct"
      });
    }

    // ─── EDUCATIONAL VIDEO RECOMMENDATIONS ───
    if (action === "curate_videos") {
      const docTitle = options?.title || body?.title || body?.documentTitle || "Study Session";
      const docText = content || body?.content || body?.extractedText || "";

      try {
        const pyRes = await callPythonAI("/api/curate-videos", "POST", {
          title: docTitle,
          content: docText,
        }, 5000);
        if (pyRes?.videos && pyRes.videos.length > 0) {
          const mappedVideos = pyRes.videos.map((v: any) => ({
            id: v.id,
            title: v.title,
            channelTitle: v.channel_title,
            thumbnailUrl: v.thumbnail_url,
            youtubeUrl: v.youtube_url,
            embedUrl: v.embed_url,
            topic: v.topic,
            relevanceReason: v.relevance_reason,
            verified: true,
          }));
          return NextResponse.json({
            success: true,
            mainTopic: pyRes.main_topic,
            videos: mappedVideos,
            handled_by: "python-video-curator"
          });
        }
      } catch (e) {
        console.warn("Python engine unavailable for video curation, falling back to Next.js curator.");
      }

      const res = await curateEducationalVideos(docTitle, docText);
      return NextResponse.json({
        success: true,
        mainTopic: res.mainTopic,
        videos: res.videos,
        searchShortcuts: res.searchShortcuts,
        handled_by: "nextjs-oembed-curator"
      });
    }

    // ─── EXAM STUDY PLAN GENERATOR ───
    if (action === "exam_plan") {
      const examSubject = options?.exam_subject || body?.exam_subject || "Core Course Exam";
      const examDate = options?.exam_date || body?.exam_date || new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
      const topics = options?.topics || body?.topics || [];

      try {
        const pyRes = await callPythonAI("/api/study-scheduler/plan", "POST", {
          exam_subject: examSubject,
          exam_date: examDate,
          topics: topics,
        });
        if (pyRes?.milestones) {
          return NextResponse.json({ ...pyRes, handled_by: "python-scheduler" });
        }
      } catch (e) {
        console.warn("Python engine unavailable for exam_plan, falling back to local planner.");
      }

      const plan = generateLocalExamPlan(examSubject, examDate, topics);
      return NextResponse.json({ success: true, ...plan, handled_by: "local-scheduler" });
    }

    // ─── SPACED REPETITION SCHEDULER ───
    if (action === "spaced_repetition") {
      const intervalStage = options?.interval_stage || body?.interval_stage || 1;
      const baseDate = options?.base_date || body?.base_date || null;

      try {
        const pyRes = await callPythonAI("/api/study-scheduler/spaced-repetition", "POST", {
          interval_stage: intervalStage,
          base_date: baseDate,
        });
        if (pyRes?.next_revision_date) {
          return NextResponse.json({ ...pyRes, handled_by: "python-scheduler" });
        }
      } catch (e) {
        console.warn("Python engine unavailable for spaced_repetition, falling back.");
      }

      const spaced = calculateLocalSpacedRepetition(intervalStage, baseDate);
      return NextResponse.json({ success: true, ...spaced, handled_by: "local-scheduler" });
    }

    // ─── STREAK HEALTH & SHIELD ───
    if (action === "streak_health") {
      const lastActive = options?.last_active_date || body?.last_active_date || null;
      const currentStreak = options?.current_streak || body?.current_streak || 0;
      const freezesLeft = options?.streak_freezes_left ?? body?.streak_freezes_left ?? 2;

      try {
        const pyRes = await callPythonAI("/api/study-scheduler/streak-health", "POST", {
          last_active_date: lastActive,
          current_streak: currentStreak,
          streak_freezes_left: freezesLeft,
        });
        if (pyRes?.status) {
          return NextResponse.json({ ...pyRes, handled_by: "python-scheduler" });
        }
      } catch (e) {
        console.warn("Python engine unavailable for streak_health.");
      }

      return NextResponse.json({
        success: true,
        status: "active_today",
        current_streak: currentStreak,
        shield_applied: false,
        freezes_left: freezesLeft,
        message: "Keep your daily momentum alive!",
        handled_by: "local-scheduler"
      });
    }


    // ─── TEACH ME FROM ZERO (FOUNDATIONS) ───
    if (action === "teach_zero") {
      if (!content) return NextResponse.json({ error: "Content is required for Teach Me From Zero." }, { status: 400 });
      const level = options?.educationalLevel || "Senior High School (SHS) & University";

      try {
        const pyRes = await callPythonAI("/api/generate-teach-zero", "POST", {
          content,
          educational_level: level,
        });
        if (pyRes?.teach_zero) {
          return NextResponse.json({ success: true, teach_zero: pyRes.teach_zero, handled_by: pyRes.handled_by });
        }
      } catch (e) {
        console.warn("Python engine unavailable for teach_zero, falling back.");
      }

      const teachZero = await generateTeachMeFromZeroWithAI(content, level);
      return NextResponse.json({ success: true, teach_zero: teachZero, handled_by: "gemini-hosted-direct" });
    }

    // ─── SOCRATIC AI TUTOR (MULTI-TURN, ACTION CHIPS & TEACHING MODES) ───
    if (action === "tutor") {
      const question = body.question || body.user_query || content;
      if (!question) return NextResponse.json({ error: "Question is required for AI tutor." }, { status: 400 });
      const context = options?.contextDocument || body.contextDocument || body.context_text || body.context || "";
      const level = options?.educationalLevel || body.educationalLevel || "University / SHS";
      const actionType = options?.actionType || body.actionType || null;
      const chatHistory = options?.chatHistory || body.chatHistory || [];
      const teachingMode = options?.teachingMode || body.teachingMode || body.teaching_mode || "socratic";

      try {
        const pyRes = await callPythonAI("/api/tutor", "POST", {
          user_query: question,
          context_text: context,
          educational_level: level,
          action_type: actionType,
          chat_history: chatHistory,
          teaching_mode: teachingMode,
        });
        if (pyRes?.answer) {
          return NextResponse.json({ success: true, answer: pyRes.answer, result: pyRes.answer, handled_by: pyRes.handled_by });
        }
      } catch (e) {
        console.warn("Python engine unavailable for tutor, falling back.");
      }

      const answer = await askStudyTutorWithAI(question, context, level, actionType, chatHistory, teachingMode);
      return NextResponse.json({ success: true, answer, result: answer, handled_by: "gemini-hosted-direct" });
    }

    // ─── VISION OCR ───
    if (action === "ocr") {
      const imageBase64 = body.imageBase64;
      const mimeType = body.mimeType || "image/jpeg";
      if (!imageBase64) {
        return NextResponse.json({ error: "imageBase64 is required for OCR extraction." }, { status: 400 });
      }
      const extractedText = await extractTextFromImageWithAI(imageBase64, mimeType);
      return NextResponse.json({ success: true, text: extractedText });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error("AI API Route Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process AI request." },
      { status: 500 }
    );
  }
}
