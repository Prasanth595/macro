import { DopplerProject, type DeployedValue } from './doppler_project';

const SERVICE_NAMES = [
  'authentication-service',
  'convert-service',
  'notification-service',
  'contacts-service',
  'calendar-service',
  'cloud-storage-service',
  'search-processing-service',
  'unfurl-service',
  'static-file-service',
  'image-proxy-service',
  'connection-gateway',
  'agent-schedule-service',
  'mcp-server',
  'email-service',
  'document-cognition',
  'agent-harness-service',
  'preview-gateway',
  'slack-import-worker',
  'lexical-service',
];

for (const service_name of SERVICE_NAMES) {
  new DopplerProject(service_name, {});
}

const MACRO_DB_URL: DeployedValue = {
  dev: '${global_databases.dev.DATABASE_URL}',
  prd: '${global_databases.prd.DATABASE_URL}',
};

// Every key the service reads (services/whatsapp_session_service/src/config.rs),
// so the project needs no hand-set values. global_databases' DATABASE_URL is
// the RDS instance endpoint, which the lock connection requires (advisory
// locks and LISTEN do not survive RDS Proxy). The KMS alias is the one
// infra/stacks/whatsapp-session-service creates.
new DopplerProject('whatsapp-session-service', {
  secrets: {
    DATABASE_URL: MACRO_DB_URL,
    WHATSAPP_SESSION_LOCK_DATABASE_URL: MACRO_DB_URL,
    WHATSAPP_SESSION_KMS_KEY_ID: {
      dev: 'alias/whatsapp-session-service-dev',
      prd: 'alias/whatsapp-session-service-prod',
    },
    WHATSAPP_SESSION_MAX_ACCOUNTS: { dev: '500', prd: '500' },
    WHATSAPP_SESSION_DRAIN_BATCH: { dev: '20', prd: '20' },
  },
});
