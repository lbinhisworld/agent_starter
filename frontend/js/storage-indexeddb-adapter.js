/**
 * [INPUT]: 浏览器 IndexedDB / localStorage（仅迁移兜底）
 * [OUTPUT]: `window.STORAGE_INDEXEDDB_ADAPTER`；`init` 结束（成功或失败）后 `setTimeout(0)` 派发 `storageIndexedDbReady`；`__STORAGE_INDEXEDDB_HYDRATED` 供 main 在缓存回填前勿用占位聊天覆盖；`saveTaskTrackingSnapshot` 供重置问题时整表写回任务追踪（已移除主站「工具知识库」相关 KV）
 * [POS]: local 模式持久化适配层，由 `storage.js` 绑定全局读写
 *
 * [PROTOCOL]: 一旦本文件逻辑变更，必须同步更新本 Header 与 `storage-indexeddb-adapter.md`、本目录 `AGENTS.md`（若影响约束）
 *
 * 说明：同步读内存 cache + 异步落盘；派发事件供首页在 IndexedDB 回填 cache 后重绘（避免刷新后首屏误显示 0 条）。
 * FE-20260403-20：`updateDigitalProblem` 按 `String(createdAt|id)` 双键定位列表项，与 HTTP 适配器一致，避免 caseKey 类型不一致时落盘与内存分叉。
 */
