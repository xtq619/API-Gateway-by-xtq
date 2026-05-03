"""feedback

Revision ID: 7a1b2c3d4e5f
Revises: fa43d14845ee
Create Date: 2026-05-03 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '7a1b2c3d4e5f'
down_revision: Union[str, None] = 'fa43d14845ee'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('feedbacks',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('category', sa.String(length=20), server_default='suggestion', nullable=False),
    sa.Column('status', sa.String(length=20), server_default='pending', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_feedbacks_user_id'), 'feedbacks', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_feedbacks_user_id'), table_name='feedbacks')
    op.drop_table('feedbacks')
