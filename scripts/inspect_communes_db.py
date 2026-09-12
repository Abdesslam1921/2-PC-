import sqlite3
from pathlib import Path

path = Path('/home/ubuntu/webdev-static-assets/algerian-cities-kossa.sqlite')
with sqlite3.connect(path) as connection:
    tables = connection.execute("select name from sqlite_master where type='table' order by name").fetchall()
    print('tables:', tables)
    for (table,) in tables:
        columns = connection.execute(f'pragma table_info("{table}")').fetchall()
        print(table, [column[1] for column in columns])
        print(connection.execute(f'select * from "{table}" limit 3').fetchall())

    rows = connection.execute('select * from communes where wilaya_id = 5 limit 10').fetchall()
    print('wilaya_5:', rows)
    print('count:', connection.execute('select count(*) from communes').fetchone()[0])
