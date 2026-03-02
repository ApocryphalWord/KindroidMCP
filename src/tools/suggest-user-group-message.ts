import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KindroidClient } from "../kindroid-client.js";
import { wrapToolHandler } from "./tool-utils.js";

const shape = {
  group_id: z
    .string()
    .min(1)
    .describe("The ID of the group chat to get a suggestion for."),
  existing_message: z
    .string()
    .optional()
    .describe(
      "The start of a message the suggestion can continue from. Defaults to empty.",
    ),
} as const;

type Params = z.infer<z.ZodObject<typeof shape>>;

export function register(
  server: McpServer,
  client: KindroidClient,
): void {
  server.tool(
    "suggest_user_group_message",
    "Get a suggested message for the user to send in a group chat. " +
      "Optionally provide the start of a message for the suggestion to continue from.",
    shape,
    wrapToolHandler<Params>(async (params) => {
      const suggestion = await client.suggestUserGroupMessage({
        group_id: params.group_id,
        existing_message: params.existing_message,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: suggestion,
          },
        ],
      };
    }),
  );
}
