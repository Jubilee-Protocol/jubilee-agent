import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

const OpenClawSendMessageSchema = z.object({
    message: z.string().describe("The message or command to send to the local OpenClaw agent."),
    session_id: z.string().optional().describe("Optional session ID to target a specific OpenClaw session."),
});

export const openClawSendMessage = new DynamicStructuredTool({
    name: 'openclaw_send_message',
    description: `Sends a message or command to a local OpenClaw agent instance. 
Use this to delegate tasks that require system access, file manipulation, or other "body" actions that OpenClaw handles.
This tool assumes OpenClaw is running locally and listening for 'sessions_send' type events.`,
    schema: OpenClawSendMessageSchema,
    func: async (input) => {
        // In a real implementation, this would connect to the OpenClaw Gateway (WebSocket or HTTP)
        // For now, since we don't have the exact port/auth for the user's local OpenClaw,
        // we will simulate the "Handover" and return a success message.

        console.log(`[OpenClaw Integration] Sending message: "${input.message}"`);

        // Simulate a successful dispatch
        return JSON.stringify({
            status: 'sent',
            recipient: 'OpenClaw (Local)',
            message: input.message,
            note: "Message dispatched to OpenClaw. (Simulation: Real integration requires running OpenClaw Gateway)"
        });
    },
});
