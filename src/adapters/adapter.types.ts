/**
 * Agent Adapter Types — Inspired by Paperclip's adapter-utils.
 *
 * Defines a model-agnostic interface that decouples angels from specific
 * LLM providers. Any angel can run on any backend (Gemini, Claude, OpenAI,
 * Ollama) through a unified interface.
 */

import type { StructuredToolInterface } from '@langchain/core/tools';

// ============================================================================
// Execution Types
// ============================================================================

/**
 * Token usage from a single execution.
 */
export interface AdapterUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cachedTokens?: number;
}

/**
 * Result returned from every adapter execution.
 */
export interface AdapterExecutionResult {
    /** The text output / answer from the model */
    output: string;
    /** Token usage statistics */
    usage: AdapterUsage;
    /** Estimated cost in USD (null if unknown, e.g. Ollama) */
    costUsd: number | null;
    /** Model identifier used for this execution */
    model: string;
    /** Provider name (gemini, claude, openai, ollama) */
    provider: string;
    /** Execution duration in milliseconds */
    durationMs: number;
    /** Tool calls made during execution */
    toolCalls?: Array<{ tool: string; args: Record<string, unknown>; result: string }>;
    /** Number of agent loop iterations */
    iterations?: number;
}

/**
 * Configuration passed to an adapter for execution.
 */
export interface AdapterConfig {
    /** The prompt / query to execute */
    prompt: string;
    /** System prompt override */
    systemPrompt?: string;
    /** Specific model to use (overrides adapter default) */
    model?: string;
    /** Tools available to the agent */
    tools?: StructuredToolInterface[];
    /** Maximum agent loop iterations */
    maxIterations?: number;
    /** AbortSignal for cancellation */
    signal?: AbortSignal;
    /** API key overrides */
    apiKeys?: Record<string, string>;
}

/**
 * Connection test result.
 */
export interface AdapterTestResult {
    ok: boolean;
    error?: string;
    latencyMs?: number;
}

/**
 * Available model descriptor.
 */
export interface AdapterModel {
    id: string;
    name: string;
    contextWindow?: number;
}

// ============================================================================
// Core Adapter Interface
// ============================================================================

/**
 * AgentAdapter — The universal interface for LLM backends.
 *
 * Each adapter wraps a specific provider (Gemini, Claude, OpenAI, Ollama)
 * and exposes a consistent execution interface. Angels interact with this
 * interface, never with raw LLM clients directly.
 *
 * Inspired by Paperclip's ServerAdapterModule but simplified for Jubilee.
 */
export interface AgentAdapter {
    /** Adapter type identifier (e.g. "gemini", "claude", "openai", "ollama") */
    readonly type: string;
    /** Human-readable display name */
    readonly name: string;
    /** Default model for this adapter */
    readonly defaultModel: string;

    /**
     * Execute a prompt against the adapter's LLM backend.
     * Returns a standardized result with output, usage, and cost.
     */
    execute(config: AdapterConfig): Promise<AdapterExecutionResult>;

    /**
     * List available models for this adapter.
     */
    listModels(): Promise<AdapterModel[]>;

    /**
     * Test the connection to the LLM backend.
     * Useful for `jubilee adapters list` to show status.
     */
    testConnection(): Promise<AdapterTestResult>;
}
