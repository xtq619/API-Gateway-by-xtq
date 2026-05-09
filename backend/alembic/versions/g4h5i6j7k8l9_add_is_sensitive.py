"""add is_sensitive to ai_news

Revision ID: g4h5i6j7k8l9
Revises: f3a4b5c6d7e8
Create Date: 2026-05-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'g4h5i6j7k8l9'
down_revision: Union[str, None] = 'f3a4b5c6d7e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('ai_news', sa.Column('is_sensitive', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('ai_news', 'is_sensitive')
