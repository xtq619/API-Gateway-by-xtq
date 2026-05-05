import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, async_session
from app.core.dependencies import get_current_user_id
from app.core.security import decode_access_token
from app.models.model_registry import ModelRegistry
from app.schemas.battle import BattleHistoryList, BattleHistoryResponse, BattleRequest, BattleTurn
from app.services import battle_service

router = APIRouter(prefix="/battle", tags=["battle"])


@router.post("/stream")
async def start_battle(
    req: BattleRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    # Validate models
    models = {}
    for label, model_id in [("a", req.model_a_id), ("b", req.model_b_id), ("judge", req.judge_model_id)]:
        result = await db.execute(
            select(ModelRegistry).where(ModelRegistry.id == model_id, ModelRegistry.is_enabled == True)
        )
        model = result.scalar_one_or_none()
        if not model:
            raise HTTPException(status_code=404, detail=f"模型 {label} 不存在或未启用")
        models[label] = model

    async def event_generator():
        async for event in battle_service.run_battle(
            db=db,
            topic=req.topic,
            model_a=models["a"],
            model_b=models["b"],
            judge_model=models["judge"],
            rounds=req.rounds,
            user_id=uuid.UUID(user_id),
        ):
            yield f"data: {event}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/history", response_model=BattleHistoryList)
async def list_history(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0),
):
    items, total = await battle_service.list_battle_history(db, uuid.UUID(user_id), limit, offset)
    return BattleHistoryList(
        items=[
            BattleHistoryResponse(
                id=record.id,
                topic=record.topic,
                model_a_name=record.model_a_name,
                model_b_name=record.model_b_name,
                judge_model_name=record.judge_model_name,
                rounds=record.rounds,
                history=[BattleTurn(**t) for t in record.history] if record.history else None,
                judge_summary=record.judge_summary,
                created_at=record.created_at,
            )
            for record in items
        ],
        total=total,
    )


@router.get("/history/{battle_id}", response_model=BattleHistoryResponse)
async def get_battle_detail(
    battle_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    record = await battle_service.get_battle_by_id(db, uuid.UUID(battle_id), uuid.UUID(user_id))
    if not record:
        raise HTTPException(status_code=404, detail="对战记录不存在")
    return BattleHistoryResponse(
        id=record.id,
        topic=record.topic,
        model_a_name=record.model_a_name,
        model_b_name=record.model_b_name,
        judge_model_name=record.judge_model_name,
        rounds=record.rounds,
        history=[BattleTurn(**t) for t in record.history] if record.history else None,
        judge_summary=record.judge_summary,
        created_at=record.created_at,
    )


@router.websocket("/ws")
async def battle_ws(ws: WebSocket):
    await ws.accept()

    # Authenticate via token query param
    token = ws.query_params.get("token")
    if not token:
        await ws.send_json({"type": "error", "detail": "缺少 token"})
        await ws.close()
        return

    payload = decode_access_token(token)
    if not payload:
        await ws.send_json({"type": "error", "detail": "token 无效或已过期"})
        await ws.close()
        return

    user_id = payload.get("sub")
    if not user_id:
        await ws.send_json({"type": "error", "detail": "token 缺少用户信息"})
        await ws.close()
        return

    try:
        # Receive battle config
        raw = await ws.receive_text()
        config = json.loads(raw)
        topic = config.get("topic", "")
        model_a_id = config.get("model_a_id")
        model_b_id = config.get("model_b_id")
        judge_model_id = config.get("judge_model_id")
        rounds = config.get("rounds", 2)

        if not all([topic, model_a_id, model_b_id, judge_model_id]):
            await ws.send_json({"type": "error", "detail": "缺少必要参数"})
            await ws.close()
            return

        async with async_session() as db:
            models = {}
            for label, model_id in [("a", model_a_id), ("b", model_b_id), ("judge", judge_model_id)]:
                result = await db.execute(
                    select(ModelRegistry).where(ModelRegistry.id == model_id, ModelRegistry.is_enabled == True)
                )
                model = result.scalar_one_or_none()
                if not model:
                    await ws.send_json({"type": "error", "detail": f"模型 {label} 不存在或未启用"})
                    await ws.close()
                    return
                models[label] = model

            async for event in battle_service.run_battle(
                db=db,
                topic=topic,
                model_a=models["a"],
                model_b=models["b"],
                judge_model=models["judge"],
                rounds=rounds,
                user_id=uuid.UUID(user_id),
            ):
                await ws.send_text(event)

        await ws.close()
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await ws.send_json({"type": "error", "detail": str(e)})
            await ws.close()
        except Exception:
            pass
