package com.tausib.springjobportal.service;

import com.tausib.springjobportal.model.Message;
import com.tausib.springjobportal.model.User;
import com.tausib.springjobportal.repo.MessageRepo;
import com.tausib.springjobportal.repo.UserRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MessagingService {

    private final MessageRepo messageRepo;
    private final UserRepo userRepo;

    public Message sendMessage(Integer senderId, Integer receiverId, String content) {
        User sender = userRepo.findById(senderId)
                .orElseThrow(() -> new RuntimeException("Sender not found"));
        User receiver = userRepo.findById(receiverId)
                .orElseThrow(() -> new RuntimeException("Receiver not found"));

        Message message = Message.builder()
                .sender(sender)
                .receiver(receiver)
                .content(content)
                .isRead(false)
                .build();

        return messageRepo.save(message);
    }

    public List<Message> getConversation(Integer userId1, Integer userId2) {
        return messageRepo.findConversation(userId1, userId2);
    }

    public List<Object> getConversationPartners(Integer userId) {
        return messageRepo.findConversationPartnerIds(userId).stream()
                .map(id -> userRepo.findById(id).orElse(null))
                .filter(u -> u != null)
                .map(u -> java.util.Map.of(
                        "id", u.getId(),
                        "fullName", u.getFullName(),
                        "email", u.getEmail()
                ))
                .collect(java.util.stream.Collectors.toList());
    }

    public long getUnreadCount(Integer userId) {
        return messageRepo.countByReceiverIdAndIsReadFalse(userId);
    }

    public void markConversationAsRead(Integer senderId, Integer receiverId) {
        List<Message> unread = messageRepo.findBySenderIdAndReceiverIdAndIsReadFalse(senderId, receiverId);
        unread.forEach(m -> m.setIsRead(true));
        messageRepo.saveAll(unread);
    }
}
