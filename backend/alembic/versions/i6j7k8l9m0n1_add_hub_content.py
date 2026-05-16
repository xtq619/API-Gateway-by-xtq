"""add hub_content table

Revision ID: i6j7k8l9m0n1
Revises: h5i6j7k8l9m0
Create Date: 2026-05-12
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'i6j7k8l9m0n1'
down_revision: Union[str, None] = 'h5i6j7k8l9m0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'hub_content',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('key', sa.String(50), unique=True, nullable=False),
        sa.Column('title', sa.String(200), server_default=''),
        sa.Column('content', sa.Text, server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    # Insert default product thoughts
    op.execute("""
        INSERT INTO hub_content (id, key, title, content)
        VALUES (
            gen_random_uuid(),
            'product_thoughts',
            '关于这个产品',
            '这个产品还有很多的可能性。我们相信，技术最好的样子不是炫技，而是让你忘记技术的存在。就像你不会去想手机里有多少个晶体管，你只想给在乎的人发一条消息。我们想做的，就是这样一个入口——让不同的 AI 在这里对话、碰撞、融合，而你只需要提出你真正关心的问题。Think Different，不只是口号，是我们对产品最朴素的期待。'
        )
    """)


def downgrade() -> None:
    op.drop_table('hub_content')
