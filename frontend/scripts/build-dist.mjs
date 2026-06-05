import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(__dirname, '..');
const distDir = path.join(frontendDir, 'dist');
const workspaceDir = path.resolve(frontendDir, '..');
const frontendVueDir = path.join(workspaceDir, 'frontend-vue');
const frontendVueRequire = createRequire(path.join(frontendVueDir, 'package.json'));
const cliArgs = new Set(process.argv.slice(2));
const enableMinify = !cliArgs.has('--no-minify');
const enableLightObfuscation = enableMinify && !cliArgs.has('--no-obfuscation');
const minifyStats = [];
const obfuscationStats = [];

const problemDetailBundleSources = [
  'js/utils.js',
  'js/object-state-machine-viz.js',
  'js/api.js',
  'js/storage-http-adapter.js',
  'js/storage-indexeddb-adapter.js',
  'js/task1BusinessInsight.js',
  'js/preliminaryRequirement.js',
  'js/task2BusinessCanvas.js',
  'js/task3RequirementLogic.js',
  'js/valueStream.js',
  'js/task4ValueStream.js',
  'js/task5ItStatus.js',
  'js/task6PainPoint.js',
  'js/storage.js',
  'js/communication-history.js',
  'js/localItGap.js',
  'js/rendering.js',
  'js/navigation.js',
  'js/rolePermission.js',
  'js/coreBusinessObject.js',
  'js/core/problem-case-api.js',
  'js/core/app-state.js',
  'js/legacy/app-dom.js',
  'js/legacy/problem-detail-renderer.js',
  'js/legacy/problem-detail-events.js',
  'js/core/problem-detail-chat.js',
  'js/core/problem-detail-runtime.js',
  'js/core/task2-companion-runtime.js',
  'js/core/task8-global-itgap.js',
  'js/core/problem-follow-shared.js',
  'js/flow-exception-record.js',
  'js/it-design-bpm-flow-render.js',
  'js/itDesignSupplement.js',
  'main.js',
];

const homeLegacyBundleSources = [
  'js/utils.js',
  'js/api.js',
  'js/storage-http-adapter.js',
  'js/storage-indexeddb-adapter.js',
  'js/task1BusinessInsight.js',
  'js/preliminaryRequirement.js',
  'js/storage.js',
  'js/core/problem-follow-shared.js',
];

const reportBundleSources = [
  'js/utils.js',
  'js/valueStream.js',
  'js/core/task8-global-itgap.js',
  'js/report-global-itgap-render.js',
  'js/report-formal-render.js',
  'js/report-page.js',
];

const wrappedModuleSources = new Set([
  'js/core/problem-case-api.js',
  'js/core/app-state.js',
  'js/legacy/app-dom.js',
  'js/legacy/problem-detail-renderer.js',
  'js/legacy/problem-detail-events.js',
  'js/core/problem-detail-chat.js',
  'js/core/problem-detail-runtime.js',
  'js/core/task2-companion-runtime.js',
  'js/core/task8-global-itgap.js',
]);

const copiedFiles = [
  'config.js',
  'config.local.js',
  'styles.css',
  'css/report.css',
  'js/config.js',
  'js/auth-runtime.js',
  'login.html',
  'admin.html',
  'model-config.html',
];

