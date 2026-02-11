import React from 'react';
import { Box, Text } from 'ink';
import { useDebugLogs } from '../hooks/useDebugLogs.js';
import { colors } from '../theme.js';
import type { LogLevel } from '../utils/logger.js';

const levelColors: Record<LogLevel, string> = {
  silent: colors.mutedDark,
  debug: colors.mutedDark,
  info: colors.info,
  warn: colors.warning,
  error: colors.error,
};

interface DebugPanelProps {
  maxLines?: number;
  show?: boolean;
}

export function DebugPanel({ maxLines = 10, show = true }: DebugPanelProps) {
  const logs = useDebugLogs();

  if (!show || logs.length === 0) return null;

  const displayLogs = logs.slice(-maxLines);

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={colors.mutedDark}
      paddingX={1}
      marginTop={1}
    >
      <Text color={colors.mutedDark} dimColor>─ Debug ─</Text>
      {displayLogs.map((entry, i) => (
        <Box key={`${entry.timestamp}-${i}`}>
          <Text color={levelColors[entry.level]}>
            [{entry.level.toUpperCase().padEnd(5)}]
          </Text>
          <Text> {entry.message}</Text>
        </Box>
      ))}
    </Box>
  );
}
