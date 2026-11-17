
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

        # Questions the user stopped while the agents were working
        connection.execute("""
            CREATE TABLE IF NOT EXISTS cancelled_requests (
                request_id TEXT PRIMARY KEY,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Sign-in: the latest emailed code for each address (only its hash is kept)
        connection.execute("""
            CREATE TABLE IF NOT EXISTS login_codes (
                email TEXT PRIMARY KEY,
                code_hash TEXT NOT NULL,
                expires_at BIGINT NOT NULL,
                sent_at BIGINT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0
            )
        """)

        # Sign-in: who each session token belongs to (only the token's hash is kept)
        connection.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                email TEXT NOT NULL,
                expires_at BIGINT NOT NULL
            )
        """)

        # How many questions each person asked on each day
        connection.execute("""
            CREATE TABLE IF NOT EXISTS usage (
                email TEXT NOT NULL,
                day TEXT NOT NULL,
                questions INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (email, day)
            )
        """)

        # Each conversation belongs to the person who started it
        if USE_POSTGRES:
            connection.execute("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_email TEXT")
        else:
            columns = [row["name"] for row in connection.execute("PRAGMA table_info(conversations)").fetchall()]
            if "user_email" not in columns:
                connection.execute("ALTER TABLE conversations ADD COLUMN user_email TEXT")


def create_conversation(conversation_id, title, user_email=None):
    # Create a new conversation for the person who asked
    with get_connection() as connection:
        connection.execute(
            _sql("""
            INSERT INTO conversations (id, title, user_email)
            VALUES (?, ?, ?)
            """),
            (conversation_id, title, user_email)
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


def get_conversations(user_email):
    # Retrieve one person's conversations, newest first
    # SQLite saves times to the second, so its hidden rowid breaks ties; Postgres saves finer times
    order = "created_at DESC" if USE_POSTGRES else "created_at DESC, rowid DESC"

    with get_connection() as connection:
        rows = connection.execute(
            _sql(f"""
            SELECT id, title, created_at
            FROM conversations
            WHERE user_email = ?
            ORDER BY {order}
            """),
            (user_email,)
        ).fetchall()

    return [_row(row) for row in rows]


def get_conversation(conversation_id):
    # Retrieve one conversation by its ID
    with get_connection() as connection:
        row = connection.execute(
            _sql("""
            SELECT id, title, created_at, user_email
            FROM conversations
            WHERE id = ?
            """),
            (conversation_id,)
        ).fetchone()

    return _row(row) if row else None


def cancel_request(request_id):
    # Mark a question as stopped by the user
    with get_connection() as connection:
        connection.execute(
            _sql("""
            INSERT INTO cancelled_requests (request_id)
            VALUES (?)
            ON CONFLICT (request_id) DO NOTHING
            """),
            (request_id,)
        )


def is_cancelled(request_id):
    # Check whether the user stopped this question
    with get_connection() as connection:
        row = connection.execute(
            _sql("""
            SELECT 1 FROM cancelled_requests
            WHERE request_id = ?
            """),
            (request_id,)
        ).fetchone()

    return row is not None


# ---------- Sign-in ----------

def save_login_code(email, code_hash, expires_at, sent_at):
    # Keep only the newest code for an address
    with get_connection() as connection:
        connection.execute(
            _sql("""
            INSERT INTO login_codes (email, code_hash, expires_at, sent_at, attempts)
            VALUES (?, ?, ?, ?, 0)
            ON CONFLICT (email) DO UPDATE SET
                code_hash = excluded.code_hash,
                expires_at = excluded.expires_at,
                sent_at = excluded.sent_at,
                attempts = 0
            """),
            (email, code_hash, expires_at, sent_at)
        )


def get_login_code(email):
    with get_connection() as connection:
        row = connection.execute(
            _sql("SELECT code_hash, expires_at, sent_at, attempts FROM login_codes WHERE email = ?"),
            (email,)
        ).fetchone()
    return dict(row) if row else None


def count_codes_sent_since(since):
    # How many addresses were sent a code recently (limits how much email the app can send)
    with get_connection() as connection:
        row = connection.execute(
            _sql("SELECT COUNT(*) AS n FROM login_codes WHERE sent_at >= ?"),
            (since,)
        ).fetchone()
    return row["n"]


def add_code_attempt(email):
    with get_connection() as connection:
        connection.execute(
            _sql("UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?"),
            (email,)
        )


def delete_login_code(email):
    with get_connection() as connection:
        connection.execute(_sql("DELETE FROM login_codes WHERE email = ?"), (email,))


def create_session(token_hash, email, expires_at):
    with get_connection() as connection:
        connection.execute(
            _sql("INSERT INTO sessions (token_hash, email, expires_at) VALUES (?, ?, ?)"),
            (token_hash, email, expires_at)
        )


def get_session_email(token_hash, now):
    # The signed-in address for a session token, or None if it is unknown or expired
    with get_connection() as connection:
        row = connection.execute(
            _sql("SELECT email FROM sessions WHERE token_hash = ? AND expires_at > ?"),
            (token_hash, now)
        ).fetchone()
    return row["email"] if row else None


def delete_session(token_hash):
    with get_connection() as connection:
        connection.execute(_sql("DELETE FROM sessions WHERE token_hash = ?"), (token_hash,))


# ---------- Daily question limits ----------

def get_usage(email, day):
    with get_connection() as connection:
        row = connection.execute(
            _sql("SELECT questions FROM usage WHERE email = ? AND day = ?"),
            (email, day)
        ).fetchone()
    return row["questions"] if row else 0


def get_total_usage(day):
    with get_connection() as connection:
        row = connection.execute(
            _sql("SELECT COALESCE(SUM(questions), 0) AS n FROM usage WHERE day = ?"),
            (day,)
        ).fetchone()
    return row["n"]


def add_usage(email, day):
    # Count one question for this person today
    with get_connection() as connection:
        connection.execute(
            _sql("""
            INSERT INTO usage (email, day, questions)
            VALUES (?, ?, 1)
            ON CONFLICT (email, day) DO UPDATE SET questions = usage.questions + 1
            """),
            (email, day)
        )


if __name__ == "__main__":
    init_db()
    print("Database initialized successfully!")
