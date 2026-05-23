"""
Daily match status updater. Runs via APScheduler.

- Auto-transitions match status based on Beijing time (UTC+8):
  upcoming → live when match time arrives
  live → finished ~2 hours after kickoff
- If an external data source is configured, fetches actual scores.
"""
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update

from app.core.database import async_session
from app.models.worldcup import Match

logger = logging.getLogger(__name__)

BEIJING_TZ = timezone(timedelta(hours=8))


def _beijing_now() -> datetime:
    return datetime.now(timezone.utc).astimezone(BEIJING_TZ)


async def run_match_updates() -> dict:
    """
    Main entry point called by the scheduler.
    Returns a summary dict of what was updated.
    """
    now_utc = datetime.now(timezone.utc)
    now_bj = now_utc.astimezone(BEIJING_TZ)
    summary = {"live": 0, "finished": 0, "scores_updated": 0}

    async with async_session() as db:
        # 1. Find matches that should be live now
        #    (match has started but not yet finished, status is still "upcoming")
        result = await db.execute(
            select(Match).where(
                Match.status == "upcoming",
            )
        )
        upcoming_matches = result.scalars().all()

        for m in upcoming_matches:
            match_start_bj = _match_start_bj(m)
            match_end_bj = match_start_bj + timedelta(hours=2, minutes=30)

            if match_start_bj <= now_bj < match_end_bj:
                m.status = "live"
                m.updated_at = datetime.now(timezone.utc)
                summary["live"] += 1
                logger.info("Match #%d (%s vs %s) → live", m.id, m.team_a_code, m.team_b_code)
            elif now_bj >= match_end_bj:
                m.status = "finished"
                m.updated_at = datetime.now(timezone.utc)
                summary["finished"] += 1
                logger.info("Match #%d (%s vs %s) → finished (no score data)", m.id, m.team_a_code, m.team_b_code)

        # 2. Find live matches that should be finished
        result = await db.execute(
            select(Match).where(Match.status == "live")
        )
        live_matches = result.scalars().all()

        for m in live_matches:
            match_start_bj = _match_start_bj(m)
            match_end_bj = match_start_bj + timedelta(hours=2, minutes=30)

            if now_bj >= match_end_bj:
                # Try to fetch scores from external source
                scores = await _fetch_scores(m)
                if scores:
                    m.score_a = scores[0]
                    m.score_b = scores[1]
                    summary["scores_updated"] += 1
                m.status = "finished"
                m.updated_at = datetime.now(timezone.utc)
                summary["finished"] += 1
                logger.info("Match #%d (%s vs %s) → finished (score: %s-%s)",
                            m.id, m.team_a_code, m.team_b_code, m.score_a, m.score_b)

        await db.commit()

    if any(v > 0 for v in summary.values()):
        logger.info("Match updater summary: %s", summary)
    return summary


def _match_start_bj(m: Match) -> datetime:
    """Parse match date + time as Beijing time."""
    hour, minute = int(m.time[:2]), int(m.time[3:5])
    return datetime(
        m.date.year, m.date.month, m.date.day,
        hour, minute, 0,
        tzinfo=BEIJING_TZ,
    )


