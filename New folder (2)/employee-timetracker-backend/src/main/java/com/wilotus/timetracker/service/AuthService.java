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

    public void changePassword(String username, String currentPassword, String newPassword) {
        Employee employee = employeeRepo.findByUsernameOrEmail(username, username)
                .orElseThrow(() -> new BadCredentialsException("User not found"));
        if (!passwordEncoder.matches(currentPassword, employee.getPassword()))
            throw new BadCredentialsException("Current password incorrect");
        employee.setPassword(passwordEncoder.encode(newPassword));
        employeeRepo.save(employee);
    }

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
                employee.getDesignation(),
                employee.getAvatar(),
                employee.isTimesheetAccess()
        );
    }
}
