import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { hash } from "bcryptjs";

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" });
const prisma = new PrismaClient({ adapter });

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function hoursAgo(hours: number): Date {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d;
}

const CHECKLIST_BY_STAGE = {
  "New Inquiry": JSON.stringify([
    { id: "ni-1", title: "Review inquiry details", isRequired: true, assignedTo: "team" },
    { id: "ni-2", title: "Verify contact information", isRequired: true, assignedTo: "team" },
    { id: "ni-3", title: "Send introduction email", isRequired: true, assignedTo: "team" },
  ]),
  "Needs Assessment": JSON.stringify([
    { id: "na-1", title: "Complete buyer questionnaire", isRequired: true, assignedTo: "client" },
    { id: "na-2", title: "Review pre-approval or proof of funds", isRequired: true, assignedTo: "team" },
    { id: "na-3", title: "Define search criteria (beds, baths, location)", isRequired: true, assignedTo: "team" },
    { id: "na-4", title: "Schedule initial consultation call", isRequired: true, assignedTo: "team" },
  ]),
  "Property Tours": JSON.stringify([
    { id: "pt-1", title: "Curate property shortlist", isRequired: true, assignedTo: "team" },
    { id: "pt-2", title: "Schedule showings", isRequired: true, assignedTo: "team" },
    { id: "pt-3", title: "Conduct property tours", isRequired: true, assignedTo: "team" },
    { id: "pt-4", title: "Collect client feedback on properties", isRequired: false, assignedTo: "client" },
  ]),
  "Offer Submitted": JSON.stringify([
    { id: "os-1", title: "Prepare comparative market analysis", isRequired: true, assignedTo: "team" },
    { id: "os-2", title: "Draft offer with client", isRequired: true, assignedTo: "team" },
    { id: "os-3", title: "Submit offer to listing agent", isRequired: true, assignedTo: "team" },
    { id: "os-4", title: "Confirm offer received", isRequired: false, assignedTo: "team" },
  ]),
  "Under Contract": JSON.stringify([
    { id: "uc-1", title: "Client signs purchase agreement", isRequired: true, assignedTo: "client" },
    { id: "uc-2", title: "Submit earnest money deposit", isRequired: true, assignedTo: "client" },
    { id: "uc-3", title: "Open escrow", isRequired: true, assignedTo: "team" },
    { id: "uc-4", title: "Send contract to title company", isRequired: true, assignedTo: "team" },
  ]),
  "Inspection & Appraisal": JSON.stringify([
    { id: "ia-1", title: "Schedule home inspection", isRequired: true, assignedTo: "team" },
    { id: "ia-2", title: "Attend home inspection", isRequired: true, assignedTo: "team" },
    { id: "ia-3", title: "Review inspection report with client", isRequired: true, assignedTo: "team" },
    { id: "ia-4", title: "Negotiate repairs if needed", isRequired: false, assignedTo: "team" },
    { id: "ia-5", title: "Lender orders appraisal", isRequired: true, assignedTo: "team" },
    { id: "ia-6", title: "Appraisal completed", isRequired: true, assignedTo: "team" },
  ]),
  "Pre-Closing": JSON.stringify([
    { id: "pc-1", title: "Final loan approval received", isRequired: true, assignedTo: "team" },
    { id: "pc-2", title: "Review closing disclosure", isRequired: true, assignedTo: "client" },
    { id: "pc-3", title: "Schedule final walkthrough", isRequired: true, assignedTo: "team" },
    { id: "pc-4", title: "Conduct final walkthrough", isRequired: true, assignedTo: "team" },
    { id: "pc-5", title: "Confirm closing date and time", isRequired: true, assignedTo: "team" },
  ]),
  "Closing Day": JSON.stringify([
    { id: "cd-1", title: "Client brings ID and certified funds", isRequired: true, assignedTo: "client" },
    { id: "cd-2", title: "Sign closing documents", isRequired: true, assignedTo: "client" },
    { id: "cd-3", title: "Keys handed over", isRequired: true, assignedTo: "team" },
  ]),
};

