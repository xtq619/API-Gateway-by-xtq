"""feedback_reply

Revision ID: 9c3d4e5f6a7b
Revises: 8b2c3d4e5f6g
Create Date: 2026-05-03 16:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '9c3d4e5f6a7b'
down_revision: Union[str, None] = '8b2c3d4e5f6g'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('feedbacks', sa.Column('reply', sa.Text(), nullable=True))
    op.add_column('feedbacks', sa.Column('replied_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('feedbacks', 'replied_at')
    op.drop_column('feedbacks', 'reply')
