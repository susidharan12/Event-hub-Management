package com.ai.chatbot.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatRequest {

    // The user's new message
    private String message;

    // Session ID — used to look up this user's memory
    // Frontend should generate one UUID per user session and send it every request
    // Example: "user-abc123" or any unique string
    private String sessionId;

    // Optional: if you still want to send history manually from frontend
    private List<ConversationMessage> history;
}