import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KindroidClient } from "../kindroid-client.js";
import { wrapToolHandler } from "./tool-utils.js";

const shape = {
  ai_id: z
    .string()
    .min(1)
    .describe("The ID of the Kindroid AI to create the journal entry for."),
  entry: z
    .string()
    .min(20)
    .max(500)
    .describe(
      "The journal entry text (20-500 characters). This is the contextual lore " +
        "that will be recalled when triggered by the associated key phrases.",
    ),
  keyphrases: z
    .array(z.string().min(3))
    .min(1)
    .describe(
      "Array of key phrases (at least 1) that trigger recall of this journal entry. " +
        "Each key phrase must be at least 3 characters long.",
    ),
} as const;

type Params = z.infer<z.ZodObject<typeof shape>>;

export function register(
  server: McpServer,
  client: KindroidClient,
): void {
  server.tool(
    "create_journal_entry",
    "Create a journal entry for a Kindroid AI companion (Kin). " +
      "Journal entries are user-created, recallable pieces of contextual lore (up to 500 characters) " +
      "that provide relevant context to the Kin when triggered by associated key phrases during conversation.",
    shape,
    wrapToolHandler<Params>(async (params) => {
      await client.createJournalEntry({
        ai_id: params.ai_id,
        entry: params.entry,
        keyphrases: params.keyphrases,
      });

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Journal entry created successfully for Kin ${params.ai_id}. ` +
              `Entry (${params.entry.length} chars) will be triggered by key phrases: ${params.keyphrases.join(", ")}.`,
          },
        ],
      };
    }),
  );
}
