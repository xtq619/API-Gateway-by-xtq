"""user_digest_prefs

Revision ID: be5f6a7b8c9d
Revises: ad4e5f6a7b8c
Create Date: 2026-05-03 23:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'be5f6a7b8c9d'
down_revision: Union[str, None] = 'ad4e5f6a7b8c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('user_digest_prefs',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
    sa.Column('is_enabled', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('email', sa.String(length=255), server_default='', nullable=False),
    sa.Column('send_time', sa.String(length=5), server_default='08:00', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id'),
    )


def downgrade() -> None:
    op.drop_table('user_digest_prefs')
