import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KindroidClient } from "../kindroid-client.js";
import { wrapToolHandler } from "./tool-utils.js";

const shape = {
  version: z
    .string()
    .describe('The group selfie API version to use (e.g. "v7").'),
  ai_ids: z
    .array(z.string().min(1))
    .min(1)
    .max(3)
    .describe(
      'Array of participant identifiers (1-3). Use Kin AI IDs for Kins, or "user" to include the user\'s persona.',
    ),
  prompt: z
    .string()
    .describe(
      "The image generation prompt describing the desired group selfie scene.",
    ),
  regional_prompts: z
    .array(z.string())
    .optional()
    .describe(
      "Per-person prompts for the group selfie. Must have the same length as ai_ids. " +
        "Each entry describes that specific participant's appearance in the scene.",
    ),
  aspect: z
    .enum(["square", "portrait", "landscape"])
    .optional()
    .describe('Aspect ratio for the selfie. Defaults to "square".'),
  uses_nsfw: z
    .boolean()
    .optional()
    .describe(
      "Whether the selfie may contain NSFW content. Defaults to false.",
    ),
  seed: z
    .number()
    .optional()
    .describe("Optional seed for reproducible image generation."),
} as const;

type Params = z.infer<z.ZodObject<typeof shape>>;

export function register(
  server: McpServer,
  client: KindroidClient,
): void {
  server.tool(
    "request_group_selfie",
    "Request a group selfie image featuring multiple Kindroid AI companions (Kins). " +
      'Supports up to 3 participants. Include "user" as a participant to add the user\'s persona. ' +
      "The selfie request is queued and processed asynchronously.",
    shape,
    wrapToolHandler<Params>(async (params) => {
      if (
        params.regional_prompts &&
        params.regional_prompts.length !== params.ai_ids.length
      ) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: regional_prompts length (${params.regional_prompts.length}) must match ai_ids length (${params.ai_ids.length}).`,
            },
          ],
          isError: true,
        };
      }

      await client.requestGroupSelfie({
        version: params.version,
        ai_ids: params.ai_ids,
        full_photo_prompt: params.prompt,
        regional_prompts: params.regional_prompts,
        aspect: params.aspect,
        uses_nsfw: params.uses_nsfw,
        seed: params.seed,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Group selfie request submitted successfully for ${params.ai_ids.length} participants (${params.ai_ids.join(", ")}). The image is being generated.`,
          },
        ],
      };
    }),
  );
}