const copiedDirs = ['vue-auth-assets'];
const minifiedHtmlFiles = ['index.html', 'home.html', 'login.html', 'admin.html', 'model-config.html', 'report.html'];
const minifiedCssFiles = ['styles.css', 'css/report.css'];
const minifiedJsFiles = ['js/problem-detail-app.bundle.js', 'js/home-legacy.bundle.js', 'js/report-app.bundle.js'];
const obfuscatedJsFiles = [...minifiedJsFiles];
const requiredDistFiles = [
  'index.html',
  'home.html',
  'login.html',
  'admin.html',
  'model-config.html',
  'report.html',
  'config.js',
  'config.local.js',
  'styles.css',
  'css/report.css',
  'js/config.js',
  'js/auth-runtime.js',
  'js/problem-detail-app.bundle.js',
  'js/home-legacy.bundle.js',
  'js/report-app.bundle.js',
  'vue-auth-assets/admin.css',
  'vue-auth-assets/admin.js',
  'vue-auth-assets/home.css',
  'vue-auth-assets/home.js',
  'vue-auth-assets/login.css',
  'vue-auth-assets/login.js',
  'vue-auth-assets/model-config.css',
  'vue-auth-assets/model-config.js',
  'vue-auth-assets/shared-_plugin-vue_export-helper.js',
  'vue-auth-assets/shared-runtime-dom.esm-bundler.js',
  'vue-auth-assets/version.txt',
];
const babelParserPlugins = [
  'dynamicImport',
  'importAttributes',
  'importMeta',
  'nullishCoalescingOperator',
  'objectRestSpread',
  'optionalChaining',
  'topLevelAwait',
];
const lightObfuscationReservedIdentifiers = [
  'APP_CONFIG',
  'SmartCto',
  'appDom',
  'appState',
  'appendProblemDetailChatMessage',
  'applyFlowExceptionResume',
  'flowExceptionRecord',
  'handleProblemDetailChatSend',
  'initTask2CompanionRuntime',
  'problemCaseApi',
  'problemDetailChat',
  'problemDetailEvents',
  'problemDetailRenderer',
  'problemDetailRuntime',
  'problemFollowShared',
  'pushAndSaveProblemDetailChat',
  'pushLlmRetryNoticeBlock',
  'recordFlowExceptionTyped',
  'renderProblemDetailContent',
  'task2Runtime',
  'task8GlobalItGap',
  'window',
  'globalThis',
  'document',
];

let minifyToolchainCache = null;
let obfuscationToolchainCache = null;

function relToSrc(relPath) {
  return path.join(frontendDir, relPath);
}

function relToDist(relPath) {
  return path.join(distDir, relPath);
}

function relToDistPosix(relPath) {
  return relPath.replace(/\\/g, '/');
}

function ensureSourceFile(relPath) {
  const absPath = relToSrc(relPath);
  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
    throw new Error(`missing source file: ${relPath}`);
  }
  return absPath;
}

function ensureSourceDir(relPath) {
  const absPath = relToSrc(relPath);
  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isDirectory()) {
    throw new Error(`missing source directory: ${relPath}`);
  }
  return absPath;
}

function mkdirForFile(absPath) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
}

function copyFileToDist(relPath) {
  const srcPath = ensureSourceFile(relPath);
  const destPath = relToDist(relPath);
  mkdirForFile(destPath);
  fs.copyFileSync(srcPath, destPath);
}

function copyDirToDist(relPath) {
  const srcPath = ensureSourceDir(relPath);
  const destPath = relToDist(relPath);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.cpSync(srcPath, destPath, { recursive: true });
}

function readSource(relPath) {
  return fs.readFileSync(ensureSourceFile(relPath), 'utf8');
}

function writeDistFile(relPath, text) {
  const destPath = relToDist(relPath);
  mkdirForFile(destPath);
  fs.writeFileSync(destPath, text, 'utf8');
}

function recordMinifyStat(kind, relPath, beforeText, afterText) {
  const beforeBytes = Buffer.byteLength(beforeText, 'utf8');
  const afterBytes = Buffer.byteLength(afterText, 'utf8');
  minifyStats.push({
    kind,
    relPath,
    beforeBytes,
    afterBytes,
    deltaBytes: beforeBytes - afterBytes,
  });
}

function recordObfuscationStat(relPath, beforeText, afterText) {
  const beforeBytes = Buffer.byteLength(beforeText, 'utf8');
  const afterBytes = Buffer.byteLength(afterText, 'utf8');
  obfuscationStats.push({
    relPath,
    beforeBytes,
    afterBytes,
    deltaBytes: beforeBytes - afterBytes,
  });
}

function normalizeNewlines(text) {
  return text.replace(/\r\n/g, '\n');
}

function removeExactLine(text, line) {
  const normalized = normalizeNewlines(text);
  const needle = `${line}\n`;
  if (normalized.includes(needle)) {
    return normalized.replace(needle, '');
  }
  if (normalized.endsWith(line)) {
    return normalized.slice(0, -line.length);
  }
  throw new Error(`expected line not found: ${line}`);
}

function insertAfterLine(text, line, insertLine) {
  const normalized = normalizeNewlines(text);
  const needle = `${line}\n`;
  if (normalized.includes(needle)) {
    return normalized.replace(needle, `${line}\n${insertLine}\n`);
  }
  if (normalized.endsWith(line)) {
    return `${normalized}\n${insertLine}`;
  }
  throw new Error(`expected insertion anchor not found: ${line}`);
}

