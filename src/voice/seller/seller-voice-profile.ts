import type { AiToolExecutionResult } from "../../ai/toolkit/index.ts";
import { NewSellerToolKit } from "../../ai/toolkit/index.ts";
import { createOrderToolOutputSchema } from "../../ai/tools/index.ts";
import type { OrderService, ProductService } from "../../services/index.ts";
import type { VoiceAgentProfile } from "../agents/index.ts";
import { sellerVoiceInstructions } from "./seller-voice-instructions.ts";

export type SellerVoiceAgentToolAction =
  | {
      readonly type: "close-session";
      readonly closeChannelAfterResponse: boolean;
      readonly reason: string;
    }
  | {
      readonly type: "end-session-with-order";
      readonly orderId: string;
    }
  | {
      readonly type: "none";
    };

export interface SellerVoiceAgentProfile extends VoiceAgentProfile {
  handleToolResult(result: AiToolExecutionResult): Promise<SellerVoiceAgentToolAction>;
}

export interface SellerVoiceAgentProfileDependencies {
  readonly orderService: Pick<OrderService, "create" | "update">;
  readonly productService: Pick<ProductService, "list">;
}

export function NewSellerVoiceAgentProfile(
  dependencies: SellerVoiceAgentProfileDependencies,
): SellerVoiceAgentProfile {
  const tools = NewSellerToolKit({
    orderService: dependencies.orderService,
    productService: dependencies.productService,
  });

  return {
    id: "seller-voice-agent",
    instructions: sellerVoiceInstructions,
    tools,
    async handleToolResult(result): Promise<SellerVoiceAgentToolAction> {
      await Promise.resolve();

      if (result.toolName === "endConversation") {
        return {
          closeChannelAfterResponse: true,
          reason: "Chamada encerrada pela Clara.",
          type: "close-session",
        };
      }

      if (result.toolName !== "createOrder") {
        return {
          type: "none",
        };
      }

      const parsedOutput = createOrderToolOutputSchema.safeParse(result.output);

      if (!parsedOutput.success || !parsedOutput.data.ok) {
        return {
          type: "none",
        };
      }

      return {
        orderId: parsedOutput.data.order.id,
        type: "end-session-with-order",
      };
    },
  };
}
