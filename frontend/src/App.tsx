
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./App.css";

// Structure of a saved conversation
type Conversation = {
  id: string;
  title: string;
  created_at: string;
};

// Structure of a user or AI message
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const API_URL = "http://127.0.0.1:8000";

function App() {
  // What the user types
  const [message, setMessage] = useState("");

  // Current conversation ID
  const [conversationId, setConversationId] = useState<string | null>(null);

  // List of saved conversations
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // Messages in the selected conversation
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Whether the agents are working
  const [loading, setLoading] = useState(false);

  // Whether a saved conversation is being opened
  const [opening, setOpening] = useState(false);

  // Error messages
  const [error, setError] = useState("");

  // STEP 1: Retrieve all saved conversations
  const fetchConversations = async () => {
    try {
      const result = await fetch(`${API_URL}/conversations`);

      if (!result.ok) {
        throw new Error("Failed to load conversations");
      }

      const data: Conversation[] = await result.json();

      setConversations(data);
    } catch (err) {
      console.error("Error loading conversations:", err);
    }
  };

  // Load saved conversations when React starts
  useEffect(() => {
    fetchConversations();
  }, []);

  // STEP 2: Open an existing conversation
  const openConversation = async (id: string) => {
    if (loading || opening) return;

    setOpening(true);
    setError("");

    try {
      const result = await fetch(
        `${API_URL}/conversations/${id}`
      );

      if (!result.ok) {
        throw new Error("Failed to load conversation");
      }

      const data = await result.json();

      // Set the active conversation
      setConversationId(id);

      // Load its previous messages
      setMessages(data.messages);

      // Clear the input
      setMessage("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setOpening(false);
    }
  };

  // STEP 3: Start a new conversation
  const newChat = () => {
    if (loading || opening) return;

    // Reset the active conversation
    setConversationId(null);

    // Clear displayed messages
    setMessages([]);

    // Clear input and errors
    setMessage("");
    setError("");
  };

  const closeConversation = () => {
    if (loading || opening) return;

      setConversationId(null);
      setMessages([]);
      setMessage("");
      setError("");
  };

  // STEP 4: Send a message to the agents
  const sendMessage = async () => {
    const submittedMessage = message.trim();

    // Prevent empty or overlapping requests
    if (!submittedMessage || loading || opening) return;

    setLoading(true);
    setError("");

    try {
      // Send the message and active conversation ID
      const result = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: submittedMessage,
          conversation_id: conversationId,
        }),
      });

      if (!result.ok) {
        throw new Error("Backend request failed");
      }

      // Read FastAPI's response
      const data = await result.json();

      if (
        typeof data.response !== "string" ||
        !data.response.trim() ||
        typeof data.conversation_id !== "string"
      ) {
        throw new Error("Invalid response from backend");
      }

      // Add the user question and AI answer to the chat
      setMessages((previous) => [
        ...previous,
        {
          role: "user",
          content: submittedMessage,
        },
        {
          role: "assistant",
          content: data.response,
        },
      ]);

      // Preserve the conversation ID
      setConversationId(data.conversation_id);

      // Clear the input after successful submission
      setMessage("");

      // Refresh saved conversations in the sidebar
      await fetchConversations();
    } catch (err) {
      if (err instanceof TypeError) {
        setError(
          "Unable to connect to the server. Please try again later."
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">

      {/* Application header */}
      <header className="app-header">
        <h1>Multi-Agent AI</h1>
        <p>Research powered by multiple AI agents</p>
      </header>

      {/* Saved conversations */}
      <div className="conversation-list">
        <div className="conversation-header">
          <h2>Previous Conversations</h2>

          <button
            type="button"
            onClick={newChat}
            disabled={loading || opening}
            className="new-chat-button"
          >
            + New Chat
          </button>
        </div>

        {conversations.length === 0 && (
          <p>No saved conversations yet.</p>
        )}

        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            className="conversation-row"
          >
            <button
              type="button"
              onClick={() => openConversation(conversation.id)}
              disabled={loading || opening}
              className={`conversation-item ${
                conversationId === conversation.id ? "active" : ""
              }`}
            >
              {conversation.title}
            </button>

            {conversationId === conversation.id && (
              <button
                type="button"
                className="close-conversation"
                onClick={closeConversation}
                disabled={loading || opening}
                aria-label="Close conversation"
                title="Close conversation"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Display all messages in the active conversation */}
      <div className="chat-history">
        {messages.map((chatMessage, index) => (
          <div
            key={index}
            className={`chat-message ${chatMessage.role}`}
          >
            <ReactMarkdown
              remarkPlugins={[[remarkGfm, { singleTilde: false }]]}
            >
              {chatMessage.content}
            </ReactMarkdown>
          </div>
        ))}
      </div>

      {/* Message input */}
      <div className="input-section">
        <input
          type="text"
          placeholder="Ask a research question..."
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              sendMessage();
            }
          }}
          disabled={loading || opening}
        />

        <button
          type="button"
          onClick={sendMessage}
          disabled={loading || opening || !message.trim()}
        >
          {loading ? "Researching..." : "Send"}
        </button>
      </div>

      {/* Loading indicators */}
      {loading && (
        <div className="loading-message">
          Your AI agents are working...
        </div>
      )}

      {opening && (
        <div className="loading-message">
          Loading conversation...
        </div>
      )}

      {/* Error messages */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

    </div>
  );
}


export default App;