function loadMinifyToolchain() {
  if (minifyToolchainCache) {
    return minifyToolchainCache;
  }

  try {
    const parser = frontendVueRequire('@babel/parser');
    const generatorModule = frontendVueRequire('@babel/generator');
    const lightningcss = frontendVueRequire('lightningcss');

    minifyToolchainCache = {
      parseJs: parser.parse,
      generateJs: generatorModule.default || generatorModule,
      transformCss: lightningcss.transform,
    };
    return minifyToolchainCache;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `minify toolchain missing from frontend-vue. Run "npm ci" in frontend-vue before building with minify. Detail: ${detail}`,
    );
  }
}

function loadObfuscationToolchain() {
  if (obfuscationToolchainCache) {
    return obfuscationToolchainCache;
  }

  try {
    const terser = frontendVueRequire('terser');
    obfuscationToolchainCache = {
      terserMinify: terser.minify,
    };
    return obfuscationToolchainCache;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `light obfuscation toolchain missing from frontend-vue. Ensure terser is installed before building with obfuscation. Detail: ${detail}`,
    );
  }
}

function minifyJsText(relPath, source, sourceType = 'script') {
  const { parseJs, generateJs } = loadMinifyToolchain();
  const ast = parseJs(source, {
    sourceType,
    allowAwaitOutsideFunction: true,
    allowImportExportEverywhere: false,
    allowNewTargetOutsideFunction: true,
    allowReturnOutsideFunction: true,
    errorRecovery: false,
    plugins: babelParserPlugins,
  });
  const generated = generateJs(
    ast,
    {
      comments: false,
      compact: true,
      minified: true,
      jsescOption: { minimal: true },
    },
    source,
  );
  const output = generated.code;
  if (!output || typeof output !== 'string') {
    throw new Error(`failed to minify js: ${relPath}`);
  }
  return output.endsWith('\n') ? output : `${output}\n`;
}

function minifyCssText(relPath, source) {
  const { transformCss } = loadMinifyToolchain();
  const result = transformCss({
    code: Buffer.from(source, 'utf8'),
    filename: relPath,
    minify: true,
    sourceMap: false,
  });
  return `${result.code.toString('utf8')}\n`;
}

function minifyInlineScriptsInHtml(html, relPath) {
  return html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs, rawContent) => {
    if (/\bsrc\s*=/.test(attrs) || rawContent.trim().length === 0) {
      return `<script${attrs}>${rawContent}</script>`;
    }
    const minifiedContent = minifyJsText(`${relPath}#inline-script`, rawContent, 'script').trim();
    return `<script${attrs}>${minifiedContent}</script>`;
  });
}

function minifyHtmlText(relPath, source) {
  const htmlWithMinifiedScripts = minifyInlineScriptsInHtml(source, relPath);
  return htmlWithMinifiedScripts
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .trim()
    .concat('\n');
}

function minifyDistFile(relPath, kind, minifyFn) {
  const absPath = relToDist(relPath);
  const beforeText = fs.readFileSync(absPath, 'utf8');
  const afterText = minifyFn(relPath, beforeText);
  fs.writeFileSync(absPath, afterText, 'utf8');
  recordMinifyStat(kind, relPath, beforeText, afterText);
}

function applyMinifyToDist() {
  minifiedJsFiles.forEach((relPath) => minifyDistFile(relPath, 'js', minifyJsText));
  minifiedCssFiles.forEach((relPath) => minifyDistFile(relPath, 'css', minifyCssText));
  minifiedHtmlFiles.forEach((relPath) => minifyDistFile(relPath, 'html', minifyHtmlText));
}

async function obfuscateJsText(relPath, source) {
  const { terserMinify } = loadObfuscationToolchain();
  const result = await terserMinify(source, {
    compress: false,
    ecma: 2020,
    format: {
      comments: false,
    },
    mangle: {
      eval: false,
      keep_fnames: false,
      reserved: lightObfuscationReservedIdentifiers,
      toplevel: true,
    },
  });
  const output = result.code;
  if (!output || typeof output !== 'string') {
    throw new Error(`failed to apply light obfuscation: ${relPath}`);
  }
  return output.endsWith('\n') ? output : `${output}\n`;
}

async function applyLightObfuscationToDist() {
  for (const relPath of obfuscatedJsFiles) {
    const absPath = relToDist(relPath);
    const beforeText = fs.readFileSync(absPath, 'utf8');
    const afterText = await obfuscateJsText(relPath, beforeText);
    fs.writeFileSync(absPath, afterText, 'utf8');
    recordObfuscationStat(relPath, beforeText, afterText);
  }
}

