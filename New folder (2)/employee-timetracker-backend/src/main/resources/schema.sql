-- ============================================================
-- Employee TimeTracker — PostgreSQL Schema
-- Run this once to create the database structure
-- ============================================================

CREATE TABLE IF NOT EXISTS employees (
    id          VARCHAR(20)  PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(100) NOT NULL UNIQUE,
    username    VARCHAR(50)  NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    role        VARCHAR(20)  NOT NULL DEFAULT 'employee', -- employee | manager | admin
    dept         VARCHAR(100),
    avatar       VARCHAR(5),
    biometric_id VARCHAR(20)  UNIQUE,   -- ZKTeco enrollment number
    active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_raw (
    id           BIGSERIAL    PRIMARY KEY,
    employee_id  VARCHAR(20)  NOT NULL,
    punch_time   TIMESTAMP    NOT NULL,
    punch_state  SMALLINT     NOT NULL, -- 0=IN 1=OUT
    device_id    VARCHAR(50),
    processed    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE (employee_id, punch_time, punch_state)
);

CREATE TABLE IF NOT EXISTS employee_live_status (
    employee_id          VARCHAR(20)  PRIMARY KEY,
    status               VARCHAR(20)  NOT NULL DEFAULT 'NOT_ARRIVED',
    entry_time           TIMESTAMP,
    last_punch_in        TIMESTAMP,
    last_punch_out       TIMESTAMP,
    total_work_ms        BIGINT       NOT NULL DEFAULT 0,
    total_break_ms       BIGINT       NOT NULL DEFAULT 0,
    total_lunch_ms       BIGINT       NOT NULL DEFAULT 0,
    late_status          VARCHAR(20)  NOT NULL DEFAULT 'NORMAL', -- NORMAL | LATE | VERY_LATE
    miss_punch_notified  BOOLEAN      NOT NULL DEFAULT FALSE,
    updated_at           TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_daily_summary (
    id           BIGSERIAL   PRIMARY KEY,
    employee_id  VARCHAR(20) NOT NULL,
    date         DATE        NOT NULL,
    entry_time   TIME,
    exit_time    TIME,
    total_work_ms  BIGINT    NOT NULL DEFAULT 0,
    total_break_ms BIGINT    NOT NULL DEFAULT 0,
    total_lunch_ms BIGINT    NOT NULL DEFAULT 0,
    late_status  VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    status       VARCHAR(20) NOT NULL DEFAULT 'NOT_ARRIVED',
    approved     BOOLEAN     NOT NULL DEFAULT FALSE,
    UNIQUE (employee_id, date)
);

CREATE TABLE IF NOT EXISTS devices (
    id                    BIGSERIAL    PRIMARY KEY,
    name                  VARCHAR(100) NOT NULL,
    ip_address            VARCHAR(50)  NOT NULL,
    serial_number         VARCHAR(50)  UNIQUE,   -- ZKTeco device serial number
    port                  INT          NOT NULL DEFAULT 4370,
    location              VARCHAR(100),
    poll_interval_seconds INT          NOT NULL DEFAULT 10,
    connected             BOOLEAN      NOT NULL DEFAULT FALSE,
    active                BOOLEAN      NOT NULL DEFAULT TRUE,
    last_seen             TIMESTAMP,
    created_at            TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id            BIGSERIAL    PRIMARY KEY,
    type          VARCHAR(30)  NOT NULL, -- MISS_PUNCH | LONG_BREAK | LATE_ENTRY | VERY_LATE
    employee_id   VARCHAR(20)  NOT NULL,
    employee_name VARCHAR(100),
    message       TEXT,
    read          BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_raw_employee     ON attendance_raw(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_raw_punch_time   ON attendance_raw(punch_time);
CREATE INDEX IF NOT EXISTS idx_attendance_raw_processed    ON attendance_raw(processed);
CREATE INDEX IF NOT EXISTS idx_daily_summary_employee_date ON attendance_daily_summary(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_notifications_read          ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created       ON notifications(created_at DESC);

-- ============================================================
-- Seed Data — Initial Users
-- Passwords are BCrypt of: pass123 (employees/manager) and admin123 (admin)
-- ============================================================
INSERT INTO employees (id, name, email, username, password, role, dept, avatar, active) VALUES
('EMP001', 'Vemana Kalyan',    'kalyan.v@wilotus.com',    'kalyan.v',   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPTIoNLIVdm', 'employee', 'Engineering',  'VK', true),
('EMP002', 'Ravi Kumar',       'ravi.k@wilotus.com',      'ravi.k',     '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPTIoNLIVdm', 'employee', 'Engineering',  'RK', true),
('EMP003', 'Priya Sharma',     'priya.s@wilotus.com',     'priya.s',    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPTIoNLIVdm', 'employee', 'Design',       'PS', true),
('EMP004', 'Arjun Reddy',      'arjun.r@wilotus.com',     'arjun.r',    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPTIoNLIVdm', 'employee', 'Sales',        'AR', true),
('EMP005', 'Sneha Patel',      'sneha.p@wilotus.com',     'sneha.p',    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPTIoNLIVdm', 'employee', 'HR',           'SP', true),
('EMP006', 'Rahul Nair',       'rahul.n@wilotus.com',     'rahul.n',    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPTIoNLIVdm', 'employee', 'Finance',      'RN', true),
('EMP007', 'Kavya Menon',      'kavya.m@wilotus.com',     'kavya.m',    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPTIoNLIVdm', 'employee', 'Engineering',  'KM', true),
('EMP008', 'Deepak Singh',     'deepak.s@wilotus.com',    'deepak.s',   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPTIoNLIVdm', 'employee', 'Operations',   'DS', true),
('EMP009', 'Ananya Das',       'ananya.d@wilotus.com',    'ananya.d',   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPTIoNLIVdm', 'employee', 'Marketing',    'AD', true),
('EMP010', 'Vikram Iyer',      'vikram.i@wilotus.com',    'vikram.i',   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPTIoNLIVdm', 'employee', 'Support',      'VI', true),
('MGR001', 'Suresh Manager',   'suresh.m@wilotus.com',    'suresh.m',   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPTIoNLIVdm', 'manager',  'Operations',   'SM', true),
('ADM001', 'Admin User',       'admin@wilotus.com',       'admin',      '$2a$10$GrJ8C6WV1nxCk5XnYkimtekn/h8q.0paSiNmYnZqOgUDhF8WFnFvW', 'admin',    'IT',           'AU', true)
ON CONFLICT (id) DO NOTHING;

-- Seed live status rows for all employees
INSERT INTO employee_live_status (employee_id, status)
SELECT id, 'NOT_ARRIVED' FROM employees
ON CONFLICT (employee_id) DO NOTHING;
