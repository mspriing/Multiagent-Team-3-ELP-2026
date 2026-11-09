
import sqlite3
from pathlib import Path

# Store the database inside the backend folder
DB_PATH = Path(__file__).resolve().parent / "conversations.db"


def get_connection():
    # Open a connection to the SQLite database
    connection = sqlite3.connect(DB_PATH)

    # Enable foreign key constraints
    connection.execute("PRAGMA foreign_keys = ON")

    # Allow rows to be accessed by column name
    connection.row_factory = sqlite3.Row

    return connection


def init_db():
    # Create the database tables if they do not exist
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
        connection.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (conversation_id)
                    REFERENCES conversations(id)
            )
        """)

        # Stores evidence linked to a specific AI response
        connection.execute("""
            CREATE TABLE IF NOT EXISTS evidence (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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

        connection.commit()


def create_conversation(conversation_id, title):
    # Create a new conversation in SQLite
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO conversations (id, title)
            VALUES (?, ?)
            """,
            (conversation_id, title)
        )


def save_message(conversation_id, role, content):
    # Save a message to its conversation
    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO messages (conversation_id, role, content)
            VALUES (?, ?, ?)
            """,
            (conversation_id, role, content)
        )

        # Return the ID of the newly saved message
        return cursor.lastrowid


def save_evidence(message_id, sources):
    # Save Tavily evidence linked to one AI response
    if not sources:
        return

    with get_connection() as connection:
        connection.executemany(
            """
            INSERT INTO evidence (message_id, title, url, content)
            VALUES (?, ?, ?, ?)
            """,
            [
                (
                    message_id,
                    source.get("title", ""),
                    source.get("url", ""),
                    source.get("content", "")
                )
                for source in sources
                if source.get("url")
            ]
        )


def get_evidence(message_id):
    # Retrieve all sources linked to an AI response
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, title, url, content
            FROM evidence
            WHERE message_id = ?
            ORDER BY id ASC
            """,
            (message_id,)
        ).fetchall()

    return [dict(row) for row in rows]


def get_messages(conversation_id):
    # Retrieve messages in the order they were saved
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, role, content
            FROM messages
            WHERE conversation_id = ?
            ORDER BY id ASC
            """,
            (conversation_id,)
        ).fetchall()

    return [dict(row) for row in rows]


def get_conversations():
    # Retrieve all conversations, newest first
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, title, created_at
            FROM conversations
            ORDER BY created_at DESC, rowid DESC
            """
        ).fetchall()

    return [dict(row) for row in rows]


def get_conversation(conversation_id):
    # Retrieve one conversation by its ID
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, title, created_at
            FROM conversations
            WHERE id = ?
            """,
            (conversation_id,)
        ).fetchone()

    return dict(row) if row else None


if __name__ == "__main__":
    init_db()
    print("Database initialized successfully!")
