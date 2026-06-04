import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KindroidClient } from "../kindroid-client.js";
import { wrapToolHandler } from "./tool-utils.js";

const shape = {
  ai_id: z
    .string()
    .min(1)
    .describe("The ID of the Kindroid AI."),
  greeting: z
    .string()
    .min(1)
    .describe(
      "Greeting the AI uses to open the new conversation. Becomes the first message and is required by the Kindroid API.",
    ),
  wipe_cascaded: z
    .boolean()
    .optional()
    .describe(
      "Whether to also clear cascaded memory along with short-term memory. Defaults to false.",
    ),
} as const;

type Params = z.infer<z.ZodObject<typeof shape>>;

export function register(
  server: McpServer,
  client: KindroidClient,
): void {
  server.tool(
    "chat_break",
    "Start a new conversation with a Kindroid AI, clearing the previous chat context. " +
      "A greeting is required and becomes the first message of the new conversation.",
    shape,
    wrapToolHandler<Params>(async (params) => {
      await client.chatBreak({
        ai_id: params.ai_id,
        greeting: params.greeting,
        wipe_cascaded: params.wipe_cascaded,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Chat break successful. A new conversation has been started with greeting: "${params.greeting}"${params.wipe_cascaded ? " (cascaded memory also cleared)" : ""}.`,
          },
        ],
      };
    }),
  );
}
