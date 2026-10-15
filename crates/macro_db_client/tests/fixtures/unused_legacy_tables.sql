-- Populate the original baseline schema so drops are exercised with retained
-- historical data and real foreign keys, not just empty stand-in tables.
INSERT INTO "User" (id, email)
VALUES ('macro|cleanup@example.test', 'cleanup@example.test');
INSERT INTO "Document" (id, name, owner)
VALUES ('cleanup-document', 'Retained document', 'macro|cleanup@example.test');
INSERT INTO "Chat" (id, name, "userId")
VALUES ('cleanup-chat', 'Retained chat', 'macro|cleanup@example.test');
INSERT INTO "ChatMessage" (id, content, role, "chatId")
VALUES ('cleanup-message', '{}', 'user', 'cleanup-chat');
INSERT INTO "SharePermission" (id, "isPublic")
VALUES ('cleanup-share', false);

-- These organization tables are still used by macro-api and must survive.
INSERT INTO "Organization" (id, name) VALUES (1, 'Retained organization');
INSERT INTO "OrganizationItJob" (id, "organizationId", "taskType")
VALUES (1, 1, 'UPDATE');
INSERT INTO "EnterpriseRules" (id, "organizationId") VALUES (1, 1);
INSERT INTO "EnterpriseIManageTenants" (id, "organizationId", tenant_uri, nickname)
VALUES (1, 1, 'https://tenant.example.test', 'Retained tenant');
INSERT INTO "EnterpriseEmailContacts" (id, "organizationId", "firstName", "lastName", email)
VALUES (1, 1, 'Retained', 'Contact', 'contact@example.test');
INSERT INTO "OrganizationDefaultSharePermission" (id, organization_id)
VALUES (1, 1);

-- The experiment helpers that remain still use these tables.
INSERT INTO "Experiment" (id) VALUES ('cleanup-experiment');
INSERT INTO "ExperimentLog" (experiment_id, user_id, "group")
VALUES ('cleanup-experiment', 'macro|cleanup@example.test', 'A');

INSERT INTO "WebsocketConnectionPermissions" ("connectionId", "userId", permissions)
VALUES ('cleanup-connection', 'macro|cleanup@example.test', '{}');
INSERT INTO "MacroPrompt" (id, title, prompt, icon, color, user_id)
VALUES ('cleanup-prompt', 'Old prompt', 'Historical prompt', 'old', 'blue', 'macro|cleanup@example.test');
INSERT INTO "MacroPromptPermission" (macro_prompt_id, share_permission_id)
VALUES ('cleanup-prompt', 'cleanup-share');
INSERT INTO "MacroPromptAttachment" (id, attachment_type, attachment_id, macro_prompt_id)
VALUES ('cleanup-attachment', 'document', 'cleanup-document', 'cleanup-prompt');
INSERT INTO "Artifact" (digest, "messageId", "documentId", "userId")
VALUES ('cleanup-digest', 'cleanup-message', 'cleanup-document', 'macro|cleanup@example.test');

INSERT INTO "InsightContext" (id, "providerSource", "userId", "resourceId")
VALUES ('cleanup-context', 'chat', 'macro|cleanup@example.test', 'cleanup-chat');
INSERT INTO "UserInsights" (id, content, source, "userId")
VALUES ('cleanup-insight', 'Historical insight', 'chat', 'macro|cleanup@example.test');
INSERT INTO "UserInsightBatch" (id, "userId", "insightIds", "totalChars", "estimatedTokens", "expiresAt")
VALUES ('cleanup-batch', 'macro|cleanup@example.test', ARRAY['cleanup-insight'], 18, 5, now());
INSERT INTO "DocumentSummary" (id, summary, document_id, version_id)
VALUES ('cleanup-summary', 'Historical summary', 'cleanup-document', 'old-version');
INSERT INTO "EmailInsightsBackfillJob" (id, "userId", "updatedAt")
VALUES ('cleanup-job', 'macro|cleanup@example.test', now());
INSERT INTO "EmailInsightsBackfillBatch" (id, "insightsBackfillJobId", "threadIds", "totalThreads", "updatedAt")
VALUES ('cleanup-email-batch', 'cleanup-job', ARRAY['old-thread'], 1, now());
