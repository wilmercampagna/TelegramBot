import { DeviceCodeCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js';
import logger from '../utils/logger';

let graphClient: Client | null = null;
let currentAccessToken: string | null = null;
let tokenExpiresAt = 0;

export function getGraphClient(): Client {
  if (graphClient) {
    return graphClient;
  }

  const clientId = process.env.AZURE_CLIENT_ID;
  if (!clientId) {
    throw new Error('AZURE_CLIENT_ID no configurado en .env');
  }

  const tenantId = process.env.AZURE_TENANT_ID || 'consumers';
  const refreshToken = process.env.GRAPH_REFRESH_TOKEN;

  if (refreshToken) {
    graphClient = createRefreshTokenClient(clientId, tenantId, refreshToken);
    logger.info('Cliente Graph inicializado con refresh token (produccion)');
  } else {
    graphClient = createDeviceCodeClient(clientId, tenantId);
    logger.info('Cliente Graph inicializado con Device Code (desarrollo)');
  }

  return graphClient;
}

function createDeviceCodeClient(clientId: string, tenantId: string): Client {
  const credential = new DeviceCodeCredential({
    clientId,
    tenantId,
    userPromptCallback: (info) => {
      logger.info('=== AUTENTICACION MICROSOFT ===');
      logger.info(info.message);
      logger.info('===============================');
    },
  });

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['Files.ReadWrite', 'User.Read'],
  });

  return Client.initWithMiddleware({ authProvider });
}

function createRefreshTokenClient(clientId: string, tenantId: string, refreshToken: string): Client {
  return Client.init({
    authProvider: async (done) => {
      try {
        const token = await getAccessTokenFromRefresh(clientId, tenantId, refreshToken);
        done(null, token);
      } catch (error) {
        done(error as Error, null);
      }
    },
  });
}

async function getAccessTokenFromRefresh(
  clientId: string,
  tenantId: string,
  refreshToken: string
): Promise<string> {
  // Reutilizar token si aun es valido (con margen de 5 min)
  if (currentAccessToken && Date.now() < tokenExpiresAt - 300_000) {
    return currentAccessToken;
  }

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: 'Files.ReadWrite User.Read offline_access',
      }),
    }
  );

  const data = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (data.error) {
    throw new Error(`Error renovando token: ${data.error} - ${data.error_description}`);
  }

  if (!data.access_token) {
    throw new Error('No se recibio access token');
  }

  currentAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;

  // Si recibimos nuevo refresh token, actualizar en memoria
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    process.env.GRAPH_REFRESH_TOKEN = data.refresh_token;
    logger.info('Refresh token renovado automaticamente');
  }

  return currentAccessToken;
}

export async function verifyGraphConnection(): Promise<boolean> {
  try {
    const client = getGraphClient();
    const me = await client.api('/me').get();
    logger.info(`Conectado a Microsoft Graph como: ${me.displayName} (${me.userPrincipalName})`);
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    logger.error(`Error al verificar conexion Graph: ${msg}`);
    return false;
  }
}
