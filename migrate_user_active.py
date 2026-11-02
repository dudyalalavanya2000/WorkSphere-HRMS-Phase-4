
from sqlalchemy import inspect, text

from app.database import engine


def migrate():
    inspector = inspect(engine)

    if "users" not in inspector.get_table_names():
        raise RuntimeError(
            "The users table does not exist. Check your database configuration."
        )

    columns = {
        column["name"]
        for column in inspector.get_columns("users")
    }

    if "is_active" in columns:
        print("Migration already applied. No changes needed.")
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE users "
                "ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1"
            )
        )

    print("Migration successful. Existing accounts remain active.")


if __name__ == "__main__":
    migrate()
