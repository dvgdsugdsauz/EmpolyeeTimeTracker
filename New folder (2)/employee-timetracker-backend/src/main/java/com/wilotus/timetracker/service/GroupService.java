package com.wilotus.timetracker.service;

import com.wilotus.timetracker.dto.GroupDetailDto;
import com.wilotus.timetracker.entity.*;
import com.wilotus.timetracker.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GroupService {

    private final EmployeeGroupRepository groupRepo;
    private final EmployeeSubGroupRepository subGroupRepo;
    private final EmployeeRepository employeeRepo;

    public List<GroupDetailDto> getAllGroups() {
        List<EmployeeGroup> groups = groupRepo.findAll();
        List<EmployeeSubGroup> allSubs = subGroupRepo.findAll();
        List<Employee> allEmployees = employeeRepo.findByActiveTrue();

        Map<Long, List<EmployeeSubGroup>> subsByGroup = allSubs.stream()
                .collect(Collectors.groupingBy(EmployeeSubGroup::getGroupId));

        Map<Long, List<Employee>> directByGroup = allEmployees.stream()
                .filter(e -> e.getGroupId() != null && e.getSubGroupId() == null)
                .collect(Collectors.groupingBy(Employee::getGroupId));

        Map<Long, List<Employee>> bySubGroup = allEmployees.stream()
                .filter(e -> e.getSubGroupId() != null)
                .collect(Collectors.groupingBy(Employee::getSubGroupId));

        return groups.stream().map(g -> {
            GroupDetailDto dto = new GroupDetailDto();
            dto.setId(g.getId());
            dto.setName(g.getName());
            dto.setDirectMembers(toMemberList(directByGroup.getOrDefault(g.getId(), List.of())));
            dto.setSubGroups(
                subsByGroup.getOrDefault(g.getId(), List.of()).stream().map(sg -> {
                    GroupDetailDto.SubGroupDetail sgd = new GroupDetailDto.SubGroupDetail();
                    sgd.setId(sg.getId());
                    sgd.setName(sg.getName());
                    sgd.setMembers(toMemberList(bySubGroup.getOrDefault(sg.getId(), List.of())));
                    return sgd;
                }).collect(Collectors.toList())
            );
            return dto;
        }).collect(Collectors.toList());
    }

    @Transactional
    public EmployeeGroup createGroup(String name) {
        if (name == null || name.isBlank()) throw new IllegalArgumentException("Group name required");
        if (groupRepo.existsByName(name.trim())) throw new IllegalArgumentException("Group already exists: " + name);
        EmployeeGroup g = new EmployeeGroup();
        g.setName(name.trim());
        return groupRepo.save(g);
    }

    @Transactional
    public void deleteGroup(Long id) {
        employeeRepo.findByActiveTrue().stream()
                .filter(e -> id.equals(e.getGroupId()))
                .forEach(e -> { e.setGroupId(null); e.setSubGroupId(null); employeeRepo.save(e); });
        subGroupRepo.deleteByGroupId(id);
        groupRepo.deleteById(id);
    }

    @Transactional
    public EmployeeSubGroup addSubGroup(Long groupId, String name) {
        if (!groupRepo.existsById(groupId)) throw new IllegalArgumentException("Group not found: " + groupId);
        EmployeeSubGroup sg = new EmployeeSubGroup();
        sg.setGroupId(groupId);
        sg.setName(name.trim());
        return subGroupRepo.save(sg);
    }

    @Transactional
    public void deleteSubGroup(Long sgId) {
        subGroupRepo.findById(sgId).ifPresent(sg -> {
            employeeRepo.findByActiveTrue().stream()
                    .filter(e -> sgId.equals(e.getSubGroupId()))
                    .forEach(e -> { e.setSubGroupId(null); employeeRepo.save(e); });
            subGroupRepo.deleteById(sgId);
        });
    }

    @Transactional
    public void assignEmployee(String empId, Long groupId, Long subGroupId) {
        Employee emp = employeeRepo.findById(empId)
                .orElseThrow(() -> new IllegalArgumentException("Employee not found: " + empId));
        emp.setGroupId(groupId);
        emp.setSubGroupId(subGroupId);
        employeeRepo.save(emp);
    }

    @Transactional
    public void removeFromGroup(String empId) {
        employeeRepo.findById(empId).ifPresent(emp -> {
            emp.setGroupId(null);
            emp.setSubGroupId(null);
            employeeRepo.save(emp);
        });
    }

    private List<GroupDetailDto.MemberInfo> toMemberList(List<Employee> list) {
        return list.stream().map(e -> {
            GroupDetailDto.MemberInfo m = new GroupDetailDto.MemberInfo();
            m.setId(e.getId());
            m.setName(e.getName());
            m.setDesignation(e.getDesignation());
            m.setAvatar(e.getAvatar());
            return m;
        }).collect(Collectors.toList());
    }
}
