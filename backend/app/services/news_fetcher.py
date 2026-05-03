import asyncio
import json
import logging
from datetime import datetime, timezone

import feedparser
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decrypt_api_key
from app.models.ai_news import AiNews
from app.models.model_registry import ModelRegistry

logger = logging.getLogger(__name__)

RSS_SOURCES = [
    {
        "name": "TechCrunch AI",
        "url": "https://techcrunch.com/category/artificial-intelligence/feed/",
        "default_category": "新闻",
    },
    {
        "name": "The Verge AI",
        "url": "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
        "default_category": "新闻",
    },
    {
        "name": "MIT Technology Review",
        "url": "https://www.technologyreview.com/feed/",
        "default_category": "论文",
    },
    {
        "name": "Hacker News AI",
        "url": "https://hnrss.org/newest?q=AI+OR+LLM+OR+GPT+OR+Claude+OR+Gemini",
        "default_category": "工具",
    },
    {
        "name": "VentureBeat AI",
        "url": "https://venturebeat.com/category/ai/feed/",
        "default_category": "新闻",
    },
]

HTTP_TIMEOUT = httpx.Timeout(15.0, connect=10.0)
USER_AGENT = "Mozilla/5.0 (compatible; APIGateway/1.0; +https://xtq619.xyz)"

# Max concurrent LLM calls
LLM_CONCURRENCY = 5


async def fetch_rss_entries(source: dict) -> list[dict]:
    """Fetch and parse an RSS/Atom feed, return list of entry dicts."""
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            resp = await client.get(source["url"], headers={"User-Agent": USER_AGENT})
            resp.raise_for_status()
    except Exception as e:
        logger.warning("Failed to fetch RSS from %s: %s", source["name"], e)
        return []

    feed = feedparser.parse(resp.text)
    entries = []
    for entry in feed.entries[:10]:
        link = getattr(entry, "link", None) or ""
        title = getattr(entry, "title", "") or ""
        summary_raw = getattr(entry, "summary", "") or ""
        content_raw = ""
        if hasattr(entry, "content") and entry.content:
            content_raw = entry.content[0].get("value", "") if entry.content else ""

        if not title or not link:
            continue

        entries.append({
            "title": title,
            "link": link,
            "summary_raw": summary_raw,
            "content_raw": content_raw,
            "source_name": source["name"],
            "default_category": source["default_category"],
        })
    return entries


async def get_first_enabled_model(db: AsyncSession) -> ModelRegistry | None:
    """Get the first enabled model from registry for AI summarization."""
    # Try boolean comparison first
    result = await db.execute(
        select(ModelRegistry).where(ModelRegistry.is_enabled == True).limit(1)
    )
    model = result.scalar_one_or_none()
    if model:
        return model

    # Fallback: fetch all and check manually (handles string "true" edge case)
    result = await db.execute(select(ModelRegistry))
    for row in result.scalars().all():
        if row.is_enabled:
            logger.info("Found enabled model via fallback: %s (is_enabled=%s, type=%s)",
                        row.model_name, row.is_enabled, type(row.is_enabled).__name__)
            return row

    logger.warning("No enabled model found. Total models: %d",
                   len(list((await db.execute(select(ModelRegistry))).scalars().all())))
    return None


def _build_prompt(title: str, content: str, default_category: str) -> str:
    content_snippet = content[:2000] if content else ""
    return f"""你是一个 AI 新闻编辑。请阅读以下文章，用中文生成一条简洁的摘要（80-120字），
并从以下分类中选择最合适的一个：新闻、论文、工具、其他。

如果原文已经是中文，请保持原文风格；如果是英文，请翻译为中文摘要。

文章来源默认分类建议：{default_category}

标题：{title}

内容：
{content_snippet}

请严格按以下 JSON 格式返回，不要包含任何其他内容：
{{"summary": "中文摘要内容", "category": "分类"}}"""


