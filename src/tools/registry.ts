import { StructuredToolInterface } from '@langchain/core/tools';
import { BibleTool } from './bible.js';
import { CommunicationTool } from './communication.js';
import { IngestCodebaseTool, SearchCodebaseTool } from './codebase-tools.js';
import { WaitForEventTool } from './onchain-tools.js';
import { createFinancialSearch, createFinancialMetrics, createReadFilings } from './finance/index.js';
import { exaSearch, tavilySearch } from './search/index.js';
import { browserTool } from './browser/index.js';
import { skillTool, SKILL_TOOL_DESCRIPTION } from './skill.js';
import { FINANCIAL_SEARCH_DESCRIPTION, FINANCIAL_METRICS_DESCRIPTION, WEB_SEARCH_DESCRIPTION, READ_FILINGS_DESCRIPTION, BROWSER_DESCRIPTION } from './descriptions/index.js';
import { discoverSkills } from '../skills/index.js';
import { McpManager } from '../mcp/index.js';
import { RememberFactTool, RecallMemoriesTool } from './memory-tools.js';
import { DispatchAngelTool } from './angel-tool.js';
import { ConfigManager } from '../config/settings.js';
import { TreasuryServer } from '../mcp/servers/treasury/index.js';
import { UpdateProtocolStateTool, QueryProtocolStateTool } from './protocol-state.js';
import { CreateTaskTool, UpdateTaskTool, QueryTasksTool } from './task-tools.js';
import { CodeExecutionTool } from './code-exec-tool.js';
import { ProposeSafeTxTool, QuerySafeStatusTool, ProposeSquadsTxTool, QuerySquadsStatusTool } from './governance-tools.js';
import { logger } from '../utils/logger.js';




/**
 * A registered tool with its rich description for system prompt injection.
 */
export interface RegisteredTool {
  /** Tool name (must match the tool's name property) */
  name: string;
  /** The actual tool instance */
  tool: StructuredToolInterface;
  /** Rich description for system prompt (includes when to use, when not to use, etc.) */
  description: string;
}

/**
 * Get all registered tools with their descriptions.
 * Conditionally includes tools based on environment configuration.
 *
 * @param model - The model name (needed for tools that require model-specific configuration)
 * @returns Array of registered tools
 */
export function getToolRegistry(model: string): RegisteredTool[] {
  const tools: RegisteredTool[] = [
    {
      name: 'financial_search',
      tool: createFinancialSearch(model),
      description: FINANCIAL_SEARCH_DESCRIPTION,
    },
    {
      name: 'financial_metrics',
      tool: createFinancialMetrics(model),
      description: FINANCIAL_METRICS_DESCRIPTION,
    },
    {
      name: 'read_filings',
      tool: createReadFilings(model),
      description: READ_FILINGS_DESCRIPTION,
    },
    {
      name: 'browser',
      tool: browserTool,
      description: BROWSER_DESCRIPTION,
    },
    {
      name: 'remember_fact',
      tool: new RememberFactTool(),
      description: 'System Tool: Store a fact or event in long-term memory for future recall.',
    },
    {
      name: 'recall_memories',
      tool: new RecallMemoriesTool(),
      description: 'System Tool: Search long-term memory for relevant facts or events.',
    },
    {
      name: 'dispatch_angel',
      tool: new DispatchAngelTool(),
      description: 'System Tool: Dispatch a specialized Angel to perform a complex task.',
    },
    {
      name: 'bible_lookup',
      tool: new BibleTool(),
      description: 'System Tool: Look up scripture references directly (e.g. "John 3:16").',
    },
    {
      name: 'draft_email',
      tool: new CommunicationTool(),
      description: 'System Tool: Draft emails or messages (Saves to file, does NOT send).',
    },
    {
      name: 'ingest_codebase',
      tool: new IngestCodebaseTool(),
      description: 'System Tool: Scan and index the codebase for semantic search.',
    },
    {
      name: 'search_codebase',
      tool: new SearchCodebaseTool(),
      description: 'System Tool: Find code logic or patterns using natural language.',
    },
  ];

  // Include web_search if Exa or Tavily API key is configured (Exa preferred)
  if (process.env.EXASEARCH_API_KEY) {
    tools.push({
      name: 'web_search',
      tool: exaSearch,
      description: WEB_SEARCH_DESCRIPTION,
    });
  } else if (process.env.TAVILY_API_KEY) {
    tools.push({
      name: 'web_search',
      tool: tavilySearch,
      description: WEB_SEARCH_DESCRIPTION,
    });
  }

  // Include skill tool if any skills are available
  const availableSkills = discoverSkills();
  if (availableSkills.length > 0) {
    tools.push({
      name: 'skill',
      tool: skillTool,
      description: SKILL_TOOL_DESCRIPTION,
    });
  }

  // Include MCP Tools
  const mcpTools = McpManager.getInstance().getTools();
  for (const mcpTool of mcpTools) {
    tools.push({
      name: mcpTool.name,
      tool: mcpTool,
      description: mcpTool.description,
    });
  }

  // Include Treasury Tools (The Almoner)
  const config = ConfigManager.getInstance().getConfig();

  if (config.modes.treasury) {
    try {
      // Treasury is initialized in index.tsx — just get tools here, no double init
      const treasuryTools = TreasuryServer.getInstance().getTools();
      for (const t of treasuryTools) {
        tools.push({
          name: t.name,
          tool: t,
          description: `Treasury Tool: ${t.description}`,
        });
      }
    } catch (e) {
      logger.warn("Failed to load Treasury Tools:", e);
    }
  }

  // Include Protocol State Tools (Builder Mode only)
  if (config.modes.builder) {
    tools.push({
      name: 'update_protocol_state',
      tool: new UpdateProtocolStateTool(),
      description: 'Builder Tool: Update or insert protocol state entries (product status, audit scores, TVL, roadmap milestones).',
    });
    tools.push({
      name: 'query_protocol_state',
      tool: new QueryProtocolStateTool(),
      description: 'Builder Tool: Query current protocol state by category or key.',
    });
  }

  // Include Task Tools (always available when DB is connected)
  tools.push({
    name: 'create_task',
    tool: new CreateTaskTool(),
    description: 'Sprint Tool: Create a new task for persistent multi-session tracking.',
  });
  tools.push({
    name: 'update_task',
    tool: new UpdateTaskTool(),
    description: 'Sprint Tool: Update task status, append context, or reassign.',
  });
  tools.push({
    name: 'query_tasks',
    tool: new QueryTasksTool(),
    description: 'Sprint Tool: Query the sprint board — tasks by status, role, or priority.',
  });

  // Include Code Execution Tool (Builder Mode only)
  if (config.modes.builder) {
    tools.push({
      name: 'code_exec',
      tool: new CodeExecutionTool(),
      description: 'Builder Tool: Execute sandboxed shell commands (forge, bun, anchor, git, etc.) for build/test/analysis.',
    });
  }

  // Include Governance Tools (Builder Mode only)
  if (config.modes.builder) {
    tools.push({
      name: 'propose_safe_tx',
      tool: new ProposeSafeTxTool(),
      description: 'Governance Tool: Propose a transaction to a Safe multi-sig wallet (EVM chains).',
    });
    tools.push({
      name: 'query_safe_status',
      tool: new QuerySafeStatusTool(),
      description: 'Governance Tool: Check Safe wallet status — pending txs, signers, threshold.',
    });
    tools.push({
      name: 'propose_squads_tx',
      tool: new ProposeSquadsTxTool(),
      description: 'Governance Tool: Propose a transaction on a Squads multi-sig (Solana).',
    });
    tools.push({
      name: 'query_squads_status',
      tool: new QuerySquadsStatusTool(),
      description: 'Governance Tool: Check Squads multisig status — members, threshold, vault balance.',
    });
  }

  return tools;
}

