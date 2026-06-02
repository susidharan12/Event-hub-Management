package com.ai.chatbot.service;

import com.ai.chatbot.model.ChatRequest;
import com.ai.chatbot.model.ConversationMessage;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Flux;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class AnthropicService {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    // ─── In-memory store: sessionId → conversation history ───────────────────
    // ConcurrentHashMap is thread-safe for multiple users at the same time
    private final Map<String, List<Map<String, String>>> memoryStore = new ConcurrentHashMap<>();

    // Max messages to keep per session (older ones are dropped to save memory)
    private static final int MAX_HISTORY = 20;

    @Value("${groq.api.key}")
    private String apiKey;

    @Value("${groq.model}")
    private String model;

    @Value("${groq.max-tokens}")
    private int maxTokens;

    @Value("${groq.system-prompt}")
    private String systemPrompt;

    public AnthropicService(
            @Value("${groq.api.url}") String apiUrl,
            ObjectMapper objectMapper
    ) {
        this.objectMapper = objectMapper;
        this.webClient = WebClient.builder()
                .baseUrl(apiUrl)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    // ─── Main streaming method ────────────────────────────────────────────────

    public Flux<String> streamChat(ChatRequest chatRequest) {

        String sessionId = chatRequest.getSessionId();

        // 1. Load or create memory for this session
        List<Map<String, String>> history = memoryStore
                .computeIfAbsent(sessionId, id -> new ArrayList<>());

        // 2. Add the new user message to memory
        history.add(Map.of("role", "user", "content", chatRequest.getMessage()));

        // 3. Build request with full memory context
        Map<String, Object> requestBody = buildRequestBody(history);

        // 4. Stream from Groq and collect the full assistant reply
        StringBuilder assistantReply = new StringBuilder();

        return webClient.post()
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToFlux(new ParameterizedTypeReference<ServerSentEvent<String>>() {})
                .map(ServerSentEvent::data)
                .filter(data -> data != null && !data.isEmpty())
                .flatMap(data -> parseStreamEvent(data, assistantReply))
                .doOnComplete(() -> {
                    // 5. Save the full assistant reply into memory when stream ends
                    String reply = assistantReply.toString();
                    if (!reply.isEmpty()) {
                        history.add(Map.of("role", "assistant", "content", reply));
                        // Trim history if it exceeds max size (keep system context small)
                        trimHistory(history);
                        log.info("Session [{}] memory updated — {} turns stored", sessionId, history.size());
                    }
                })
                .doOnError(e -> {
                    if (e instanceof WebClientResponseException wcre) {
                        log.error("Groq API error {} — body: {}", wcre.getStatusCode(), wcre.getResponseBodyAsString());
                    } else {
                        log.error("Groq streaming error: {}", e.getMessage());
                    }
                })
                .onErrorResume(this::toClientErrorStream);
    }

    // ─── Clear memory for a session (call when user clicks "New Chat") ────────

    public void clearMemory(String sessionId) {
        memoryStore.remove(sessionId);
        log.info("Memory cleared for session [{}]", sessionId);
    }

    // ─── Parse one SSE data chunk from Groq ──────────────────────────────────

    private Flux<String> parseStreamEvent(String data, StringBuilder replyAccumulator) {
        if ("[DONE]".equals(data.trim())) {
            return Flux.just("[DONE]");
        }
        try {
            JsonNode node  = objectMapper.readTree(data);
            JsonNode delta = node.path("choices").path(0).path("delta").path("content");
            if (delta.isMissingNode() || !delta.isTextual()) return Flux.empty();
            String text = delta.asText();
            if (text.isEmpty()) return Flux.empty();
            replyAccumulator.append(text);   // collect full reply for memory
            return Flux.just(text);
        } catch (Exception e) {
            log.warn("Failed to parse stream event: {}", data);
            return Flux.empty();
        }
    }

    // ─── Build request body using full memory history ─────────────────────────

    private Map<String, Object> buildRequestBody(List<Map<String, String>> history) {

        List<Map<String, String>> messages = new ArrayList<>();

        // System prompt always goes first
        messages.add(Map.of("role", "system", "content", systemPrompt));

        // All prior turns (AI remembers the full conversation)
        messages.addAll(history);

        Map<String, Object> body = new HashMap<>();
        body.put("model",      model);
        body.put("max_tokens", maxTokens);
        body.put("stream",     true);
        body.put("messages",   messages);

        return body;
    }

    // ─── Keep history within limits ───────────────────────────────────────────

    private void trimHistory(List<Map<String, String>> history) {
        while (history.size() > MAX_HISTORY) {
            history.remove(0);   // drop the oldest message
        }
    }

    private Flux<String> toClientErrorStream(Throwable error) {
        if (error instanceof WebClientResponseException wcre) {
            HttpStatusCode status = wcre.getStatusCode();
            if (status.value() == 401 || status.value() == 403) {
                return Flux.just(
                        "[ERROR] AI provider authentication failed. Update the Groq API key.",
                        "[DONE]"
                );
            }
            return Flux.just(
                    "[ERROR] AI provider returned " + status.value() + ". Please try again later.",
                    "[DONE]"
            );
        }

        return Flux.just(
                "[ERROR] AI service is temporarily unavailable. Please try again later.",
                "[DONE]"
        );
    }
}
