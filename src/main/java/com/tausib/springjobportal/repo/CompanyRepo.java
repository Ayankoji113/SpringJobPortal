package com.tausib.springjobportal.repo;

import com.tausib.springjobportal.model.Company;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CompanyRepo extends JpaRepository<Company, Integer> {
    List<Company> findByOwnerId(Integer ownerId);
    Optional<Company> findByNameIgnoreCase(String name);
}
