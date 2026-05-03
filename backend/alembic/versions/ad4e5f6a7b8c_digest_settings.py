"""digest_settings

Revision ID: ad4e5f6a7b8c
Revises: 9c3d4e5f6a7b
Create Date: 2026-05-03 22:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'ad4e5f6a7b8c'
down_revision: Union[str, None] = '9c3d4e5f6a7b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('digest_settings',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('smtp_host', sa.String(length=200), server_default='smtp.qq.com', nullable=False),
    sa.Column('smtp_port', sa.Integer(), server_default='465', nullable=False),
    sa.Column('smtp_user', sa.String(length=200), server_default='', nullable=False),
    sa.Column('smtp_password', sa.Text(), server_default='', nullable=False),
    sa.Column('smtp_sender', sa.String(length=200), server_default='', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('digest_settings')
