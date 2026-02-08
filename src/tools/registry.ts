import { DynamicStructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import { createFinancialSearch, createFinancialMetrics, createReadFilings } from './finance/index.js';
import { exaSearch, tavilySearch } from './search/index.js';
import { browserTool } from './browser/index.js';
import { skillTool, SKILL_TOOL_DESCRIPTION } from './skill.js';
import { FINANCIAL_SEARCH_DESCRIPTION, FINANCIAL_METRICS_DESCRIPTION, WEB_SEARCH_DESCRIPTION, READ_FILINGS_DESCRIPTION, BROWSER_DESCRIPTION } from './descriptions/index.js';
import { discoverSkills } from '../skills/index.js';
import { McpManager } from '../mcp/index.js';
import { RememberFactTool, RecallMemoriesTool } from './memory-tools.js';
import { DispatchAngelTool } from './angel-tool.js';


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

  // Include Treasury Tools (The Almoner) -- DISABLED per user request
  // We dynamically fetch them from the singleton
  // const treasuryTools = require('../mcp/servers/treasury/index.js').TreasuryServer.getInstance().getTools();
  // for (const t of treasuryTools) {
  //   tools.push({
  //     name: t.name,
  //     tool: t,
  //     description: `Treasury Tool: ${t.description}`,
  //   });
  // }

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
  // The Mind: Research and Analysis only. No system actions (OpenClaw) or actions that change state.
  const mindTools = ['financial_search', 'financial_metrics', 'read_filings', 'browser', 'web_search', 'skill', 'remember_fact', 'recall_memories'];

  // The Prophet: High-level trends and strategy. Similar to Mind but focused on synthesis.
  const prophetTools = ['financial_search', 'financial_metrics', 'web_search', 'browser', 'skill', 'remember_fact', 'recall_memories'];

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
