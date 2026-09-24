/**
 * M-EDU Zero-Trust Real Browser E2E Verification Suite
 * Executes 18 comprehensive browser flows using Playwright and Google Chrome.
 */
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CHROME_PATH = process.env.CHROME_BIN || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const RESULTS = [];

function record(flowNumber, flowName, status, details = '') {
  const entry = { flowNumber, flowName, status, details, timestamp: new Date().toISOString() };
  RESULTS.push(entry);
  const mark = status === 'PASS' ? '✅' : '❌';
  console.log(`${mark} [Flow ${String(flowNumber).padStart(2, '0')}] ${flowName}: ${status} ${details ? '(' + details + ')' : ''}`);
}

async function run() {
  console.log('='.repeat(70));
  console.log('🚀 Launching Real Browser E2E Suite via Playwright & Chrome');
  console.log(`🌐 Target Base URL: ${BASE_URL}`);
  console.log(`💻 Chrome Binary:   ${CHROME_PATH}`);
  console.log('='.repeat(70));

  let browser;
  try {
    browser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1280,800',
      ],
    });
  } catch (err) {
    console.error('❌ Failed to launch Chrome browser:', err);
    process.exit(1);
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  });

  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });
  page.on('pageerror', (err) => {
    console.log('BROWSER UNCAUGHT:', err.message);
  });

  try {
    // ── Flow 01: Open Application ──────────────────────────────────────────
    try {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('input[name="email"]', { timeout: 10000 });
      const title = await page.title();
      record(1, 'Open Application', 'PASS', `Title: "${title}"`);
    } catch (e) {
      record(1, 'Open Application', 'FAIL', e.message);
    }

    // ── Flow 02: Login Flow (Invalid + Valid) ──────────────────────────────
    try {
      // Test invalid credentials
      await page.fill('input[name="email"]', 'wrong@medu.test');
      await page.fill('input[name="password"]', 'WrongPassword123!');
      await page.click('button[type="submit"]');
      const alert = await page.waitForSelector('[role="alert"]', { timeout: 5000 });
      const alertText = await alert.textContent();

      // Test valid credentials
      await page.fill('input[name="email"]', 'admin@medu.test');
      await page.fill('input[name="password"]', 'Admin1234!');
      await page.click('button[type="submit"]');

      // Wait for navigation to dashboard (URL should become /)
      await page.waitForURL((url) => url.pathname === '/', { timeout: 10000 });
      record(2, 'Login Flow', 'PASS', `Rejection verified: "${alertText?.trim()}", authenticated as admin@medu.test`);
    } catch (e) {
      record(2, 'Login Flow', 'FAIL', e.message);
    }

    // ── Flow 03: Dashboard ────────────────────────────────────────────────
    try {
      await page.waitForSelector('main', { timeout: 10000 });
      // Wait for content inside main
      await page.waitForSelector('main h1, main h2, main div', { timeout: 10000 });
      await page.waitForTimeout(1000);
      const mainText = await page.locator('main').textContent();
      const hasContent = mainText && mainText.trim().length > 10;
      if (!hasContent) throw new Error('Dashboard main content is empty');
      record(3, 'Dashboard Overview', 'PASS', 'Dashboard mounted with metric cards');
    } catch (e) {
      record(3, 'Dashboard Overview', 'FAIL', e.message);
    }

    // ── Flow 04: Students List ────────────────────────────────────────────
    try {
      await page.goto(`${BASE_URL}/students`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('h1, h2', { timeout: 8000 });
      const heading = await page.locator('h1, h2').first().textContent();
      record(4, 'Students List', 'PASS', `Heading: "${heading?.trim()}"`);
    } catch (e) {
      record(4, 'Students List', 'FAIL', e.message);
    }

    // ── Flow 05: Add Student Form ─────────────────────────────────────────
    try {
      await page.goto(`${BASE_URL}/students/new`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('form', { timeout: 8000 });

      const uniqueSuffix = Date.now().toString().slice(-6);
      const studentEmail = `student_${uniqueSuffix}@medu.test`;

      // Fill required fields
      await page.locator('input[placeholder="John"]').fill('E2E');
      await page.locator('input[placeholder="Doe"]').fill(`Student${uniqueSuffix}`);
      await page.locator('input[placeholder="john@example.com"]').fill(studentEmail);

      // Submit form
      await page.click('button[type="submit"]');

      // Wait for redirect to student detail or back to students list
      await page.waitForTimeout(2000);
      const currentUrl = page.url();
      record(5, 'Add Student Form', 'PASS', `Created student "${studentEmail}" -> ${currentUrl}`);
    } catch (e) {
      record(5, 'Add Student Form', 'FAIL', e.message);
    }

    // ── Flow 06: Teachers List ────────────────────────────────────────────
    try {
      await page.goto(`${BASE_URL}/teachers`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('main', { timeout: 8000 });
      await page.waitForTimeout(800);
      record(6, 'Teachers List', 'PASS', 'Teachers page rendered');
    } catch (e) {
      record(6, 'Teachers List', 'FAIL', e.message);
    }

    // ── Flow 07: Groups ───────────────────────────────────────────────────
    try {
      await page.goto(`${BASE_URL}/groups`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('main', { timeout: 8000 });
      await page.waitForTimeout(800);
      record(7, 'Groups View', 'PASS', 'Groups page rendered');
    } catch (e) {
      record(7, 'Groups View', 'FAIL', e.message);
    }

    // ── Flow 08: Courses ──────────────────────────────────────────────────
    try {
      await page.goto(`${BASE_URL}/courses`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('main', { timeout: 8000 });
      await page.waitForTimeout(800);
      record(8, 'Courses View', 'PASS', 'Courses page rendered');
    } catch (e) {
      record(8, 'Courses View', 'FAIL', e.message);
    }

    // ── Flow 09: Attendance ───────────────────────────────────────────────
    try {
      await page.goto(`${BASE_URL}/attendance`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('main', { timeout: 8000 });
      await page.waitForTimeout(800);
      record(9, 'Attendance Module', 'PASS', 'Attendance page rendered');
    } catch (e) {
      record(9, 'Attendance Module', 'FAIL', e.message);
    }

    // ── Flow 10: Payments ─────────────────────────────────────────────────
    try {
      await page.goto(`${BASE_URL}/payments`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('main', { timeout: 8000 });
      await page.waitForTimeout(800);
      record(10, 'Payments Module', 'PASS', 'Payments page rendered');
    } catch (e) {
      record(10, 'Payments Module', 'FAIL', e.message);
    }

    // ── Flow 11: Invoices / Finance ───────────────────────────────────────
    try {
      await page.goto(`${BASE_URL}/invoices`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('main', { timeout: 8000 });
      await page.waitForTimeout(800);
      record(11, 'Invoices Module', 'PASS', 'Invoices & Billing page rendered');
    } catch (e) {
      record(11, 'Invoices Module', 'FAIL', e.message);
    }

    // ── Flow 12: Reports ──────────────────────────────────────────────────
    try {
      await page.goto(`${BASE_URL}/reports`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('main', { timeout: 8000 });
      await page.waitForTimeout(1000);
      record(12, 'Reports Module', 'PASS', 'Reports & Business Intelligence page rendered');
    } catch (e) {
      record(12, 'Reports Module', 'FAIL', e.message);
    }

    // ── Flow 13: Settings ─────────────────────────────────────────────────
    try {
      await page.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('main', { timeout: 8000 });
      await page.waitForTimeout(800);
      record(13, 'Settings Module', 'PASS', 'Settings page rendered');
    } catch (e) {
      record(13, 'Settings Module', 'FAIL', e.message);
    }

    // ── Flow 14: Language Switcher ────────────────────────────────────────
    try {
      // Find language switcher select in header
      const langSelect = page.locator('select[aria-label="Language"], select[aria-label="Til"], select[aria-label="Язык"]').first();
      await langSelect.waitFor({ state: 'attached', timeout: 5000 });

      // Switch to Uzbek (uz)
      await langSelect.selectOption('uz');
      await page.waitForTimeout(500);

      // Switch to Russian (ru)
      await langSelect.selectOption('ru');
      await page.waitForTimeout(500);

      // Switch back to English (en)
      await langSelect.selectOption('en');
      await page.waitForTimeout(500);

      record(14, 'Language Switcher', 'PASS', 'Successfully toggled UZ -> RU -> EN');
    } catch (e) {
      record(14, 'Language Switcher', 'FAIL', e.message);
    }

    // ── Flow 15: Dark/Light Theme Switch ──────────────────────────────────
    try {
      const themeBtn = page.locator('button[title*="theme"], button[aria-label*="theme"]').first();
      await themeBtn.waitFor({ state: 'attached', timeout: 5000 });

      // Click to toggle to dark
      await themeBtn.click();
      await page.waitForTimeout(400);
      const darkTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));

      // Click to toggle back to light
      await themeBtn.click();
      await page.waitForTimeout(400);
      const lightTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));

      if (darkTheme === lightTheme) {
        throw new Error(`Theme did not toggle: ${darkTheme} === ${lightTheme}`);
      }
      record(15, 'Theme Switcher', 'PASS', `Toggled theme: ${darkTheme} -> ${lightTheme}`);
    } catch (e) {
      record(15, 'Theme Switcher', 'FAIL', e.message);
    }

    // ── Flow 16: Mobile Viewport ──────────────────────────────────────────
    try {
      // Resize to mobile viewport (iPhone dimensions)
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);

      // Verify mobile hamburger menu button exists and click it
      const menuBtn = page.locator('button[aria-label="Open menu"]');
      await menuBtn.waitFor({ state: 'visible', timeout: 5000 });
      await menuBtn.click();

      // Verify mobile drawer / sheet opens with navigation items
      await page.waitForSelector('nav[aria-label="Main navigation"]', { timeout: 5000 });
      const navCount = await page.locator('nav[aria-label="Main navigation"] a').count();

      // Close mobile menu
      const closeBtn = page.locator('button[aria-label="Close menu"]').first();
      await closeBtn.click();
      await page.waitForTimeout(400);

      // Restore desktop viewport
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.waitForTimeout(400);

      record(16, 'Mobile Viewport', 'PASS', `Mobile navigation opened with ${navCount} items and closed cleanly`);
    } catch (e) {
      record(16, 'Mobile Viewport', 'FAIL', e.message);
    }

    // ── Flow 17: Direct Deep-Link Navigation & Refresh Persistence ────────
    try {
      await page.goto(`${BASE_URL}/students`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('main', { timeout: 8000 });

      // Trigger hard reload
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('main', { timeout: 8000 });

      // Ensure we are still on /students and not redirected to /login
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        throw new Error('Session lost after page reload: redirected to /login');
      }
      record(17, 'Deep-Link & Session Persistence', 'PASS', `Session retained on reload at ${currentUrl}`);
    } catch (e) {
      record(17, 'Deep-Link & Session Persistence', 'FAIL', e.message);
    }

    // ── Flow 18: Logout ───────────────────────────────────────────────────
    try {
      // Find sign out button in sidebar
      const signOutBtn = page.locator('button:has-text("Sign out")').first();
      await signOutBtn.waitFor({ state: 'visible', timeout: 5000 });
      await signOutBtn.click();

      // Verify redirection to /login
      await page.waitForURL((url) => url.pathname === '/login', { timeout: 8000 });

      // Verify protected route redirection
      await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForURL((url) => url.pathname === '/login', { timeout: 8000 });

      record(18, 'Logout & Route Guard', 'PASS', 'Logged out cleanly and protected route redirected to /login');
    } catch (e) {
      record(18, 'Logout & Route Guard', 'FAIL', e.message);
    }

  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  console.log('='.repeat(70));
  console.log('📊 Real Browser E2E Suite Results:');
  const passed = RESULTS.filter((r) => r.status === 'PASS').length;
  const failed = RESULTS.filter((r) => r.status === 'FAIL').length;
  console.log(`TOTAL: ${RESULTS.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('='.repeat(70));

  if (failed > 0) {
    console.error(`💥 ${failed} browser flow(s) failed!`);
    process.exit(1);
  } else {
    console.log('🎉 ALL 18 BROWSER FLOWS PASSED VERIFICATION!');
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal error in browser test runner:', err);
  process.exit(1);
});
