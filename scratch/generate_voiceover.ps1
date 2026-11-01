# LAMLA Guide AI - English Voiceover Audio Generator
# Uses Windows System.Speech.Synthesis with studio voice settings

Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer

# Prefer Microsoft Zira Desktop (clear, natural, professional English)
$voice = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Name -like "*Zira*" } | Select-Object -First 1
if ($voice) {
    $synth.SelectVoice($voice.VoiceInfo.Name)
    Write-Host "Selected Voice: $($voice.VoiceInfo.Name)"
} else {
    Write-Host "Using Default Voice"
}

$synth.Rate = 0  # Normal, clear, well-paced speaking speed
$synth.Volume = 100

$audioDir = "C:\Users\dell\.gemini\antigravity\scratch\lamla-guide-web\scratch\audio"

$scripts = @(
    @{
        Id = "scene_01"
        Text = "Welcome to LAMLA Guide AI, the intelligent, all-in-one educational platform engineered for Senior High School, University students, and independent learners. In this comprehensive walkthrough, we will explore every part of the platform, show what each section does, and demonstrate how LAMLA Guide AI empowers your daily learning."
    },
    @{
        Id = "scene_02"
        Text = "The home page provides a clean, modern, and predominantly white design with subtle blue accents and zero visual clutter. The top navigation bar gives students instant access to the personal dashboard, practice quizzes, live class circles, flashcards, and the study planner, ensuring effortless navigation on both desktop and mobile devices."
    },
    @{
        Id = "scene_03"
        Text = "The How It Works section details our core pedagogical methodology. In just three simple steps, students upload their lecture materials, receive comprehensive multi-slide analysis, interact with a conversational Socratic AI tutor, and practice with automated exam-style assessments."
    },
    @{
        Id = "scene_04"
        Text = "Student registration is streamlined and secure. When creating an account, learners choose their institution and study level. Right after signing up, the platform prompts the student to enable notifications, ensuring they never miss upcoming study sessions, spaced revision alerts, or live class quizzes."
    },
    @{
        Id = "scene_05"
        Text = "The personal dashboard is the student's central learning cockpit. At the top right, notice the foreground study timer. Unlike ordinary apps that allow passive background timing, our focus tracker measures your genuine revision exclusively while you are actively on the platform, automatically pausing when you switch away."
    },
    @{
        Id = "scene_06"
        Text = "Uploading your lecture slides is instant and cost-effective. Supporting PowerPoint, PDF, Word documents, and textbook photos, our zero-storage ingestion engine streams and indexes content on the fly, allowing millions of students to upload massive lecture decks without wasting server storage."
    },
    @{
        Id = "scene_07"
        Text = "Meet your personal AI Tutor. Unlike basic chatbots restricted only to slide text, our tutor is backed by open-domain academic knowledge and web enrichment. When students ask to visualize or draw a concept, the AI generates fully labeled, interactive vector SVG diagrams directly inside the chat interface."
    },
    @{
        Id = "scene_08"
        Text = "The practice quiz section enables students to generate up to fifty questions per slide, with guaranteed zero repeated questions across tests. When time expires or when you submit, each question is evaluated independently with step-by-step reasoning and misconception alerts."
    },
    @{
        Id = "scene_09"
        Text = "For collaborative learning, Live Class Circles connect entire classrooms in real time over WebSockets. Study groups compete in synchronized multiplayer quizzes where everyone receives questions simultaneously, timers count down together, and live scores update the circle leaderboard."
    },
    @{
        Id = "scene_10"
        Text = "Group leaders can schedule quizzes in advance with an exact launch date and time. Sharing a class invite link allows fellow classmates to preview the circle and join with one click. When the scheduled start time arrives, the live quiz launches automatically for all connected students."
    },
    @{
        Id = "scene_11"
        Text = "The study analytics section provides deep insights into mastery progress, subject strengths, and exam readiness. Students can track total focused hours, review confidence scores, and establish structured daily study routines tailored to their academic goals."
    },
    @{
        Id = "scene_12"
        Text = "LAMLA Guide AI is a full Progressive Web App. With a single tap, students can install it to their iPhone, Android, or PC home screen. It operates smoothly, caches offline resources with modern service workers, and provides an effortless native mobile experience."
    },
    @{
        Id = "scene_13"
        Text = "Protected by enterprise-grade OWASP security, rate limiting, and zero-lag performance optimizations, LAMLA Guide AI is completely ready for students and schools worldwide. Visit our website today to start learning smarter. Because at LAMLA Guide AI, It's Never Too Late To Study."
    }
)

foreach ($item in $scripts) {
    $outFile = Join-Path $audioDir "$($item.Id).wav"
    Write-Host "Synthesizing $($item.Id)..."
    $synth.SetOutputToWaveFile($outFile)
    $synth.Speak($item.Text)
}

$synth.Dispose()
Write-Host "All 13 voiceover chapters synthesized successfully!"
