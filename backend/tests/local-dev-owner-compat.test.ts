import { describe, expect, it } from 'vitest';

const compat = require('../scripts/local-dev-ensure-owner-isolation.cjs');

describe('local dev owner compat script (helpers)', () => {
  it('parseDatabaseUrl parses mysql url', () => {
    const cfg = compat.parseDatabaseUrl('mysql://user:pass@127.0.0.1:3306/do1_smart_cto');
    expect(cfg.host).toBe('127.0.0.1');
    expect(cfg.port).toBe(3306);
    expect(cfg.user).toBe('user');
    expect(cfg.password).toBe('pass');
    expect(cfg.database).toBe('do1_smart_cto');
  });

  it('ensureOwnerIsolationDbCompatWithConnection is idempotent and does not overwrite existing owner', async () => {
    const state = {
      schema: 'do1_smart_cto',
      tables: {
        problemcase: {
          columns: new Set(['id', 'createdAt', 'updatedAt', 'customerName']),
          indexes: new Set(),
          rows: [
            { id: 'c1', ownerSubjectId: null, ownerSubjectType: null, ownerUsernameSnapshot: null },
            { id: 'c2', ownerSubjectId: 'u_1', ownerSubjectType: 'user', ownerUsernameSnapshot: 'u1' },
          ],
        },
        adminuser: {
          columns: new Set(['id', 'username', 'passwordHash', 'createdAt', 'updatedAt']),
          rows: [{ id: 'adm_root_id', username: 'root', passwordHash: 'x' }],
        },
      },
    };

    const fakeConn = {
      async query(sql: string, params: any[]) {
        const s = String(sql).trim();

        if (s.includes('FROM information_schema.columns')) {
          const tableName = params[1] as keyof typeof state.tables;
          const cols = Array.from((state.tables as any)[tableName].columns).map((c: any) => ({ column_name: c }));
          return cols;
        }

        if (s.startsWith('ALTER TABLE')) {
          const m = s.match(/ALTER TABLE\s+`([^`]+)`\s+ADD COLUMN\s+`([^`]+)`/i);
          if (!m) throw new Error('unexpected ALTER TABLE: ' + s);
          const table = m[1];
          const col = m[2];
          (state.tables as any)[table].columns.add(col);
          return { affectedRows: 0 };
        }

        if (s.includes('FROM information_schema.statistics')) {
          const tableName = params[1] as keyof typeof state.tables;
          const indexName = String(params[2]);
          const exists = (state.tables as any)[tableName].indexes.has(indexName);
          return [{ cnt: exists ? 1 : 0 }];
        }

        if (s.startsWith('CREATE INDEX')) {
          const m = s.match(/CREATE INDEX\s+`([^`]+)`\s+ON\s+`([^`]+)`/i);
          if (!m) throw new Error('unexpected CREATE INDEX: ' + s);
          const indexName = m[1];
          const table = m[2];
          (state.tables as any)[table].indexes.add(indexName);
          return { affectedRows: 0 };
        }

        if (s.startsWith('SELECT id, username FROM')) {
          const m = s.match(/FROM\s+`([^`]+)`/i);
          if (!m) throw new Error('unexpected SELECT query: ' + s);
          const table = m[1] as keyof typeof state.tables;
          const row = (state.tables as any)[table].rows.find((r: any) => r.username === 'root');
          return row ? [row] : [];
        }

        if (s.startsWith('INSERT INTO')) {
          const m = s.match(/INSERT INTO\s+`([^`]+)`/i);
          if (!m) throw new Error('unexpected INSERT query: ' + s);
          const table = m[1] as keyof typeof state.tables;
          (state.tables as any)[table].rows.push({
            id: params[0],
            username: 'root',
            passwordHash: params[1],
          });
          return { affectedRows: 1 };
        }

        if (s.startsWith('UPDATE')) {
          const m = s.match(/UPDATE\s+`([^`]+)`/i);
          if (!m) throw new Error('unexpected UPDATE query: ' + s);
          const table = m[1] as keyof typeof state.tables;
          let affected = 0;
          for (const row of (state.tables as any)[table].rows) {
            if (row.ownerSubjectId == null && row.ownerSubjectType == null) {
              row.ownerSubjectId = params[0];
              row.ownerSubjectType = 'admin';
              row.ownerUsernameSnapshot = 'root';
              affected++;
            }
          }
          return { affectedRows: affected };
        }

        throw new Error('unexpected sql: ' + s);
      },
    };

    const first = await compat.ensureOwnerIsolationDbCompatWithConnection(fakeConn, state.schema, {
      envName: 'test',
      problemCaseTable: 'problemcase',
      adminUserTable: 'adminuser',
    });
    expect(first.columns.added.length).toBeGreaterThan(0);
    expect(first.index.created || first.index.existed).toBe(true);
    expect(first.backfill.updatedRows).toBe(1);
    // 不覆盖已有 owner
    const c2 = state.tables.problemcase.rows.find((r) => r.id === 'c2');
    expect(c2).toBeTruthy();
    expect(c2!.ownerSubjectId).toBe('u_1');

    const second = await compat.ensureOwnerIsolationDbCompatWithConnection(fakeConn, state.schema, {
      envName: 'test',
      problemCaseTable: 'problemcase',
      adminUserTable: 'adminuser',
    });
    expect(second.columns.added).toEqual([]);
    expect(second.backfill.updatedRows).toBe(0);
  });
});

