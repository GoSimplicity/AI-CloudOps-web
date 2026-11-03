import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));
export const protectedRuleIds = Object.freeze([
  '@typescript-eslint/no-non-null-assertion',
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
    for (const message of result.messages) {
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

/** A failed or empty scan must never look like an absence of rule violations. */
export async function runBoundaryCheck(
  lint = () => {
    const { ESLint } = require('eslint');

    return new ESLint({ cwd: root }).lintFiles(['.']);
  },
) {
  try {
    return inspectBoundaryResults(await lint());
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
