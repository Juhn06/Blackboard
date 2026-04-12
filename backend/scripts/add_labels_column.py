import sqlite3
import sys
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "blackboard.db"
print(f"Using DB: {DB_PATH}")
if not DB_PATH.exists():
    print("Database file not found.")
    sys.exit(1)

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()
cur.execute("PRAGMA table_info(cards);")
cols = [row[1] for row in cur.fetchall()]
print("Existing columns:", cols)
if "labels" in cols:
    print("labels column already exists. Nothing to do.")
else:
    print("Adding labels column (TEXT) to cards table...")
    cur.execute("ALTER TABLE cards ADD COLUMN labels TEXT;")
    conn.commit()
    print("Added labels column.")

conn.close()

