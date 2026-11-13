package com.tausib.springjobportal.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RefreshTokenRepo extends JpaRepository<RefreshToken, Integer> {
    Optional<RefreshToken> findByToken(String token);

    /** Ends every session an account has. Called when it is banned. */
    void deleteByUserId(Integer userId);
}
