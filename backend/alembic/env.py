from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from app.core.config import settings
from app.core.database import Base

# Import all models so Base.metadata includes them
from app.models.user import User
from app.models.api_key import ApiKey, api_key_models
from app.models.model_registry import ModelRegistry
from app.models.usage_log import UsageLog
from app.models.billing import BillingAccount, BillingTransaction
from app.models.feedback import Feedback
from app.models.ai_news import AiNews
from app.models.battle import BattleRecord
from app.models.digest import DigestSetting
from app.models.user_digest import UserDigestPref
from app.models.news_setting import NewsSetting
from app.models.hub_content import HubContent
from app.models.worldcup import Guess, EmotionVote

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", settings.DATABASE_URL_SYNC)

target_metadata = Base.metadata


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = create_engine(
        settings.DATABASE_URL_SYNC,
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
