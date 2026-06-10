"""
Import punch records from ZKTeco MDB file into wt_att_raw.
Only inserts records that don't already exist (safe to re-run any time).
After import, rebuilds daily summaries for all affected employee-date pairs.
"""
import pyodbc
import psycopg2
from datetime import date, datetime
from collections import defaultdict

MDB_PATH = r'D:\bimoatic device MDB File\eTimeTrackLite1.mdb'
MDB_CONN  = f'DRIVER={{Microsoft Access Driver (*.mdb, *.accdb)}};DBQ={MDB_PATH};'
PG_CONN   = "host=192.168.1.104 port=5432 dbname=attendance_system user=attendance_admin password=Nikitha@23"

LATE_AFTER      = 9 * 60 + 15
VERY_LATE_AFTER = 10 * 60 + 0

# ── Connect ──────────────────────────────────────────────────────────────────
mdb = pyodbc.connect(MDB_CONN)
mc  = mdb.cursor()
pg  = psycopg2.connect(PG_CONN)
pgc = pg.cursor()

# ── Valid employee IDs from our DB ───────────────────────────────────────────
pgc.execute("SELECT id FROM wt_employees WHERE active = true")
valid_ids = set(r[0] for r in pgc.fetchall())
print(f"Valid employees: {len(valid_ids)}")

# ── Find all DeviceLogs_* tables in MDB ──────────────────────────────────────
all_tables = [r.table_name for r in mc.tables(tableType='TABLE')]
device_log_tables = sorted([t for t in all_tables if t.startswith('DeviceLogs_') and t != 'DeviceLogs'])
print(f"DeviceLogs tables found: {len(device_log_tables)}")
for t in device_log_tables:
    print(f"  {t}")

# ── Already existing punches in our DB (employee_id + punch_time set) ────────
print("\nLoading existing punch index from DB...")
pgc.execute("SELECT employee_id, punch_time FROM wt_att_raw")
existing = set((r[0], r[1]) for r in pgc.fetchall())
print(f"Existing punches in DB: {len(existing)}")

# ── Import ───────────────────────────────────────────────────────────────────
inserted   = 0
skipped    = 0
today      = date.today()
affected   = defaultdict(set)   # employee_id -> set of dates needing rebuild

for table in device_log_tables:
    mc.execute(f"SELECT UserId, LogDate, C1, C3 FROM [{table}]")
    rows = mc.fetchall()

    table_new = 0
    for user_id, log_date, c1, c3 in rows:
        if not user_id or user_id not in valid_ids:
            continue
        if not log_date:
            continue

        # Determine punch_state: c1='in'->0, 'out'->1; fallback to c3='0'->0,'1'->1
        if c1 == 'in':
            state = 0
        elif c1 == 'out':
            state = 1
        elif c3 == '0':
            state = 0
        elif c3 == '1':
            state = 1
        else:
            state = 0   # default IN if unknown

        punch_dt = log_date if isinstance(log_date, datetime) else datetime.combine(log_date, datetime.min.time())

        # Skip future-date device bugs (device with wrong RTC — year > 2030)
        if punch_dt.year > 2030:
            skipped += 1
            continue

        # Skip if already in DB
        key = (user_id, punch_dt)
        if key in existing:
            skipped += 1
            continue

        # Insert
        pgc.execute("""
            INSERT INTO wt_att_raw (employee_id, punch_time, punch_state, device_id, processed, created_at)
            VALUES (%s, %s, %s, %s, true, NOW())
            ON CONFLICT DO NOTHING
        """, (user_id, punch_dt, state, 1))

        existing.add(key)
        inserted += 1
        table_new += 1

        punch_date = punch_dt.date()
        if punch_date < today:
            affected[user_id].add(punch_date)

    if table_new:
        print(f"  {table}: +{table_new} new punches")
        pg.commit()

pg.commit()
print(f"\nImport done — Inserted: {inserted}  |  Skipped: {skipped}")

# ── Rebuild daily summaries for affected employee-date pairs ──────────────────
if not affected:
    print("No new historical dates — no rebuild needed.")
    mdb.close(); pg.close()
    exit()

print(f"\nRebuilding summaries for {sum(len(v) for v in affected.values())} employee-date pairs...")

# Reuse the same dedup + IN->OUT logic as AttendanceProcessingService
def calc_summary(emp_id, work_date):
    pgc.execute("""
        SELECT punch_time, punch_state FROM wt_att_raw
        WHERE employee_id = %s
          AND punch_time >= %s AND punch_time < %s
        ORDER BY punch_time
    """, (emp_id, datetime.combine(work_date, datetime.min.time()),
                  datetime.combine(work_date, datetime.max.time())))
    punches = pgc.fetchall()
    if not punches:
        return None

    # Dedup by minute — same-minute IN+OUT -> keep IN
    by_minute = {}
    for pt, ps in punches:
        mk = pt.replace(second=0, microsecond=0)
        if mk not in by_minute or ps == 0:
            by_minute[mk] = (pt, ps)
    deduped = sorted(by_minute.values(), key=lambda x: x[0])

    entry_time = deduped[0][0]
    exit_time  = deduped[-1][0]
    presence_ms = int((exit_time - entry_time).total_seconds() * 1000)

    # State-based IN->OUT pair sum
    work_ms = 0
    session = None
    for pt, ps in deduped:
        if ps == 0 and session is None:
            session = pt
        elif ps == 1 and session is not None:
            work_ms += int((pt - session).total_seconds() * 1000)
            session = None

    break_ms = max(0, presence_ms - work_ms)

    entry_mins = entry_time.hour * 60 + entry_time.minute
    if entry_mins >= VERY_LATE_AFTER:
        late = 'VERY_LATE'
    elif entry_mins >= LATE_AFTER:
        late = 'LATE'
    else:
        late = 'NORMAL'

    status = 'OFFLINE' if presence_ms > 0 else 'PRESENT'

    return {
        'entry_time': entry_time,
        'exit_time':  exit_time,
        'work_ms':    work_ms,
        'break_ms':   break_ms,
        'late':       late,
        'status':     status,
    }

rebuilt = 0
for emp_id, dates in affected.items():
    for work_date in sorted(dates):
        s = calc_summary(emp_id, work_date)
        if not s:
            continue
        pgc.execute("""
            INSERT INTO wt_daily_summary
                (employee_id, date, entry_time, exit_time, total_work_ms, total_break_ms,
                 total_lunch_ms, status, late_status, approved)
            VALUES (%s, %s, %s, %s, %s, %s, 0, %s, %s, false)
            ON CONFLICT (employee_id, date) DO UPDATE SET
                entry_time     = EXCLUDED.entry_time,
                exit_time      = EXCLUDED.exit_time,
                total_work_ms  = EXCLUDED.total_work_ms,
                total_break_ms = EXCLUDED.total_break_ms,
                status         = EXCLUDED.status,
                late_status    = EXCLUDED.late_status
        """, (emp_id, work_date, s['entry_time'], s['exit_time'],
              s['work_ms'], s['break_ms'], s['status'], s['late']))
        rebuilt += 1

    if rebuilt % 500 == 0 and rebuilt:
        pg.commit()
        print(f"  Rebuilt {rebuilt}...")

pg.commit()
print(f"Summaries rebuilt: {rebuilt}")
print("\n=== IMPORT COMPLETE ===")

mdb.close()
pg.close()
