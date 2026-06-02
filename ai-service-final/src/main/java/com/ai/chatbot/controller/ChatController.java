package com.ai.chatbot.controller;

import com.ai.chatbot.model.ChatRequest;
import com.ai.chatbot.service.AnthropicService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

@Slf4j
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class ChatController {

    private final AnthropicService anthropicService;

    /**
     * POST /api/ai/chat/stream
     *
     * Request body:
     * {
     *   "message":   "What events should I create for summer?",
     *   "sessionId": "user-abc123"   <- unique per user/browser tab
     * }
     *
     * Response: text/event-stream (SSE)
     *   data: Here\n\n
     *   data:  are\n\n
     *   data:  some ideas...\n\n
     *   data: [DONE]\n\n
     */
    @PostMapping(
            value = "/chat/stream",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    public Flux<String> streamChat(@RequestBody ChatRequest request) {
        log.info("Chat request — session: [{}] message: '{}'", request.getSessionId(), request.getMessage());
        return anthropicService.streamChat(request);
    }

    /**
     * DELETE /api/ai/memory/{sessionId}
     *
     * Clears the conversation memory for a session.
     * Call this when the user clicks "New Chat" in your frontend.
     *
     * Example: DELETE /api/ai/memory/user-abc123
     */
    @DeleteMapping("/memory/{sessionId}")
    public ResponseEntity<String> clearMemory(@PathVariable String sessionId) {
        anthropicService.clearMemory(sessionId);
        return ResponseEntity.ok("Memory cleared for session: " + sessionId);
    }

    /**
     * GET /api/ai/health
     */
    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("AI service is running (Groq + Memory enabled)");
    }
}