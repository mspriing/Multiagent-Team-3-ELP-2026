import { useState } from "react";

function App() {
  const [message, setMessage] = useState(""); // what the user types
  const [response, setResponse] = useState(""); // what the backend sends back
  
  const sendMessage = async () => {
  const result = await fetch("http://127.0.0.1:8000/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: message,
    }),
  });

  const data = await result.json();

  setResponse(data.response);
  };

  return (
    <div>
      <h1>Multi-Agent AI</h1>

      <input // creates the text box
        type="text"
        placeholder="Ask something..."
        value={message}
        onChange={(event) => setMessage(event.target.value)}
      />

      <button onClick={sendMessage}>Send</button>

      <p>Response: {response}</p>
    </div>
  );
}

export default App;