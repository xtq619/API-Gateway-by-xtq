import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.schemas.worldcup import EmotionResponse, EmotionSubmit, GuessList, GuessResponse, GuessSubmit
from app.services import worldcup_service

router = APIRouter(prefix="/worldcup", tags=["worldcup"])


@router.post("/guess/{match_id}", response_model=GuessResponse)
async def submit_guess(
    match_id: int,
    req: GuessSubmit,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    guess = await worldcup_service.submit_guess(
        db, uuid.UUID(user_id), match_id, req.score_a, req.score_b
    )
    return GuessResponse(
        id=guess.id, match_id=guess.match_id,
        score_a=guess.score_a, score_b=guess.score_b,
        created_at=guess.created_at, updated_at=guess.updated_at,
    )


@router.get("/guesses", response_model=GuessList)
async def get_my_guesses(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    guesses = await worldcup_service.get_user_guesses(db, uuid.UUID(user_id))
    return GuessList(
        items=[GuessResponse(
            id=g.id, match_id=g.match_id,
            score_a=g.score_a, score_b=g.score_b,
            created_at=g.created_at, updated_at=g.updated_at,
        ) for g in guesses],
    )


@router.post("/emotion/{match_id}", response_model=EmotionResponse)
async def submit_emotion(
    match_id: int,
    req: EmotionSubmit,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        await worldcup_service.submit_emotion(db, uuid.UUID(user_id), match_id, req.emotion)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return await worldcup_service.get_emotion_stats(db, match_id, uuid.UUID(user_id))


@router.get("/emotion/{match_id}", response_model=EmotionResponse)
async def get_emotions(
    match_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await worldcup_service.get_emotion_stats(db, match_id, uuid.UUID(user_id))


@router.post("/analysis")
async def analyze_match(
    body: dict,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    team_a = body.get("team_a", "")
    team_b = body.get("team_b", "")
    if not team_a or not team_b:
        raise HTTPException(status_code=400, detail="缺少队伍名称")

    return await worldcup_service.run_match_analysis(db, team_a, team_b, user_id)
