import dotenv from 'dotenv';
dotenv.config();

const clientId = process.env.AZURE_CLIENT_ID;
if (!clientId) {
  console.error('AZURE_CLIENT_ID no configurado en .env');
  process.exit(1);
}

const tenantId = process.env.AZURE_TENANT_ID || 'consumers';
const scopes = 'Files.ReadWrite User.Read offline_access';

async function main(): Promise<void> {
  // Paso 1: Solicitar device code
  const deviceCodeResponse = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/devicecode`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `client_id=${clientId}&scope=${encodeURIComponent(scopes)}`,
    }
  );

  const deviceCode = await deviceCodeResponse.json() as {
    user_code: string;
    device_code: string;
    verification_uri: string;
    interval: number;
    message: string;
  };

  console.log('\n=== AUTENTICACION MICROSOFT ===');
  console.log(deviceCode.message);
  console.log('===============================\n');

  // Paso 2: Poll hasta que el usuario autorice
  const interval = (deviceCode.interval || 5) * 1000;
  let authorized = false;

  while (!authorized) {
    await new Promise((r) => setTimeout(r, interval));

    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `client_id=${clientId}&grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code=${deviceCode.device_code}`,
      }
    );

    const tokenData = await tokenResponse.json() as {
      error?: string;
      access_token?: string;
      refresh_token?: string;
    };

    if (tokenData.error === 'authorization_pending') {
      process.stdout.write('.');
      continue;
    }

    if (tokenData.error) {
      console.error(`\nError: ${tokenData.error}`);
      process.exit(1);
    }

    if (tokenData.refresh_token) {
      authorized = true;
      console.log('\n\n=== REFRESH TOKEN OBTENIDO ===');
      console.log('Copia este valor y configuralo como variable GRAPH_REFRESH_TOKEN en Railway:\n');
      console.log(tokenData.refresh_token);
      console.log('\n==============================');
    }
  }
}

main().catch(console.error);
