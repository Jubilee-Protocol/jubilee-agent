import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import matter from 'gray-matter';
import type { Skill, SkillSource } from './types.js';
import { logger } from '../utils/logger.js';

/**
 * Parse a SKILL.md file content into a Skill object.
 * Extracts YAML frontmatter (name, description) and the markdown body (instructions).
 *
 * @param content - Raw file content
 * @param path - Absolute path to the file (for reference)
 * @param source - Where this skill came from
 * @returns Parsed Skill object
 * @throws Error if required frontmatter fields are missing
 */
export function parseSkillFile(content: string, path: string, source: SkillSource): Skill {
  const { data, content: instructions } = matter(content);

  // Validate required frontmatter fields
  if (!data.name || typeof data.name !== 'string') {
    throw new Error(`Skill at ${path} is missing required 'name' field in frontmatter`);
  }
  if (!data.description || typeof data.description !== 'string') {
    throw new Error(`Skill at ${path} is missing required 'description' field in frontmatter`);
  }

  return {
    name: data.name,
    description: data.description,
    path,
    source,
    instructions: instructions.trim(),
  };
}

/**
 * Load the private architect context from ~/.jubilee/architect.json.
 * Returns a formatted markdown string, or empty string if not found.
 */
function loadArchitectContext(): string {
  const architectPath = join(homedir(), '.jubilee', 'architect.json');
  if (!existsSync(architectPath)) {
    return '';
  }

  try {
    const raw = readFileSync(architectPath, 'utf-8');
    const ctx = JSON.parse(raw);

    const sections: string[] = [
      '\n\n---\n\n## Architect Context (Loaded from ~/.jubilee/architect.json)\n',
    ];

    // Identity
    if (ctx.identity) {
      const id = ctx.identity;
      sections.push(`### Lead Architect\n- **Name**: ${id.name}\n- **Role**: ${id.role}\n- **Organization**: ${id.organization || 'N/A'}`);
      if (id.workingStyle) {
        const ws = id.workingStyle;
        sections.push(`\n### Working Style`);
        for (const [key, value] of Object.entries(ws)) {
          sections.push(`- **${key}**: ${value}`);
        }
      }
    }

    // Protocol
    if (ctx.protocol) {
      const p = ctx.protocol;
      sections.push(`\n### Protocol Identity\n- **Name**: ${p.name}\n- **Tagline**: ${p.tagline}\n- **Mission**: ${p.mission}\n- **Philosophy**: ${p.philosophy}\n- **Summary**: ${p.summary}`);
    }

    // Products
    if (ctx.products && Array.isArray(ctx.products)) {
      sections.push('\n### Live Products\n| Product | Status | Chain | Address |\n|---------|--------|-------|---------|');
      for (const prod of ctx.products) {
        sections.push(`| ${prod.name} | ${prod.status} | ${prod.chain} | ${prod.address || '—'} |`);
      }
    }

    // Locked Decisions
    if (ctx.architecture?.lockedDecisions) {
      sections.push('\n### Locked Decisions (Do Not Re-litigate)\n');
      for (const d of ctx.architecture.lockedDecisions) {
        sections.push(`- ✅ **${d.decision}** — ${d.rationale}`);
      }
    }

    // Roadmap
    if (ctx.roadmap) {
      sections.push(`\n### Roadmap (Current: ${ctx.roadmap.currentPhase})`);
      if (ctx.roadmap.milestones) {
        for (const m of ctx.roadmap.milestones) {
          sections.push(`\n**${m.phase} — ${m.label}**`);
          for (const item of m.items) {
            sections.push(`- ${item}`);
          }
        }
      }
    }

    // Angel Archetypes
    if (ctx.angelArchetypes) {
      sections.push('\n### Angel Archetypes');
      for (const [role, angel] of Object.entries(ctx.angelArchetypes) as [string, any][]) {
        sections.push(`\n**${angel.emoji} ${role}** (${angel.requiredMode} mode)\n- Domain: ${angel.domain}\n- Tools: ${angel.tools.join(', ')}\n- Mission: ${angel.missionFraming}`);
      }
    }

    // Open Questions
    if (ctx.openQuestions && ctx.openQuestions.length > 0) {
      sections.push('\n### Open Questions (Surface When Relevant)');
      for (const q of ctx.openQuestions) {
        sections.push(`- [ ] ${q}`);
      }
    }

    // North Star
    if (ctx.northStar) {
      sections.push(`\n### North Star\n> ${ctx.northStar}`);
    }

    return sections.join('\n');
  } catch (e) {
    logger.warn('Failed to load architect context from ~/.jubilee/architect.json:', e);
    return '';
  }
}

/**
 * Load a skill from a file path.
 * For the 'architect' skill, also loads private context from ~/.jubilee/architect.json.
 *
 * @param path - Absolute path to the SKILL.md file
 * @param source - Where this skill came from
 * @returns Parsed Skill object
 * @throws Error if file cannot be read or parsed
 */
export function loadSkillFromPath(path: string, source: SkillSource): Skill {
  const content = readFileSync(path, 'utf-8');
  const skill = parseSkillFile(content, path, source);

  // Inject private architect context for the architect skill
  if (skill.name === 'architect') {
    const architectContext = loadArchitectContext();
    if (architectContext) {
      skill.instructions += architectContext;
      logger.info('📐 Architect context loaded from ~/.jubilee/architect.json');
    }
  }

  return skill;
}

/**
 * Extract just the metadata from a skill file without loading full instructions.
 * Used for lightweight discovery at startup.
 *
 * @param path - Absolute path to the SKILL.md file
 * @param source - Where this skill came from
 * @returns Skill metadata (name, description, path, source)
 */
export function extractSkillMetadata(path: string, source: SkillSource): { name: string; description: string; path: string; source: SkillSource } {
  const content = readFileSync(path, 'utf-8');
  const { data } = matter(content);

  if (!data.name || typeof data.name !== 'string') {
    throw new Error(`Skill at ${path} is missing required 'name' field in frontmatter`);
  }
  if (!data.description || typeof data.description !== 'string') {
    throw new Error(`Skill at ${path} is missing required 'description' field in frontmatter`);
  }

  return {
    name: data.name,
    description: data.description,
    path,
    source,
  };
}
