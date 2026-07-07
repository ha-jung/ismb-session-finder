#!/usr/bin/env python3
"""Build track-specific keyword suggestions for the ISMB session finder."""

from __future__ import annotations

import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SESSIONS_PATH = ROOT / "sessions.json"
OUTPUT_PATH = ROOT / "track_keywords.json"
EXCLUDED_DATES = {"2026-07-06", "2026-07-07"}

STOPWORDS = {
    "about",
    "across",
    "after",
    "again",
    "against",
    "also",
    "among",
    "analysis",
    "and",
    "are",
    "based",
    "been",
    "between",
    "both",
    "can",
    "data",
    "dataset",
    "datasets",
    "different",
    "during",
    "each",
    "from",
    "has",
    "have",
    "how",
    "into",
    "its",
    "may",
    "method",
    "methods",
    "model",
    "models",
    "more",
    "new",
    "not",
    "our",
    "over",
    "paper",
    "poster",
    "present",
    "presented",
    "provide",
    "provides",
    "result",
    "results",
    "show",
    "shows",
    "session",
    "such",
    "than",
    "that",
    "the",
    "their",
    "these",
    "this",
    "through",
    "using",
    "via",
    "was",
    "were",
    "which",
    "while",
    "with",
    "within",
    "closing",
    "https",
    "http",
    "keynote",
    "remarks",
    "tutorial",
    "welcome",
    "workshop",
    "www",
}

ALIASES = {
    "ai": "artificial intelligence",
    "gnn": "graph neural network",
    "gnns": "graph neural network",
    "llm": "large language model",
    "llms": "large language model",
    "ml": "machine learning",
    "plm": "protein language model",
    "plms": "protein language model",
}

DOMAIN_PHRASES = [
    "artificial intelligence",
    "causal inference",
    "cell atlas",
    "cell type",
    "clinical genomics",
    "cryo em",
    "deep learning",
    "drug discovery",
    "foundation model",
    "gene expression",
    "gene regulation",
    "genome assembly",
    "genome annotation",
    "genome editing",
    "genomic medicine",
    "graph neural network",
    "knowledge graph",
    "large language model",
    "machine learning",
    "metabolic pathway",
    "metagenomics",
    "microbiome",
    "multi omics",
    "multimodal",
    "network biology",
    "pathway analysis",
    "phylogenetics",
    "precision medicine",
    "protein design",
    "protein function",
    "protein interaction",
    "protein language model",
    "protein structure",
    "rare disease",
    "rna seq",
    "sequence alignment",
    "single cell",
    "spatial transcriptomics",
    "structural bioinformatics",
    "systems biology",
    "variant effect",
    "variant interpretation",
]


def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def tokens(text: str) -> list[str]:
    return [
        ALIASES.get(token, token)
        for token in normalize(text).split()
        if len(token) > 2 and token not in STOPWORDS
    ]


def split_keywords(value: str) -> list[str]:
    items = re.split(r"[;,|]\s*", value or "")
    return [normalize(item) for item in items if len(normalize(item)) > 2]


def candidate_phrases(session: dict) -> Counter:
    text = " ".join(
        str(session.get(field) or "")
        for field in ("title", "keywords", "abstract")
    )
    normalized = normalize(text)
    counts: Counter[str] = Counter()

    for keyword in split_keywords(str(session.get("keywords") or "")):
        if keyword and not all(part in STOPWORDS for part in keyword.split()):
            counts[keyword] += 4

    for phrase in DOMAIN_PHRASES:
        if re.search(rf"\b{re.escape(phrase)}s?\b", normalized):
            counts[phrase] += 5

    words = tokens(text)
    for size in (3, 2):
        for i in range(len(words) - size + 1):
            phrase = " ".join(words[i : i + size])
            parts = phrase.split()
            if any(len(part) > 3 for part in parts) and not all(part in STOPWORDS for part in parts):
                counts[phrase] += size

    for word in words:
        if len(word) > 4:
            counts[word] += 1

    return counts


