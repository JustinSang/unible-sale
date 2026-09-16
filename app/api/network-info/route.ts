import { NextResponse } from 'next/server';
import os from 'os';

export async function GET() {
  const interfaces = os.networkInterfaces();
  let localIp = '127.0.0.1';
  let tailscaleIp = '';

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      // IPv4 and non-internal
      if (net.family === 'IPv4' && !net.internal) {
        if (net.address.startsWith('100.')) {
          tailscaleIp = net.address;
        } else if (net.address.startsWith('192.168.') || net.address.startsWith('10.') || net.address.startsWith('172.')) {
          localIp = net.address;
        }
      }
    }
  }

  const port = process.env.PORT || 3000;

  return NextResponse.json({
    localIp,
    localUrl: `http://${localIp}:${port}`,
    tailscaleIp,
    tailscaleUrl: tailscaleIp ? `http://${tailscaleIp}:${port}` : null,
    port: Number(port),
    hostname: os.hostname(),
    platform: os.platform()
  });
}
