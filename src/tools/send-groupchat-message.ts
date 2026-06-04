import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KindroidClient } from "../kindroid-client.js";
import { wrapToolHandler } from "./tool-utils.js";

const shape = {
  group_id: z
    .string()
    .min(1)
    .describe("The ID of the group chat to send a message to."),
  message: z
    .string()
    .optional()
    .describe(
      "The text message to send to the group chat. Provide exactly one of message or audio_url.",
    ),
  audio_url: z
    .string()
    .url()
    .optional()
    .describe(
      "URL of an audio file to send as a voice message. Provide exactly one of message or audio_url.",
    ),
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
    .describe("Optional link URL to share."),
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
    "send_groupchat_message",
    "Send a user message to a group chat. " +
      "Does not trigger AI responses — use groupchat_get_turn and groupchat_ai_response to get Kin replies. " +
      "Optionally attach images, video, or links.",
    shape,
    wrapToolHandler<Params>(async (params) => {
      const hasMessage = !!params.message?.trim();
      const hasAudio = !!params.audio_url;
      if (hasMessage === hasAudio) {
        throw new Error(
          "Provide exactly one of message or audio_url.",
        );
      }

      await client.sendGroupChatMessage({
        group_id: params.group_id,
        message: hasMessage ? params.message : undefined,
        audio_url: params.audio_url,
        image_urls: params.image_urls,
        image_description: params.image_description,
        video_url: params.video_url,
        video_description: params.video_description,
        link_url: params.link_url,
        link_description: params.link_description,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Message sent to group chat "${params.group_id}" successfully.`,
          },
        ],
      };
    }),
  );
}
