import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KindroidClient } from "../kindroid-client.js";
import { wrapToolHandler } from "./tool-utils.js";

const shape = {
  ai_id: z
    .string()
    .min(1)
    .describe("The AI ID of the Kin to generate a selfie for."),
  prompt: z
    .string()
    .describe(
      "The image generation prompt describing the desired selfie scene.",
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
    "request_selfie",
    "Request a solo selfie image of a single Kindroid AI companion (Kin). " +
      "For group selfies with multiple participants, use request_group_selfie instead. " +
      "The selfie request is queued and processed asynchronously.",
    shape,
    wrapToolHandler<Params>(async (params) => {
      await client.requestSelfie({
        ai_id: params.ai_id,
        prompt: params.prompt,
        aspect: params.aspect,
        uses_nsfw: params.uses_nsfw,
        seed: params.seed,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Selfie request submitted successfully for Kin ${params.ai_id}. The image is being generated.`,
          },
        ],
      };
    }),
  );
}
