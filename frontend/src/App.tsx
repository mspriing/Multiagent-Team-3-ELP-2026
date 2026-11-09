
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

// Structure of a research source
type EvidenceSource = {
  id?: number;
  title: string;
  url: string;
  content: string;
};

// Structure of a user or AI message
type ChatMessage = {
  id?: number;
  role: "user" | "assistant";
  content: string;
  evidence?: EvidenceSource[];
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

  // Whether the sidebar is visible
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

      // Load its previous messages and evidence
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

    setConversationId(null);
    setMessages([]);
    setMessage("");
    setError("");
  };

  // Close the current conversation without deleting it
  const closeConversation = () => {
    newChat();
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

      // Add the user question and AI answer
      // including evidence for the assistant response
      setMessages((previous) => [
        ...previous,
        {
          role: "user",
          content: submittedMessage,
        },
        {
          id: data.message_id,
          role: "assistant",
          content: data.response,
          evidence: Array.isArray(data.evidence)
            ? data.evidence
            : [],
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
    <div className="app-layout">

      {/* LEFT SIDEBAR */}
      {sidebarOpen && (
        <aside className="sidebar">

          <div className="sidebar-header">
            <h2>Multi-Agent AI</h2>

            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(false)}
              title="Close sidebar"
              aria-label="Close sidebar"
            >
              ☰
            </button>
          </div>

          <button
            type="button"
            className="new-chat-button"
            onClick={newChat}
            disabled={loading || opening}
          >
            + New Chat
          </button>

          <h3>Previous Conversations</h3>

          <div className="sidebar-conversations">
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
                  onClick={() =>
                    openConversation(conversation.id)
                  }
                  disabled={loading || opening}
                  className={`conversation-item ${
                    conversationId === conversation.id
                      ? "active"
                      : ""
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
                    title="Close conversation"
                    aria-label="Close conversation"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* MAIN CHAT AREA */}
      <main className="main-chat">

        {/* Header */}
        <header className="app-header">

          {!sidebarOpen && (
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(true)}
              title="Open sidebar"
              aria-label="Open sidebar"
            >
              ☰
            </button>
          )}

          <h1>Multi-Agent AI</h1>
          <p>Research powered by multiple AI agents</p>
        </header>

        {/* Conversation messages */}
        <div className="chat-history">
          {messages.map((chatMessage, index) => (
            <div
              key={chatMessage.id ?? index}
              className={`chat-message ${chatMessage.role}`}
            >

              {/* Render user or AI message */}
              <ReactMarkdown
                remarkPlugins={[
                  [remarkGfm, { singleTilde: false }]
                ]}
              >
                {chatMessage.content}
              </ReactMarkdown>

              {/* EVIDENCE LEDGER */}
              {chatMessage.role === "assistant" &&
                chatMessage.evidence &&
                chatMessage.evidence.length > 0 && (

                  <details className="evidence-ledger">
                    <summary className="evidence-toggle">
                      View Sources ({chatMessage.evidence.length})
                    </summary>

                    <div className="evidence-content">
                      <p className="evidence-description">
                        Sources retrieved by the Researcher Agent.
                        These are not individually verified citations.
                      </p>

                      {chatMessage.evidence.map((source, sourceIndex) => (
                        <div
                          key={source.id ?? sourceIndex}
                          className="evidence-source"
                        >
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="evidence-link"
                          >
                            {source.title || source.url}
                          </a>

                          {source.content && (
                            <p className="evidence-excerpt">
                              {source.content}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
            </div>
          ))}
        </div>

        {/* Bottom input area */}
        <div className="chat-bottom">

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

          {/* Message input */}
          <div className="input-section">
            <input
              type="text"
              placeholder="Ask a research question..."
              value={message}
              onChange={(event) =>
                setMessage(event.target.value)
              }
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
              disabled={
                loading ||
                opening ||
                !message.trim()
              }
            >
              {loading ? "Researching..." : "Send"}
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}

export default App;