/**
 * Get just the tool instances for binding to the LLM.
 *
 * @param model - The model name
 * @returns Array of tool instances
 */
export function getTools(model: string): StructuredToolInterface[] {
  return getToolRegistry(model).map((t) => t.tool);
}

/**
 * Build the tool descriptions section for the system prompt.
 * Formats each tool's rich description with a header.
 *
 * @param model - The model name
 * @returns Formatted string with all tool descriptions
 */
export function buildToolDescriptions(model: string): string {
  return getToolRegistry(model)
    .map((t) => `### ${t.name}\n\n${t.description}`)
    .join('\n\n');
}

/**
 * Get tools for a specific Triune agent role.
 *
 * @param role - The agent role ('mind', 'prophet', 'will')
 * @param model - The model name
 * @returns Array of tool instances filtered for the role
 */
export function getToolsForRole(role: 'mind' | 'prophet' | 'will', model: string): StructuredToolInterface[] {
  const allTools = getToolRegistry(model);

  // Define allowed tools for each role
  // The Mind: Research and Analysis only.
  const mindTools = ['financial_search', 'financial_metrics', 'read_filings', 'browser', 'web_search', 'skill', 'remember_fact', 'recall_memories', 'bible_lookup', 'get_wallet_details', 'get_balance', 'search_codebase', 'query_protocol_state'];

  // The Prophet: High-level trends and strategy.
  const prophetTools = ['financial_search', 'financial_metrics', 'web_search', 'browser', 'skill', 'remember_fact', 'recall_memories', 'bible_lookup', 'draft_email', 'get_wallet_details', 'get_balance', 'search_codebase'];

  // The Will: Execution. Needs everything, including OpenClaw and specialized action tools.
  // Note: OpenClaw system tools (shell_execute, etc.) are now loaded dynamically via MCP.
  // The Will gets everything, including dispatch_angel.
  const willTools = allTools.map(t => t.name); // All tools

  let allowedNames: string[] = [];

  switch (role) {
    case 'mind':
      allowedNames = mindTools;
      break;
    case 'prophet':
      allowedNames = prophetTools;
      break;
    case 'will':
      // The Will gets everything in the registry
      allowedNames = allTools.map(t => t.name);
      break;
  }

  return allTools
    .filter(t => allowedNames.includes(t.name))
    .map(t => t.tool);
}