async def run_squad_updates() -> dict:
    """
    Update team squad data by scraping a web page. Runs every 12 hours.
    Set WORLDCUP_SQUADS_PAGE_URL in .env to enable.

    The scraper tries multiple parsing strategies to handle different page structures
    and logs diagnostic info for debugging on first deploy.
    """
    from app.core.config import settings
    from app.models.worldcup import Team

    page_url = getattr(settings, "WORLDCUP_SQUADS_PAGE_URL", None)
    if not page_url:
        return {"enabled": False, "reason": "WORLDCUP_SQUADS_PAGE_URL not configured"}

    summary = {"updated": 0, "unchanged": 0, "teams_checked": 0, "teams_matched": 0}

    try:
        import httpx
        from lxml import etree

        async with async_session() as db:
            # Fetch the page
            async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
                resp = await client.get(
                    page_url,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        "KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
                        "Accept-Language": "en-US,en;q=0.9",
                    },
                    follow_redirects=True,
                )
                if resp.status_code != 200:
                    logger.warning("Squad page returned HTTP %d", resp.status_code)
                    return {"enabled": True, "error": f"HTTP {resp.status_code}"}
                html = resp.text

            tree = etree.HTML(html)

            # Log page structure diagnostics for initial debugging
            _log_page_structure(tree)

            # Try to extract squad data
            squads = _extract_squads(tree)
            if not squads:
                logger.warning("No squad data extracted from page — may need selector updates")
                return {"enabled": True, "error": "No squad data extracted", "teams_checked": 0}

            # Load DB teams and build name lookup
            result = await db.execute(select(Team))
            db_teams = {t.code: t for t in result.scalars().all()}
            db_teams_by_name = {_normalize(t.name): t for t in db_teams.values()}

            for raw_name, squad_data in squads.items():
                summary["teams_checked"] += 1
                team = _find_team(raw_name, db_teams, db_teams_by_name)
                if team is None:
                    logger.debug("No DB match for scraped team: %s", raw_name)
                    continue
                summary["teams_matched"] += 1

                changed = False
                if squad_data and squad_data != team.squad_data:
                    team.squad_data = squad_data
                    changed = True
                if not team.squad_confirmed:
                    team.squad_confirmed = True
                    changed = True

                if changed:
                    team.updated_at = datetime.now(timezone.utc)
                    summary["updated"] += 1
                    logger.info("Squad updated for %s (%d players)", team.code, len(squad_data))
                else:
                    summary["unchanged"] += 1

            if summary["updated"] > 0:
                await db.commit()

    except Exception as e:
        logger.exception("Squad update failed: %s", e)
        return {"enabled": True, "error": str(e)}

    if summary["updated"] > 0:
        logger.info("Squad updater summary: %s", summary)
    return summary


# ---------------------------------------------------------------------------
# HTML parsing helpers
# ---------------------------------------------------------------------------

# Mapping from English position names found on web pages to Chinese used in DB
_POSITION_MAP: dict[str, str] = {
    "goalkeeper": "门将",
    "gk": "门将",
    "defender": "后卫",
    "df": "后卫",
    "centre-back": "后卫",
    "center-back": "后卫",
    "center back": "后卫",
    "full-back": "后卫",
    "full back": "后卫",
    "left-back": "后卫",
    "left back": "后卫",
    "right-back": "后卫",
    "right back": "后卫",
    "wing-back": "后卫",
    "wing back": "后卫",
    "sweeper": "后卫",
    "midfielder": "中场",
    "mf": "中场",
    "central midfielder": "中场",
    "defensive midfielder": "中场",
    "attacking midfielder": "中场",
    "winger": "中场",
    "forward": "前锋",
    "fw": "前锋",
    "striker": "前锋",
    "centre-forward": "前锋",
    "center-forward": "前锋",
    "center forward": "前锋",
    "winger-forward": "前锋",
}


def _translate_position(pos: str) -> str:
    return _POSITION_MAP.get(pos.strip().lower(), pos.strip())


def _normalize(s: str) -> str:
    """Normalize a team name for fuzzy matching."""
    import re
    s = s.strip().lower()
    s = re.sub(r"\s*\([^)]*\)", "", s)  # remove parentheticals
    s = re.sub(r"[^a-z]", "", s)
    return s


