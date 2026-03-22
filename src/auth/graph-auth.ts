import { DeviceCodeCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js';
import logger from '../utils/logger';

let graphClient: Client | null = null;

export function getGraphClient(): Client {
  if (graphClient) {
    return graphClient;
  }

  const clientId = process.env.AZURE_CLIENT_ID;
  if (!clientId) {
    throw new Error('AZURE_CLIENT_ID no configurado en .env');
  }

  const tenantId = process.env.AZURE_TENANT_ID || 'consumers';

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

  graphClient = Client.initWithMiddleware({ authProvider });

  logger.info('Cliente Microsoft Graph inicializado');
  return graphClient;
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
