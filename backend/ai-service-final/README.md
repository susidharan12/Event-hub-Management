# AI Chatbot Service
Spring Boot backend — Anthropic Claude API — SSE Streaming

---

## Prerequisites

| Tool        | Minimum version | Check with          |
|-------------|-----------------|---------------------|
| Java (JDK)  | 17              | `java -version`     |
| Maven       | 3.8             | `mvn -version`      |
| Anthropic API key | —         | console.anthropic.com |

---

## 1. Get your Anthropic API key

1. Go to https://console.anthropic.com
2. Sign in → **API Keys** → **Create Key**
3. Copy the key (starts with `sk-ant-...`)

---

## 2. Set the API key as an environment variable

**macOS / Linux:**
```bash
export ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE
```

**Windows (Command Prompt):**
```cmd
set ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE
```

**Windows (PowerShell):**
```powershell
$env:ANTHROPIC_API_KEY="sk-ant-YOUR_KEY_HERE"
```

> Never paste your key directly into application.properties —
> environment variables keep secrets out of source control.

---

## 3. Configure your React app's URL (CORS)

Open `src/main/resources/application.properties` and update:

```properties
cors.allowed-origins=http://localhost:3000,http://localhost:5173
```

Add your production URL here when you deploy, e.g.:
```properties
cors.allowed-origins=http://localhost:3000,https://myapp.com
```

---

## 4. (Optional) Customize the system prompt

In `application.properties`, change:
```properties
anthropic.system-prompt=You are a helpful AI assistant. Be concise, friendly, and accurate.
```
This controls the AI's personality and behavior for your app.

---

## 5. Run the service

```bash
# From the ai-chatbot-service/ folder:
./mvnw spring-boot:run
```

Or build a JAR and run it:
```bash
./mvnw clean package
java -jar target/ai-chatbot-service-1.0.0.jar
```

The service starts on **http://localhost:8080**

---

## 6. Verify it's running

```bash
curl http://localhost:8080/api/ai/health
# → AI service is running
```

---

## 7. Integrate into your React app

Copy `react-integration/useAIChat.js` into your React project:

```
your-react-app/
  src/
    hooks/
      useAIChat.js   ← paste here
```

Then use it in any component:

```jsx
import { useAIChat } from './hooks/useAIChat';

function ChatWidget() {
  const { messages, sendMessage, isStreaming, error, stopStreaming, clearMessages } = useAIChat();
  const [input, setInput] = useState('');

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i} style={{ textAlign: msg.role === 'user' ? 'right' : 'left' }}>
          <b>{msg.role}:</b> {msg.content}
        </div>
      ))}

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && sendMessage(input) && setInput('')}
        placeholder="Type a message..."
        disabled={isStreaming}
      />

      {isStreaming
        ? <button onClick={stopStreaming}>Stop</button>
        : <button onClick={() => { sendMessage(input); setInput(''); }}>Send</button>
      }

      <button onClick={clearMessages}>Clear</button>
    </div>
  );
}
```

---

## API Reference

### POST /api/ai/chat/stream

**Request:**
```json
{
  "message": "What is the capital of France?",
  "history": [
    { "role": "user",      "content": "Hello" },
    { "role": "assistant", "content": "Hi! How can I help you today?" }
  ]
}
```
- `message` — required. The user's latest message.
- `history` — optional. Prior conversation turns for multi-turn chat.

**Response:** `text/event-stream` (SSE)
```
data: Paris

data:  is the capital

data:  of France.

data: [DONE]
```
Each `data:` line is one text token. `[DONE]` signals the end of the stream.

---

### GET /api/ai/health

Returns `200 OK` with body `AI service is running`.

---

## Project Structure

```
ai-chatbot-service/
├── pom.xml
├── react-integration/
│   └── useAIChat.js                      ← copy into your React app
└── src/main/
    ├── java/com/ai/chatbot/
    │   ├── AiChatbotApplication.java      ← entry point
    │   ├── config/CorsConfig.java         ← CORS settings
    │   ├── controller/ChatController.java ← REST endpoints
    │   ├── model/
    │   │   ├── AnthropicMessage.java
    │   │   ├── AnthropicRequest.java
    │   │   ├── ChatRequest.java
    │   │   └── ConversationMessage.java
    │   └── service/AnthropicService.java  ← streams Claude API
    └── resources/
        └── application.properties         ← configuration
```
