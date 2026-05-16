"""add is_reasoning column to model_registry

Revision ID: k8l9m0n1o2p3
Revises: j7k8l9m0n1o2
Create Date: 2026-05-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'k8l9m0n1o2p3'
down_revision: Union[str, None] = 'j7k8l9m0n1o2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('model_registry', sa.Column('is_reasoning', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('model_registry', 'is_reasoning')
