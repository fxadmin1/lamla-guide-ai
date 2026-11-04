# LAMLA Guide AI - Natural Human English Voiceover Generator
# Uses Microsoft Mark (WinRT OneCore) with conversational SSML cadence and studio acoustics mastering

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
Function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}

[Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime] | Out-Null
$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer

# Select Microsoft Mark (modern, smooth, natural male narrator voice)
$voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.DisplayName -like "*Mark*" } | Select-Object -First 1
if ($voice) {
    $synth.Voice = $voice
    Write-Host "Selected Natural Voice: $($voice.DisplayName)"
} else {
    Write-Host "Mark voice not found, using default voice"
}

$ffmpeg = "C:\Users\dell\AppData\Local\Packages\PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0\LocalCache\local-packages\Python313\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"
$audioDir = "C:\Users\dell\.gemini\antigravity\scratch\lamla-guide-web\scratch\audio"

$scripts = @(
    @{
        Id = "scene_01"
        RawText = "Welcome to LAMLA Guide AI! It's never too late to study. Whether you're preparing for your high school finals, tackling tough university coursework, or learning independently, we built this platform to make studying feel natural, fast, and genuinely rewarding. In this video, we're going to walk through every part of the website together, so you can see exactly how it works."
        Ssml = @"
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
    <prosody rate="0.92" pitch="-1Hz">
        Welcome to LAMLA Guide AI! <break time="300ms"/> It's never too late to study. <break time="350ms"/>
        Whether you're preparing for your high school finals, tackling tough university coursework, or learning independently, <break time="200ms"/>
        we built this platform to make studying feel natural, fast, and genuinely rewarding. <break time="350ms"/>
        In this video, we're going to walk through every part of the website together, so you can see exactly how it works.
    </prosody>
</speak>
"@
    },
    @{
        Id = "scene_02"
        RawText = "Right here on the home page, the first thing you'll notice is how clean and open everything feels. We designed it with a crisp white look and subtle blue accents, keeping all distractions out of your way. At the top, you can jump straight to your dashboard, practice quizzes, live study circles, flashcards, or the study planner in a single click."
        Ssml = @"
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
    <prosody rate="0.92" pitch="-1Hz">
        Right here on the home page, the first thing you'll notice is how clean and open everything feels. <break time="300ms"/>
        We designed it with a crisp white look and subtle blue accents, keeping all distractions out of your way. <break time="300ms"/>
        At the top, you can jump straight to your dashboard, practice quizzes, live study circles, flashcards, or the study planner in a single click.
    </prosody>
</speak>
"@
    },
    @{
        Id = "scene_03"
        RawText = "So, how does it all work? It's simple. First, you upload your lecture slides or notes. Next, our AI instantly indexes every concept, diagram, and definition. Then, you explore and ask questions with your personal tutor. And finally, you test yourself with targeted practice quizzes to make sure everything sticks."
        Ssml = @"
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
    <prosody rate="0.92" pitch="-1Hz">
        So, how does it all work? It's simple. <break time="350ms"/>
        First, you upload your lecture slides or notes. <break time="250ms"/>
        Next, our AI instantly indexes every concept, diagram, and definition. <break time="250ms"/>
        Then, you explore and ask questions with your personal tutor. <break time="250ms"/>
        And finally, you test yourself with targeted practice quizzes to make sure everything sticks.
    </prosody>
</speak>
"@
    },
    @{
        Id = "scene_04"
        RawText = "Getting started takes just seconds. You can choose your institution, select your level of study, and create your account securely. Right after signing up, the browser asks if you'd like study reminders, so you never miss an upcoming revision session, spaced repetition prompt, or live group quiz."
        Ssml = @"
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
    <prosody rate="0.92" pitch="-1Hz">
        Getting started takes just seconds. <break time="300ms"/>
        You can choose your institution, select your level of study, and create your account securely. <break time="300ms"/>
        Right after signing up, the browser asks if you'd like study reminders, <break time="200ms"/>
        so you never miss an upcoming revision session, spaced repetition prompt, or live group quiz.
    </prosody>
</speak>
"@
    },
    @{
        Id = "scene_05"
        RawText = "Here inside your dashboard, you have a complete birds-eye view of your study life. Look at the top right: that's our Foreground Study Tracker. It only counts time when you're actively on the website. If you switch tabs or leave, it pauses immediately. That means no fake hours, just real, honest progress."
        Ssml = @"
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
    <prosody rate="0.92" pitch="-1Hz">
        Here inside your dashboard, you have a complete bird's-eye view of your study life. <break time="300ms"/>
        Look at the top right: that's our Foreground Study Tracker. <break time="250ms"/>
        It only counts time when you're actively on the website. <break time="200ms"/>
        If you switch tabs or leave, it pauses immediately. <break time="300ms"/>
        That means no fake hours, just real, honest progress.
    </prosody>
</speak>
"@
    },
    @{
        Id = "scene_06"
        RawText = "When it comes to your study materials, you can drop in PowerPoint slides, PDFs, Word documents, or even photos of textbook pages. What's amazing is our zero-storage engine: it reads and analyzes everything in real time without filling up expensive cloud servers, making the platform fast and accessible for millions of students."
        Ssml = @"
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
    <prosody rate="0.92" pitch="-1Hz">
        When it comes to your study materials, you can drop in PowerPoint slides, PDFs, Word documents, or even photos of textbook pages. <break time="300ms"/>
        What's amazing is our zero-storage engine: <break time="250ms"/>
        it reads and analyzes everything in real time without filling up expensive cloud servers, <break time="200ms"/>
        making the platform fast and accessible for millions of students.
    </prosody>
</speak>
"@
    },
    @{
        Id = "scene_07"
        RawText = "Meet your personal AI tutor! This isn't a basic bot that only repeats what's on your slides. It has broad academic knowledge and can explain concepts at your exact level. Best of all, if you ask it to visualize or draw something, it generates clear, labeled vector diagrams right inside your chat!"
        Ssml = @"
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
    <prosody rate="0.92" pitch="-1Hz">
        Meet your personal AI tutor! <break time="300ms"/>
        This isn't a basic bot that only repeats what's on your slides. <break time="250ms"/>
        It has broad academic knowledge, and can explain concepts at your exact level. <break time="300ms"/>
        Best of all, if you ask it to visualize or draw something, <break time="200ms"/>
        it generates clear, labeled vector diagrams right inside your chat!
    </prosody>
</speak>
"@
    },
    @{
        Id = "scene_08"
        RawText = "Ready to test your knowledge? Our practice quiz generator can create up to fifty questions per slide, with guaranteed zero duplicate questions. When you finish, every single answer is marked independently with clear explanations and misconception alerts to help you learn from any mistakes."
        Ssml = @"
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
    <prosody rate="0.92" pitch="-1Hz">
        Ready to test your knowledge? <break time="250ms"/>
        Our practice quiz generator can create up to fifty questions per slide, with guaranteed zero duplicate questions. <break time="300ms"/>
        When you finish, every single answer is marked independently with clear explanations and misconception alerts, <break time="200ms"/>
        to help you learn from any mistakes.
    </prosody>
</speak>
"@
    },
    @{
        Id = "scene_09"
        RawText = "Studying with friends is where the platform really comes alive. In Live Class Circles, entire classrooms can join real-time multiplayer quizzes. Everyone sees questions at the exact same second, countdown timers run in sync, and live scores update the leaderboard as you compete."
        Ssml = @"
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
    <prosody rate="0.92" pitch="-1Hz">
        Studying with friends is where the platform really comes alive. <break time="300ms"/>
        In Live Class Circles, entire classrooms can join real-time multiplayer quizzes. <break time="250ms"/>
        Everyone sees questions at the exact same second, countdown timers run in sync, <break time="200ms"/>
        and live scores update the leaderboard as you compete.
    </prosody>
</speak>
"@
    },
    @{
        Id = "scene_10"
        RawText = "Class leaders can also schedule quizzes in advance. You can set the exact date and time, share a quick invite link with your classmates, and let them preview the circle details. When start time arrives, the live quiz launches automatically for everyone who joined."
        Ssml = @"
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
    <prosody rate="0.92" pitch="-1Hz">
        Class leaders can also schedule quizzes in advance. <break time="300ms"/>
        You can set the exact date and time, share a quick invite link with your classmates, and let them preview the circle details. <break time="300ms"/>
        When start time arrives, the live quiz launches automatically for everyone who joined.
    </prosody>
</speak>
"@
    },
    @{
        Id = "scene_11"
        RawText = "Over in analytics, you can see exactly where you stand before exam day. The platform visualizes your focused study hours, pinpoints your strongest and weakest topics, and creates structured daily routines to help you stay confident and avoid last-minute cramming."
        Ssml = @"
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
    <prosody rate="0.92" pitch="-1Hz">
        Over in analytics, you can see exactly where you stand before exam day. <break time="300ms"/>
        The platform visualizes your focused study hours, pinpoints your strongest and weakest topics, <break time="200ms"/>
        and creates structured daily routines to help you stay confident and avoid last-minute cramming.
    </prosody>
</speak>
"@
    },
    @{
        Id = "scene_12"
        RawText = "You can also install LAMLA Guide AI directly on your phone or computer as a Progressive Web App! Just tap 'Add to Home Screen' on your iPhone or Android. It loads instantly, caches resources for offline review, and feels like a native app without eating up your storage."
        Ssml = @"
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
    <prosody rate="0.92" pitch="-1Hz">
        You can also install LAMLA Guide AI directly on your phone or computer as a Progressive Web App! <break time="300ms"/>
        Just tap 'Add to Home Screen' on your iPhone or Android. <break time="250ms"/>
        It loads instantly, caches resources for offline review, <break time="200ms"/>
        and feels like a native app without eating up your storage.
    </prosody>
</speak>
"@
    },
    @{
        Id = "scene_13"
        RawText = "Behind the scenes, the entire system is built with bulletproof security, anti-DDoS rate limiting, and zero-lag performance so that thousands of students can study simultaneously without a hitch. Start your journey with LAMLA Guide AI today, because it's never too late to study!"
        Ssml = @"
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
    <prosody rate="0.92" pitch="-1Hz">
        Behind the scenes, the entire system is built with bulletproof security, anti-DDoS rate limiting, and zero-lag performance, <break time="250ms"/>
        so that thousands of students can study simultaneously without a hitch. <break time="350ms"/>
        Start your journey with LAMLA Guide AI today, <break time="250ms"/>
        because it's never too late to study!
    </prosody>
</speak>
"@
    }
)