async function main() {
  console.log("🌱 Seeding database...");

  // ==================== WORKSPACE & USER ====================
  const passwordHash = await hash("password123", 12);

  const user = await prisma.user.create({
    data: {
      name: "Alex Johnson",
      email: "alex@prestigerealty.com",
      passwordHash,
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: "Prestige Realty Group",
      slug: "prestige-realty",
      brandColor: "#1E3A5F",
      secondaryColor: "#4F8FD6",
      emailFromName: "Prestige Realty Group",
      emailReplyTo: "hello@prestigerealty.com",
      portalEnabled: true,
    },
  });

  await prisma.workspaceMember.create({
    data: { userId: user.id, workspaceId: workspace.id, role: "OWNER" },
  });

  console.log("✅ Workspace and user created");

  // ==================== PIPELINE & STAGES ====================
  const pipeline = await prisma.pipeline.create({
    data: {
      name: "Buyer Journey",
      description: "End-to-end pipeline for home buyers — from first inquiry to closing day",
      isDefault: true,
      isActive: true,
      workspaceId: workspace.id,
    },
  });

  const stageData = [
    { name: "New Inquiry", color: "#6366F1", daysExpected: 2, order: 0 },
    { name: "Needs Assessment", color: "#8B5CF6", daysExpected: 3, order: 1 },
    { name: "Property Tours", color: "#3B82F6", daysExpected: 7, order: 2 },
    { name: "Offer Submitted", color: "#F59E0B", daysExpected: 3, order: 3 },
    { name: "Under Contract", color: "#F97316", daysExpected: 5, order: 4 },
    { name: "Inspection & Appraisal", color: "#10B981", daysExpected: 14, order: 5 },
    { name: "Pre-Closing", color: "#14B8A6", daysExpected: 10, order: 6 },
    { name: "Closing Day", color: "#06B6D4", daysExpected: 1, order: 7 },
  ];

  const stages: Array<{ id: string; name: string; daysExpected: number | null; order: number }> = [];
  for (const s of stageData) {
    const stage = await prisma.stage.create({
      data: {
        ...s,
        pipelineId: pipeline.id,
        checklist: CHECKLIST_BY_STAGE[s.name as keyof typeof CHECKLIST_BY_STAGE] ?? null,
        description: `Clients in the ${s.name} stage`,
      },
    });
    stages.push(stage);
  }

  console.log("✅ Pipeline and 8 stages created");

  // ==================== CLIENTS ====================
  const clientsData = [
    // New Inquiry (5)
    { name: "Marcus & Linda Chen", email: "mchen@email.com", phone: "555-0101", projectType: "Single Family Home", projectValue: 485000, stageIdx: 0, daysInStage: 1 },
    { name: "Darnell Williams", email: "dwilliams@email.com", phone: "555-0102", projectType: "Condo", projectValue: 320000, stageIdx: 0, daysInStage: 2 },
    { name: "The Peterson Family", email: "petersons@email.com", phone: "555-0103", projectType: "Townhouse", projectValue: 410000, stageIdx: 0, daysInStage: 1 },
    { name: "Roberto Sanchez", email: "rsanchez@email.com", phone: "555-0104", projectType: "Single Family Home", projectValue: 575000, stageIdx: 0, daysInStage: 3 },
    { name: "Amanda Kowalski", email: "akowalski@email.com", phone: "555-0105", projectType: "Investment Property", projectValue: 290000, stageIdx: 0, daysInStage: 1 },
    // Needs Assessment (3)
    { name: "Thomas & Grace Murphy", email: "tmurphy@email.com", phone: "555-0201", projectType: "Luxury Estate", projectValue: 1250000, stageIdx: 1, daysInStage: 2 },
    { name: "Keisha Robinson", email: "krobinson@email.com", phone: "555-0202", projectType: "Single Family Home", projectValue: 525000, stageIdx: 1, daysInStage: 5 },
    { name: "James Okonkwo", email: "jokonkwo@email.com", phone: "555-0203", projectType: "Multi-Family Duplex", projectValue: 680000, stageIdx: 1, daysInStage: 1 },
    // Property Tours (3)
    { name: "Priya & Raj Patel", email: "rpatel@email.com", phone: "555-0301", projectType: "Single Family Home", projectValue: 450000, stageIdx: 2, daysInStage: 4 },
    { name: "Christopher Blake", email: "cblake@email.com", phone: "555-0302", projectType: "Condo", projectValue: 365000, stageIdx: 2, daysInStage: 10 },
    { name: "Nicole & David Thornton", email: "nthornton@email.com", phone: "555-0303", projectType: "Townhouse", projectValue: 490000, stageIdx: 2, daysInStage: 6 },
    // Offer Submitted (2)
    { name: "Susan Kim", email: "skim@email.com", phone: "555-0401", projectType: "Single Family Home", projectValue: 715000, stageIdx: 3, daysInStage: 2 },
    { name: "Michael Andersen", email: "mandersen@email.com", phone: "555-0402", projectType: "Luxury Estate", projectValue: 1850000, stageIdx: 3, daysInStage: 1 },
    // Under Contract (2)
    { name: "The Harrison Family", email: "harrisons@email.com", phone: "555-0501", projectType: "Single Family Home", projectValue: 620000, stageIdx: 4, daysInStage: 4 },
    { name: "Elena Vasquez", email: "evasquez@email.com", phone: "555-0502", projectType: "Condo", projectValue: 340000, stageIdx: 4, daysInStage: 3 },
    // Inspection & Appraisal (2)
    { name: "Robert Fitzpatrick", email: "rfitz@email.com", phone: "555-0601", projectType: "Single Family Home", projectValue: 555000, stageIdx: 5, daysInStage: 8 },
    { name: "Diana & Steven Park", email: "dpark@email.com", phone: "555-0602", projectType: "Townhouse", projectValue: 430000, stageIdx: 5, daysInStage: 5 },
    // Pre-Closing (1)
    { name: "George & Mary Wallace", email: "gwallace@email.com", phone: "555-0701", projectType: "Luxury Estate", projectValue: 975000, stageIdx: 6, daysInStage: 7 },
    // Closing Day (1)
    { name: "The Nguyen Family", email: "nguyens@email.com", phone: "555-0801", projectType: "Single Family Home", projectValue: 510000, stageIdx: 7, daysInStage: 1 },
  ] as const;

  const clients: Array<{ id: string; name: string; stageIdx: number }> = [];
  for (const c of clientsData) {
    const stage = stages[c.stageIdx];
    const stageEnteredAt = daysAgo(c.daysInStage);
    const sourceOptions = ["MANUAL", "WEBSITE", "REFERRAL", "ADVERTISING"] as const;
    const source = sourceOptions[Math.floor(Math.random() * sourceOptions.length)];

    const client = await prisma.client.create({
      data: {
        name: c.name,
        email: c.email,
        phone: c.phone,
        projectType: c.projectType,
        projectValue: c.projectValue,
        source,
        status: "ACTIVE",
        workspaceId: workspace.id,
        pipelineId: pipeline.id,
        currentStageId: stage.id,
        stageEnteredAt,
        assignedToId: user.id,
        portalToken: `portal-${Math.random().toString(36).slice(2, 12)}`,
      },
    });
    clients.push({ id: client.id, name: c.name, stageIdx: c.stageIdx });

    // CLIENT_CREATED activity
    await prisma.activity.create({
      data: {
        type: "CLIENT_CREATED",
        title: "Client added to pipeline",
        description: `${c.name} was added as a new inquiry`,
        clientId: client.id,
        userId: user.id,
        createdAt: daysAgo(c.daysInStage + c.stageIdx + 2),
      },
    });

    // STAGE_CHANGE activities for previous stages
    for (let i = 0; i < c.stageIdx; i++) {
      await prisma.activity.create({
        data: {
          type: "STAGE_CHANGE",
          title: `Moved to ${stages[i + 1].name}`,
          description: `Client advanced from ${stages[i].name} to ${stages[i + 1].name}`,
          clientId: client.id,
          userId: user.id,
          createdAt: daysAgo(c.daysInStage + (c.stageIdx - i) * 2),
        },
      });
    }

    // Add some notes for later-stage clients
    if (c.stageIdx >= 3) {
      const notes = [
        "Buyer is pre-approved with First National Bank. Very motivated — wants to close before school year starts.",
        "Client prefers move-in ready properties. Open to minor cosmetic updates but no major renovations.",
        "Relocating from out of state for work. Needs virtual tour options for initial viewings.",
        "First-time home buyer — very enthusiastic. Will need extra guidance through inspection and closing process.",
        "Investor client — primarily interested in rental yield and neighborhood appreciation trends.",
      ];
      await prisma.activity.create({
        data: {
          type: "NOTE_ADDED",
          title: "Note added",
          description: notes[c.stageIdx % notes.length],
          clientId: client.id,
          userId: user.id,
          createdAt: hoursAgo(6 + c.stageIdx * 12),
        },
      });
    }
  }

  console.log("✅ 19 clients created with activities");

  // ==================== EMAIL TEMPLATES ====================
  const emailTemplates = [
    {
      name: "Welcome Email",
      subject: "Welcome to {{company_name}}, {{client_name}}!",
      type: "WELCOME",
      body: `<h2>Welcome, {{client_name}}!</h2>
<p>Thank you for choosing {{company_name}} to help you find your perfect home. I'm {{assigned_team_member}} and I'll be your dedicated agent throughout this exciting journey.</p>
<p>We've created a personalized portal where you can track your home search progress, complete action items, and upload documents. Access it anytime:</p>
<p><a href="{{portal_link}}" style="background:#1E3A5F;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">View Your Client Portal →</a></p>
<p>Our next step is to learn more about what you're looking for. You'll hear from us within 24 hours to schedule your needs assessment call.</p>
<p>Excited to get started!<br/>{{assigned_team_member}}<br/>{{company_name}}</p>`,
    },
    {
      name: "Buyer Questionnaire",
      subject: "Action required: Complete your buyer profile — {{company_name}}",
      type: "STAGE_CHANGE",
      body: `<h2>Hi {{client_name}},</h2>
<p>To help us find the right properties for you, please complete the buyer questionnaire in your client portal. It takes about 5 minutes and covers:</p>
<ul>
<li>Your must-have features and deal-breakers</li>
<li>Preferred neighborhoods and school districts</li>
<li>Budget range and financing details</li>
<li>Your ideal timeline</li>
</ul>
<p><a href="{{portal_link}}">Complete your questionnaire →</a></p>
<p>Best,<br/>{{assigned_team_member}}</p>`,
    },
    {
      name: "Property Tour Prep",
      subject: "Your property tours are scheduled — {{company_name}}",
      type: "STAGE_CHANGE",
      body: `<h2>Great news, {{client_name}}!</h2>
<p>Based on your preferences, we've curated a shortlist of {{project_type}} properties for you to tour. Here's what to keep in mind:</p>
<ul>
<li>Take photos and notes at each property</li>
<li>Check water pressure, outlets, and storage</li>
<li>Drive through the neighborhood at different times of day</li>
<li>Note anything you'd want to negotiate or renovate</li>
</ul>
<p>Your tour details are in your portal: <a href="{{portal_link}}">View properties →</a></p>
<p>See you soon!<br/>{{assigned_team_member}}</p>`,
    },
    {
      name: "Offer Confirmation",
      subject: "Your offer has been submitted — {{company_name}}",
      type: "STAGE_CHANGE",
      body: `<h2>Your offer is in, {{client_name}}!</h2>
<p>We've submitted your offer on the {{project_type}} property. Here's what happens next:</p>
<ol>
<li>The listing agent will present your offer to the seller</li>
<li>The seller typically responds within 24–72 hours</li>
<li>They may accept, counter, or decline</li>
</ol>
<p>I'll be in touch the moment we hear back. In the meantime, your offer details are available in your portal.</p>
<p><a href="{{portal_link}}">View offer details →</a></p>
<p>Fingers crossed!<br/>{{assigned_team_member}}<br/>{{company_name}}</p>`,
    },
    {
      name: "Under Contract Next Steps",
      subject: "Congratulations — you're under contract! — {{company_name}}",
      type: "STAGE_CHANGE",
      body: `<h2>Congratulations, {{client_name}}! 🎉</h2>
<p>Your offer was accepted and you're officially under contract! Here's what's coming up:</p>
<ol>
<li><strong>Earnest Money:</strong> Due within 3 business days</li>
<li><strong>Home Inspection:</strong> We'll schedule this within the inspection period</li>
<li><strong>Appraisal:</strong> Your lender will order this</li>
<li><strong>Title Search:</strong> The title company handles this</li>
</ol>
<p>Track all your action items in your portal: <a href="{{portal_link}}">Your Client Portal →</a></p>
<p>We're on our way to getting you the keys!<br/>{{assigned_team_member}}<br/>{{company_name}}</p>`,
    },
    {
      name: "Closing Prep",
      subject: "Your closing is approaching — {{company_name}}",
      type: "STAGE_CHANGE",
      body: `<h2>Almost there, {{client_name}}!</h2>
<p>Your closing is approaching. Here's your final checklist:</p>
<ul>
<li>Review your Closing Disclosure (you'll receive this 3 days before closing)</li>
<li>Arrange a cashier's check or wire for closing costs</li>
<li>Bring a valid government-issued photo ID</li>
<li>We'll do a final walkthrough the day before or morning of closing</li>
</ul>
<p>Review everything in your portal: <a href="{{portal_link}}">Closing details →</a></p>
<p>Can't wait to hand you the keys!<br/>{{assigned_team_member}}<br/>{{company_name}}</p>`,
    },
    {
      name: "Follow-Up (Offer Review)",
      subject: "Quick update on your home search — {{company_name}}",
      type: "FOLLOW_UP",
      body: `<h2>Hi {{client_name}},</h2>
<p>Just checking in on your {{project_type}} search. We know finding the right home is a big decision and we want to make sure you have everything you need.</p>
<p>If you'd like to revisit any properties, adjust your search criteria, or discuss new listings that have come up, just let us know. We're here to help.</p>
<p>Check your portal for the latest listings: <a href="{{portal_link}}">View updates →</a></p>
<p>Best,<br/>{{assigned_team_member}}<br/>{{company_name}}</p>`,
    },
  ];

  const createdTemplates: Array<{ id: string; name: string }> = [];
  for (const t of emailTemplates) {
    const template = await prisma.emailTemplate.create({
      data: {
        ...t,
        isActive: true,
        workspaceId: workspace.id,
      },
    });
    createdTemplates.push({ id: template.id, name: t.name });
  }

  console.log("✅ 7 email templates created");

  // ==================== AUTOMATION RULES ====================
  const stageByName = Object.fromEntries(stages.map((s) => [s.name, s]));

  const automationRules = [
    {
      name: "Welcome Email on Client Creation",
      triggerType: "CLIENT_CREATED",
      triggerConfig: JSON.stringify({}),
      actionType: "SEND_EMAIL",
      actionConfig: JSON.stringify({ templateId: createdTemplates[0].id }),
      templateId: createdTemplates[0].id,
    },
    {
      name: "Buyer Questionnaire on Needs Assessment",
      triggerType: "STAGE_ENTRY",
      triggerConfig: JSON.stringify({ stageId: stageByName["Needs Assessment"].id }),
      actionType: "SEND_EMAIL",
      actionConfig: JSON.stringify({ templateId: createdTemplates[1].id }),
      stageId: stageByName["Needs Assessment"].id,
      templateId: createdTemplates[1].id,
    },
    {
      name: "Tour Prep on Property Tours",
      triggerType: "STAGE_ENTRY",
      triggerConfig: JSON.stringify({ stageId: stageByName["Property Tours"].id }),
      actionType: "SEND_EMAIL",
      actionConfig: JSON.stringify({ templateId: createdTemplates[2].id }),
      stageId: stageByName["Property Tours"].id,
      templateId: createdTemplates[2].id,
    },
    {
      name: "Offer Confirmation on Submit",
      triggerType: "STAGE_ENTRY",
      triggerConfig: JSON.stringify({ stageId: stageByName["Offer Submitted"].id }),
      actionType: "SEND_EMAIL",
      actionConfig: JSON.stringify({ templateId: createdTemplates[3].id }),
      stageId: stageByName["Offer Submitted"].id,
      templateId: createdTemplates[3].id,
    },
    {
      name: "Under Contract Next Steps",
      triggerType: "STAGE_ENTRY",
      triggerConfig: JSON.stringify({ stageId: stageByName["Under Contract"].id }),
      actionType: "SEND_EMAIL",
      actionConfig: JSON.stringify({ templateId: createdTemplates[4].id }),
      stageId: stageByName["Under Contract"].id,
      templateId: createdTemplates[4].id,
    },
    {
      name: "Closing Prep Email",
      triggerType: "STAGE_ENTRY",
      triggerConfig: JSON.stringify({ stageId: stageByName["Pre-Closing"].id }),
      actionType: "SEND_EMAIL",
      actionConfig: JSON.stringify({ templateId: createdTemplates[5].id }),
      stageId: stageByName["Pre-Closing"].id,
      templateId: createdTemplates[5].id,
    },
    {
      name: "7-Day Follow-Up in Property Tours",
      triggerType: "TIME_IN_STAGE",
      triggerConfig: JSON.stringify({ stageId: stageByName["Property Tours"].id, days: 7 }),
      actionType: "SEND_EMAIL",
      actionConfig: JSON.stringify({ templateId: createdTemplates[6].id }),
      stageId: stageByName["Property Tours"].id,
      templateId: createdTemplates[6].id,
    },
  ];

  for (const rule of automationRules) {
    await prisma.automationRule.create({
      data: {
        ...rule,
        isActive: true,
        workspaceId: workspace.id,
      },
    });
  }

  console.log("✅ 7 automation rules created");

  // ==================== SAMPLE EMAIL LOGS ====================
  const laterStageClients = clients.filter((c) => c.stageIdx >= 2);
  for (const c of laterStageClients.slice(0, 8)) {
    await prisma.emailLog.create({
      data: {
        subject: "Welcome to Prestige Realty Group!",
        body: `<p>Welcome email sent to ${c.name}</p>`,
        status: "DELIVERED",
        clientId: c.id,
        templateId: createdTemplates[0].id,
        sentAt: daysAgo(10 + c.stageIdx),
      },
    });
  }

  console.log("✅ Sample email logs created");
  console.log("\n🎉 Seed complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Login: alex@prestigerealty.com");
  console.log("Password: password123");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