def _find_team(raw_name: str, by_code: dict, by_name: dict):
    """Find a DB Team by scraped team name. Returns Team or None."""
    # Direct code match (e.g. "KOR", "JPN")
    if raw_name.upper() in by_code:
        return by_code[raw_name.upper()]

    norm = _normalize(raw_name)
    # Exact normalized name match
    if norm in by_name:
        return by_name[norm]

    # Substring match: scraped name contains DB name or vice versa
    for db_norm, team in by_name.items():
        if len(db_norm) >= 3 and (db_norm in norm or norm in db_norm):
            return team

    # Special-case common variations
    aliases: dict[str, str] = {
        "unitedstates": "usa",
        "usa": "usa",
        "southkorea": "kor",
        "korearepublic": "kor",
        "northkorea": "prk",
        "bosniaherzegovina": "bih",
        "bosnia": "bih",
        "cotedivoire": "civ",
        "capeverde": "cpv",
        "czechrepublic": "cze",
        "dr congo": "cod",
        "congodr": "cod",
        "newzealand": "nzl",
        "saudiarabia": "ksa",
        "southafrica": "rsa",
        "trkiye": "tur",
        "turkey": "tur",
        "unitedarabemirates": "uae",
        "uae": "uae",
    }
    alias_code = aliases.get(norm)
    if alias_code and alias_code in by_code:
        return by_code[alias_code]

    return None


def _log_page_structure(tree) -> None:
    """Log key HTML elements to help tune selectors after first deploy."""
    from lxml import etree

    # Count elements by tag
    tag_counts: dict[str, int] = {}
    for el in tree.iter():
        tag = etree.QName(el).localname
        tag_counts[tag] = tag_counts.get(tag, 0) + 1

    # Find heading hierarchy
    headings: list[str] = []
    for h in tree.iter("h1", "h2", "h3", "h4"):
        tag = etree.QName(h).localname
        text = " ".join((h.text or "").split())[:80]
        if text:
            headings.append(f"{tag}: {text}")

    # Check for embedded JSON
    has_json_ld = bool(tree.xpath('//script[@type="application/ld+json"]'))
    has_next_data = bool(tree.xpath('//script[@id="__NEXT_DATA__"]'))

    logger.info(
        "Squad page structure: tags=%d unique, h1-h4=%d, jsonld=%s, nextdata=%s",
        len(tag_counts),
        len(headings),
        has_json_ld,
        has_next_data,
    )
    # Log first N headings to help identify team/player sections
    for h in headings[:30]:
        logger.debug("  %s", h)


def _extract_squads(tree) -> dict[str, list[dict]]:
    """
    Extract team → squad mapping from parsed HTML.
    Tries multiple strategies in order, returns first non-empty result.
    """
    squads = _try_jsonld(tree)
    if squads:
        logger.info("Squad extraction: used JSON-LD strategy, got %d teams", len(squads))
        return squads

    squads = _try_next_data(tree)
    if squads:
        logger.info("Squad extraction: used __NEXT_DATA__ strategy, got %d teams", len(squads))
        return squads

    squads = _try_semantic_sections(tree)
    if squads:
        logger.info("Squad extraction: used semantic sections strategy, got %d teams", len(squads))
        return squads

    squads = _try_tables(tree)
    if squads:
        logger.info("Squad extraction: used table strategy, got %d teams", len(squads))
        return squads

    return {}


def _try_jsonld(tree) -> dict[str, list[dict]]:
    """Extract squad data from schema.org JSON-LD blocks."""
    import json

    squads: dict[str, list[dict]] = {}
    for script in tree.xpath('//script[@type="application/ld+json"]'):
        try:
            data = json.loads(script.text or "")
        except (json.JSONDecodeError, TypeError):
            continue
        if isinstance(data, dict):
            data = [data]
        for item in data if isinstance(data, list) else []:
            if item.get("@type") in ("SportsTeam", "SportsEvent"):
                # Flatten graph if present
                pass  # JSON-LD varies too much; logged but not relied on
    return squads