Write-Host "Synthesizing 13 Natural Human Voiceover Chapters with Studio Mastering..."

foreach ($item in $scripts) {
    $tempWav = Join-Path $audioDir "$($item.Id)_raw.wav"
    $finalWav = Join-Path $audioDir "$($item.Id).wav"
    
    # 1. Synthesize via WinRT with SSML
    $streamOp = $synth.SynthesizeSsmlToStreamAsync($item.Ssml)
    $stream = Await $streamOp ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
    
    $reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
    $loadOp = $reader.LoadAsync($stream.Size)
    $netTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0].MakeGenericMethod([uint32]).Invoke($null, @($loadOp))
    $netTask.Wait(-1) | Out-Null
    $bytes = New-Object byte[] $stream.Size
    $reader.ReadBytes($bytes)
    [System.IO.File]::WriteAllBytes($tempWav, $bytes)
    
    # 2. Master via FFmpeg for warm human studio acoustics
    $af = "highpass=f=80,equalizer=f=220:width_type=o:width=1.2:g=3.5,equalizer=f=3000:width_type=o:width=1.0:g=-2.5,compand=attacks=0.03:decays=0.3:points=-60/-60|-24/-12|-12/-4|0/-1,aecho=0.8:0.7:25:0.12,aresample=44100"
    & $ffmpeg -y -i $tempWav -af $af $finalWav 2>$null
    
    Remove-Item $tempWav -ErrorAction SilentlyContinue
    
    $sz = (Get-Item $finalWav).Length
    Write-Host "  [OK] $($item.Id).wav mastered ($([math]::Round($sz/1024, 1)) KB)"
}

$synth.Dispose()
Write-Host "All 13 Human Voiceover Chapters synthesized and mastered successfully!"
