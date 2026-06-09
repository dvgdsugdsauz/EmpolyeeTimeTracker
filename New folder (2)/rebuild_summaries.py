"""
Rebuild wt_daily_summary from wt_att_raw directly in Python.
Replicates the Spring Boot AttendanceProcessingService logic.
"""
import psycopg2
from datetime import date, datetime, timedelta
from collections import defaultdict

PG_CONN = "host=192.168.1.104 port=5432 dbname=attendance_system user=attendance_admin password=Nikitha@23"

LATE_AFTER      = 9 * 60 + 15   # 09:15 in minutes
VERY_LATE_AFTER = 10 * 60 + 0   # 10:00 in minutes
TARGET_MS       = (9 * 3600 + 30 * 60) * 1000   # 9h 30m
WEEKEND_DAYS    = {6, 7}  # Saturday=6, Sunday=7 (ISO weekday)
LUNCH_START_MIN = 12 * 60 + 45  # 12:45
LUNCH_END_MIN   = 14 * 60 + 0   # 14:00

conn = psycopg2.connect(PG_CONN)
cur = conn.cursor()

# Get all active employees
cur.execute("SELECT id FROM wt_employees WHERE active = true")
active_ids = set(r[0] for r in cur.fetchall())
print(f"Active employees: {len(active_ids)}")

# Get all raw punches grouped by (employee_id, date)
print("Loading raw punches...")
cur.execute("""
    SELECT employee_id, punch_time::date as day, punch_time, punch_state
    FROM wt_att_raw
    WHERE employee_id = ANY(%s)
    ORDER BY employee_id, punch_time
""", (list(active_ids),))

rows = cur.fetchall()
print(f"Total raw punches: {len(rows)}")

# Group by (employee, date)
data = defaultdict(list)
for emp_id, day, punch_time, punch_state in rows:
    data[(emp_id, day)].append((punch_time, punch_state))

print(f"Employee-day combinations: {len(data)}")

today = date.today()
inserted = 0
updated  = 0

# Delete existing summaries and rebuild
print("Rebuilding daily summaries...")
cur.execute("DELETE FROM wt_daily_summary WHERE date < %s", (today,))
print(f"Deleted old summaries: {cur.rowcount}")

for (emp_id, work_date), punches in data.items():
    if work_date >= today:
        continue  # skip today - handled by live status

    punches.sort(key=lambda x: x[0])

    if not punches:
        continue

    # First punch = Login, Last punch = Logout (state-agnostic — device states unreliable)
    entry_time = punches[0][0]
    exit_time  = punches[-1][0]

    presence_ms = int((exit_time - entry_time).total_seconds() * 1000)

    # Positional pairs (0+1, 2+3 …) used only to find break gaps — punch_state ignored
    total_break_ms = 0
    total_lunch_ms = 0
    pairs = []

    for i in range(0, len(punches) - 1, 2):
        a_time = punches[i][0]
        b_time = punches[i + 1][0]
        seg = int((b_time - a_time).total_seconds() * 1000)
        if seg > 0:
            pairs.append((a_time, b_time))

    # Break = gaps between consecutive pairs
    for i in range(1, len(pairs)):
        out_t  = pairs[i - 1][1]
        in_t   = pairs[i][0]
        gap_ms = int((in_t - out_t).total_seconds() * 1000)
        if gap_ms <= 0:
            continue
        out_mins = out_t.hour * 60 + out_t.minute
        if LUNCH_START_MIN <= out_mins <= LUNCH_END_MIN:
            total_lunch_ms += gap_ms
        else:
            total_break_ms += gap_ms

    # Actual Work = Presence - Break  →  always ≤ Presence (validation guaranteed)
    total_work_ms = max(0, presence_ms - total_break_ms - total_lunch_ms)

    # Late status
    entry_mins = entry_time.hour * 60 + entry_time.minute
    if entry_mins <= LATE_AFTER:
        late_status = 'NORMAL'
    elif entry_mins <= VERY_LATE_AFTER:
        late_status = 'LATE'
    else:
        late_status = 'VERY_LATE'

    # Status: OFFLINE = has distinct entry+exit; PRESENT = single punch
    day_of_week = work_date.isoweekday()  # 1=Mon...7=Sun
    if day_of_week in WEEKEND_DAYS:
        status = 'WEEKEND'
    elif presence_ms > 0:
        status = 'OFFLINE'
    else:
        status = 'PRESENT'

    cur.execute("""
        INSERT INTO wt_daily_summary
            (employee_id, date, entry_time, exit_time, total_work_ms, total_break_ms, total_lunch_ms, status, late_status, approved)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, false)
        ON CONFLICT (employee_id, date) DO UPDATE SET
            entry_time     = EXCLUDED.entry_time,
            exit_time      = EXCLUDED.exit_time,
            total_work_ms  = EXCLUDED.total_work_ms,
            total_break_ms = EXCLUDED.total_break_ms,
            total_lunch_ms = EXCLUDED.total_lunch_ms,
            status         = EXCLUDED.status,
            late_status    = EXCLUDED.late_status
    """, (emp_id, work_date, entry_time, exit_time, total_work_ms, total_break_ms, total_lunch_ms, status, late_status))

    inserted += 1
    if inserted % 1000 == 0:
        conn.commit()
        print(f"  Processed {inserted} days...")

conn.commit()

# Final count
cur.execute("SELECT COUNT(*), MIN(date), MAX(date) FROM wt_daily_summary")
r = cur.fetchone()
print(f"\n=== REBUILD DONE ===")
print(f"Total daily summaries: {r[0]}")
print(f"Date range: {r[1]} to {r[2]}")
print(f"Records processed: {inserted}")

conn.close()
