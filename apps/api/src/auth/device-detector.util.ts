export interface ParsedDeviceInfo {
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  os: string;
  browser: string;
}

export function parseUserAgent(ua?: string | null): ParsedDeviceInfo {
  if (!ua || typeof ua !== 'string') {
    return {
      deviceName: 'Unknown Device',
      deviceType: 'unknown',
      os: 'Unknown OS',
      browser: 'Unknown Browser',
    };
  }

  const s = ua.trim();

  // Detect OS
  let os = 'Unknown OS';
  if (/windows nt 10\.0/i.test(s)) {
    os = 'Windows 10/11';
  } else if (/windows nt 6\.3/i.test(s)) {
    os = 'Windows 8.1';
  } else if (/windows nt 6\.2/i.test(s)) {
    os = 'Windows 8';
  } else if (/windows nt 6\.1/i.test(s)) {
    os = 'Windows 7';
  } else if (/windows nt/i.test(s)) {
    os = 'Windows';
  } else if (/android\s*([0-9.]+)?/i.test(s)) {
    const match = s.match(/android\s*([0-9.]+)?/i);
    os = match && match[1] ? `Android ${match[1]}` : 'Android';
  } else if (/ipad|iphone|ipod/i.test(s)) {
    const match = s.match(/os\s*([0-9_]+)?/i);
    os = match && match[1] ? `iOS ${match[1].replace(/_/g, '.')}` : 'iOS';
  } else if (/mac os x\s*([0-9_]+)?/i.test(s)) {
    const match = s.match(/mac os x\s*([0-9_]+)?/i);
    os = match && match[1] ? `macOS ${match[1].replace(/_/g, '.')}` : 'macOS';
  } else if (/cros/i.test(s)) {
    os = 'ChromeOS';
  } else if (/linux/i.test(s)) {
    os = 'Linux';
  }

  // Detect Browser
  let browser = 'Unknown Browser';
  if (/edg\/([0-9.]+)/i.test(s)) {
    const v = s.match(/edg\/([0-9.]+)/i);
    browser = v ? `Edge ${v[1].split('.')[0]}` : 'Edge';
  } else if (/opr\/([0-9.]+)/i.test(s)) {
    const v = s.match(/opr\/([0-9.]+)/i);
    browser = v ? `Opera ${v[1].split('.')[0]}` : 'Opera';
  } else if (/crios\/([0-9.]+)/i.test(s)) {
    const v = s.match(/crios\/([0-9.]+)/i);
    browser = v ? `Chrome Mobile ${v[1].split('.')[0]}` : 'Chrome Mobile';
  } else if (/fxios\/([0-9.]+)/i.test(s)) {
    const v = s.match(/fxios\/([0-9.]+)/i);
    browser = v ? `Firefox Mobile ${v[1].split('.')[0]}` : 'Firefox Mobile';
  } else if (/chrome\/([0-9.]+)/i.test(s)) {
    const v = s.match(/chrome\/([0-9.]+)/i);
    browser = v ? `Chrome ${v[1].split('.')[0]}` : 'Chrome';
  } else if (/firefox\/([0-9.]+)/i.test(s)) {
    const v = s.match(/firefox\/([0-9.]+)/i);
    browser = v ? `Firefox ${v[1].split('.')[0]}` : 'Firefox';
  } else if (/version\/([0-9.]+).*safari/i.test(s)) {
    const v = s.match(/version\/([0-9.]+)/i);
    browser = v ? `Safari ${v[1].split('.')[0]}` : 'Safari';
  } else if (/safari/i.test(s) && !/chrome/i.test(s)) {
    browser = 'Safari';
  }

  // Detect Device Type
  let deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown' = 'desktop';
  if (/ipad|tablet/i.test(s) || (/android/i.test(s) && !/mobile/i.test(s))) {
    deviceType = 'tablet';
  } else if (/mobile|iphone|ipod|android/i.test(s)) {
    deviceType = 'mobile';
  }

  // Detect Device Name
  let deviceName = 'Device';
  if (/iphone/i.test(s)) {
    deviceName = 'iPhone';
  } else if (/ipad/i.test(s)) {
    deviceName = 'iPad';
  } else if (/android/i.test(s)) {
    // Attempt to extract device model e.g. SM-S918B
    const modelMatch = s.match(/;\s*([^;)]+)\s+Build\//i);
    if (modelMatch && modelMatch[1]) {
      const model = modelMatch[1].trim();
      deviceName = model.startsWith('SM-') ? `Samsung ${model}` : model;
    } else {
      deviceName = deviceType === 'tablet' ? 'Android Tablet' : 'Android Phone';
    }
  } else if (/macintosh|mac os x/i.test(s)) {
    deviceName = 'Mac';
  } else if (/windows/i.test(s)) {
    deviceName = 'Windows PC';
  } else if (/linux/i.test(s)) {
    deviceName = 'Linux PC';
  } else if (/cros/i.test(s)) {
    deviceName = 'Chromebook';
  } else {
    deviceName = deviceType === 'mobile' ? 'Mobile Phone' : deviceType === 'tablet' ? 'Tablet' : 'Desktop';
  }

  return {
    deviceName,
    deviceType,
    os,
    browser,
  };
}

export function formatIpAddress(rawIp?: string | null): string {
  if (!rawIp) return '127.0.0.1';
  let ip = rawIp.trim();
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  return ip;
}
