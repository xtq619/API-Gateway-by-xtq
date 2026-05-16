import json
import logging
import re
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.model_registry import ModelRegistry
from app.models.worldcup import EmotionVote, Guess

logger = logging.getLogger(__name__)

VALID_EMOTIONS = {"excited", "nervous", "disappointed", "ecstatic", "calm"}


async def submit_guess(db: AsyncSession, user_id: uuid.UUID, match_id: int, score_a: int, score_b: int) -> Guess:
    result = await db.execute(
        select(Guess).where(Guess.user_id == user_id, Guess.match_id == match_id)
    )
    guess = result.scalar_one_or_none()

    if guess:
        guess.score_a = score_a
        guess.score_b = score_b
        guess.updated_at = datetime.now(timezone.utc)
    else:
        guess = Guess(user_id=user_id, match_id=match_id, score_a=score_a, score_b=score_b)
        db.add(guess)

    await db.commit()
    await db.refresh(guess)
    return guess


async def get_user_guesses(db: AsyncSession, user_id: uuid.UUID) -> list[Guess]:
    result = await db.execute(
        select(Guess).where(Guess.user_id == user_id).order_by(Guess.match_id)
    )
    return list(result.scalars().all())


async def submit_emotion(db: AsyncSession, user_id: uuid.UUID, match_id: int, emotion: str) -> EmotionVote:
    if emotion not in VALID_EMOTIONS:
        raise ValueError(f"无效的情绪类型: {emotion}")

    result = await db.execute(
        select(EmotionVote).where(EmotionVote.user_id == user_id, EmotionVote.match_id == match_id)
    )
    vote = result.scalar_one_or_none()

    if vote:
        vote.emotion = emotion
    else:
        vote = EmotionVote(user_id=user_id, match_id=match_id, emotion=emotion)
        db.add(vote)

    await db.commit()
    await db.refresh(vote)
    return vote


async def get_emotion_stats(db: AsyncSession, match_id: int, user_id: uuid.UUID | None = None) -> dict:
    # Get total count
    total_q = select(func.count(EmotionVote.id)).where(EmotionVote.match_id == match_id)
    total = (await db.execute(total_q)).scalar() or 0

    # Get counts per emotion
    q = (
        select(EmotionVote.emotion, func.count(EmotionVote.id).label("count"))
        .where(EmotionVote.match_id == match_id)
        .group_by(EmotionVote.emotion)
    )
    rows = (await db.execute(q)).all()
    count_map = {row.emotion: row.count for row in rows}

    # Get user's own vote
    my_emotion = None
    if user_id:
        my_q = select(EmotionVote.emotion).where(
            EmotionVote.match_id == match_id, EmotionVote.user_id == user_id
        )
        my_emotion = (await db.execute(my_q)).scalar_one_or_none()

    # Build stats for all emotion types
    stats = []
    for emo in VALID_EMOTIONS:
        count = count_map.get(emo, 0)
        pct = round((count / total) * 100) if total > 0 else 0
        stats.append({"emotion": emo, "count": count, "pct": pct})

    return {"match_id": match_id, "my_emotion": my_emotion, "stats": stats}


# ---------------------------------------------------------------------------
# Match Analysis (AI-powered)
# ---------------------------------------------------------------------------

SYSTEM_PROMPT_ANALYSIS = (
    "你是一位资深足球战术分析师，精通球队战术、球员能力和比赛预测。"
    "请对世界杯比赛进行全面分析。"
    "你的回答必须是一个 JSON 对象，包含以下字段（每个字段的值为字符串）：\n"
    "- team_styles: 两队风格对比（控球/反击/高位压迫等），各 2-3 句话\n"
    "- tactical_comparison: 战术博弈分析（中场争夺、边路进攻、定位球等），3-5 句话\n"
    "- key_players: 关键球员分析，每队 2-3 人，含作用说明\n"
    "- historical: 历史交锋记录，2-3 句话\n"
    "- lineup_prediction: 预计阵容（阵型、关键位置人员），各 2-3 句话\n"
    "- injury_concerns: 伤病和停赛影响，1-3 句话\n"
    "- odds_reference: 胜平负概率估算（基于球队实力和历史数据），1-2 句话\n"
    "- score_prediction: 比分预测 + 简要理由，2-3 句话\n"
    "直接输出 JSON，不要包含任何其他内容、思考过程或 markdown 代码块标记。"
)


