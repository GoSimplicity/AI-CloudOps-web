import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));
export const protectedRuleIds = Object.freeze([
  '@typescript-eslint/no-non-null-assertion',
  'cloudops/no-sfc-non-null-assertion',
  'no-empty',
  'no-undef',
  'no-unsafe-finally',
]);
const protectedRules = new Set(protectedRuleIds);

/** Classify actual diagnostics without changing the repository's lint rules. */
export function inspectBoundaryResults(results) {
  const violations = [];
  let fatalCount = 0;
  let errorCount = 0;
  let warningCount = 0;
  for (const result of results) {
    errorCount += result.errorCount;
    warningCount += result.warningCount;
    const toolMessages = result.messages.filter(
      (message) =>
        message.fatal || (message.ruleId === null && message.severity > 0),
    );
    fatalCount += Math.max(result.fatalErrorCount, toolMessages.length);
    for (const message of [
      ...result.messages,
      ...(result.suppressedMessages ?? []),
    ]) {
      if (protectedRules.has(message.ruleId) && message.severity > 0) {
        // Never include diagnostic text: parser and plugin messages can echo source.
        violations.push({
          column: message.column,
          filePath: result.filePath,
          line: message.line,
          ruleId: message.ruleId,
        });
      }
    }
  }
  if (results.length === 0) fatalCount += 1;
  let exitCode = violations.length > 0 ? 1 : 0;
  if (fatalCount > 0) exitCode = 2;
  return {
    errorCount,
    exitCode,
    fatalCount,
    fileCount: results.length,
    violations,
    warningCount,
  };
}

function lintRepository() {
  const { ESLint } = require('eslint');
  return new ESLint({ cwd: root }).lintFiles(['.']);
}

function lintWithoutDirectiveSuppression(files) {
  const { ESLint } = require('eslint');
  return new ESLint({
    allowInlineConfig: false,
    cwd: root,
    overrideConfig: {
      files: ['**/*.vue'],
      // Vue's processor removes template directive diagnostics before ESLint can
      // put them in suppressedMessages. This audit alone must see those nodes.
      rules: { 'vue/comment-directive': 'off' },
    },
  }).lintFiles(files);
}

/** Rule-control directives contain this literal; ESLint still parses their syntax. */
export async function auditBoundaryDirectives(
  results,
  lint = lintWithoutDirectiveSuppression,
  read = (filename) => readFile(filename, 'utf8'),
) {
  const files = new Set();
  for (const result of results) {
    const source =
      typeof result.source === 'string'
        ? result.source
        : await read(result.filePath);
    if (source.includes('eslint')) files.add(result.filePath);
  }
  if (files.size === 0) return [];
  const audited = await lint([...files]);
  const seen = new Set();
  if (!Array.isArray(audited) || audited.length !== files.size) {
    throw new Error('ESLint directive audit returned invalid file coverage');
  }
  for (const result of audited) {
    if (
      !result ||
      typeof result.filePath !== 'string' ||
      !files.has(result.filePath) ||
      seen.has(result.filePath)
    ) {
      throw new Error('ESLint directive audit returned invalid file coverage');
    }
    seen.add(result.filePath);
  }
  return audited;
}

/** A failed or empty primary scan must never look like an absence of violations. */
export async function runBoundaryCheck(
  lint = lintRepository,
  audit = lint === lintRepository ? auditBoundaryDirectives : undefined,
) {
  let results;
  let report;
  try {
    results = await lint();
    report = inspectBoundaryResults(results);
  } catch {
    return {
      errorCount: 0,
      exitCode: 2,
      fatalCount: 1,
      fileCount: 0,
      violations: [],
      warningCount: 0,
    };
  }
  if (!audit || report.fatalCount > 0) return report;
  try {
    const auditResults = await audit(results);
    if (auditResults.length === 0) return { ...report, auditedFileCount: 0 };
    const extra = inspectBoundaryResults(auditResults);
    const unique = new Map();
    for (const entry of [...report.violations, ...extra.violations]) {
      unique.set(JSON.stringify(entry), entry);
    }
    const violations = [...unique.values()];
    const fatalCount = report.fatalCount + extra.fatalCount;
    let exitCode = violations.length > 0 ? 1 : 0;
    if (fatalCount > 0) exitCode = 2;
    // Keep totals from the ordinary scan: unrelated rule waivers retain their
    // normal meaning, even though the secondary audit sees all diagnostics.
    return {
      ...report,
      auditedFileCount: auditResults.length,
      exitCode,
      fatalCount,
      violations,
    };
  } catch {
    return { ...report, exitCode: 2, fatalCount: report.fatalCount + 1 };
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const report = await runBoundaryCheck();
  const status = report.exitCode === 0 ? 'PASS' : 'FAIL';
  process.stdout.write(
    `ESLint boundaries ${status}: ${report.fileCount} files, ${report.violations.length} protected-rule violations, ${report.fatalCount} parser/tool failures.\n`,
  );
  if (report.auditedFileCount !== undefined) {
    process.stdout.write(
      `Directive audit: ${report.auditedFileCount} files.\n`,
    );
  }
  process.stdout.write(
    `Repository totals: ${report.errorCount} errors, ${report.warningCount} warnings. This boundary check does not certify full lint success.\n`,
  );
  if (report.exitCode !== 0) {
    process.stderr.write(
      'ESLint boundary verification failed. Diagnostic/source text omitted; use the normal ESLint command locally for details.\n',
    );
  }
  process.exitCode = report.exitCode;
}
