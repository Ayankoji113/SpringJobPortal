package com.tausib.springjobportal.controller;

import com.tausib.springjobportal.dto.CompanyRequest;
import com.tausib.springjobportal.model.Company;
import com.tausib.springjobportal.model.User;
import com.tausib.springjobportal.service.CompanyService;
import com.tausib.springjobportal.service.FileStorageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/companies")
@RequiredArgsConstructor
public class CompanyController {

    private final CompanyService companyService;
    private final FileStorageService fileStorageService;

    @PostMapping
    @PreAuthorize("hasRole('EMPLOYER')")
    public ResponseEntity<Company> createCompany(
            @Valid @RequestBody CompanyRequest request,
            @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.ok(companyService.createCompany(request, user));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('EMPLOYER')")
    public ResponseEntity<Company> updateCompany(
            @PathVariable Integer id,
            @RequestBody CompanyRequest request,
            @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.ok(companyService.updateCompany(id, request, user));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Company> getCompany(@PathVariable Integer id) {
        return ResponseEntity.ok(companyService.getCompanyById(id));
    }

    @GetMapping
    public ResponseEntity<List<Company>> getAllCompanies() {
        return ResponseEntity.ok(companyService.getAllCompanies());
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('EMPLOYER')")
    public ResponseEntity<List<Company>> getMyCompanies(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(companyService.getCompaniesByOwner(user.getId()));
    }

    @PostMapping(value = "/{id}/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('EMPLOYER')")
    public ResponseEntity<?> uploadLogo(
            @PathVariable Integer id,
            @RequestParam("file") MultipartFile file
    ) {
        String path = fileStorageService.storeCompanyLogo(file, id);
        companyService.updateLogoPath(id, path);
        return ResponseEntity.ok(Map.of("path", path));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('EMPLOYER')")
    public ResponseEntity<?> deleteCompany(
            @PathVariable Integer id,
            @AuthenticationPrincipal User user
    ) {
        companyService.deleteCompany(id, user);
        return ResponseEntity.ok(Map.of("message", "Company deleted"));
    }
}
