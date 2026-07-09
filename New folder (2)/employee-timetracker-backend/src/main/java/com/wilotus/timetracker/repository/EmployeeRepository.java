package com.wilotus.timetracker.repository;

import com.wilotus.timetracker.entity.Employee;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface EmployeeRepository extends JpaRepository<Employee, String> {
    Optional<Employee> findByUsernameOrEmail(String username, String email);
    Optional<Employee> findByBiometricId(String biometricId);
    List<Employee> findByActiveTrue();
    List<Employee> findByRoleAndActiveTrue(String role);
    boolean existsByEmail(String email);
    boolean existsByUsername(String username);
    Optional<Employee> findByUsername(String username);
}
