# CLAUDE.md

## Descripcion del Proyecto

Bot de Telegram para gestion de documentos oficiales (oficios colombianos) en grupos de Telegram.
Cada grupo esta vinculado a una carpeta en OneDrive. Al recibir un documento y ejecutar `/gestionar`,
el bot: descarga el documento, extrae informacion (radicado, asunto, fecha), lo sube a OneDrive,
registra el seguimiento en Excel y genera un borrador de respuesta en Word.

## Stack

- **Runtime**: Node.js + TypeScript
- **Bot Framework**: grammY (Telegram Bot API)
- **OneDrive**: Microsoft Graph API + @azure/identity (Device Code flow)
- **PDF**: pdf-parse v2 (clase PDFParse)
- **Word lectura**: mammoth
- **Word generacion**: docxtemplater + pizzip
- **Excel**: Microsoft Graph Excel API (tablas con nombre "Radicados")
- **Logging**: winston
- **Config**: dotenv + JSON

## Estructura del Proyecto

```
src/
  index.ts                        # Entry point (orquesta + notificaciones)
  bot/
    bot.ts                        # Instancia Bot + middleware (log de chatId)
    commands.ts                   # Registro central de comandos
    commands/
      gestionar.ts                # /gestionar + confirmacion inline
      consultas.ts                # /oficios, /revision, /respondidos, /buscar, /detalle
      responder.ts                # /responder + generacion borrador .docx
  services/
    telegram.service.ts           # Descarga archivos de Telegram
    onedrive.service.ts           # Subida a OneDrive + validacion duplicados
    excel.service.ts              # CRUD Excel via Graph API
    extraction.service.ts         # Extraer radicado, fecha, asunto (regex)
    docgen.service.ts             # Generar borrador de respuesta .docx
    notifications.service.ts      # Alertas de vencimiento programadas
  auth/
    graph-auth.ts                 # Autenticacion Microsoft Graph (Device Code)
  types/
    config.types.ts               # Interfaces de configuracion
    document.types.ts             # Interfaces de datos y ExcelRow
  utils/
    logger.ts                     # Configuracion de winston
    helpers.ts                    # Utilidades (fechas, rutas temp)
    config.ts                     # Carga de groups.json
    cache.ts                      # Cache temporal de datos extraidos
config/
  groups.json                     # Mapeo grupo Telegram -> carpeta OneDrive
  extraction-patterns.json        # Patrones regex para oficios colombianos
templates/
  respuesta-template.docx         # Plantilla de respuesta borrador
scripts/
  create-template.ts              # Script para regenerar la plantilla .docx
```

## Comandos de Desarrollo

```bash
npm run dev      # Desarrollo con hot-reload (nodemon + ts-node)
npm run build    # Compilar TypeScript a dist/
npm start        # Ejecutar version compilada
```

## Comandos del Bot

| Comando | Descripcion |
|---|---|
| `/start` | Mensaje de bienvenida |
| `/help` | Lista de comandos |
| `/gestionar` | Responder a un documento para procesarlo (extrae datos, sube a OneDrive, registra en Excel). Muestra botones de confirmacion antes de proceder. |
| `/responder <codigo> <codigo_resp>` | Marca oficio como "Respondido", actualiza Excel, genera borrador .docx y lo sube a OneDrive |
| `/oficios` | Lista todos los oficios registrados |
| `/revision` | Lista oficios con estado "En Revision" |
| `/respondidos` | Lista oficios respondidos con codigo de respuesta |
| `/buscar <texto>` | Busca oficios por codigo o texto en asunto |
| `/detalle <codigo>` | Muestra info completa de un oficio |

## Configuracion

### Variables de entorno (.env)
```
BOT_TOKEN=                        # Token del bot de Telegram
ADMIN_USER_ID=                    # ID de usuario administrador
AZURE_CLIENT_ID=                  # Application ID de Azure AD
AZURE_TENANT_ID=consumers         # "consumers" para cuenta personal
ONEDRIVE_DEFAULT_FOLDER=          # Carpeta por defecto si el grupo no esta configurado
NOTIFICATION_INTERVAL_HOURS=12    # Frecuencia de revision de vencimientos
NOTIFICATION_DAYS_LIMIT=5         # Dias sin respuesta para alertar
```

### Configuracion de grupos (config/groups.json)
Cada grupo de Telegram se mapea a una carpeta de OneDrive y un archivo Excel:
```json
{
  "groups": [{
    "chatId": -1003503834431,
    "name": "GestionTPG",
    "onedriveFolderPath": "Consultoria/JCPosada/Plateado-Guapi/Comunicaciones",
    "excelFileName": "ControlDocumental.xlsx"
  }]
}
```

### Excel en OneDrive
El archivo Excel debe tener una tabla con nombre **"Radicados"** y 7 columnas:
`Code | Asunto | FechaDocumento | FechaRecepcion | Estado | FechaRespuesta | CodeRespuesta`

### Patrones de extraccion (config/extraction-patterns.json)
Patrones regex ajustados para oficios de interventoria colombianos (UPTC/INVIAS).
Detectan codigos tipo `C4234-585-2024`, fechas con ciudades colombianas, campo Asunto multi-linea,
y solicitudes con "se solicita", "se recomienda", "se requiere".

### Plantilla de respuesta (templates/respuesta-template.docx)
Placeholders: `{code_respuesta}`, `{radicado}`, `{asunto}`, `{fecha_documento}`,
`{fecha_respuesta}`, `{fecha_recepcion}`, `{solicitudes}`.
Se puede personalizar abriendo el .docx en Word.

## Buenas Practicas

- **Max 500 lineas por archivo**. Si crece, dividir en submodulos.
- **Una funcion = una tarea**. Funciones cortas (max ~50 lineas).
- **Tipos estrictos**: no usar `any`. Interfaces para todos los datos entre componentes.
- **Componentes independientes**: cada servicio tiene una responsabilidad unica.
- **Errores especificos** por servicio. Mensajes al usuario en espanol.
- **Secretos en `.env`**, configuracion de negocio en `config/`.

## Archivos Sensibles

- `.env` contiene BOT_TOKEN, ADMIN_USER_ID, AZURE_CLIENT_ID. Nunca commitear.
- `botId.md` contiene token y user ID del bot. Nunca commitear ni exponer.

## Flujo Principal: /gestionar

1. Usuario responde a un documento con `/gestionar`
2. Bot descarga el documento de Telegram
3. Bot extrae datos: radicado, asunto, fecha, solicitudes (regex)
4. Bot muestra resumen y botones **Confirmar / Cancelar**
5. Al confirmar: valida que el archivo no exista ya en OneDrive
6. Sube documento a OneDrive (carpeta del grupo)
7. Registra en Excel: codigo, asunto, fechas, estado "En Revision"
8. Cachea datos para uso en /responder

## Flujo: /responder

1. Usuario ejecuta `/responder C4234-585-2024 C4221-123-2026`
2. Bot actualiza Excel: estado "Respondido", fecha y codigo respuesta
3. Si hay datos en cache, genera borrador .docx con plantilla
4. Sube borrador a OneDrive y lo envia al grupo

## Notificaciones Automaticas

Cada N horas (configurable), el bot revisa oficios "En Revision" y envia alerta
al grupo si alguno supera el limite de dias sin respuesta.
