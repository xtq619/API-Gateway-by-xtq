"""add wx_openid to users

Revision ID: d1a2b3c4d5e6
Revises: cf6a7b8c9d0e
Create Date: 2026-05-05

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d1a2b3c4d5e6"
down_revision = "cf6a7b8c9d0e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("wx_openid", sa.String(64), nullable=True))
    op.create_index(op.f("ix_users_wx_openid"), "users", ["wx_openid"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_wx_openid"), table_name="users")
    op.drop_column("users", "wx_openid")