function assertDistFileExists(relPath) {
  const absPath = relToDist(relPath);
  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
    throw new Error(`required dist file missing: ${relPath}`);
  }
}

function isExternalReference(ref) {
  return /^(?:[a-z]+:)?\/\//i.test(ref) || ref.startsWith('data:') || ref.startsWith('#');
}

function validateHtmlLocalReferences(relHtmlPath) {
  const html = fs.readFileSync(relToDist(relHtmlPath), 'utf8');
  const refPattern = /\b(?:src|href)=["']([^"']+)["']/g;
  const htmlDir = path.posix.dirname(relToDistPosix(relHtmlPath));
  let match;

  while ((match = refPattern.exec(html)) !== null) {
    const rawRef = match[1];
    const normalizedRef = rawRef.split('#')[0].split('?')[0];
    if (!normalizedRef || isExternalReference(normalizedRef)) {
      continue;
    }

    const resolvedRef = path.posix.normalize(path.posix.join(htmlDir, normalizedRef));
    if (resolvedRef.startsWith('../')) {
      throw new Error(`dist html reference escapes dist root: ${relHtmlPath} -> ${rawRef}`);
    }
    assertDistFileExists(resolvedRef);
  }
}

function validateDistIntegrity() {
  requiredDistFiles.forEach(assertDistFileExists);
  minifiedHtmlFiles.forEach(validateHtmlLocalReferences);
}

function transformModuleSource(relPath, source) {
  let transformed = source;

  if (relPath === 'js/core/problem-case-api.js') {
    transformed = transformed.replace(/^export const problemCaseApi =/m, 'const problemCaseApi =');
  }

  if (relPath === 'js/core/task2-companion-runtime.js') {
    transformed = transformed.replace(/\nexport\s*\{\s*init\s*\};?\s*$/m, '\n');
  }

  if (/^\s*export\b/m.test(transformed)) {
    throw new Error(`unhandled module export syntax in ${relPath}`);
  }

  return `;(() => {\n${transformed.trimEnd()}\n})();\n`;
}

function renderBundleSource(relPath) {
  const source = readSource(relPath);
  const rendered = wrappedModuleSources.has(relPath) ? transformModuleSource(relPath, source) : `${source.trimEnd()}\n`;
  return `/* ===== ${relPath} ===== */\n${rendered}`;
}

function buildBundle(relPaths, bundleName) {
  relPaths.forEach(ensureSourceFile);
  return [
    `/* ${bundleName} */`,
    '/* Generated by frontend/scripts/build-dist.mjs */',
    '',
    ...relPaths.map(renderBundleSource),
  ].join('\n');
}

function buildIndexHtml() {
  let html = normalizeNewlines(readSource('index.html'));

  [
    '  <script src="js/utils.js"></script>',
    '  <script src="js/object-state-machine-viz.js"></script>',
    '  <script src="js/api.js"></script>',
    '  <script src="js/storage-http-adapter.js"></script>',
    '  <script src="js/storage-indexeddb-adapter.js"></script>',
    '  <script src="js/task1BusinessInsight.js"></script>',
    '  <script src="js/preliminaryRequirement.js"></script>',
    '  <script src="js/task2BusinessCanvas.js"></script>',
    '  <script src="js/task3RequirementLogic.js"></script>',
    '  <script src="js/valueStream.js"></script>',
    '  <script src="js/task4ValueStream.js"></script>',
    '  <script src="js/task5ItStatus.js"></script>',
    '  <script src="js/task6PainPoint.js"></script>',
    '  <script src="js/storage.js"></script>',
    '  <script src="js/communication-history.js"></script>',
    '  <script src="js/localItGap.js"></script>',
    '  <script src="js/rendering.js"></script>',
    '  <script src="js/navigation.js"></script>',
    '  <script src="js/rolePermission.js"></script>',
    '  <script src="js/coreBusinessObject.js"></script>',
    '  <script type="module" src="js/core/problem-case-api.js"></script>',
    '  <script type="module" src="js/core/app-state.js"></script>',
    '  <script type="module" src="js/legacy/app-dom.js"></script>',
    '  <script type="module" src="js/legacy/problem-detail-renderer.js"></script>',
    '  <script type="module" src="js/legacy/problem-detail-events.js"></script>',
    '  <script type="module" src="js/core/problem-detail-chat.js"></script>',
    '  <script type="module" src="js/core/problem-detail-runtime.js"></script>',
    '  <script type="module" src="js/core/task2-companion-runtime.js"></script>',
    '  <script type="module" src="js/core/task8-global-itgap.js"></script>',
    '  <script src="js/core/problem-follow-shared.js"></script>',
    '  <script defer src="js/flow-exception-record.js"></script>',
    '  <script defer src="js/it-design-bpm-flow-render.js"></script>',
    '  <script defer src="js/itDesignSupplement.js"></script>',
    '  <script defer src="main.js"></script>',
  ].forEach((line) => {
    html = removeExactLine(html, line);
  });

  html = insertAfterLine(
    html,
    '  <script src="js/auth-runtime.js"></script>',
    '  <script src="js/problem-detail-app.bundle.js"></script>',
  );

  return html;
}

