/**
 * [INPUT]: `../frontend` 静态资源、`serve-static`、Vite 多页构建
 * [OUTPUT]: 开发态 `/frontend` 静态挂载、构建产物与 HTML 路径归一
 * [POS]: `frontend-vue` 构建与 dev 服务器配置
 *
 * [PROTOCOL]: 变更 dev 静态映射、`inject-vite-home-guard`、构建钩子、`writeVueAuthAssetsVersion`（含 design-detail / design-llm-log 的 `?v=` 防缓存）或路径归一逻辑时，同步更新本 Header 与 `frontend-vue/AGENTS.md`
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'path';
import serveStatic from 'serve-static';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

/** 开发态：`home.html` 等壳使用 `/frontend/*`；Connect 官方 `use('/frontend', …)` 挂载 sibling 目录 */
function createDevFrontendStack(frontendAbs: string) {
  const staticMw = serveStatic(frontendAbs, { index: false, fallthrough: false });
  type Next = (err?: unknown) => void;
  return [
    (req: IncomingMessage, res: ServerResponse, next: Next) => {
      if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }
      const urlPath = (req.url?.split('?')[0] ?? '/').replace(/^\//, '') || '';
      if (urlPath === 'config.local.js' || urlPath.endsWith('/config.local.js')) {
        const full = path.join(frontendAbs, 'config.local.js');
        if (!fs.existsSync(full)) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.end('/* optional: frontend/config.local.js (gitignored) */\n');
          return;
        }
      }
      next();
    },
    staticMw,
  ] as const;
}

/** 与 `frontend/js/auth-runtime.js` 同源，构建/开发启动时复制到 `public/js`，供 login/admin 静态引用 */
function syncAuthRuntimeToPublic() {
  const src = path.resolve(__dirname, '../frontend/js/auth-runtime.js');
  const dest = path.resolve(__dirname, 'public/js/auth-runtime.js');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function cleanFrontendVueAuthAssets() {
  const dir = path.resolve(__dirname, '../frontend/vue-auth-assets');
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (e) {
    // ignore
  }
  fs.mkdirSync(dir, { recursive: true });
}

function sha256Hex(buf: Buffer) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function writeVueAuthAssetsVersion() {
  const assetsDir = path.resolve(__dirname, '../frontend/vue-auth-assets');
  const loginJs = path.resolve(assetsDir, 'login.js');
  const adminJs = path.resolve(assetsDir, 'admin.js');
  const homeJs = path.resolve(assetsDir, 'home.js');
  const modelConfigJs = path.resolve(assetsDir, 'model-config.js');
  const loginCss = path.resolve(assetsDir, 'login.css');
  const adminCss = path.resolve(assetsDir, 'admin.css');
  const homeCss = path.resolve(assetsDir, 'home.css');
  const sharedCss = path.resolve(assetsDir, 'shared.css');
  const modelConfigCss = path.resolve(assetsDir, 'model-config.css');
  const toolExperienceJs = path.resolve(assetsDir, 'tool-experience.js');
  const toolExperienceCss = path.resolve(assetsDir, 'tool-experience.css');
  const toolDetailJs = path.resolve(assetsDir, 'tool-detail.js');
  const toolDetailCss = path.resolve(assetsDir, 'tool-detail.css');
  const designDetailJs = path.resolve(assetsDir, 'design-detail.js');
  const designDetailCss = path.resolve(assetsDir, 'design-detail.css');
  const designLlmLogJs = path.resolve(assetsDir, 'design-llm-log.js');
  const designLlmLogCss = path.resolve(assetsDir, 'design-llm-log.css');

  const bufs: Buffer[] = [];
  for (const p of [
    loginJs,
    adminJs,
    homeJs,
    modelConfigJs,
    toolExperienceJs,
    toolDetailJs,
    designDetailJs,
    designLlmLogJs,
    loginCss,
    adminCss,
    homeCss,
    sharedCss,
    modelConfigCss,
    toolExperienceCss,
    toolDetailCss,
    designDetailCss,
    designLlmLogCss,
  ]) {
    if (fs.existsSync(p)) bufs.push(fs.readFileSync(p));
  }

  // 产物版本：对当前产物内容做 sha256（同一套源码同一套产物 → 版本稳定可复现）
  const version = sha256Hex(Buffer.concat(bufs)).slice(0, 12);
  fs.writeFileSync(path.resolve(assetsDir, 'version.txt'), `${version}\n`, 'utf8');

  /** 为 HTML 中 `./vue-auth-assets/*` 追加 `?v=`，避免浏览器长期缓存旧 bundle 导致设计页逻辑不更新 */
  function patchHtmlVueAuthAssetsQuery(htmlRel: string) {
    const htmlPath = path.resolve(__dirname, '../frontend', htmlRel);
    if (!fs.existsSync(htmlPath)) return;
    const raw = fs.readFileSync(htmlPath, 'utf8');
    const next = raw.replace(
      /(\b(?:src|href)=")(\.\/vue-auth-assets\/[^"?]+)(\?[^"]*)?(")/g,
      (_m, p1: string, p2: string, _q: string, p4: string) => `${p1}${p2}?v=${version}${p4}`,
    );
    if (next !== raw) fs.writeFileSync(htmlPath, next, 'utf8');
  }
  patchHtmlVueAuthAssetsQuery('tool-detail.html');
  patchHtmlVueAuthAssetsQuery('design-detail.html');
  patchHtmlVueAuthAssetsQuery('design-llm-log.html');
}

function normalizeBuiltHtmlLocalAssetPaths() {
  const targets = [
    path.resolve(__dirname, '../frontend/home.html'),
    path.resolve(__dirname, '../frontend/tool-experience.html'),
    path.resolve(__dirname, '../frontend/tool-detail.html'),
    path.resolve(__dirname, '../frontend/design-detail.html'),
    path.resolve(__dirname, '../frontend/design-llm-log.html'),
  ];
  for (const htmlPath of targets) {
    if (!fs.existsSync(htmlPath)) continue;
    const raw = fs.readFileSync(htmlPath, 'utf8');
    const next = raw
      .replace(
        /\b(src|href)="\.\.\/frontend\/([^"]+)"/g,
        (_match, attrName: string, assetPath: string) => `${attrName}="${assetPath}"`,
      )
      .replace(
        /\b(src|href)="\/frontend\/([^"]+)"/g,
        (_match, attrName: string, assetPath: string) => `${attrName}="${assetPath}"`,
      );
    if (next !== raw) fs.writeFileSync(htmlPath, next, 'utf8');
  }
}

