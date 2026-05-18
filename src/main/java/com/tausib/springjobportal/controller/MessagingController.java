package com.tausib.springjobportal.controller;

import com.tausib.springjobportal.model.Message;
import com.tausib.springjobportal.model.User;
import com.tausib.springjobportal.service.MessagingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessagingController {

    private final MessagingService messagingService;

    @PostMapping
    public ResponseEntity<Message> sendMessage(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, Object> request
    ) {
        Integer receiverId = (Integer) request.get("receiverId");
        String content = (String) request.get("content");
        return ResponseEntity.ok(messagingService.sendMessage(user.getId(), receiverId, content));
    }

    @GetMapping("/conversation/{userId}")
    public ResponseEntity<List<Message>> getConversation(
            @AuthenticationPrincipal User user,
            @PathVariable Integer userId
    ) {
        return ResponseEntity.ok(messagingService.getConversation(user.getId(), userId));
    }

    @GetMapping("/conversations")
    public ResponseEntity<List<Object>> getConversationPartners(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(messagingService.getConversationPartners(user.getId()));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<?> getUnreadCount(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(Map.of("count", messagingService.getUnreadCount(user.getId())));
    }

    @PostMapping("/read/{senderId}")
    public ResponseEntity<?> markAsRead(
            @AuthenticationPrincipal User user,
            @PathVariable Integer senderId
    ) {
        messagingService.markConversationAsRead(senderId, user.getId());
        return ResponseEntity.ok(Map.of("message", "Messages marked as read"));
    }
}
