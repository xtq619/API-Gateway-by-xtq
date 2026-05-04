"""battle_records

Revision ID: cf6a7b8c9d0e
Revises: be5f6a7b8c9d
Create Date: 2026-05-04 11:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = 'cf6a7b8c9d0e'
down_revision: Union[str, None] = 'be5f6a7b8c9d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('battle_records',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
    sa.Column('topic', sa.Text(), nullable=False),
    sa.Column('model_a_name', sa.String(length=200), nullable=False),
    sa.Column('model_b_name', sa.String(length=200), nullable=False),
    sa.Column('judge_model_name', sa.String(length=200), server_default='', nullable=False),
    sa.Column('rounds', sa.Integer(), server_default='3', nullable=False),
    sa.Column('history', JSONB, nullable=True),
    sa.Column('judge_summary', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_battle_records_user_id', 'battle_records', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_battle_records_user_id', table_name='battle_records')
    op.drop_table('battle_records')