function buildHomeHtml() {
  let html = normalizeNewlines(readSource('home.html'));

  [
    '  <script src="js/utils.js"></script>',
    '  <script src="js/api.js"></script>',
    '  <script src="js/storage-http-adapter.js"></script>',
    '  <script src="js/storage-indexeddb-adapter.js"></script>',
    '  <script src="js/task1BusinessInsight.js"></script>',
    '  <script src="js/preliminaryRequirement.js"></script>',
    '  <script src="js/storage.js"></script>',
    '  <script src="js/core/problem-follow-shared.js"></script>',
  ].forEach((line) => {
    html = removeExactLine(html, line);
  });

  html = insertAfterLine(
    html,
    '  <script src="js/auth-runtime.js"></script>',
    '  <script src="js/home-legacy.bundle.js"></script>',
  );

  return html;
}

function buildReportHtml() {
  let html = normalizeNewlines(readSource('report.html'));

  [
    '  <script src="js/utils.js"></script>',
    '  <script src="js/valueStream.js"></script>',
    '  <script type="module" src="js/core/task8-global-itgap.js"></script>',
    '  <script src="js/report-global-itgap-render.js"></script>',
    '  <script src="js/report-formal-render.js"></script>',
    '  <script src="js/report-page.js"></script>',
  ].forEach((line) => {
    html = removeExactLine(html, line);
  });

  html = insertAfterLine(
    html,
    '  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>',
    '  <script src="js/report-app.bundle.js"></script>',
  );

  return html;
}

async function buildDist() {
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  copiedFiles.forEach(copyFileToDist);
  copiedDirs.forEach(copyDirToDist);

  writeDistFile('index.html', buildIndexHtml());
  writeDistFile('home.html', buildHomeHtml());
  writeDistFile('report.html', buildReportHtml());

  writeDistFile('js/problem-detail-app.bundle.js', buildBundle(problemDetailBundleSources, 'problem-detail-app.bundle.js'));
  writeDistFile('js/home-legacy.bundle.js', buildBundle(homeLegacyBundleSources, 'home-legacy.bundle.js'));
  writeDistFile('js/report-app.bundle.js', buildBundle(reportBundleSources, 'report-app.bundle.js'));

  if (enableMinify) {
    applyMinifyToDist();
  }
  if (enableLightObfuscation) {
    await applyLightObfuscationToDist();
  }
  validateDistIntegrity();
}

function printSummary() {
  const files = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const absPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(absPath);
        continue;
      }
      files.push(path.relative(distDir, absPath).replace(/\\/g, '/'));
    }
  }

  walk(distDir);

  process.stdout.write('[build-dist] generated frontend/dist\n');
  for (const file of files) {
    process.stdout.write(` - ${file}\n`);
  }
  if (enableMinify) {
    process.stdout.write('[build-dist] minify summary\n');
    for (const stat of minifyStats) {
      process.stdout.write(
        ` - ${stat.kind}: ${stat.relPath} ${stat.beforeBytes}B -> ${stat.afterBytes}B (-${stat.deltaBytes}B)\n`,
      );
    }
  }
  if (enableLightObfuscation) {
    process.stdout.write('[build-dist] light obfuscation summary\n');
    for (const stat of obfuscationStats) {
      process.stdout.write(
        ` - js: ${stat.relPath} ${stat.beforeBytes}B -> ${stat.afterBytes}B (-${stat.deltaBytes}B)\n`,
      );
    }
  }
}

try {
  await buildDist();
  printSummary();
} catch (error) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`[build-dist] failed: ${message}\n`);
  process.exitCode = 1;
}
