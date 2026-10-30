"""
LAMLA Guide AI - Educational Video Curator & YouTube Verifier (Python Engine)
Slogan: "It's Never Too Late To Study."
Verifies every candidate video with YouTube oEmbed to guarantee authentic titles, creators, and thumbnails.
"""

import json
import urllib.request
import urllib.parse
from typing import List, Dict, Any, Optional

CANONICAL_VIDEOS = [
    {
        "id": "OZG8M_ldA1M",
        "keywords": ["nervous", "neuron", "action potential", "depolarization", "membrane", "synapse"],
        "topic": "Action Potentials & The Nervous System",
        "default_channel": "CrashCourse",
        "reason": "Exhaustive animated breakdown of resting membrane potential, voltage-gated sodium/potassium channels, and refractory periods.",
    },
    {
        "id": "pBg58FvV_m8",
        "keywords": ["cardiac", "heart", "action potential", "pacemaker", "sa node", "cardiovascular", "ventricular"],
        "topic": "Cardiac Action Potential & Electrophysiology",
        "default_channel": "Ninja Nerd",
        "reason": "In-depth medical breakdown detailing the 5 distinct phases (Phase 0 to Phase 4) of ventricular muscle and nodal tissue depolarization.",
    },
    {
        "id": "IS9TD9fSvW8",
        "keywords": ["cardiac cycle", "systole", "diastole", "heart sounds", "valve", "wiggers"],
        "topic": "The Cardiac Cycle & Pressure Changes",
        "default_channel": "Ninja Nerd",
        "reason": "Step-by-step clinical walkthrough of ventricular systole, diastole, pressure-volume loops, and valve mechanics.",
    },
    {
        "id": "-rsYk4eCKnA",
        "keywords": ["respiration", "cellular respiration", "atp", "glycolysis", "krebs", "mitochondria", "electron transport"],
        "topic": "Cellular Respiration & ATP Synthesis",
        "default_channel": "Amoeba Sisters",
        "reason": "Clear, visual explanation of glycolysis, the citric acid cycle, and oxidative phosphorylation.",
    },
    {
        "id": "g78utcLQrJ4",
        "keywords": ["photosynthesis", "chloroplast", "calvin", "light reactions", "thylakoid", "chlorophyll"],
        "topic": "Photosynthesis: Light & Dark Reactions",
        "default_channel": "Amoeba Sisters",
        "reason": "Explains how photosystems harvest light energy to produce ATP/NADPH and synthesize glucose.",
    },
    {
        "id": "g9aDizJpd_s",
        "keywords": ["demand", "supply", "equilibrium", "market", "shortage", "surplus", "price mechanism"],
        "topic": "Supply, Demand & Market Equilibrium",
        "default_channel": "CrashCourse",
        "reason": "Explains why demand curves slope downward, shifts vs movements along curves, and market-clearing equilibrium.",
    },
    {
        "id": "kUPm2tMCbGE",
        "keywords": ["elasticity", "price elasticity", "inelastic", "demand elasticity"],
        "topic": "Price Elasticity of Demand & Revenue",
        "default_channel": "Marginal Revolution University",
        "reason": "Breaks down the percentage change formula, determinants of elasticity, and its relationship to total revenue.",
    },
    {
        "id": "d8uTB5XorBw",
        "keywords": ["macroeconomics", "gdp", "gross domestic", "inflation", "unemployment", "recession"],
        "topic": "Macroeconomics: GDP & Economic Growth",
        "default_channel": "CrashCourse",
        "reason": "Covers the components of GDP (C + I + G + NX), real versus nominal GDP, and standard business cycles.",
    },
    {
        "id": "CGA8sRwqIFg",
        "keywords": ["covalent", "ionic", "bonding", "lewis", "octet", "electronegativity", "valence"],
        "topic": "Chemical Bonding: Ionic vs Covalent",
        "default_channel": "The Organic Chemistry Tutor",
        "reason": "Visual walkthrough of electron sharing vs transfer, electronegativity differences, and Lewis dot structures.",
    },
    {
        "id": "WUvTyaaNkzM",
        "keywords": ["calculus", "derivative", "differential", "tangent", "rate of change", "limit"],
        "topic": "The Essence of Calculus & Derivatives",
        "default_channel": "3Blue1Brown",
        "reason": "World-renowned visual animations showing why derivatives represent instantaneous rates of change.",
    },
]


def verify_youtube_video(video_id: str) -> Optional[Dict[str, str]]:
    """
    Verifies a YouTube video via YouTube's official oEmbed endpoint.
    Returns metadata dict if video exists and is public, or None if unavailable.
    """
    if not video_id or len(video_id) < 5:
        return None
    url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    req = urllib.request.Request(url, headers={"User-Agent": "LAMLA-Guide-AI-Verifier/1.0"})

    try:
        with urllib.request.urlopen(req, timeout=4) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                return {
                    "title": data.get("title", ""),
                    "author_name": data.get("author_name", ""),
                    "thumbnail_url": data.get("thumbnail_url", f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"),
                }
    except Exception:
        pass
    return None


def curate_videos_for_text(title: str, text: str) -> Dict[str, Any]:
    """
    Curates and verifies 2 to 3 educational YouTube videos for uploaded study text.
    """
    corpus = f"{title} {text[:10000]}".lower()

    scored = []
    for item in CANONICAL_VIDEOS:
        score = sum(3 for kw in item["keywords"] if kw.lower() in corpus)
        if score > 0:
            scored.append((score, item))

    scored.sort(key=lambda x: x[0], reverse=True)
    candidates = [x[1] for x in scored[:5]]

    if not candidates:
        candidates = [CANONICAL_VIDEOS[0], CANONICAL_VIDEOS[5]]

    verified = []
    for c in candidates:
        if len(verified) >= 3:
            break
        meta = verify_youtube_video(c["id"])
        if meta and meta["title"]:
            verified.append({
                "id": c["id"],
                "title": meta["title"],
                "channel_title": meta["author_name"] or c["default_channel"],
                "thumbnail_url": meta["thumbnail_url"],
                "youtube_url": f"https://www.youtube.com/watch?v={c['id']}",
                "embed_url": f"https://www.youtube-nocookie.com/embed/{c['id']}",
                "topic": c["topic"],
                "relevance_reason": c["reason"],
                "verified": True,
            })

    main_topic = candidates[0]["topic"] if candidates else title

    return {
        "success": True,
        "main_topic": main_topic,
        "videos": verified[:3],
    }
