-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "clientId" TEXT,
    "workspaceId" TEXT,
    "templateId" TEXT,
    "automationRuleId" TEXT,
    CONSTRAINT "EmailLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmailLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmailLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EmailLog_automationRuleId_fkey" FOREIGN KEY ("automationRuleId") REFERENCES "AutomationRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EmailLog" ("automationRuleId", "body", "clientId", "id", "sentAt", "status", "subject", "templateId") SELECT "automationRuleId", "body", "clientId", "id", "sentAt", "status", "subject", "templateId" FROM "EmailLog";
DROP TABLE "EmailLog";
ALTER TABLE "new_EmailLog" RENAME TO "EmailLog";
CREATE INDEX "EmailLog_clientId_sentAt_idx" ON "EmailLog"("clientId", "sentAt");
CREATE INDEX "EmailLog_workspaceId_sentAt_idx" ON "EmailLog"("workspaceId", "sentAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
