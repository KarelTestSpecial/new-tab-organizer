// Runs every suite in this folder, one after another.
//
// Each suite starts its own headless Chrome on its own debugging port and
// serves the extension over its own HTTP port, so they cannot run in parallel.
// A non-zero exit from any suite fails the run.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SUITES = [
    'test-organizers.mjs',
    'test-link-lists.mjs',
    'test-folder-picker.mjs',
    'test-ordering.mjs',
    'test-leaks.mjs',
    'test-realdrag.mjs'
];

const here = fileURLToPath(new URL('.', import.meta.url));
let failed = 0;

for (const suite of SUITES) {
    console.log(`\n=== ${suite}`);
    const code = await new Promise((resolve) => {
        const child = spawn(process.execPath, [here + suite], { stdio: 'inherit' });
        child.on('exit', resolve);
        child.on('error', () => resolve(1));
    });
    if (code !== 0) {
        failed++;
        console.log(`--- ${suite} FAILED`);
    }
}

console.log(failed === 0
    ? '\nALL SUITES PASSED'
    : `\n${failed} SUITE(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);