(function (global) {
  const DB_NAME = 'do1_smart_cto_local_db';
  const DB_VERSION = 1;
  const STORE_NAME = 'kv';

  const KEYS = {
    analyses: 'company_analyses',
    digitalProblems: 'digital_problem_followups',
    chats: 'problem_detail_chats',
    operationHistory: 'digital_problem_operation_history',
    taskTracking: 'digital_problem_task_tracking',
  };
  const MIGRATION_MARK = '__idb_migrated__';

  function deepClone(v) {
    return v == null ? v : JSON.parse(JSON.stringify(v));
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('indexedDB open failed'));
    });
  }

  function idbGet(db, key) {
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
      req.onerror = () => resolve(undefined);
    });
  }

  function idbPut(db, key, value) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('indexedDB put failed'));
      tx.onabort = () => reject(tx.error || new Error('indexedDB put aborted'));
    });
  }

  function readLocalStorageJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function clearLegacyLocalStorageKeys() {
    try {
      Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    } catch (_) {}
  }

  function dispatchIndexedDbReady() {
    try {
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('storageIndexedDbReady'));
      }
    } catch (_) {}
  }

  function createAdapter() {
    let db = null;
    let ready = false;
    const cache = {
      analyses: readLocalStorageJson(KEYS.analyses, []),
      digitalProblems: readLocalStorageJson(KEYS.digitalProblems, []),
      chats: readLocalStorageJson(KEYS.chats, {}),
      operationHistory: readLocalStorageJson(KEYS.operationHistory, {}),
      taskTracking: readLocalStorageJson(KEYS.taskTracking, {}),
    };

    /** main.js 中 initProblemDetailChat 依赖：init 完成前勿用占位消息覆盖 chats（否则异步回填后仍为空） */
    if (typeof global !== 'undefined') global.__STORAGE_INDEXEDDB_HYDRATED = false;

    const flushing = new Map();
    function flushKey(key, value) {
      if (!db || !ready) return;
      if (flushing.get(key)) return;
      flushing.set(key, true);
      Promise.resolve().then(() => idbPut(db, key, deepClone(value)))
        .catch(() => {})
        .finally(() => flushing.delete(key));
    }

    async function init() {
      try {
        db = await openDb();
        const migrated = await idbGet(db, MIGRATION_MARK);
        if (!migrated) {
          await Promise.all(Object.values(KEYS).map((k) => idbPut(db, k, deepClone(cache[toCacheField(k)]))));
          await idbPut(db, MIGRATION_MARK, true);
          clearLegacyLocalStorageKeys();
        } else {
          await Promise.all(Object.values(KEYS).map(async (k) => {
            const v = await idbGet(db, k);
            if (v !== undefined) cache[toCacheField(k)] = v;
          }));
          clearLegacyLocalStorageKeys();
        }
        ready = true;
        /* init 完成前若已有写入，flushKey 曾跳过；此处把当前内存缓存再落盘一遍，避免丢数据 */
        if (db) {
          Object.values(KEYS).forEach((k) => {
            const field = toCacheField(k);
            if (field) flushKey(k, deepClone(cache[field]));
          });
        }
      } catch (_) {
        ready = false;
      } finally {
        try {
          if (typeof global !== 'undefined') global.__STORAGE_INDEXEDDB_HYDRATED = true;
        } catch (_) {}
        /* 推迟到 macrotask：避免在 main.js 注册监听前完成 init 导致漏派事件 */
        setTimeout(dispatchIndexedDbReady, 0);
      }
    }

    function toCacheField(key) {
      switch (key) {
        case KEYS.analyses: return 'analyses';
        case KEYS.digitalProblems: return 'digitalProblems';
        case KEYS.chats: return 'chats';
        case KEYS.operationHistory: return 'operationHistory';
        case KEYS.taskTracking: return 'taskTracking';
        default: return '';
      }
    }

    function setField(field, value) {
      cache[field] = deepClone(value);
      const key = Object.values(KEYS).find((k) => toCacheField(k) === field);
      if (key) flushKey(key, cache[field]);
    }

    init();

    return {
      getSavedAnalyses: () => deepClone(cache.analyses || []),
      saveAnalysis(record) {
        const list = deepClone(cache.analyses || []);
        const idx = list.findIndex((r) => (r.companyName || '').trim() === (record.companyName || '').trim());
        if (idx >= 0) list[idx] = record; else list.push(record);
        setField('analyses', list);
      },
      getDigitalProblems: () => deepClone(cache.digitalProblems || []),
      saveDigitalProblem(item) {
        let list = deepClone(cache.digitalProblems || []);
        const applyMig = typeof global.applyDigitalProblemsArchiveNoMigration === 'function'
          ? global.applyDigitalProblemsArchiveNoMigration(list)
          : { list, changed: false };
        list = applyMig.list;
        if (applyMig.changed) setField('digitalProblems', list);
        const peekNext = typeof global.peekNextDigitalProblemArchiveNo === 'function'
          ? global.peekNextDigitalProblemArchiveNo(list)
          : list.length + 1;
        const existingNo = Number(item?.archiveNo);
        const archiveNo = Number.isFinite(existingNo) && existingNo > 0 ? existingNo : peekNext;
        list.unshift({ ...item, createdAt: new Date().toISOString(), archiveNo });
        setField('digitalProblems', list);
      },
      removeDigitalProblem(index) {
        const list = deepClone(cache.digitalProblems || []);
        if (index < 0 || index >= list.length) return;
        list.splice(index, 1);
        setField('digitalProblems', list);
      },
      updateDigitalProblem(createdAt, updates) {
        const list = deepClone(cache.digitalProblems || []);
        const k = String(createdAt);
        const idx = list.findIndex((it) => String(it.createdAt || '') === k || String(it.id || '') === k);
        if (idx < 0) return;
        list[idx] = { ...list[idx], ...updates };
        setField('digitalProblems', list);
      },
      saveDigitalProblemsSnapshot(list) {
        setField('digitalProblems', Array.isArray(list) ? list : []);
      },
      getProblemDetailChats: () => deepClone(cache.chats || {}),
      saveProblemDetailChat(createdAt, messages) {
        const chats = deepClone(cache.chats || {});
        chats[createdAt] = messages;
        if (Array.isArray(messages) && messages.length === 0) {
          const list = cache.digitalProblems || [];
          const row = list.find(
            (it) => String(it.createdAt || '') === String(createdAt) || String(it.id || '') === String(createdAt),
          );
          if (row) {
            if (row.createdAt != null) chats[String(row.createdAt)] = [];
            if (row.id != null) chats[String(row.id)] = [];
          }
        }
        setField('chats', chats);
      },
      getOperationHistory: () => deepClone(cache.operationHistory || {}),
      saveOperationHistory(all) { setField('operationHistory', all || {}); },
      getTaskTrackingData: () => deepClone(cache.taskTracking || {}),
      saveTaskTrackingData(createdAt, data) {
        const all = deepClone(cache.taskTracking || {});
        all[createdAt] = data;
        setField('taskTracking', all);
      },
      /** 整表替换任务追踪（如重置问题时删除某 createdAt 条目） */
      saveTaskTrackingSnapshot(all) {
        setField('taskTracking', all && typeof all === 'object' ? all : {});
      },
    };
  }

  global.STORAGE_INDEXEDDB_ADAPTER = createAdapter();
})(typeof window !== 'undefined' ? window : this);
