import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { KindroidClient } from "../kindroid-client.js";
import { register as registerSendMessage } from "./send-message.js";
import { register as registerCreateKin } from "./create-kin.js";
import { register as registerUpdateKin } from "./update-kin.js";
import { register as registerChatBreak } from "./chat-break.js";
import { register as registerRequestSelfie } from "./request-selfie.js";
import { register as registerRequestGroupSelfie } from "./request-group-selfie.js";
import { register as registerCheckSubscription } from "./check-subscription.js";
import { register as registerCreateJournalEntry } from "./create-journal-entry.js";
import { register as registerCreateGroupChat } from "./create-groupchat.js";
import { register as registerUpdateGroupChat } from "./update-groupchat.js";
import { register as registerSendGroupChatMessage } from "./send-groupchat-message.js";
import { register as registerGroupChatGetTurn } from "./groupchat-get-turn.js";
import { register as registerGroupChatAiResponse } from "./groupchat-ai-response.js";

export function registerTools(
  server: McpServer,
  client: KindroidClient,
): void {
  registerSendMessage(server, client);
  registerCreateKin(server, client);
  registerUpdateKin(server, client);
  registerChatBreak(server, client);
  registerRequestSelfie(server, client);
  registerRequestGroupSelfie(server, client);
  registerCheckSubscription(server, client);
  registerCreateJournalEntry(server, client);
  registerCreateGroupChat(server, client);
  registerUpdateGroupChat(server, client);
  registerSendGroupChatMessage(server, client);
  registerGroupChatGetTurn(server, client);
  registerGroupChatAiResponse(server, client);
}
