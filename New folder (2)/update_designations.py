"""
One-time script: set designation + dept for all employees from the master list.
Run on server: python update_designations.py
"""
import psycopg2

PG_CONN = "host=192.168.1.104 port=5432 dbname=attendance_system user=attendance_admin password=Nikitha@23"

EMPLOYEES = [
    ("10010", "Senior Database Administrator - Lead",      "Product & Engineering"),
    ("10013", "Software Engineer - Frontend UI",           "Product & Engineering"),
    ("10040", "Software Engineer - Backend",               "Product & Engineering"),
    ("10041", "Software Engineer - Backend",               "Product & Engineering"),
    ("10043", "Software Engineer - Backend",               "Product & Engineering"),
    ("10045", "Software Engineer - Backend",               "Product & Engineering"),
    ("10046", "Software Engineer - Backend",               "Product & Engineering"),
    ("10067", "Associate Software Engineer - Frontend UI", "Product & Engineering"),
    ("10071", "Associate Software Engineer - Frontend UI", "Product & Engineering"),
    ("10073", "Software Engineer - Backend",               "Product & Engineering"),
    ("10074", "Associate Software Engineer - Frontend UI", "Product & Engineering"),
    ("10075", "Associate Software Engineer - Frontend UI", "Product & Engineering"),
    ("10076", "Software Engineer - Frontend UI",           "Product & Engineering"),
    ("10081", "Quality Assurance Engineer",                "Product & Engineering"),
    ("10083", "Quality Assurance Engineer",                "Product & Engineering"),
    ("10084", "Quality Assurance Engineer",                "Product & Engineering"),
    ("10089", "Quality Assurance Engineer",                "Product & Engineering"),
    ("10127", "Technical Delivery Manager",                "Product & Engineering"),
    ("10128", "IT Systems Manager",                        "Security & Infrastructure"),
    ("10144", "Associate Software Engineer - Frontend UX", "Product & Engineering"),
    ("10145", "Associate Software Engineer - Frontend UX", "Product & Engineering"),
    ("10146", "Associate Software Engineer - Frontend UI", "Product & Engineering"),
    ("10151", "Quality Assurance Engineer",                "Product & Engineering"),
    ("10152", "IT Systems Administrator",                  "Security & Infrastructure"),
    ("10155", "Quality Assurance Engineer",                "Product & Engineering"),
    ("10161", "Software Engineer - Mobile Developer",      "Product & Engineering"),
    ("10165", "Associate Software Engineer - Frontend UI", "Product & Engineering"),
    ("10168", "Software Engineer - Mobile Developer",      "Product & Engineering"),
    ("10169", "Senior Software Engineer - Frontend Lead",  "Product & Engineering"),
    ("10170", "Finance Manager",                           "Operations & Enablement"),
    ("10171", "HR Coordinator",                            "Operations & Enablement"),
    ("10172", "Quality Assurance Engineer",                "Product & Engineering"),
    ("10173", "HR Manager",                                "Operations & Enablement"),
    ("10174", "Senior Software Engineer - Frontend Lead",  "Product & Engineering"),
]

conn = psycopg2.connect(PG_CONN)
cur  = conn.cursor()

updated = 0
skipped = 0

for emp_id, designation, dept in EMPLOYEES:
    cur.execute(
        "UPDATE wt_employees SET designation = %s, dept = %s WHERE id = %s",
        (designation, dept, emp_id)
    )
    if cur.rowcount:
        updated += 1
    else:
        skipped += 1
        print(f"  WARN: {emp_id} not found in DB")

conn.commit()

cur.execute(
    "SELECT id, name, designation, dept FROM wt_employees WHERE id = ANY(%s) ORDER BY id",
    ([e[0] for e in EMPLOYEES],)
)
rows = cur.fetchall()

print(f"\n=== DONE ===")
print(f"Updated: {updated}  |  Not found: {skipped}")
print(f"\nVerification ({len(rows)} rows):")
for r in rows:
    print(f"  {r[0]}  {r[1][:30]:<30}  {r[2] or '(empty)'}  |  {r[3]}")

conn.close()
