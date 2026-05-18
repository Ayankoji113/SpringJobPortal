package com.tausib.springjobportal.repo;

import com.tausib.springjobportal.model.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageRepo extends JpaRepository<Message, Integer> {

    @Query("SELECT m FROM Message m WHERE " +
            "(m.sender.id = :userId1 AND m.receiver.id = :userId2) OR " +
            "(m.sender.id = :userId2 AND m.receiver.id = :userId1) " +
            "ORDER BY m.sentAt ASC")
    List<Message> findConversation(@Param("userId1") Integer userId1, @Param("userId2") Integer userId2);

    @Query("SELECT DISTINCT CASE WHEN m.sender.id = :userId THEN m.receiver.id ELSE m.sender.id END " +
            "FROM Message m WHERE m.sender.id = :userId OR m.receiver.id = :userId")
    List<Integer> findConversationPartnerIds(@Param("userId") Integer userId);

    long countByReceiverIdAndIsReadFalse(Integer receiverId);

    List<Message> findBySenderIdAndReceiverIdAndIsReadFalse(Integer senderId, Integer receiverId);
}