def _try_next_data(tree) -> dict[str, list[dict]]:
    """Extract from Next.js __NEXT_DATA__ JSON blob."""
    import json

    script = tree.xpath('//script[@id="__NEXT_DATA__"]')
    if not script:
        return {}
    try:
        data = json.loads(script[0].text or "")
    except (json.JSONDecodeError, TypeError):
        return {}

    # Walk the Next.js props tree looking for team/player data
    squads: dict[str, list[dict]] = {}
    _walk_next_props(data, squads)
    return squads


def _walk_next_props(node, squads: dict, depth: int = 0) -> None:
    """Recursively search Next.js props for squad-like structures."""
    if depth > 8:
        return
    if isinstance(node, dict):
        # Look for patterns like {"name": "Japan", "squad": [...], "players": [...]}
        maybe_team = node.get("name") or node.get("team") or node.get("teamName")
        players = node.get("squad") or node.get("players") or node.get("roster")
        if isinstance(maybe_team, str) and isinstance(players, list) and len(players) > 0:
            parsed = _parse_player_list(players)
            if len(parsed) >= 11:  # minimum plausible squad size
                squads[maybe_team] = parsed
        for v in node.values():
            _walk_next_props(v, squads, depth + 1)
    elif isinstance(node, list):
        for item in node:
            _walk_next_props(item, squads, depth + 1)


def _try_semantic_sections(tree) -> dict[str, list[dict]]:
    """
    Parse page by finding team-name headings and extracting player lists
    from following content. This handles the most common news-article layout.
    """
    squads: dict[str, list[dict]] = {}

    # Collect all h2/h3/h4 headings with their following siblings
    headings = tree.xpath('//h2 | //h3 | //h4')
    for i, heading in enumerate(headings):
        heading_text = " ".join((heading.text or "").split())
        if not heading_text or len(heading_text) > 60:
            continue

        # Determine if this heading names a team
        # Strategy: scan for player-like data in the elements between this
        # heading and the next heading of same or higher level.
        content_elements = _following_elements(heading, headings[i + 1] if i + 1 < len(headings) else None)

        players = _extract_players_from_elements(content_elements)
        if len(players) >= 11:
            squads[heading_text] = players

    return squads


def _following_elements(start_el, stop_el):
    """Collect all elements between start_el and stop_el (exclusive)."""
    elements = []
    el = start_el.getnext()
    while el is not None:
        if el is stop_el:
            break
        elements.append(el)
        el = el.getnext()
        # Safety limit
        if len(elements) > 200:
            break
    return elements


def _extract_players_from_elements(elements: list) -> list[dict]:
    """Try to extract player data from a list of HTML elements."""
    players: list[dict] = []

    for el in elements:
        text = " ".join((el.text_content() or "").split())
        if not text:
            continue

        # Check for table rows
        if el.tag == "tr":
            cells = el.findall("td") or el.findall("th")
            player = _parse_table_row(cells)
            if player:
                players.append(player)
            continue

        # Check for list items: "1. Zion Suzuki (Goalkeeper)" or "Goalkeeper: Zion Suzuki"
        if el.tag in ("li", "p", "div"):
            player = _parse_text_as_player(text)
            if player:
                players.append(player)

    return players


def _try_tables(tree) -> dict[str, list[dict]]:
    """Extract from HTML tables. Each table may represent one team."""
    squads: dict[str, list[dict]] = {}
    tables = tree.xpath('//table')
    for table in tables:
        # Try to find a caption or preceding heading as team name
        caption = table.find("caption")
        team_name = None
        if caption is not None:
            team_name = " ".join((caption.text or "").split())
        else:
            # Look at preceding h2/h3
            prev = table.getprevious()
            while prev is not None:
                if prev.tag in ("h2", "h3", "h4"):
                    team_name = " ".join((prev.text or "").split())
                    break
                prev = prev.getprevious()

        players: list[dict] = []
        for row in table.findall(".//tr"):
            cells = row.findall("td") or row.findall("th")
            player = _parse_table_row(cells)
            if player:
                players.append(player)

        if team_name and len(players) >= 11:
            squads[team_name] = players

    return squads


