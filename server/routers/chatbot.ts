import { z } from "zod";
import { askBuyerChatbot, askStoreOwnerChatbot } from "../chatbot";
import {
  protectedProcedure,
  publicProcedure,
  router,
  getStoreId,
} from "../_core/trpc";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(3000),
});
const messagesInput = z.object({
  messages: z.array(messageSchema).min(1).max(30),
});

export const chatbotRouter = router({
  buyer: publicProcedure
    .input(messagesInput)
    .mutation(({ ctx, input }) =>
      askBuyerChatbot(ctx.store?.id ?? undefined, input.messages)
    ),
  owner: protectedProcedure
    .input(messagesInput)
    .mutation(({ ctx, input }) =>
      askStoreOwnerChatbot(getStoreId(ctx), input.messages)
    ),
});
