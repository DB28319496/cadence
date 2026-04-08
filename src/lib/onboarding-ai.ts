import Anthropic from "@anthropic-ai/sdk";

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export type OnboardingAnswers = {
  businessType: string;
  services: string;
  clientJourney: string;
  painPoints: string;
  tone: "formal" | "professional" | "friendly";
  teamSize: string;
};

export type GeneratedStage = {
  name: string;
  description: string;
  color: string;
  daysExpected: number;
  checklist: Array<{
    title: string;
    isRequired: boolean;
    assignedTo: "team" | "client";
  }>;
};

export type GeneratedTemplate = {
  name: string;
  subject: string;
  body: string;
  type: "WELCOME" | "STAGE_CHANGE" | "FOLLOW_UP" | "REMINDER" | "CUSTOM";
};

export type GeneratedAutomation = {
  name: string;
  triggerType: "CLIENT_CREATED" | "STAGE_ENTRY" | "TIME_IN_STAGE";
  triggerStageName?: string;
  triggerDays?: number;
  templateName: string;
  description: string;
};

export type GeneratedWorkspace = {
  pipeline: {
    name: string;
    description: string;
  };
  stages: GeneratedStage[];
  emailTemplates: GeneratedTemplate[];
  automationRules: GeneratedAutomation[];
};

const WORKSPACE_TOOL = {
  name: "create_workspace_config",
  description:
    "Generate a complete client onboarding workspace configuration based on the user's business needs.",
  input_schema: {
    type: "object" as const,
    properties: {
      pipeline: {
        type: "object",
        description: "The main pipeline for this business",
        properties: {
          name: {
            type: "string",
            description:
              "A descriptive pipeline name (e.g. 'Client Onboarding', 'Buyer Journey', 'New Case Intake')",
          },
          description: {
            type: "string",
            description: "A one-sentence description of what the pipeline covers",
          },
        },
        required: ["name", "description"],
      },
      stages: {
        type: "array",
        description:
          "6-8 pipeline stages representing the client journey from first contact to completion",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Short stage name (2-4 words)" },
            description: {
              type: "string",
              description: "One-sentence description of what happens in this stage",
            },
            color: {
              type: "string",
              description:
                "Hex color code from this palette: #6366F1 #8B5CF6 #3B82F6 #F59E0B #F97316 #EF4444 #10B981 #14B8A6 #06B6D4",
            },
            daysExpected: {
              type: "number",
              description: "Typical number of days clients spend in this stage (1-30)",
            },
            checklist: {
              type: "array",
              description: "3-6 actionable tasks that need to happen in this stage",
              items: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Concise task name" },
                  isRequired: {
                    type: "boolean",
                    description: "Whether this task is required vs optional",
                  },
                  assignedTo: {
                    type: "string",
                    enum: ["team", "client"],
                    description: "Who is responsible for completing this task",
                  },
                },
                required: ["title", "isRequired", "assignedTo"],
              },
            },
          },
          required: ["name", "description", "color", "daysExpected", "checklist"],
        },
      },
      emailTemplates: {
        type: "array",
        description:
          "3-5 email templates tailored to this business. Use merge fields: {{client_name}}, {{workspace_name}}, {{stage_name}}, {{portal_url}}, {{project_type}}",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            subject: { type: "string" },
            body: {
              type: "string",
              description:
                "HTML email body. Use <p>, <ul>, <ol>, <a>, <strong>. Keep tone matching user's preference.",
            },
            type: {
              type: "string",
              enum: ["WELCOME", "STAGE_CHANGE", "FOLLOW_UP", "REMINDER", "CUSTOM"],
            },
          },
          required: ["name", "subject", "body", "type"],
        },
      },
      automationRules: {
        type: "array",
        description:
          "2-3 automation rules that wire templates to triggers. Each rule references a template by name.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            triggerType: {
              type: "string",
              enum: ["CLIENT_CREATED", "STAGE_ENTRY", "TIME_IN_STAGE"],
            },
            triggerStageName: {
              type: "string",
              description: "For STAGE_ENTRY and TIME_IN_STAGE: the stage name",
            },
            triggerDays: {
              type: "number",
              description: "For TIME_IN_STAGE: number of days",
            },
            templateName: {
              type: "string",
              description: "Name of the email template to send (must match one above exactly)",
            },
            description: { type: "string" },
          },
          required: ["name", "triggerType", "templateName", "description"],
        },
      },
    },
    required: ["pipeline", "stages", "emailTemplates", "automationRules"],
  },
};

export async function generateWorkspaceFromAnswers(
  answers: OnboardingAnswers
): Promise<GeneratedWorkspace | null> {
  if (!client) {
    console.error("[Onboarding AI] No ANTHROPIC_API_KEY configured");
    return null;
  }

  const toneDescription = {
    formal: "formal and polished — avoid contractions, use professional language",
    professional: "warm but professional — clear and respectful",
    friendly: "friendly and casual — conversational, use contractions, approachable",
  }[answers.tone];

  const prompt = `You are a workspace configuration expert for Cadence, a client onboarding platform. A new user has signed up and described their business. Generate a complete, production-ready workspace configuration tailored specifically to their needs.

## User's Business

**Business Type:** ${answers.businessType}

**Services Offered:**
${answers.services}

**Typical Client Journey:**
${answers.clientJourney}

**Biggest Pain Points:**
${answers.painPoints}

**Communication Tone:** ${answers.tone} (${toneDescription})

**Team Size:** ${answers.teamSize}

## Your Task

Generate a complete workspace configuration that includes:

1. **One custom pipeline** — named and described to match their business
2. **6-8 stages** — each with a meaningful name, description, appropriate color from the palette, realistic daysExpected, and 3-6 actionable checklist items that address their specific workflow
3. **3-5 email templates** — written in their preferred tone, using their business language, solving their specific pain points
4. **2-3 automation rules** — wire templates to sensible triggers (client creation, stage entry, time in stage)

## Critical Requirements

- Stages should reflect THEIR actual workflow, not generic "Lead → Qualified → Closed"
- Checklist items should be specific actions (e.g. "Send property comps report" not "Review documents")
- Email templates MUST use merge fields: {{client_name}}, {{workspace_name}}, {{stage_name}}, {{portal_url}}, {{project_type}}
- Email body must be valid HTML with <p> tags, not plain text
- Automation rule templateName must EXACTLY match one of your emailTemplates names
- Address their pain points directly in automations (e.g. if they said "clients go dark after proposal", add a follow-up rule)

Call the create_workspace_config tool with your complete configuration.`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8000,
      tools: [WORKSPACE_TOOL],
      tool_choice: { type: "tool", name: "create_workspace_config" },
      messages: [{ role: "user", content: prompt }],
    });

    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      console.error("[Onboarding AI] No tool_use in response");
      return null;
    }

    return toolUse.input as GeneratedWorkspace;
  } catch (err) {
    console.error("[Onboarding AI] Generation failed:", err);
    return null;
  }
}
