
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# When the app is hosted (Vercel), DATABASE_URL points at a Postgres database (Neon).
# Without it, the app keeps using a SQLite file inside the backend folder.
DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
USE_POSTGRES = bool(DATABASE_URL)

# Store the SQLite database inside the backend folder
DB_PATH = Path(__file__).resolve().parent / "conversations.db"

if USE_POSTGRES:
    import psycopg
    from psycopg.rows import dict_row


def _sql(query):
    # SQLite marks parameters with ?, Postgres with %s
    return query.replace("?", "%s") if USE_POSTGRES else query


def _row(row):
    # Turn a database row into a plain dict, with dates written the way SQLite writes them
    data = dict(row)
    for key, value in data.items():
        if isinstance(value, datetime):
            data[key] = value.strftime("%Y-%m-%d %H:%M:%S")
    return data


@contextmanager
def get_connection():
    # Open a connection, commit when the block finishes, and always close it
    if USE_POSTGRES:
        # prepare_threshold=None keeps it working through Neon's connection pooler
        connection = psycopg.connect(DATABASE_URL, row_factory=dict_row, prepare_threshold=None)
    else:
        connection = sqlite3.connect(DB_PATH)

        # Enable foreign key constraints
        connection.execute("PRAGMA foreign_keys = ON")

        # Allow rows to be accessed by column name
        connection.row_factory = sqlite3.Row

    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def init_db():
    # Create the database tables if they do not exist
    # Postgres numbers rows with SERIAL, SQLite with AUTOINCREMENT
    auto_id = "SERIAL PRIMARY KEY" if USE_POSTGRES else "INTEGER PRIMARY KEY AUTOINCREMENT"

    with get_connection() as connection:

        # Stores each conversation
        connection.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Stores messages belonging to conversations
        connection.execute(f"""
            CREATE TABLE IF NOT EXISTS messages (
                id {auto_id},
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (conversation_id)
                    REFERENCES conversations(id)
            )
        """)

        # Stores evidence linked to a specific AI response
        connection.execute(f"""
            CREATE TABLE IF NOT EXISTS evidence (
                id {auto_id},
                message_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                content TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (message_id)
                    REFERENCES messages(id)
                    ON DELETE CASCADE
            )
        """)

        # Speed up evidence lookups by message ID
        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_evidence_message
            ON evidence(message_id)
        """)


def create_conversation(conversation_id, title):
    # Create a new conversation
    with get_connection() as connection:
        connection.execute(
            _sql("""
            INSERT INTO conversations (id, title)
            VALUES (?, ?)
            """),
            (conversation_id, title)
        )


def save_message(conversation_id, role, content):
    # Save a message to its conversation and return its new ID
    with get_connection() as connection:
        if USE_POSTGRES:
            row = connection.execute(
                _sql("""
                INSERT INTO messages (conversation_id, role, content)
                VALUES (?, ?, ?)
                RETURNING id
                """),
                (conversation_id, role, content)
            ).fetchone()
            return row["id"]

        cursor = connection.execute(
            """
            INSERT INTO messages (conversation_id, role, content)
            VALUES (?, ?, ?)
            """,
            (conversation_id, role, content)
        )
        return cursor.lastrowid


def save_evidence(message_id, sources):
    # Save Tavily evidence linked to one AI response
    rows = [
        (
            message_id,
            source.get("title", ""),
            source.get("url", ""),
            source.get("content", "")
        )
        for source in sources or []
        if source.get("url")
    ]

    if not rows:
        return

    with get_connection() as connection:
        connection.cursor().executemany(
            _sql("""
            INSERT INTO evidence (message_id, title, url, content)
            VALUES (?, ?, ?, ?)
            """),
            rows
        )


def get_evidence(message_id):
    # Retrieve all sources linked to an AI response
    with get_connection() as connection:
        rows = connection.execute(
            _sql("""
            SELECT id, title, url, content
            FROM evidence
            WHERE message_id = ?
            ORDER BY id ASC
            """),
            (message_id,)
        ).fetchall()

    return [_row(row) for row in rows]


def get_messages(conversation_id):
    # Retrieve messages in the order they were saved
    with get_connection() as connection:
        rows = connection.execute(
            _sql("""
            SELECT id, role, content
            FROM messages
            WHERE conversation_id = ?
            ORDER BY id ASC
            """),
            (conversation_id,)
        ).fetchall()

    return [_row(row) for row in rows]


def get_conversations():
    # Retrieve all conversations, newest first
    # SQLite saves times to the second, so its hidden rowid breaks ties; Postgres saves finer times
    order = "created_at DESC" if USE_POSTGRES else "created_at DESC, rowid DESC"

    with get_connection() as connection:
        rows = connection.execute(
            f"""
            SELECT id, title, created_at
            FROM conversations
            ORDER BY {order}
            """
        ).fetchall()

    return [_row(row) for row in rows]


def get_conversation(conversation_id):
    # Retrieve one conversation by its ID
    with get_connection() as connection:
        row = connection.execute(
            _sql("""
            SELECT id, title, created_at
            FROM conversations
            WHERE id = ?
            """),
            (conversation_id,)
        ).fetchone()

    return _row(row) if row else None


if __name__ == "__main__":
    init_db()
    print("Database initialized successfully!")