def is_good_phrase(phrase: str, track_terms: set[str]) -> bool:
    parts = phrase.split()
    if not parts:
        return False
    if any(part in STOPWORDS for part in parts):
        return False
    if any(part in {"com", "github", "gov", "ncbi", "nlm", "www", "https", "http"} for part in parts):
        return False
    if any(re.search(r"\d", part) for part in parts):
        return False
    if any(first == second for first, second in zip(parts, parts[1:])):
        return False
    if track_terms and set(parts).issubset(track_terms):
        return False
    if len(parts) == 1 and phrase not in DOMAIN_PHRASES:
        return False
    return True


def session_keywords(session: dict, track_name: str = "") -> set[str]:
    candidates = candidate_phrases(session)
    track_terms = set(tokens(track_name)) if track_name else set()
    ranked = []

    for phrase, weight in candidates.items():
        if not is_good_phrase(phrase, track_terms):
            continue

        parts = phrase.split()
        phrase_bonus = 1.3 if len(parts) > 1 else 1.0
        domain_bonus = 1.6 if phrase in DOMAIN_PHRASES else 1.0
        keyword_bonus = 1.35 if phrase in split_keywords(str(session.get("keywords") or "")) else 1.0
        title_bonus = 1.25 if phrase in normalize(str(session.get("title") or "")) else 1.0
        score = weight * phrase_bonus * domain_bonus * keyword_bonus * title_bonus
        ranked.append((score, weight, phrase))

    ranked.sort(key=lambda item: (-item[0], -item[1], item[2]))
    selected = []
    seen_roots: Counter[str] = Counter()

    for _, _, phrase in ranked:
        root = phrase.split()[-1]
        if seen_roots[root] >= 2:
            continue
        seen_roots[root] += 1
        selected.append(phrase)
        if len(selected) >= 8:
            break

    return set(selected)


def build_group_keywords(groups: dict[str, list[dict]]) -> dict[str, list[dict]]:
    all_counts: Counter[str] = Counter()
    per_group: dict[str, Counter[str]] = {}

    for name, group_sessions in groups.items():
        counter: Counter[str] = Counter()
        for session in group_sessions:
            keywords = session_keywords(session, "" if name == "__all__" else name)
            counter.update(keywords)
        per_group[name] = counter
        if name != "__all__":
            all_counts.update(counter)

    total_sessions = max(1, len(groups.get("__all__", [])))
    output: dict[str, list[dict]] = {}

    for name, counter in per_group.items():
        group_size = max(1, len(groups[name]))
        track_terms = set(tokens(name)) if name != "__all__" else set()
        ranked = []
        for phrase, count in counter.items():
            if count < 2:
                continue
            if not is_good_phrase(phrase, track_terms):
                continue
            global_count = all_counts.get(phrase, count)
            specificity = (count / group_size) / max(global_count / total_sessions, 0.01)
            parts = phrase.split()
            phrase_bonus = 1.25 if len(parts) > 1 else 1.0
            domain_bonus = 1.35 if phrase in DOMAIN_PHRASES else 1.0
            score = math.log1p(count) * specificity * phrase_bonus * domain_bonus
            ranked.append((score, count, phrase))

        ranked.sort(key=lambda item: (-item[0], -item[1], item[2]))
        output[name] = [
            {"keyword": phrase, "count": count}
            for _, count, phrase in ranked[:30]
        ]

    return output


def main() -> None:
    sessions = json.loads(SESSIONS_PATH.read_text())
    conference_sessions = [
        session for session in sessions if session.get("date") not in EXCLUDED_DATES
    ]

    groups: dict[str, list[dict]] = defaultdict(list)
    groups["__all__"] = conference_sessions
    for session in conference_sessions:
        track = session.get("track") or "Uncategorized"
        groups[track].append(session)

    OUTPUT_PATH.write_text(
        json.dumps(build_group_keywords(groups), indent=2, ensure_ascii=False) + "\n"
    )


if __name__ == "__main__":
    main()