export default defineConfig({
  appType: 'mpa',
  server: {
    fs: {
      allow: [path.resolve(__dirname, '..'), path.resolve(__dirname, '../frontend')],
    },
  },
  plugins: [
    {
      name: 'dev-serve-sibling-frontend',
      configureServer(server) {
        const frontendAbs = path.resolve(__dirname, '../frontend');
        const stack = createDevFrontendStack(frontendAbs);
        for (const mw of stack) {
          server.middlewares.use('/frontend', mw);
        }
      },
    },
    /** 向 home.html 注入 `vite-home-guard.js`（Vite 默认会丢弃模板里未参与打包的 body 脚本） */
    {
      name: 'inject-vite-home-guard',
      transformIndexHtml(html, ctx) {
        const filename = String(ctx.filename || ctx.path || '').replace(/\\/g, '/');
        if (!filename.endsWith('home.html')) return html;
        if (html.includes('vite-home-guard.js')) return html;
        return html.replace('</body>', '  <script src="./vite-home-guard.js"></script>\n</body>');
      },
    },
    /**
     * 设计详情页：构建后保证 `task1BusinessInsight.js` 等 body 脚本仍在 `</body>` 前（与 bundle 内 import 双轨）。
     */
    {
      name: 'preserve-design-detail-legacy-body-scripts',
      transformIndexHtml: {
        order: 'post',
        handler(html, ctx) {
          const filename = String(ctx.filename || ctx.path || '').replace(/\\/g, '/');
          if (!filename.endsWith('design-detail.html')) return html;
          if (html.includes('task1BusinessInsight.js')) {
            if (!html.includes('designDetailL3ScenarioSystemPrompt.js')) {
              return html.replace(
                '<script src="js/task1BusinessInsight.js"></script>',
                '  <script src="js/designDetailL3ScenarioSystemPrompt.js"></script>\n  <script src="js/designDetailL65ItGapSystemPrompt.js"></script>\n  <script src="js/task1BusinessInsight.js"></script>',
              );
            }
            return html;
          }
          const legacy = [
            '  <script src="config.js"></script>',
            '  <script src="config.local.js"></script>',
            '  <script src="js/config.js"></script>',
            '  <script src="js/utils.js"></script>',
            '  <script src="js/communication-history.js"></script>',
            '  <script src="js/auth-runtime.js"></script>',
            '  <script src="js/api.js"></script>',
            '  <script src="js/designDetailL3ScenarioSystemPrompt.js"></script>',
            '  <script src="js/designDetailL65ItGapSystemPrompt.js"></script>',
            '  <script src="js/task1BusinessInsight.js"></script>',
            '  <script src="js/storage-http-adapter.js"></script>',
            '  <script src="js/storage-indexeddb-adapter.js"></script>',
            '  <script src="js/storage.js"></script>',
          ].join('\n');
          return html.replace('</body>', `${legacy}\n</body>`);
        },
      },
    },
    {
      name: 'sync-auth-runtime-public',
      buildStart() {
        try {
          syncAuthRuntimeToPublic();
        } catch (e) {
          console.warn('[vite] sync-auth-runtime-public failed:', e);
        }
      },
    },
    {
      name: 'clean-frontend-vue-auth-assets',
      apply: 'build',
      buildStart() {
        cleanFrontendVueAuthAssets();
      },
    },
    {
      name: 'write-frontend-vue-auth-assets-version',
      apply: 'build',
      closeBundle() {
        try {
          writeVueAuthAssetsVersion();
        } catch (e) {
          console.warn('[vite] write-frontend-vue-auth-assets-version failed:', e);
        }
      },
    },
    {
      name: 'normalize-built-html-local-asset-paths',
      apply: 'build',
      closeBundle() {
        try {
          normalizeBuiltHtmlLocalAssetPaths();
        } catch (e) {
          console.warn('[vite] normalize-built-html-local-asset-paths failed:', e);
        }
      },
    },
    {
      name: 'ensure-design-detail-scenario-script-tag',
      apply: 'build',
      closeBundle() {
        const htmlPath = path.resolve(__dirname, '../frontend/design-detail.html');
        if (!fs.existsSync(htmlPath)) return;
        let raw = fs.readFileSync(htmlPath, 'utf8');
        if (!raw.includes('task1BusinessInsight.js') || raw.includes('designDetailL3ScenarioSystemPrompt.js')) {
          return;
        }
        const next = raw.replace(
          '<script src="js/task1BusinessInsight.js"></script>',
          '  <script src="js/designDetailL3ScenarioSystemPrompt.js"></script>\n  <script src="js/designDetailL65ItGapSystemPrompt.js"></script>\n  <script src="js/task1BusinessInsight.js"></script>',
        );
        if (next !== raw) fs.writeFileSync(htmlPath, next, 'utf8');
      },
    },
    vue(),
  ],
  // 让构建产物中的资源引用变为相对路径（例如 `./vue-auth-assets/...`）
  // 避免静态部署/多页面场景下因路径解析差异导致加载行为不一致。
  base: './',
  build: {
    // 把 login/admin 的构建产物输出到现有 frontend/ 目录（不清空，避免影响原业务入口 index.html）
    outDir: path.resolve(__dirname, '../frontend'),
    emptyOutDir: false,
    assetsDir: 'vue-auth-assets',
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        login: path.resolve(__dirname, 'login.html'),
        admin: path.resolve(__dirname, 'admin.html'),
        home: path.resolve(__dirname, 'home.html'),
        'model-config': path.resolve(__dirname, 'model-config.html'),
        'tool-experience': path.resolve(__dirname, 'tool-experience.html'),
        'tool-detail': path.resolve(__dirname, 'tool-detail.html'),
        'design-detail': path.resolve(__dirname, 'design-detail.html'),
        'design-llm-log': path.resolve(__dirname, 'design-llm-log.html'),
      },
      output: {
        // 产物固定命名：避免 hash 文件名堆积，便于多人协作与冲突处理（冲突时统一重构建）
        entryFileNames: 'vue-auth-assets/[name].js',
        chunkFileNames: 'vue-auth-assets/shared-[name].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name ?? '';
          if (name.endsWith('.css')) {
            if (name.includes('login')) return 'vue-auth-assets/login.css';
            if (name.includes('admin')) return 'vue-auth-assets/admin.css';
            if (name.includes('home') || name.includes('HomePage')) return 'vue-auth-assets/home.css';
            if (name.includes('model-config') || name.includes('ModelConfigPage')) return 'vue-auth-assets/model-config.css';
            if (name.includes('tool-experience') || name.includes('ToolExperience')) {
              return 'vue-auth-assets/tool-experience.css';
            }
            if (name.includes('tool-detail') || name.includes('ToolDetailPage')) {
              return 'vue-auth-assets/tool-detail.css';
            }
            if (name.includes('design-detail') || name.includes('DesignDetailPage')) {
              return 'vue-auth-assets/design-detail.css';
            }
            if (name.includes('design-llm-log') || name.includes('DesignLlmLogPage')) {
              return 'vue-auth-assets/design-llm-log.css';
            }
            return 'vue-auth-assets/shared.css';
          }
          // 其他静态资源（如有）也固定归档到目录内
          return 'vue-auth-assets/[name][extname]';
        },
      },
    },
  },
});