def _build_analysis_prompt(team_a: str, team_b: str) -> tuple[str, str]:
    user_msg = (
        f"请分析 2026 世界杯比赛：{team_a} vs {team_b}。"
        f"请从战术风格、关键球员、历史交锋、阵容预测、伤病情况、胜率估算和比分预测等多个维度进行全面分析。"
    )
    return SYSTEM_PROMPT_ANALYSIS, user_msg


def _strip_thinking(content: str) -> str:
    """Remove reasoning model <think> blocks from output."""
    return re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()


async def _select_analysis_model(db: AsyncSession) -> ModelRegistry:
    """Select the best model for match analysis — prefer reasoning models."""
    result = await db.execute(
        select(ModelRegistry).where(ModelRegistry.is_enabled == True)
    )
    models = result.scalars().all()
    if not models:
        raise HTTPException(status_code=503, detail="没有可用的模型")

    reasoning = [m for m in models if m.is_reasoning]
    if reasoning:
        chosen = reasoning[0]
        logger.info("Analysis: selected reasoning model %s", chosen.display_name)
        return chosen

    chosen = models[0]
    logger.info("Analysis: selected chat model %s (no reasoning model available)", chosen.display_name)
    return chosen


def _parse_analysis_response(raw: str) -> dict:
    """Parse JSON from LLM response, with error handling."""
    cleaned = _strip_thinking(raw).strip()

    # Strip markdown code fences if present
    if cleaned.startswith("```"):
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1:
            cleaned = cleaned[start:end + 1]

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("Failed to parse analysis JSON, returning raw: %s", cleaned[:300])
        return {"raw_text": cleaned}

    defaults = {
        "team_styles": "暂无数据",
        "tactical_comparison": "暂无数据",
        "key_players": "暂无数据",
        "historical": "暂无数据",
        "lineup_prediction": "暂无数据",
        "injury_concerns": "暂无数据",
        "odds_reference": "暂无数据",
        "score_prediction": "暂无数据",
    }
    for field, default in defaults.items():
        if field not in parsed:
            logger.warning("Analysis response missing field '%s'", field)
            parsed.setdefault(field, default)

    return parsed


def _log_analysis_event(team_a: str, team_b: str, model_name: str, success: bool = True, error: str = ""):
    if success:
        logger.info("Analysis completed: %s vs %s [model=%s]", team_a, team_b, model_name)
    else:
        logger.warning("Analysis failed: %s vs %s [model=%s, error=%s]", team_a, team_b, model_name, error)


async def run_match_analysis(db: AsyncSession, team_a: str, team_b: str, _user_id: str) -> dict:
    from app.services.proxy_service import proxy_service

    model = await _select_analysis_model(db)
    system_prompt, user_prompt = _build_analysis_prompt(team_a, team_b)

    request_body = {
        "model": model.model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": 2048,
        "temperature": 0.5,
    }

    try:
        resp_body, _, _usage_log = await proxy_service.chat_completion(
            model=model,
            request_body=request_body,
            request_headers={},
            request_ip=None,
        )

        msg = resp_body["choices"][0]["message"]
        raw = msg.get("content", "") or msg.get("reasoning_content", "") or ""
        parsed = _parse_analysis_response(raw)

        _log_analysis_event(team_a, team_b, model.display_name, success=True)

        return {
            "analysis": parsed,
            "model": model.display_name,
            "team_a": team_a,
            "team_b": team_b,
        }
    except Exception as e:
        _log_analysis_event(team_a, team_b, model.display_name, success=False, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))