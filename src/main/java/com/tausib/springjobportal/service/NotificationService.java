package com.tausib.springjobportal.service;

import com.tausib.springjobportal.model.Notification;
import com.tausib.springjobportal.model.NotificationType;
import com.tausib.springjobportal.model.User;
import com.tausib.springjobportal.repo.NotificationRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepo notificationRepo;

    public Notification createNotification(User user, String title, String message,
                                           NotificationType type, String actionUrl) {
        Notification notification = Notification.builder()
                .user(user)
                .title(title)
                .message(message)
                .type(type)
                .actionUrl(actionUrl)
                .isRead(false)
                .build();
        return notificationRepo.save(notification);
    }

    public List<Notification> getUserNotifications(Integer userId) {
        return notificationRepo.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public List<Notification> getUnreadNotifications(Integer userId) {
        return notificationRepo.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId);
    }

    public long getUnreadCount(Integer userId) {
        return notificationRepo.countByUserIdAndIsReadFalse(userId);
    }

    public Notification markAsRead(Integer notificationId) {
        Notification notification = notificationRepo.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));
        notification.setIsRead(true);
        return notificationRepo.save(notification);
    }

    public void markAllAsRead(Integer userId) {
        List<Notification> unread = notificationRepo.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId);
        unread.forEach(n -> n.setIsRead(true));
        notificationRepo.saveAll(unread);
    }

    public void deleteNotification(Integer id) {
        notificationRepo.deleteById(id);
    }
}
