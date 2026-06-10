"""
Check Naresh (10169) May 2026 raw punches + daily summaries
to verify break and average calculations.
"""
import psycopg2
from datetime import date, timedelta

PG_CONN = "host=192.168.1.104 port=5432 dbname=attendance_system user=attendance_admin password=Nikitha@23"

conn = psycopg2.connect(PG_CONN)
cur  = conn.cursor()

EMP_ID = '10169'

# 1. Raw punches for May 2026
cur.execute("""
    SELECT DATE(punch_time) as day, punch_time, punch_state
    FROM wt_att_raw
    WHERE employee_id = %s
      AND punch_time >= '2026-05-01'
      AND punch_time <  '2026-06-01'
    ORDER BY punch_time
""", (EMP_ID,))
raw = cur.fetchall()

# 2. Daily summaries for May 2026
cur.execute("""
    SELECT date, entry_time, exit_time,
           total_work_ms, total_break_ms, total_lunch_ms,
           status, late_status
    FROM wt_daily_summary
    WHERE employee_id = %s
      AND date >= '2026-05-01'
      AND date <  '2026-06-01'
    ORDER BY date
""", (EMP_ID,))
summaries = cur.fetchall()

print("=" * 70)
print(f"RAW PUNCHES — Naresh (10169) — May 2026  ({len(raw)} total punches)")
print("=" * 70)

from collections import defaultdict
by_day = defaultdict(list)
for day, punch_time, punch_state in raw:
    by_day[day].append((punch_time, punch_state))

LUNCH_START = 12 * 60 + 45
LUNCH_END   = 14 * 60 + 0

total_presence_min = 0
total_work_min     = 0
total_break_min    = 0
working_days       = 0

for work_date in sorted(by_day.keys()):
    punches = sorted(by_day[work_date], key=lambda x: x[0])
    n = len(punches)
    first = punches[0][0]
    last  = punches[-1][0]

    presence_min = int((last - first).total_seconds() / 60)

    # Deduplicate by minute: same-minute IN+OUT -> keep IN
    by_minute = {}
    for punch_time, punch_state in punches:
        mk = punch_time.replace(second=0, microsecond=0)
        if mk not in by_minute or punch_state == 0:
            by_minute[mk] = (punch_time, punch_state)
    deduped = sorted(by_minute.values(), key=lambda x: x[0])

    # State-based IN->OUT pair sum
    work_min = 0
    session_start = None
    for pt, ps in deduped:
        if ps == 0 and session_start is None:
            session_start = pt
        elif ps == 1 and session_start is not None:
            work_min += int((pt - session_start).total_seconds() / 60)
            session_start = None

    break_min = max(0, presence_min - work_min)
    lunch_min = 0

    total_presence_min += presence_min
    total_work_min     += work_min
    total_break_min    += (break_min + lunch_min)
    working_days       += 1

    punch_str = "  ".join([
        f"{'IN' if s==0 else 'OUT'} {t.strftime('%H:%M')}"
        for t, s in punches
    ])

    print(f"\n{work_date}  ({n} punches)")
    print(f"  Punches : {punch_str}")
    print(f"  Presence: {presence_min//60}h {presence_min%60:02d}m  |  "
          f"Break: {(break_min+lunch_min)//60}h {(break_min+lunch_min)%60:02d}m  |  "
          f"Work: {work_min//60}h {work_min%60:02d}m")

print("\n" + "=" * 70)
print(f"TOTALS  ({working_days} working days)")
print(f"  Total Presence : {total_presence_min//60}h {total_presence_min%60:02d}m")
print(f"  Total Break    : {total_break_min//60}h {total_break_min%60:02d}m")
print(f"  Total Work     : {total_work_min//60}h {total_work_min%60:02d}m")
avg = total_work_min / working_days if working_days else 0
print(f"  Avg Work/Day   : {avg/60:.2f}h  ({int(avg//60)}h {int(avg%60):02d}m)")

print("\n" + "=" * 70)
print("DB DAILY SUMMARIES (what system stored):")
print("=" * 70)
db_total_work = 0
db_days = 0
for row in summaries:
    d, entry, exit_, work_ms, break_ms, lunch_ms, status, late = row
    work_min  = (work_ms or 0) // 60000
    break_min = ((break_ms or 0) + (lunch_ms or 0)) // 60000

    entry_s = str(entry)[:5] if entry else '--'
    exit_s  = str(exit_)[:5] if exit_  else '--'

    if work_ms and work_ms > 0:
        db_total_work += work_ms
        db_days += 1

    print(f"  {d}  {entry_s} -> {exit_s}  "
          f"Work: {work_min//60}h{work_min%60:02d}m  "
          f"Break: {break_min//60}h{break_min%60:02d}m  "
          f"{status}  {late}")

if db_days:
    db_avg = db_total_work / db_days / 3600000
    print(f"\n  DB Avg Work: {db_avg:.2f}h  ({db_days} days)")

conn.close()
