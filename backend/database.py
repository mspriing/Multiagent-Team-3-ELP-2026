
import sqlite3
from pathlib import Path

# Store the database inside the backend folder
DB_PATH = Path(__file__).resolve().parent / "conversations.db"


def get_connection():
    # Open a connection to the SQLite database
    connection = sqlite3.connect(DB_PATH)

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
        connection.execute(
            """
            INSERT INTO messages (conversation_id, role, content)
            VALUES (?, ?, ?)
            """,
            (conversation_id, role, content)
        )


def get_messages(conversation_id):
    # Retrieve messages in the order they were saved
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT role, content
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