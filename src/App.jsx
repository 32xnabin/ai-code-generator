import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import DateRangePicker from './DateRangePicker';
import TimePicker from './TimePicker';
import Prism from 'prismjs';
import 'prismjs/themes/prism.css'; // or another theme like 'prism-tomorrow.css'
// Import the languages you need (e.g., javascript, jsx, python, etc.)
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';

const SAMPLE_CODE = `// Example snippet shown on the right‑hand side
fetch(\`\${ollamaUrl}/api/chat\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: modelName,
    messages: [...messages, userMessage],
  }),
});`;

function App() {
  // const [startDate, setStartDate] = React.useState(null);
  // const [endDate, setEndDate] = React.useState(null);
  /* --------------- existing chat state --------------- */
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [modelName, setModelName] = useState('');
  const [modelList, setModelList] = useState([]);
  const messagesEndRef = useRef(null);
  const [code, setCode] = useState(SAMPLE_CODE);  
  useEffect(() => {
    Prism.highlightAll();
  }, [code]); // Re-run when code changes

  /* --------------- code‑viewer state --------------- */
         // what we show
  const [copied, setCopied] = useState(false);            // UI feedback

  /* --------------- auto‑scroll ---------------------- */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* --------------- handlers ------------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
  
    const userMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
  
    try {
      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          messages: [...messages, userMessage],
          stream: false,
          options: { temperature: 0.7, top_p: 0.9, repeat_penalty: 1.1 }
        })
      });
  
      if (!response.ok) throw new Error(`Error: ${response.status}`);
      const data = await response.json();
      const rawContent = data.message?.content || 'No response';
  
      // --- Extract code and plain text ---
      const codeRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
      let codeBlocks = [];
      let textOnly = rawContent;
  
      let match;
      while ((match = codeRegex.exec(rawContent)) !== null) {
        codeBlocks.push(match[1].trim());
        textOnly = textOnly.replace(match[0], '').trim();
      }
  
      if (textOnly) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: textOnly }
        ]);
      }
  
      if (codeBlocks.length > 0) {
        setCode(codeBlocks.join('\n\n'));
      }
  
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message}` }
      ]);
    } finally {
      setIsLoading(false);
    }
  };
  

  const checkOllamaConnection = async () => {
    try {
      const res = await fetch(`${ollamaUrl}/api/tags`);
      if (!res.ok) throw new Error('Failed to fetch models');
      const data = await res.json();
      const models = data.models?.map((m) => m.name) || [];
      setModelList(models);
      if (models[0]) setModelName(models[0]);
      alert(`Connected! Models: ${models.join(', ')}`);
    } catch (e) {
      alert(`Connection failed: ${e.message}`);
    }
  };

  /* --------------- copy‑to‑clipboard --------------- */
  const copyCode = () => {
    navigator.clipboard.writeText(code)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(console.error);
  };

  /* --------------- UI ------------------------------ */
  return (
    <div className="app">
      {/* <TimePicker /> */}
       {/* <div>
      <h1>Date Range Picker</h1>
      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
      />
    </div> */}
      {/* SETTINGS */}
      <div className="settings-panel">
        <h2>Abindra Coding Agent</h2>

        <div className="settings-row">
          <label>
            Ollama URL:
            <input
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
            />
          </label>
          <button onClick={checkOllamaConnection}>Test Connection</button>
        </div>

        <div className="settings-row">
          <label>
            Model Name:
            <select
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              disabled={modelList.length === 0}
            >
              {modelList.length === 0
                ? <option value="">No models found</option>
                : modelList.map((m) => <option key={m}>{m}</option>)
              }
            </select>
          </label>
        </div>
      </div>

      {/* MAIN TWO‑PANE LAYOUT */}
      <div className="main-content">
        {/* ---------- CHAT PANE ---------- */}
        <div className="chat-container">
          <div className="messages">
            {messages.length === 0 ? (
              <div className="welcome-message">
                <p>Welcome! Click <strong>Test Connection</strong> and start chatting.</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`message ${msg.role}`}>
                  <div className="message-content">
                    {msg.content.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="message assistant">
                <div className="typing-indicator"><span>●</span><span>●</span><span>●</span></div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="input-area">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message…"
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || !input.trim()}>
              {isLoading ? '…' : 'Send'}
            </button>
          </form>
        </div>

        {/* ---------- CODE VIEWER PANE ---------- */}
        <div className="code-panel">
          <div className="code-toolbar">
            <span>Code preview</span>
            <button onClick={copyCode}>{copied ? 'Copied!' : 'Copy'}</button>
          </div>
          <pre><code className="language-javascript">{code}</code></pre>
        </div>
      </div>
    </div>
  );
}

export default App;
