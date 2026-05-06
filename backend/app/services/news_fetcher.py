import asyncio
import json
import logging
import math
import re
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
        "name": "The War Zone",
        "url": "https://www.twz.com/rss",
        "default_category": "军事",
    },
    {
        "name": "Defense News",
        "url": "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml",
        "default_category": "军事",
    },
    {
        "name": "C4ISRNET",
        "url": "https://www.c4isrnet.com/arc/outboundfeeds/rss/?outputType=xml",
        "default_category": "军事",
    },
    {
        "name": "Task & Purpose",
        "url": "https://taskandpurpose.com/feed/",
        "default_category": "军事",
    },
]

HTTP_TIMEOUT = httpx.Timeout(20.0, connect=10.0)
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

# Max concurrent LLM calls
LLM_CONCURRENCY = 5

# Max concurrent article fetches
FETCH_CONCURRENCY = 5


async def fetch_rss_entries(source: dict, max_items: int = 10) -> list[dict]:
    """Fetch and parse an RSS/Atom feed, return list of entry dicts."""
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, follow_redirects=True) as client:
            resp = await client.get(source["url"], headers={"User-Agent": USER_AGENT})
            resp.raise_for_status()
    except Exception as e:
        logger.warning("Failed to fetch RSS from %s: %s", source["name"], e)
        return []

    feed = feedparser.parse(resp.text)
    entries = []
    for entry in feed.entries[:max_items]:
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


def _extract_article_text(html: str) -> str:
    """Extract article text from HTML using readability."""
    try:
        from lxml.html import fromstring
        from readability import Document

        doc = Document(html)
        summary_html = doc.summary()
        tree = fromstring(summary_html)
        text = tree.text_content()
        # Clean up whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        return text[:8000]
    except Exception:
        return ""


async def fetch_article_fulltext(
    url: str, client: httpx.AsyncClient, sem: asyncio.Semaphore,
) -> str:
    """Fetch an article page and extract its full text."""
    async with sem:
        try:
            resp = await client.get(url, headers={"User-Agent": USER_AGENT})
            resp.raise_for_status()
            return _extract_article_text(resp.text)
        except Exception as e:
            logger.warning("Failed to fetch article %s: %s", url[:80], e)
            return ""


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
    return f"""你是一个军事新闻编辑。请阅读以下国外军事文章，用中文生成一条简洁的摘要（80-120字）。
分类固定为"军事"。

要求：
1. 必须使用中文输出
2. 如果原文是英文，请翻译并概括为中文
3. 重点关注：武器装备、军事行动、国防政策、地缘冲突、军事科技等方面
4. 语言简洁有力，适合移动端阅读

标题：{title}

内容：
{content_snippet}

请严格按以下 JSON 格式返回，不要包含任何其他内容：
{{"summary": "中文摘要内容", "category": "军事"}}"""


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

        content_text = data["choices"][0]["message"]["content"]
        if not content_text or not content_text.strip():
            raise ValueError("Empty LLM response")

        content_text = content_text.strip()

        # Strip markdown code fences
        if "```" in content_text:
            start = content_text.find("{")
            end = content_text.rfind("}")
            if start != -1 and end != -1:
                content_text = content_text[start:end + 1]

        parsed = json.loads(content_text)
        summary = parsed.get("summary", title)
        category = parsed.get("category", default_category)
        if category not in ("新闻", "论文", "工具", "军事", "其他"):
            category = default_category
        return summary, category

    except (json.JSONDecodeError, KeyError, IndexError, ValueError) as e:
        # Structured errors: JSON parse failure, missing keys, empty response
        logger.warning("AI summarization parse error for '%s': %s", title[:50], e)
        fallback = content[:100] if content else title
        return fallback, default_category
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
    sem: asyncio.Semaphore, fetch_sem: asyncio.Semaphore,
) -> AiNews | None:
    """Process a single entry: fetch full text → AI summarize."""
    # Step 1: Fetch full article text from the source URL
    fulltext = await fetch_article_fulltext(entry["link"], client, fetch_sem)
    content_for_ai = fulltext or entry["content_raw"] or entry["summary_raw"]

    # Step 2: AI summarize
    async with sem:
        summary, category = await summarize_with_ai(
            entry["title"], content_for_ai, model, entry["default_category"], client,
        )

    # Store full text (or fallback to RSS content)
    stored_content = fulltext or entry["summary_raw"]

    return AiNews(
        title=entry["title"][:300],
        summary=summary,
        content=stored_content[:5000] if stored_content else None,
        category=category,
        source_name=entry["source_name"],
        source_url=entry["link"][:1000],
        is_published=True,
        created_at=datetime.now(timezone.utc),
    )


async def auto_fetch_news(db: AsyncSession, total_count: int = 10) -> dict:
    """Main pipeline: fetch RSS (parallel) → batch dedup → AI summarize (concurrent) → save.

    Evenly distributes fetch across RSS sources.
    Hard timeout: 120s total.
    """
    try:
        return await asyncio.wait_for(
            _auto_fetch_news_impl(db, total_count),
            timeout=120.0,
        )
    except asyncio.TimeoutError:
        logger.error("Auto-fetch timed out after 120s")
        return {"error": "抓取超时（120秒），部分 RSS 源可能不可达", "fetched": 0, "created": 0, "skipped": 0, "errors": 0}


async def _auto_fetch_news_impl(db: AsyncSession, total_count: int) -> dict:
    model = await get_first_enabled_model(db)
    if not model:
        logger.error("No enabled model found for AI summarization")
        return {"error": "没有可用的模型，请先在模型管理中添加并启用一个模型"}

    stats = {"fetched": 0, "created": 0, "skipped": 0, "errors": 0}

    # Even distribution: each source gets ceil(total_count / num_sources)
    per_source = math.ceil(total_count / len(RSS_SOURCES))

    # Step 1: Fetch all RSS feeds in parallel (each with 10s timeout)
    rss_tasks = [fetch_rss_entries(source, max_items=per_source) for source in RSS_SOURCES]
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

    # Limit to total_count
    new_entries = new_entries[:total_count]

    # Step 3: Fetch full text + AI summarize concurrently
    sem = asyncio.Semaphore(LLM_CONCURRENCY)
    fetch_sem = asyncio.Semaphore(FETCH_CONCURRENCY)
    llm_timeout = httpx.Timeout(30.0, connect=10.0)
    async with httpx.AsyncClient(timeout=llm_timeout) as client:
        tasks = [
            _process_one_entry(entry, model, client, sem, fetch_sem)
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
