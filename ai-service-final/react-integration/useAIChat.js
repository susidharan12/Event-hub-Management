// ─────────────────────────────────────────────────────────────────────────────
// useAIChat.js  —  drop this file into your React app's hooks/ folder
//
// USAGE:
//   import { useAIChat } from './hooks/useAIChat';
//
//   function MyComponent() {
//     const { messages, sendMessage, isStreaming, error, clearMessages, stopStreaming } = useAIChat();
//
//     return (
//       <>
//         {messages.map((msg, i) => (
//           <div key={i}><b>{msg.role}:</b> {msg.content}</div>
//         ))}
//         <button onClick={() => sendMessage("Hello!")}>Send</button>
//       </>
//     );
//   }
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef } from 'react';

const AI_SERVICE_URL = 'http://localhost:8080/api/ai/chat/stream';

export function useAIChat() {
  const [messages, setMessages]     = useState([]);   // { role: 'user'|'assistant', content: string }[]
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError]           = useState(null);
  const abortRef = useRef(null);

  const sendMessage = useCallback(async (userText) => {
    if (!userText.trim() || isStreaming) return;

    setError(null);

    // 1. Snapshot history before adding new messages
    const historySnapshot = [...messages];

    // 2. Add the user message to the chat immediately
    const userMessage = { role: 'user', content: userText };
    setMessages(prev => [...prev, userMessage]);

    // 3. Add an empty assistant bubble that we'll fill token-by-token
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
    setIsStreaming(true);

    try {
      // Abort any previous in-flight request
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const response = await fetch(AI_SERVICE_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          history: historySnapshot,   // send only prior turns, not the new one
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Server error ${response.status}: ${response.statusText}`);
      }

      // 4. Read the SSE stream chunk by chunk
      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE events are delimited by double newlines
        const events = buffer.split('\n\n');
        buffer = events.pop(); // keep any incomplete trailing chunk

        for (const event of events) {
          const line = event.trim();
          if (!line.startsWith('data:')) continue;

          const token = line.replace(/^data:\s*/, '');

          if (token === '[DONE]') {
            setIsStreaming(false);
            return;
          }

          // 5. Append the token to the last assistant message
          setMessages(prev => {
            const updated = [...prev];
            const last    = updated[updated.length - 1];
            if (last?.role === 'assistant') {
              updated[updated.length - 1] = {
                ...last,
                content: last.content + token,
              };
            }
            return updated;
          });
        }
      }

    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to connect to AI service');
        // Remove the empty assistant bubble if we got nothing
        setMessages(prev =>
          prev[prev.length - 1]?.content === '' ? prev.slice(0, -1) : prev
        );
      }
    } finally {
      setIsStreaming(false);
    }
  }, [messages, isStreaming]);

  /** Cancel an in-progress stream */
  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  /** Reset the conversation */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, sendMessage, isStreaming, error, clearMessages, stopStreaming };
}
