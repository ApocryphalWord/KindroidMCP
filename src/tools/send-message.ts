import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KindroidClient } from "../kindroid-client.js";
import { wrapToolHandler } from "./tool-utils.js";

const shape = {
  ai_id: z
    .string()
    .min(1)
    .describe("The ID of the Kindroid AI to message."),
  message: z.string().describe("The message to send to the Kindroid AI."),
  image_urls: z
    .array(z.string().url())
    .optional()
    .describe("Optional array of image URLs to attach."),
  image_description: z
    .string()
    .optional()
    .describe("Optional description of the attached images."),
  video_url: z
    .string()
    .url()
    .optional()
    .describe("Optional video URL to attach."),
  video_description: z
    .string()
    .optional()
    .describe("Optional description of the attached video."),
  link_url: z
    .string()
    .url()
    .optional()
    .describe("Optional link URL to share with the AI."),
  link_description: z
    .string()
    .optional()
    .describe("Optional description of the shared link."),
} as const;

type Params = z.infer<z.ZodObject<typeof shape>>;

export function register(
  server: McpServer,
  client: KindroidClient,
): void {
  server.tool(
    "send_message",
    "Send a message to a Kindroid AI and receive its response. " +
      "Use this to have conversations with a Kin. " +
      "Optionally attach images, video, or links for the AI to reference.",
    shape,
    wrapToolHandler<Params>(async (params) => {
      const reply = await client.sendMessage({
        ai_id: params.ai_id,
        message: params.message,
        image_urls: params.image_urls,
        image_description: params.image_description,
        video_url: params.video_url,
        video_description: params.video_description,
        link_url: params.link_url,
        link_description: params.link_description,
      });

      return { content: [{ type: "text" as const, text: reply }] };
    }),
  );
}
