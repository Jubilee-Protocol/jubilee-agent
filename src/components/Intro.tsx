import React from 'react';
import { Box, Text } from 'ink';
import { colors, dimensions } from '../theme.js';
import packageJson from '../../package.json';
import { getProviderDisplayName } from '../utils/env.js';
import { getModelDisplayName } from './ModelSelector.js';

interface IntroProps {
  provider: string;
  model: string;
}

export function Intro({ provider, model }: IntroProps) {
  const { introWidth } = dimensions;
  const welcomeText = 'Welcome to Jubilee';
  const versionText = ` v${packageJson.version}`;
  const fullText = welcomeText + versionText;
  const padding = Math.floor((introWidth - fullText.length - 2) / 2);

  const verses = [
    "The heart of the discerning acquires knowledge. - Proverbs 18:15",
    "Where there is no vision, the people perish. - Proverbs 29:18",
    "Commit your work to the Lord, and your plans will be established. - Proverbs 16:3",
    "For God has not given us a spirit of fear, but of power and of love and of a sound mind. - 2 Timothy 1:7",
    "But let justice roll down like waters, and righteousness like an ever-flowing stream. - Amos 5:24",
    "Iron sharpens iron, and one man sharpens another. - Proverbs 27:17",
    "Be strong and courageous. Do not be afraid; do not be discouraged. - Joshua 1:9"
  ];
  const randomVerse = verses[Math.floor(Math.random() * verses.length)];

  return (
    <Box flexDirection="column" marginTop={2}>
      <Text color="#E10098">{'═'.repeat(introWidth)}</Text>
      <Text color="#E10098">
        ║{' '.repeat(padding)}
        <Text bold>{welcomeText}</Text>
        <Text color={colors.muted}>{versionText}</Text>
        {' '.repeat(introWidth - fullText.length - padding - 2)}║
      </Text>
      <Text color="#E10098">{'═'.repeat(introWidth)}</Text>

      <Box marginTop={1}>
        <Text color="#E10098" bold>
          {`
     ██╗██╗   ██╗██████╗ ██╗██╗     ███████╗███████╗
     ██║██║   ██║██╔══██╗██║██║     ██╔════╝██╔════╝
     ██║██║   ██║██████╔╝██║██║     █████╗  █████╗  
██   ██║██║   ██║██╔══██╗██║██║     ██╔══╝  ██╔══╝  
╚█████╔╝╚██████╔╝██████╔╝██║███████╗███████╗███████╗
 ╚════╝  ╚═════╝ ╚═════╝ ╚═╝╚══════╝╚══════╝╚══════╝`}
        </Text>
      </Box>

      <Box marginY={1} flexDirection="column">
        <Text>The Triune Agent: Mind, Prophet, and Will.</Text>
        <Text color={colors.muted} italic>"{randomVerse}"</Text>
        <Text color={colors.muted}>Model: <Text color={colors.primary}>{getModelDisplayName(model)}.</Text> Type /model to change.</Text>
      </Box>
    </Box>
  );
}
