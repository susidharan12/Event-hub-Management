package com.ai.chatbot.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnthropicRequest {
    private String model;
    private int max_tokens;
    private String system;
    private boolean stream;
    private List<AnthropicMessage> messages;
}
