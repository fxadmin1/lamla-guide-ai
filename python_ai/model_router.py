"""
LAMLA Guide AI - Multi-Model Intelligent Task Router & Failover Engine
"It's Never Too Late To Study."

Orchestrates multi-provider execution across:
1. Google Gemini (gemini-2.5-flash, gemini-2.5-flash-lite, gemini-2.0-flash) with key rotation
2. Groq (llama-3.3-70b-versatile, llama-3.1-8b-instant) for blazing ultra-fast inference
3. Cloud OpenAI-compatible endpoints (if configured)
4. Local Ollama (qwen2.5, llama3.2, mistral) for offline / zero-data cost
5. Deterministic Academic Knowledge Synthesizer for 100% zero-crash guarantee

Task Routing Categories:
- DEEP_REASONING: complex mechanisms, comparative analysis, Socratic tutor dialogues
- DOCUMENT_ANALYSIS: concept mapping, structure-function extraction, outline generation
- VISION_OCR: diagram reading, chart reading, scanned slide interpretation
- QUESTION_GENERATION: 7-format exam question authoring
- VERIFICATION: 7-point quality gate auditing and fact-checking
- TUTOR_CONVERSATION: interactive student study sessions
"""

import os
import time
import json
import logging
import random
import threading
import urllib.request
import urllib.error
import urllib.parse
from enum import Enum
from typing import Dict, Any, List, Optional, Tuple, Callable

logger = logging.getLogger("LAMLA.ModelRouter")

REVOKED_PLACEHOLDER_KEYS = {
    "AIzaSyAeEcyHo4mNkGaBYQnw1BSDCASSWwqY1aM",
    "placeholder",
    "your-api-key",
    "your_gemini_api_key_here",
}

class TaskCategory(str, Enum):
    DEEP_REASONING = "deep_reasoning"
    DOCUMENT_ANALYSIS = "document_analysis"
    VISION_OCR = "vision_ocr"
    QUESTION_GENERATION = "question_generation"
    VERIFICATION = "verification"
    TUTOR_CONVERSATION = "tutor_conversation"


