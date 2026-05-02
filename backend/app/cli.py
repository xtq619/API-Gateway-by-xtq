"""CLI helper for managing the API Gateway."""
import asyncio
import sys
import uuid

from sqlalchemy import select

from app.core.database import async_session
from app.core.security import encrypt_api_key, hash_password
from app.models.api_key import ApiKey
from app.models.billing import BillingAccount, BillingTransaction
from app.models.model_registry import ModelRegistry
from app.models.usage_log import UsageLog
from app.models.user import User


async def create_admin(email: str, password: str, name: str = "Admin"):
    async with async_session() as db:
        result = await db.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none():
            print(f"User {email} already exists")
            return

        user = User(id=uuid.uuid4(), email=email, password_hash=hash_password(password), name=name, role="admin")
        db.add(user)
        await db.flush()
        billing = BillingAccount(user_id=user.id, balance=1000.0)
        db.add(billing)
        await db.commit()
        print(f"Admin user created: {email}")


async def add_model(provider: str, model_name: str, display_name: str,
                    base_url: str, api_key: str, pricing_input: float = 0.003,
                    pricing_output: float = 0.006, max_tokens: int = 4096):
    async with async_session() as db:
        model = ModelRegistry(
            provider=provider,
            model_name=model_name,
            display_name=display_name,
            base_url=base_url,
            api_key_encrypted=encrypt_api_key(api_key),
            pricing_input=pricing_input,
            pricing_output=pricing_output,
            max_tokens_limit=max_tokens,
        )
        db.add(model)
        await db.commit()
        print(f"Model added: {model_name} ({provider})")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python -m app.cli create-admin <email> <password> [name]")
        print("  python -m app.cli add-model <provider> <model_name> <display_name> <base_url> <api_key> [pricing_input] [pricing_output] [max_tokens]")
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "create-admin":
        email = sys.argv[2]
        password = sys.argv[3]
        name = sys.argv[4] if len(sys.argv) > 4 else "Admin"
        asyncio.run(create_admin(email, password, name))
    elif cmd == "add-model":
        provider = sys.argv[2]
        model_name = sys.argv[3]
        display_name = sys.argv[4]
        base_url = sys.argv[5]
        api_key = sys.argv[6]
        pricing_input = float(sys.argv[7]) if len(sys.argv) > 7 else 0.003
        pricing_output = float(sys.argv[8]) if len(sys.argv) > 8 else 0.006
        max_tokens = int(sys.argv[9]) if len(sys.argv) > 9 else 4096
        asyncio.run(add_model(provider, model_name, display_name, base_url, api_key, pricing_input, pricing_output, max_tokens))
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)
