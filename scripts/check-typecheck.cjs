const { execSync } = require('child_process');
const path = require('path');

const webDir = path.join(process.cwd(), 'apps', 'web');
try {
  const out = execSync('npx tsc --noEmit -p tsconfig.json', {
    cwd: webDir,
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log('✅ TYPECHECK PASSED WITH 0 ERRORS!');
  if (out) console.log(out);
} catch (err) {
  console.error('❌ TYPECHECK FAILED:');
  if (err.stdout) console.log(err.stdout);
  if (err.stderr) console.error(err.stderr);
  process.exit(1);
}