async def summarize_with_ai(
    title: str, content: str, model: ModelRegistry, default_category: str,
    client: httpx.AsyncClient,
) -> tuple[str, str]:
    """Call LLM to summarize an article. Returns (summary, category)."""
    prompt = _build_prompt(title, content, default_category)
    api_key = decrypt_api_key(model.api_key_encrypted)

    body = {
        "model": model.model_name,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 300,
        "temperature": 0.3,
    }

    try:
        resp = await client.post(
            f"{model.base_url.rstrip('/')}/chat/completions",
            json=body,
            headers={"Authorization": f"Bearer {api_key}"},
        )
        resp.raise_for_status()
        data = resp.json()

        content_text = data["choices"][0]["message"]["content"].strip()

        if "```" in content_text:
            start = content_text.find("{")
            end = content_text.rfind("}")
            if start != -1 and end != -1:
                content_text = content_text[start:end + 1]

        parsed = json.loads(content_text)
        summary = parsed.get("summary", title)
        category = parsed.get("category", default_category)
        if category not in ("新闻", "论文", "工具", "其他"):
            category = default_category
        return summary, category

    except Exception as e:
        logger.warning("AI summarization failed for '%s': %s", title[:50], e)
        fallback = content[:100] if content else title
        return fallback, default_category


async def batch_get_duplicates(db: AsyncSession, links: list[str]) -> set[str]:
    """Check which source_urls already exist. Returns set of duplicate links."""
    if not links:
        return set()
    result = await db.execute(
        select(AiNews.source_url).where(AiNews.source_url.in_(links))
    )
    return {row[0] for row in result.fetchall()}


async def _process_one_entry(
    entry: dict, model: ModelRegistry, client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
) -> AiNews | None:
    """Process a single entry with concurrency limit."""
    async with sem:
        content_for_ai = entry["content_raw"] or entry["summary_raw"]
        summary, category = await summarize_with_ai(
            entry["title"], content_for_ai, model, entry["default_category"], client,
        )

    return AiNews(
        title=entry["title"][:300],
        summary=summary,
        content=entry["summary_raw"][:5000] if entry["summary_raw"] else None,
        category=category,
        source_name=entry["source_name"],
        source_url=entry["link"][:1000],
        is_published=True,
        created_at=datetime.now(timezone.utc),
    )


async def auto_fetch_news(db: AsyncSession) -> dict:
    """Main pipeline: fetch RSS (parallel) → batch dedup → AI summarize (concurrent) → save.

    Expected time: ~10-20s depending on RSS source speed and LLM latency.
    """
    model = await get_first_enabled_model(db)
    if not model:
        logger.error("No enabled model found for AI summarization")
        return {"error": "没有可用的模型，请先在模型管理中添加并启用一个模型"}

    stats = {"fetched": 0, "created": 0, "skipped": 0, "errors": 0}

    # Step 1: Fetch all RSS feeds in parallel
    rss_tasks = [fetch_rss_entries(source) for source in RSS_SOURCES]
    results = await asyncio.gather(*rss_tasks)

    all_entries = []
    for entries in results:
        all_entries.extend(entries)
    stats["fetched"] = len(all_entries)

    if not all_entries:
        return stats

    # Step 2: Batch dedup — one query instead of N
    all_links = [e["link"] for e in all_entries]
    duplicates = await batch_get_duplicates(db, all_links)
    new_entries = [e for e in all_entries if e["link"] not in duplicates]
    stats["skipped"] = len(all_entries) - len(new_entries)

    if not new_entries:
        await db.commit()
        return stats

    # Step 3: AI summarize concurrently with semaphore
    sem = asyncio.Semaphore(LLM_CONCURRENCY)
    llm_timeout = httpx.Timeout(30.0, connect=10.0)
    async with httpx.AsyncClient(timeout=llm_timeout) as client:
        tasks = [
            _process_one_entry(entry, model, client, sem)
            for entry in new_entries
        ]
        news_results = await asyncio.gather(*tasks, return_exceptions=True)

    # Step 4: Save successful results
    for result in news_results:
        if isinstance(result, Exception):
            stats["errors"] += 1
            logger.warning("Error processing entry: %s", result)
            continue
        if result is not None:
            db.add(result)
            stats["created"] += 1

    await db.commit()
    logger.info("Auto-fetch complete: %s", stats)
    return stats
