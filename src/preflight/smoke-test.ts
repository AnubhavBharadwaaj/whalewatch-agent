/**
 * Smoke test for the preflight safety guard.
 *
 * Verifies the full 2x2 matrix of (mode x source): the one dangerous
 * combination is refused, the other three are allowed.
 */
import { log } from '../util/log.js';
import { checkRunMode } from './guard.js';

function main(): void {
  let failures = 0;
  const check = (label: string, ok: boolean, detail = ''): void => {
    if (ok) {
      log.info(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
    } else {
      failures++;
      log.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    }
  };

  // The one dangerous combination — must be refused, with an explanation.
  const liveMock = checkRunMode('live', 'mock');
  check('live + mock is refused', liveMock.ok === false);
  check(
    'refusal explains the problem and the fix',
    typeof liveMock.reason === 'string' &&
      liveMock.reason.includes('mock') &&
      liveMock.reason.includes('dry-run'),
  );

  // The three safe combinations — must all be allowed.
  check('live + whale-alert is allowed', checkRunMode('live', 'whale-alert').ok === true);
  check('dry-run + mock is allowed', checkRunMode('dry-run', 'mock').ok === true);
  check('dry-run + whale-alert is allowed', checkRunMode('dry-run', 'whale-alert').ok === true);

  if (failures > 0) {
    log.error(`Preflight smoke test: ${failures} failure(s).`);
    process.exit(1);
  }
  log.info('Preflight smoke test: all checks passed.');
}

main();
