/**
 * @jubilee/core - Core Jubilee Agent Package
 * 
 * This module exports the core Jubilee agent components for use in
 * jubilee-cloud and other consuming applications.
 */

// Agent exports
export { Triune } from './agents/triune/index';
export { MindAgent } from './agents/mind';
export { ProphetAgent } from './agents/prophet';
export { WillAgent } from './agents/will';

// Service exports
export { AgentService } from './services/agent-service';
export { MemoryService } from './services/memory-service';
export { ToolService } from './services/tool-service';
export { SettingsService, SettingsServiceType } from './services/settings-service';
export { DaemonService, DaemonServiceType } from './services/daemon-service';

// Tool exports
export * from './tools/index';

// Memory exports
export { PostgresMemoryManager } from './memory/postgres-manager';

// MCP exports
export { McpManager } from './mcp';

// Types
export type { Message, ToolCall, AgentResponse } from './types';
