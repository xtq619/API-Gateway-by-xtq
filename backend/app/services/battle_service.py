import json
import logging
import uuid
from datetime import datetime

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.battle import BattleRecord
from app.models.model_registry import ModelRegistry
from app.services.proxy_service import proxy_service

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_A = (
    "你是一位严谨的辩论者，风格理性、逻辑清晰，像工程师一样用事实和推理说话。\n"
    "规则：\n"
    "- 针对对方观点进行回应、反驳或补充\n"
    "- 每轮提供新的信息或观点，不要重复\n"
    "- 控制在100-150字\n"
    "- 直接输出观点，不要寒暄"
)

SYSTEM_PROMPT_B = (
    "你是一位有个性的辩论者，风格直接、有锋芒，敢于表达鲜明观点。\n"
    "规则：\n"
    "- 针对对方观点进行回应、反驳或补充\n"
    "- 每轮提供新的信息或观点，不要重复\n"
    "- 控制在100-150字\n"
    "- 直接输出观点，不要寒暄"
)

JUDGE_PROMPT = (
    "你是一位中立的裁判，负责总结这场辩论。\n"
    "请完成以下任务：\n"
    "1. 简要概括双方的核心观点（各3-5句话）\n"
    "2. 分析双方论证的逻辑性和说服力\n"
    "3. 给出你的评判：谁的论点更有说服力，为什么\n"
    "4. 用 Markdown 格式输出，控制在300字以内"
)


def _build_messages(topic: str, history: list[dict], system_prompt: str) -> list[dict]:
    messages = [{"role": "system", "content": system_prompt}]
    messages.append({"role": "user", "content": f"讨论主题：{topic}\n\n请就此主题发表你的第一轮观点。"})
    # Add recent history (last 6 messages = 3 rounds)
    for turn in history[-6:]:
        messages.append({"role": "user", "content": turn["content"]})
    if len(history) > 0:
        # Replace the first user message with context-aware prompt
        messages[1] = {
            "role": "user",
            "content": f"讨论主题：{topic}\n\n对方上一轮的观点：\n{history[-1]['content']}\n\n请针对以上观点进行回应（不要总结，直接反驳或补充新观点）。",
        }
    return messages


import re


def _strip_thinking(content: str) -> str:
    return re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()


async def _call_model(model: ModelRegistry, messages: list[dict]) -> str:
    body = {"model": model.model_name, "messages": messages, "stream": False}
    try:
        resp_body, _, _ = await proxy_service.chat_completion(model, body, {})
        return _strip_thinking(resp_body["choices"][0]["message"]["content"])
    except Exception as e:
        logger.error("Battle model call failed: %s", e)
        raise


async def run_battle(
    db: AsyncSession,
    topic: str,
    model_a: ModelRegistry,
    model_b: ModelRegistry,
    judge_model: ModelRegistry,
    rounds: int,
    user_id: uuid.UUID,
):
    history: list[dict] = []

    try:
        for r in range(1, rounds + 1):
            # Model A turn
            messages_a = _build_messages(topic, history, SYSTEM_PROMPT_A)
            content_a = await _call_model(model_a, messages_a)
            turn_a = {"round": r, "model": "a", "model_name": model_a.display_name, "content": content_a}
            history.append(turn_a)
            yield json.dumps({"type": "turn", **turn_a}, ensure_ascii=False)

            # Model B turn
            messages_b = _build_messages(topic, history, SYSTEM_PROMPT_B)
            content_b = await _call_model(model_b, messages_b)
            turn_b = {"round": r, "model": "b", "model_name": model_b.display_name, "content": content_b}
            history.append(turn_b)
            yield json.dumps({"type": "turn", **turn_b}, ensure_ascii=False)

        # Judge summary
        history_text = "\n\n".join(
            f"【{'辩手A' if t['model'] == 'a' else '辩手B'} 第{t['round']}轮】\n{t['content']}"
            for t in history
        )
        judge_messages = [
            {"role": "system", "content": JUDGE_PROMPT},
            {"role": "user", "content": f"辩论主题：{topic}\n\n以下是完整辩论记录：\n\n{history_text}"},
        ]
        judge_content = await _call_model(judge_model, judge_messages)
        yield json.dumps({"type": "judge", "content": judge_content}, ensure_ascii=False)

        # Save to database
        record = BattleRecord(
            user_id=user_id,
            topic=topic,
            model_a_name=model_a.display_name,
            model_b_name=model_b.display_name,
            judge_model_name=judge_model.display_name,
            rounds=rounds,
            history=history,
            judge_summary=judge_content,
            created_at=datetime.utcnow(),
        )
        db.add(record)
        await db.commit()

        yield json.dumps({"type": "done", "record_id": str(record.id)}, ensure_ascii=False)
    except Exception as e:
        logger.error("Battle error: %s", e, exc_info=True)
        yield json.dumps({"type": "error", "detail": str(e)}, ensure_ascii=False)


async def list_battle_history(db: AsyncSession, user_id: uuid.UUID, limit: int, offset: int):
    from sqlalchemy import func, select

    total_q = select(func.count(BattleRecord.id)).where(BattleRecord.user_id == user_id)
    total = (await db.execute(total_q)).scalar() or 0

    q = (
        select(BattleRecord)
        .where(BattleRecord.user_id == user_id)
        .order_by(BattleRecord.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = list((await db.execute(q)).scalars().all())
    return items, total


async def get_battle_by_id(db: AsyncSession, battle_id: uuid.UUID, user_id: uuid.UUID) -> BattleRecord | None:
    from sqlalchemy import select

    result = await db.execute(
        select(BattleRecord).where(BattleRecord.id == battle_id, BattleRecord.user_id == user_id)
    )
    return result.scalar_one_or_none()
