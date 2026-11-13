package com.tausib.springjobportal.company;

import com.tausib.springjobportal.common.exception.ForbiddenOperationException;
import com.tausib.springjobportal.common.exception.ResourceNotFoundException;
import com.tausib.springjobportal.company.dto.CompanyRequest;
import com.tausib.springjobportal.company.dto.CompanyResponse;
import com.tausib.springjobportal.file.FileStorageService;
import com.tausib.springjobportal.user.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CompanyService {

    private final CompanyRepo companyRepo;
    private final CompanyMapper companyMapper;
    private final UserService userService;
    private final FileStorageService fileStorageService;

    /** Entity accessor for other services. Never returned across a controller boundary. */
    @Transactional(readOnly = true)
    public Company getEntityById(Integer id) {
        return companyRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Company not found with id: " + id));
    }

    /**
     * Entity accessor that also enforces ownership. Used by {@code job/} so a posting cannot name a
     * company the poster does not own — otherwise any employer can publish under any established
     * company's name and logo.
     */
    @Transactional(readOnly = true)
    public Company getOwnedEntityById(Integer id, Integer ownerId) {
        return requireOwner(id, ownerId);
    }

    @Transactional
    public CompanyResponse create(CompanyRequest request, Integer ownerId) {
        Company company = Company.builder()
                .name(request.getName())
                .description(request.getDescription())
                .website(request.getWebsite())
                .location(request.getLocation())
                .industry(request.getIndustry())
                .size(request.getSize())
                .owner(userService.getEntityById(ownerId))
                .build();
        return companyMapper.toResponse(companyRepo.save(company));
    }

    @Transactional
    public CompanyResponse update(Integer id, CompanyRequest request, Integer ownerId) {
        Company company = requireOwner(id, ownerId);

        if (request.getName() != null) company.setName(request.getName());
        if (request.getDescription() != null) company.setDescription(request.getDescription());
        if (request.getWebsite() != null) company.setWebsite(request.getWebsite());
        if (request.getLocation() != null) company.setLocation(request.getLocation());
        if (request.getIndustry() != null) company.setIndustry(request.getIndustry());
        if (request.getSize() != null) company.setSize(request.getSize());

        return companyMapper.toResponse(companyRepo.save(company));
    }

    @Transactional(readOnly = true)
    public CompanyResponse getById(Integer id) {
        return companyMapper.toResponse(getEntityById(id));
    }

    @Transactional(readOnly = true)
    public List<CompanyResponse> getAll() {
        return companyRepo.findAll().stream().map(companyMapper::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<CompanyResponse> getByOwner(Integer ownerId) {
        return companyRepo.findByOwnerId(ownerId).stream().map(companyMapper::toResponse).toList();
    }

    @Transactional
    public String uploadLogo(Integer id, Integer ownerId, MultipartFile file) {
        Company company = requireOwner(id, ownerId);
        String path = fileStorageService.storeCompanyLogo(file, id);
        company.setLogoPath(path);
        companyRepo.save(company);
        return path;
    }

    @Transactional
    public void delete(Integer id, Integer ownerId) {
        requireOwner(id, ownerId);
        companyRepo.deleteById(id);
    }

    private Company requireOwner(Integer id, Integer ownerId) {
        Company company = getEntityById(id);
        if (!company.getOwner().getId().equals(ownerId)) {
            throw new ForbiddenOperationException("You don't own this company");
        }
        return company;
    }
}