def _parse_table_row(cells: list) -> dict | None:
    """Parse a <tr> with cells like [No, Position, Name] or [Position, Name]."""
    if len(cells) < 2:
        return None
    texts = [" ".join((c.text_content() or "").split()) for c in cells]
    # Remove empty cells
    texts = [t for t in texts if t]

    if len(texts) < 2:
        return None

    # Try to identify number, position, name columns
    number = None
    position = ""
    name = ""

    for t in texts:
        if t.isdigit() and len(t) <= 2 and number is None:
            number = int(t)
        elif _looks_like_position(t):
            position = t
        elif len(t) > 3 and not t.isdigit():
            name = t
            break

    if name and position:
        return {"pos": _translate_position(position), "name": name, "no": number or 0}
    if name and not position:
        # Two-column format: [Name, Position] or [Position, Name]
        other = texts[0] if texts[1] == name else texts[1]
        if _looks_like_position(other):
            return {"pos": _translate_position(other), "name": name, "no": number or 0}
    return None


def _parse_player_list(items: list[dict]) -> list[dict]:
    """Convert a list of player dicts (from JSON) to our format."""
    result: list[dict] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        name = item.get("name") or item.get("playerName") or ""
        pos = item.get("position") or item.get("pos") or item.get("role") or ""
        no = item.get("number") or item.get("no") or item.get("shirtNumber") or item.get("jersey") or 0
        try:
            no = int(no)
        except (ValueError, TypeError):
            no = 0
        if name and pos:
            result.append({"pos": _translate_position(str(pos)), "name": str(name), "no": no})
    return result


def _parse_text_as_player(text: str) -> dict | None:
    """Parse a single text line as a player entry. e.g. '1. Zion Suzuki (Goalkeeper)'"""
    import re

    # Pattern: "Number. PlayerName (Position)" or "Number PlayerName — Position"
    m = re.match(r"(\d{1,2})[\.\)]\s*(.+?)\s*[\(（—–-]\s*(.+?)\s*[\)）]", text)
    if m:
        return {
            "no": int(m.group(1)),
            "name": m.group(2).strip(),
            "pos": _translate_position(m.group(3).strip()),
        }

    # Pattern: "PlayerName — Position"
    m = re.match(r"(.+?)\s*[—–-]\s*(.+)$", text)
    if m:
        name = m.group(1).strip()
        pos = m.group(2).strip()
        if _looks_like_position(pos) and _looks_like_name(name):
            return {"no": 0, "name": name, "pos": _translate_position(pos)}

    return None


def _looks_like_position(text: str) -> bool:
    """Heuristic: does this text look like a football position?"""
    t = text.strip().lower()
    return t in _POSITION_MAP


def _looks_like_name(text: str) -> bool:
    """Heuristic: does this text look like a person's name?"""
    t = text.strip()
    parts = t.split()
    if len(parts) < 2:
        return False
    # Names have capital first letters per word and no digits
    return all(p[0].isupper() for p in parts if p) and not any(c.isdigit() for c in t)


async def _fetch_scores(m: Match) -> tuple[int, int] | None:
    """
    Try to fetch actual scores from an external API.
    Placeholder — extend with real API integration when available.

    Set WORLDCUP_SCORES_API_URL in .env to enable.
    Expected API response format:
      {"home_score": 2, "away_score": 1}
    """
    from app.core.config import settings

    api_url = getattr(settings, "WORLDCUP_SCORES_API_URL", None)
    if not api_url:
        return None

    try:
        import aiohttp

        async with aiohttp.ClientSession() as session:
            url = f"{api_url}?home_team={m.team_a_name}&away_team={m.team_b_name}&date={m.date.isoformat()}"
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return (int(data.get("home_score", 0)), int(data.get("away_score", 0)))
    except Exception as e:
        logger.warning("Failed to fetch scores for match #%d: %s", m.id, e)

    return None
