package com.tausib.springjobportal.company;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CompanyRepo extends JpaRepository<Company, Integer> {
    List<Company> findByOwnerId(Integer ownerId);
}
