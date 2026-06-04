import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KindroidClient } from "../kindroid-client.js";
import { wrapToolHandler } from "./tool-utils.js";

const shape = {
  group_id: z
    .string()
    .min(1)
    .describe("The ID of the group chat to reset."),
  greeting: z
    .string()
    .min(1)
    .describe(
      "Mandatory greeting that becomes the first message of the new group conversation.",
    ),
  wipe_cascaded: z
    .boolean()
    .optional()
    .describe(
      "Whether to also clear the group's cascaded long-term memory along with short-term memory. Defaults to false.",
    ),
} as const;

type Params = z.infer<z.ZodObject<typeof shape>>;

export function register(
  server: McpServer,
  client: KindroidClient,
): void {
  server.tool(
    "groupchat_chat_break",
    "Start a new conversation in a group chat, resetting short-term memory. " +
      "A greeting is required and becomes the first message of the new conversation.",
    shape,
    wrapToolHandler<Params>(async (params) => {
      await client.groupChatChatBreak({
        group_id: params.group_id,
        greeting: params.greeting,
        wipe_cascaded: params.wipe_cascaded,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Group chat break successful. A new conversation has been started for group "${params.group_id}" with greeting: "${params.greeting}"${params.wipe_cascaded ? " (cascaded memory also cleared)" : ""}.`,
          },
        ],
      };
    }),
  );
}
