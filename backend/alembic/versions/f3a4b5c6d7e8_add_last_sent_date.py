"""add last_sent_date to user_digest_prefs

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-05-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f3a4b5c6d7e8'
down_revision: Union[str, None] = 'e2f3a4b5c6d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user_digest_prefs', sa.Column('last_sent_date', sa.String(10), nullable=True))


def downgrade() -> None:
    op.drop_column('user_digest_prefs', 'last_sent_date')
