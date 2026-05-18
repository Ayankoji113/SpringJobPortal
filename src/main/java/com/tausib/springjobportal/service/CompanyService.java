package com.tausib.springjobportal.service;

import com.tausib.springjobportal.dto.CompanyRequest;
import com.tausib.springjobportal.exception.ResourceNotFoundException;
import com.tausib.springjobportal.model.Company;
import com.tausib.springjobportal.model.User;
import com.tausib.springjobportal.repo.CompanyRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CompanyService {

    private final CompanyRepo companyRepo;

    public Company createCompany(CompanyRequest request, User owner) {
        Company company = Company.builder()
                .name(request.getName())
                .description(request.getDescription())
                .website(request.getWebsite())
                .location(request.getLocation())
                .industry(request.getIndustry())
                .size(request.getSize())
                .owner(owner)
                .build();
        return companyRepo.save(company);
    }

    public Company updateCompany(Integer id, CompanyRequest request, User owner) {
        Company company = companyRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Company not found"));
        if (!company.getOwner().getId().equals(owner.getId())) {
            throw new RuntimeException("You don't own this company");
        }

        if (request.getName() != null) company.setName(request.getName());
        if (request.getDescription() != null) company.setDescription(request.getDescription());
        if (request.getWebsite() != null) company.setWebsite(request.getWebsite());
        if (request.getLocation() != null) company.setLocation(request.getLocation());
        if (request.getIndustry() != null) company.setIndustry(request.getIndustry());
        if (request.getSize() != null) company.setSize(request.getSize());

        return companyRepo.save(company);
    }

    public Company getCompanyById(Integer id) {
        return companyRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Company not found with id: " + id));
    }

    public List<Company> getCompaniesByOwner(Integer ownerId) {
        return companyRepo.findByOwnerId(ownerId);
    }

    public List<Company> getAllCompanies() {
        return companyRepo.findAll();
    }

    public void updateLogoPath(Integer companyId, String path) {
        Company company = getCompanyById(companyId);
        company.setLogoPath(path);
        companyRepo.save(company);
    }

    public void deleteCompany(Integer id, User owner) {
        Company company = getCompanyById(id);
        if (!company.getOwner().getId().equals(owner.getId())) {
            throw new RuntimeException("You don't own this company");
        }
        companyRepo.deleteById(id);
    }
}
