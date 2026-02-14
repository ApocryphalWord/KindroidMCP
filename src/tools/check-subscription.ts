import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { KindroidClient } from "../kindroid-client.js";
import { wrapToolHandler } from "./tool-utils.js";

export function register(
  server: McpServer,
  client: KindroidClient,
): void {
  server.tool(
    "check_subscription",
    "Check the current Kindroid account subscription status, " +
      "including base subscription and add-on tiers.",
    {},
    wrapToolHandler<Record<string, never>>(async () => {
      const info = await client.checkSubscription();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(info, null, 2),
          },
        ],
      };
    }),
  );
}
