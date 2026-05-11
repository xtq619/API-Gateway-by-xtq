"""add avatar_url to users

Revision ID: h5i6j7k8l9m0
Revises: g4h5i6j7k8l9
Create Date: 2026-05-11
"""

from alembic import op
import sqlalchemy as sa

revision = 'h5i6j7k8l9m0'
down_revision = 'g4h5i6j7k8l9'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('users', sa.Column('avatar_url', sa.String(500), nullable=True))

def downgrade():
    op.drop_column('users', 'avatar_url')
