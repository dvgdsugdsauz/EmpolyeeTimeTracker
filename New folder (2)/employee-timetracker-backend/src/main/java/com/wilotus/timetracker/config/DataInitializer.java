package com.wilotus.timetracker.config;

import com.wilotus.timetracker.entity.Employee;
import com.wilotus.timetracker.entity.EmployeeLiveStatus;
import com.wilotus.timetracker.repository.EmployeeRepository;
import com.wilotus.timetracker.repository.EmployeeLiveStatusRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer {

    private final EmployeeRepository employeeRepo;
    private final EmployeeLiveStatusRepository liveRepo;
    private final PasswordEncoder passwordEncoder;

    @EventListener(ApplicationReadyEvent.class)
    public void seed() {
        String potPass   = passwordEncoder.encode("Pot@123");
        String adminPass = passwordEncoder.encode("admin123");

        // Real employees — inserted only if their ID doesn't already exist
        List<Employee> realEmployees = List.of(
            emp("10010", "Sangapu Venkata Nageswara Vamsidhar", "10010", "vamsidhar@wilotus.com",   potPass, "employee", "Operations",    "SV", "10010"),
            emp("10013", "Viramalla Upender",                   "10013", "upender@wilotus.com",      potPass, "employee", "Operations",    "VU", "10013"),
            emp("10040", "Abhilash Yendluri",                   "10040", "abhilash@wilotus.com",     potPass, "employee", "Engineering",   "AY", "10040"),
            emp("10041", "Vikas Kumar",                         "10041", "vikas@wilotus.com",         potPass, "employee", "Engineering",   "VK", "10041"),
            emp("10043", "Nibbaragandla Sreelakshmi",           "10043", "sreelakshmi@wilotus.com",  potPass, "employee", "Operations",    "NS", "10043"),
            emp("10045", "Bhukya Venkanna",                     "10045", "venkanna@wilotus.com",     potPass, "employee", "Operations",    "BV", "10045"),
            emp("10046", "Batharaju Maheshwari",                "10046", "maheshwari@wilotus.com",   potPass, "employee", "Operations",    "BM", "10046"),
            emp("10067", "Gundu Bhargavi Seeta Maha Lakshmi",  "10067", "bhargavi.g@wilotus.com",   potPass, "employee", "Operations",    "GB", "10067"),
            emp("10071", "Muthineni Aswanth Kumar",             "10071", "aswanth@wilotus.com",      potPass, "employee", "Engineering",   "MA", "10071"),
            emp("10073", "Ravishankar Pandey",                  "10073", "ravishankar@wilotus.com",  potPass, "employee", "Engineering",   "RP", "10073"),
            emp("10074", "Rentala Jayasree",                    "10074", "jayasree@wilotus.com",     potPass, "employee", "Operations",    "RJ", "10074"),
            emp("10075", "Rodda Lalitha",                       "10075", "lalitha@wilotus.com",      potPass, "employee", "Operations",    "RL", "10075"),
            emp("10076", "Annapareddy Sai Charan Reddy",        "10076", "saicharan@wilotus.com",    potPass, "employee", "Engineering",   "AS", "10076"),
            emp("10081", "Nampelly Susmitha",                   "10081", "susmitha@wilotus.com",     potPass, "employee", "Operations",    "NS", "10081"),
            emp("10083", "Soma Bhargavi",                       "10083", "soma.bhargavi@wilotus.com",potPass, "employee", "Operations",    "SB", "10083"),
            emp("10084", "Pedamala Haritha",                    "10084", "haritha@wilotus.com",      potPass, "employee", "Operations",    "PH", "10084"),
            emp("10089", "Kannuri Navya",                       "10089", "navya@wilotus.com",        potPass, "employee", "Operations",    "KN", "10089"),
            emp("10127", "Chinka Surya Prakash Yadav",          "10127", "suryaprakash@wilotus.com", potPass, "manager",  "Delivery",      "CS", "10127"),
            emp("10128", "Vignesh Jayaseelan",                  "10128", "vignesh@wilotus.com",      potPass, "manager",  "IT",            "VJ", "10128"),
            emp("10144", "Kalluri Sahitya",                     "10144", "sahitya@wilotus.com",      potPass, "employee", "Operations",    "KS", "10144"),
            emp("10145", "Amireddy Harinath Reddy",             "10145", "harinath@wilotus.com",     potPass, "employee", "Engineering",   "AH", "10145"),
            emp("10146", "Ganesula Ramya",                      "10146", "ramya@wilotus.com",        potPass, "employee", "Operations",    "GR", "10146"),
            emp("10151", "Divyashri Veligotla",                 "10151", "divyashri@wilotus.com",    potPass, "employee", "Operations",    "DV", "10151"),
            emp("10152", "Vemana Kalyan",                       "10152", "kalyan@wilotus.com",       potPass, "admin",    "IT",            "VK", "10152"),
            emp("10155", "Satti Deepika Chitrasri",             "10155", "deepika@wilotus.com",      potPass, "employee", "Operations",    "SD", "10155"),
            emp("10161", "Matteda Premchand",                   "10161", "premchand@wilotus.com",    potPass, "employee", "Engineering",   "MP", "10161"),
            emp("10165", "Masam Sanjana",                       "10165", "sanjana@wilotus.com",      potPass, "employee", "Operations",    "MS", "10165"),
            emp("10168", "Tholapu Lakshmi Naga Aravind Swamy", "10168", "aravind@wilotus.com",      potPass, "employee", "Engineering",   "TA", "10168"),
            emp("10169", "Naresh N",                            "10169", "naresh@wilotus.com",       potPass, "employee", "Operations",    "NN", "10169"),
            emp("10170", "V Shiva Polamarsetty",                "10170", "shiva.p@wilotus.com",      potPass, "manager",  "Finance",       "SP", "10170"),
            emp("10171", "Ventrapragada Anuradha",              "10171", "anuradha@wilotus.com",     potPass, "employee", "HR",            "VA", "10171"),
            emp("10172", "Pooja Gupta",                         "10172", "pooja@wilotus.com",        potPass, "employee", "Operations",    "PG", "10172"),
            emp("10173", "Yallapu Satyanarayana",               "10173", "satyanarayana@wilotus.com",potPass, "manager",  "HR",            "YS", "10173"),
            emp("10174", "Garkini Ramu",                        "10174", "ramu@wilotus.com",         potPass, "employee", "Operations",    "GR", "10174")
        );

        // System admin account (fallback login if needed)
        Employee sysAdmin = emp("ADM001", "Admin User", "admin", "admin@wilotus.com",
                                adminPass, "admin", "IT", "AU", null);

        int added = 0;
        for (Employee e : realEmployees) {
            if (!employeeRepo.existsById(e.getId())) {
                employeeRepo.save(e);
                seedLiveStatus(e.getId());
                added++;
            }
        }
        if (!employeeRepo.existsById("ADM001")) {
            employeeRepo.save(sysAdmin);
            seedLiveStatus("ADM001");
            added++;
        }

        if (added > 0)
            log.info("DataInitializer — seeded {} new employee records", added);
        else
            log.info("DataInitializer — all employees already present, nothing to seed");
    }

    private void seedLiveStatus(String employeeId) {
        if (liveRepo.findById(employeeId).isEmpty()) {
            EmployeeLiveStatus s = new EmployeeLiveStatus();
            s.setEmployeeId(employeeId);
            s.setStatus("NOT_ARRIVED");
            s.setLateStatus("NORMAL");
            s.setUpdatedAt(java.time.LocalDateTime.now());
            liveRepo.save(s);
        }
    }

    private Employee emp(String id, String name, String username, String email,
                         String password, String role, String dept, String avatar,
                         String biometricId) {
        return Employee.builder()
                .id(id).name(name).username(username).email(email)
                .password(password).role(role).dept(dept).avatar(avatar)
                .biometricId(biometricId)
                .active(true).build();
    }
}