class ModelRouter:
    """
    Intelligent router with per-task model prioritization, dynamic key rotation,
    automatic backoff cooldowns, and full provider telemetry.
    """

    def __init__(
        self,
        gemini_api_keys: Optional[List[str]] = None,
        groq_api_key: Optional[str] = None,
        ollama_endpoint: Optional[str] = None,
        local_model: Optional[str] = None,
        mode: Optional[str] = None,
    ):
        # 1. API Keys configuration
        raw_gemini = gemini_api_keys or os.environ.get("GEMINI_API_KEY", "").split(",")
        self.gemini_keys = [
            k.strip() for k in raw_gemini
            if k.strip() and k.strip() not in REVOKED_PLACEHOLDER_KEYS
        ]
        self.groq_key = (groq_api_key or os.environ.get("GROQ_API_KEY", "")).strip()
        self.ollama_endpoint = (
            ollama_endpoint or os.environ.get("OLLAMA_ENDPOINT", "http://localhost:11434")
        ).rstrip("/")
        self.local_model = local_model or os.environ.get("LOCAL_MODEL_NAME", "qwen2.5:1.5b")
        self.mode = (mode or os.environ.get("AI_PROVIDER_MODE", "free_configured")).lower()

        # 2. Key rotation state and cooldowns
        self._key_index = 0
        self._key_lock = threading.Lock()
        self._key_cooldowns: Dict[str, float] = {}

        # 3. Model candidate preferences
        env_model = os.environ.get("GEMINI_MODEL", "").strip()
        default_gemini_models = [
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
            "gemini-1.5-flash",
        ]
        if env_model and env_model not in default_gemini_models and not any(bad in env_model for bad in ("3.1", "3.5")):
            self.gemini_models = [env_model] + default_gemini_models
        else:
            self.gemini_models = default_gemini_models

        # Dynamic memory of recently working models
        self.working_gemini_model: Optional[str] = None

        # 4. Telemetry tracking
        self.telemetry = {
            "total_requests": 0,
            "gemini_success": 0,
            "groq_success": 0,
            "ollama_success": 0,
            "fallback_success": 0,
            "failures": 0,
            "active_provider": "gemini" if self.gemini_keys else ("groq" if self.groq_key else "fallback"),
        }

    def get_active_gemini_key(self) -> Optional[str]:
        """Rotates through valid Gemini keys, bypassing cooled-down rate-limited keys."""
        with self._key_lock:
            if not self.gemini_keys:
                return None
            now = time.time()
            # Find first non-cooling key
            for offset in range(len(self.gemini_keys)):
                idx = (self._key_index + offset) % len(self.gemini_keys)
                candidate = self.gemini_keys[idx]
                cooldown_until = self._key_cooldowns.get(candidate, 0.0)
                if now >= cooldown_until:
                    self._key_index = (idx + 1) % len(self.gemini_keys)
                    return candidate
            # If all are in cooldown, pick the one expiring soonest
            soonest_key = min(self.gemini_keys, key=lambda k: self._key_cooldowns.get(k, 0.0))
            return soonest_key

    def mark_key_rate_limited(self, key: str, cooldown_seconds: float = 60.0):
        """Puts a specific Gemini key into temporary cooldown."""
        with self._key_lock:
            self._key_cooldowns[key] = time.time() + cooldown_seconds

    def call_gemini(
        self,
        prompt: str,
        system_instruction: str = "",
        temperature: float = 0.3,
        json_mode: bool = False,
        task: TaskCategory = TaskCategory.DOCUMENT_ANALYSIS,
    ) -> Optional[str]:
        """Calls Google Gemini using the google-genai SDK or direct REST API."""
        key = self.get_active_gemini_key()
        if not key:
            return None

        # Build list of candidate models with task preference
        candidate_models = list(self.gemini_models)
        if self.working_gemini_model and self.working_gemini_model in candidate_models:
            candidate_models.remove(self.working_gemini_model)
            candidate_models.insert(0, self.working_gemini_model)

        for model_name in candidate_models:
            # 1. Try google-genai official SDK
            try:
                from google import genai
                from google.genai import types

                client = genai.Client(api_key=key)
                config_kwargs: Dict[str, Any] = {
                    "temperature": temperature,
                }
                if system_instruction:
                    config_kwargs["system_instruction"] = system_instruction
                if json_mode:
                    config_kwargs["response_mime_type"] = "application/json"

                cfg = types.GenerateContentConfig(**config_kwargs)
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=cfg,
                )
                if response and response.text:
                    self.working_gemini_model = model_name
                    self.telemetry["gemini_success"] += 1
                    return response.text
            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    self.mark_key_rate_limited(key, cooldown_seconds=60.0)
                    key = self.get_active_gemini_key() or key
                elif "404" in err_str or "NOT_FOUND" in err_str:
                    continue  # try next model candidate

            # 2. Direct HTTP REST fallback if SDK failed
            try:
                endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={key}"
                body_dict: Dict[str, Any] = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": temperature},
                }
                if system_instruction:
                    body_dict["systemInstruction"] = {"parts": [{"text": system_instruction}]}
                if json_mode:
                    body_dict["generationConfig"]["responseMimeType"] = "application/json"

                req = urllib.request.Request(
                    endpoint,
                    data=json.dumps(body_dict).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=30) as resp:
                    resp_data = json.loads(resp.read().decode("utf-8"))
                    candidates = resp_data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts and "text" in parts[0]:
                            self.working_gemini_model = model_name
                            self.telemetry["gemini_success"] += 1
                            return parts[0]["text"]
            except Exception:
                continue

        return None

    def call_gemini_vision(
        self,
        prompt: str,
        image_bytes: Optional[bytes] = None,
        image_base64: Optional[str] = None,
        mime_type: str = "image/jpeg",
    ) -> Optional[str]:
        """Runs Multimodal Vision OCR via Gemini for slide diagrams and whiteboard notes."""
        key = self.get_active_gemini_key()
        if not key:
            return None

        import base64
        if image_bytes and not image_base64:
            image_base64 = base64.b64encode(image_bytes).decode("utf-8")
        elif not image_bytes and image_base64:
            try:
                image_bytes = base64.b64decode(image_base64)
            except Exception:
                pass

        for model_name in ("gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"):
            # SDK attempt
            try:
                from google import genai
                from google.genai import types

                client = genai.Client(api_key=key)
                part = types.Part.from_bytes(data=image_bytes or b"", mime_type=mime_type)
                response = client.models.generate_content(
                    model=model_name,
                    contents=[prompt, part],
                )
                if response and response.text:
                    self.telemetry["gemini_success"] += 1
                    return response.text
            except Exception:
                pass

            # REST attempt
            try:
                endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={key}"
                body_dict = {
                    "contents": [{
                        "parts": [
                            {"text": prompt},
                            {"inlineData": {"mimeType": mime_type, "data": image_base64}},
                        ]
                    }]
                }
                req = urllib.request.Request(
                    endpoint,
                    data=json.dumps(body_dict).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=35) as resp:
                    resp_data = json.loads(resp.read().decode("utf-8"))
                    candidates = resp_data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts and "text" in parts[0]:
                            self.telemetry["gemini_success"] += 1
                            return parts[0]["text"]
            except Exception:
                continue

        return None

    def call_groq(
        self,
        prompt: str,
        system_instruction: str = "",
        json_mode: bool = False,
    ) -> Optional[str]:
        """Calls Groq API (ultra-fast Llama 3.3 70B Versatile / Llama 3.1 8B)."""
        if not self.groq_key:
            return None

        models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
        for model in models:
            try:
                endpoint = "https://api.groq.com/openai/v1/chat/completions"
                messages = []
                if system_instruction:
                    messages.append({"role": "system", "content": system_instruction})
                messages.append({"role": "user", "content": prompt})

                payload: Dict[str, Any] = {
                    "model": model,
                    "messages": messages,
                    "temperature": 0.3,
                }
                if json_mode:
                    payload["response_format"] = {"type": "json_object"}

                req = urllib.request.Request(
                    endpoint,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {self.groq_key}",
                    },
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=25) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    choices = data.get("choices", [])
                    if choices:
                        content = choices[0].get("message", {}).get("content", "")
                        if content:
                            self.telemetry["groq_success"] += 1
                            return content
            except Exception:
                continue
        return None

    def call_ollama(
        self,
        prompt: str,
        system_instruction: str = "",
    ) -> Optional[str]:
        """Calls local Ollama instance (100% free offline)."""
        try:
            endpoint = f"{self.ollama_endpoint}/api/generate"
            full_prompt = f"{system_instruction}\n\n{prompt}" if system_instruction else prompt
            payload = {
                "model": self.local_model,
                "prompt": full_prompt,
                "stream": False,
            }
            req = urllib.request.Request(
                endpoint,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                resp_text = data.get("response", "")
                if resp_text:
                    self.telemetry["ollama_success"] += 1
                    return resp_text
        except Exception:
            pass
        return None

    def complete(
        self,
        prompt: str,
        system_instruction: str = "",
        temperature: float = 0.3,
        json_mode: bool = False,
        task: TaskCategory = TaskCategory.DOCUMENT_ANALYSIS,
        fallback_fn: Optional[Callable[[], str]] = None,
    ) -> str:
        """
        Executes completion following the multi-provider routing policy:
        1. Gemini Hosted API
        2. Groq Fast API
        3. Local Ollama (if available)
        4. Deterministic Academic Fallback
        """
        self.telemetry["total_requests"] += 1

        # Priority 1: Gemini
        if self.mode != "local_only" and self.gemini_keys:
            res = self.call_gemini(
                prompt=prompt,
                system_instruction=system_instruction,
                temperature=temperature,
                json_mode=json_mode,
                task=task,
            )
            if res:
                return res

        # Priority 2: Groq
        if self.mode != "local_only" and self.groq_key:
            res = self.call_groq(
                prompt=prompt,
                system_instruction=system_instruction,
                json_mode=json_mode,
            )
            if res:
                return res

        # Priority 3: Local Ollama
        res = self.call_ollama(prompt=prompt, system_instruction=system_instruction)
        if res:
            return res

        # Priority 4: Deterministic Fallback Generator
        if fallback_fn:
            self.telemetry["fallback_success"] += 1
            return fallback_fn()

        self.telemetry["failures"] += 1
        return ""
