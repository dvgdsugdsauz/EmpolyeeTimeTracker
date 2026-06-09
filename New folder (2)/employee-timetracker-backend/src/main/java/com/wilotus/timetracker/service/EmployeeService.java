package com.wilotus.timetracker.service;

import com.wilotus.timetracker.dto.EmployeeDto;
import com.wilotus.timetracker.entity.Employee;
import com.wilotus.timetracker.entity.EmployeeLiveStatus;
import com.wilotus.timetracker.repository.EmployeeLiveStatusRepository;
import com.wilotus.timetracker.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class EmployeeService {

    private final EmployeeRepository employeeRepo;
    private final EmployeeLiveStatusRepository liveRepo;
    private final PasswordEncoder passwordEncoder;

    public List<Employee> getAll() {
        return employeeRepo.findByActiveTrue();
    }

    @Transactional
    public Employee create(EmployeeDto dto) {
        if (employeeRepo.existsByEmail(dto.getEmail()))
            throw new IllegalArgumentException("Email already in use");
        if (employeeRepo.existsByUsername(dto.getUsername()))
            throw new IllegalArgumentException("Username already in use");

        Employee emp = Employee.builder()
                .id(dto.getId())
                .name(dto.getName())
                .email(dto.getEmail())
                .username(dto.getUsername())
                .password(passwordEncoder.encode(dto.getPassword()))
                .role(dto.getRole())
                .dept(dto.getDept())
                .avatar(dto.getAvatar())
                .active(true)
                .build();
        emp = employeeRepo.save(emp);

        // Ensure live status row exists
        if (!liveRepo.existsById(emp.getId())) {
            EmployeeLiveStatus live = new EmployeeLiveStatus();
            live.setEmployeeId(emp.getId());
            live.setStatus("NOT_ARRIVED");
            live.setLateStatus("NORMAL");
            liveRepo.save(live);
        }
        return emp;
    }

    @Transactional
    public Employee update(String id, EmployeeDto dto) {
        Employee emp = employeeRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Employee not found: " + id));

        emp.setName(dto.getName());
        emp.setDept(dto.getDept());
        emp.setAvatar(dto.getAvatar());
        emp.setRole(dto.getRole());
        if (dto.getEmail() != null && !dto.getEmail().isBlank())
            emp.setEmail(dto.getEmail());
        if (dto.getPassword() != null && !dto.getPassword().isBlank())
            emp.setPassword(passwordEncoder.encode(dto.getPassword()));
        return employeeRepo.save(emp);
    }

    @Transactional
    public void resetPassword(String id, String newPassword) {
        Employee emp = employeeRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Employee not found: " + id));
        emp.setPassword(passwordEncoder.encode(newPassword));
        employeeRepo.save(emp);
    }

    @Transactional
    public void deactivate(String id) {
        employeeRepo.findById(id).ifPresent(emp -> {
            emp.setActive(false);
            employeeRepo.save(emp);
        });
    }

    public EmployeeDto toDto(Employee emp) {
        EmployeeDto dto = new EmployeeDto();
        dto.setId(emp.getId());
        dto.setName(emp.getName());
        dto.setEmail(emp.getEmail());
        dto.setUsername(emp.getUsername());
        dto.setRole(emp.getRole());
        dto.setDept(emp.getDept());
        dto.setAvatar(emp.getAvatar());
        dto.setActive(emp.isActive());
        // password deliberately not returned
        return dto;
    }
}
