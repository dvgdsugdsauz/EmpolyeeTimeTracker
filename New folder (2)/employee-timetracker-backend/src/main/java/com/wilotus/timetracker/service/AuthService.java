package com.wilotus.timetracker.service;

import com.wilotus.timetracker.dto.LoginRequest;
import com.wilotus.timetracker.dto.LoginResponse;
import com.wilotus.timetracker.entity.Employee;
import com.wilotus.timetracker.repository.EmployeeRepository;
import com.wilotus.timetracker.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final EmployeeRepository employeeRepo;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public LoginResponse login(LoginRequest req) {
        String identifier = req.getIdentifier().trim();
        Employee employee = employeeRepo.findByUsernameOrEmail(identifier, identifier)
                .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));

        if (!employee.isActive()) {
            throw new DisabledException("Account is disabled");
        }

        if (!passwordEncoder.matches(req.getPassword(), employee.getPassword())) {
            throw new BadCredentialsException("Invalid credentials");
        }

        String token = jwtUtil.generateToken(employee.getUsername(), employee.getRole());

        return new LoginResponse(
                token,
                employee.getId(),
                employee.getName(),
                employee.getEmail(),
                employee.getRole(),
                employee.getDept(),
                employee.getAvatar()
        );
    }
}
