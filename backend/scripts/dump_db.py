import sqlite3

db = r'C:\Users\Xuan\PycharmProjects\BlackBoard\backend\blackboard.db'
con = sqlite3.connect(db)
cur = con.cursor()
rows = cur.execute("SELECT name, type, sql FROM sqlite_master WHERE type='table'").fetchall()
print('TABLES:', rows)
for table in [r[0] for r in rows]:
    try:
        cols = [c[1] for c in cur.execute(f"PRAGMA table_info('{table}')")]
        print('\nTable', table, 'cols', cols)
        for r in cur.execute(f"SELECT * FROM '{table}' LIMIT 50"):
            print(table, r)
    except Exception as e:
        print('err', table, e)
con.close()

