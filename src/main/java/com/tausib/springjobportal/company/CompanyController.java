package com.tausib.springjobportal.company;

import com.tausib.springjobportal.company.dto.CompanyRequest;
import com.tausib.springjobportal.company.dto.CompanyResponse;
import com.tausib.springjobportal.user.UserPrincipal;
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

    @PostMapping
    @PreAuthorize("hasRole('EMPLOYER')")
    public ResponseEntity<CompanyResponse> createCompany(
            @Valid @RequestBody CompanyRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(companyService.create(request, principal.getId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('EMPLOYER')")
    public ResponseEntity<CompanyResponse> updateCompany(
            @PathVariable Integer id,
            @Valid @RequestBody CompanyRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(companyService.update(id, request, principal.getId()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CompanyResponse> getCompany(@PathVariable Integer id) {
        return ResponseEntity.ok(companyService.getById(id));
    }

    @GetMapping
    public ResponseEntity<List<CompanyResponse>> getAllCompanies() {
        return ResponseEntity.ok(companyService.getAll());
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('EMPLOYER')")
    public ResponseEntity<List<CompanyResponse>> getMyCompanies(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(companyService.getByOwner(principal.getId()));
    }

    @PostMapping(value = "/{id}/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('EMPLOYER')")
    public ResponseEntity<Map<String, String>> uploadLogo(
            @PathVariable Integer id,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(Map.of("path",
                companyService.uploadLogo(id, principal.getId(), file)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('EMPLOYER')")
    public ResponseEntity<Map<String, String>> deleteCompany(
            @PathVariable Integer id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        companyService.delete(id, principal.getId());
        return ResponseEntity.ok(Map.of("message", "Company deleted"));
    }
}
