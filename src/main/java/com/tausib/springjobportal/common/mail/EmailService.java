package com.tausib.springjobportal.common.mail;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.mail.from:noreply@jobportal.com}")
    private String fromEmail;

    @Value("${app.base-url:http://localhost:5173}")
    private String baseUrl;

    @Async
    public void sendVerificationEmail(String to, String token) {
        String subject = "Verify Your Email - NextGen Jobs";
        String verifyUrl = baseUrl + "/verify-email?token=" + token;
        String body = "Hello,\n\nPlease click the link below to verify your email:\n\n"
                + verifyUrl + "\n\nThis link will expire in 24 hours.\n\nBest,\nNextGen Jobs Team";
        sendEmail(to, subject, body);
    }

    @Async
    public void sendPasswordResetEmail(String to, String token) {
        String subject = "Reset Your Password - NextGen Jobs";
        String resetUrl = baseUrl + "/reset-password?token=" + token;
        String body = "Hello,\n\nYou requested a password reset. Click the link below:\n\n"
                + resetUrl + "\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, ignore this email.\n\nBest,\nNextGen Jobs Team";
        sendEmail(to, subject, body);
    }

    @Async
    public void sendApplicationNotification(String to, String jobTitle, String applicantName) {
        String subject = "New Application Received - " + jobTitle;
        String body = "Hello,\n\n" + applicantName + " has applied for the position: " + jobTitle
                + "\n\nLog in to review the application.\n\nBest,\nNextGen Jobs Team";
        sendEmail(to, subject, body);
    }

    @Async
    public void sendStatusUpdateEmail(String to, String jobTitle, String status) {
        String subject = "Application Status Update - " + jobTitle;
        String body = "Hello,\n\nYour application for \"" + jobTitle + "\" has been updated to: "
                + status + "\n\nLog in to see more details.\n\nBest,\nNextGen Jobs Team";
        sendEmail(to, subject, body);
    }

    @Async
    public void sendResponseReminderEmail(String to, int waiting) {
        String subject = "Applications waiting for your response - NextGen Jobs";
        String body = "Hello,\n\n" + waiting + " application(s) to your postings are close to their response "
                + "deadline. Any that are not answered in time are marked as unanswered and count against "
                + "your response rate.\n\n" + baseUrl + "/manage-applications\n\nBest,\nNextGen Jobs Team";
        sendEmail(to, subject, body);
    }

    private void sendEmail(String to, String subject, String body) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
            log.info("Email sent to: {}", to);
        } catch (Exception e) {
            log.warn("Failed to send email to {}: {}. Continuing without email.", to, e.getMessage());
        }
    }
}
