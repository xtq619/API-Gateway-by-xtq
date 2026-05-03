"""ai_news

Revision ID: 8b2c3d4e5f6g
Revises: 7a1b2c3d4e5f
Create Date: 2026-05-03 14:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '8b2c3d4e5f6g'
down_revision: Union[str, None] = '7a1b2c3d4e5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('ai_news',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('title', sa.String(length=300), nullable=False),
    sa.Column('summary', sa.Text(), nullable=False),
    sa.Column('content', sa.Text(), nullable=True),
    sa.Column('category', sa.String(length=20), server_default='新闻', nullable=False),
    sa.Column('source_name', sa.String(length=100), nullable=False),
    sa.Column('source_url', sa.String(length=1000), nullable=True),
    sa.Column('is_published', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('ai_news')
