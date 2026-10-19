async function test() {
  const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
  
  // 1. Get CSRF token from cookie
  const csrfRes = await fetch('http://127.0.0.1:3001/api/csrf-token');
  const setCookie = csrfRes.headers.get('set-cookie');
  const tokenMatch = setCookie.match(/XSRF-TOKEN=([^;]+)/);
  const csrfToken = tokenMatch ? tokenMatch[1] : '';
  console.log('CSRF Token from cookie:', csrfToken);

  // 2. Login
  const loginRes = await fetch('http://127.0.0.1:3001/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': csrfToken,
      'Cookie': `XSRF-TOKEN=${csrfToken}`,
    },
    body: JSON.stringify({ email: 'admin@medu.test', password: 'Password123!' }),
  });

  const loginData = await loginRes.json();
  console.log('Login Status:', loginRes.status);
  console.log('User:', loginData.user);

  // 3. Get Dashboard Stats with auth cookie
  const authCookie = loginRes.headers.raw()['set-cookie'].map(c => c.split(';')[0]).join('; ');
  const statsRes = await fetch('http://127.0.0.1:3001/api/dashboard/stats', {
    headers: {
      'Cookie': `${authCookie}; XSRF-TOKEN=${csrfToken}`,
    },
  });
  const stats = await statsRes.json();
  console.log('Dashboard Stats status:', statsRes.status);
  console.log('Dashboard Stats for clean system:');
  console.log(stats);
}

test().catch(console.error);
