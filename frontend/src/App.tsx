
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./App.css";

function App() {
  // What the user types
  const [message, setMessage] = useState("");

  // What the backend sends back
  const [response, setResponse] = useState("");

  // Whether the agents are currently working
  const [loading, setLoading] = useState(false);

  // Stores any error messages
  const [error, setError] = useState("");

  const sendMessage = async () => {
    // Prevent empty questions
    if (!message.trim() || loading) return;

    setLoading(true);
    setError("");
    setResponse("");

    try {
      // Send the user's question to FastAPI
      const result = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: message,
        }),
      });

      // Check whether the request succeeded
      if (!result.ok) {
        throw new Error("Backend request failed");
      }

      // Read the backend's JSON response
      const data = await result.json();

      // Save the AI's final answer
      setResponse(data.response ?? "No response received.");

    } catch (err) {
    if (err instanceof TypeError) {
      setError("Unable to connect to the server. Please try again later.");
      } else {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
    } finally {
      // Stop loading whether successful or not
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Multi-Agent AI</h1>
        <p>Research powered by multiple AI agents</p>
      </header>

      <div className="input-section">
        <input
          type="text"
          placeholder="Ask a research question..."
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") sendMessage();
          }}
        />

        <button
          onClick={sendMessage}
          disabled={loading || !message.trim()}
        >
          {loading ? "Researching..." : "Send"}
        </button>
      </div>

      {loading && (
        <div className="loading-message">
          Researcher, Analyst, and Writer agents are working...
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {response && (
        <div className="response-container">
          <ReactMarkdown
          remarkPlugins={[[remarkGfm, { singleTilde: false }]]}
          >
          {response}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

export default App;
