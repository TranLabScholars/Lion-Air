import React from 'react';
import { Box, Flex, Text, useColorModeValue } from '@chakra-ui/react';

export const PURPLE = '#6d28d9';

export function Panel({ children, ...rest }) {
  const bg = useColorModeValue('white', 'navy.800');
  return (
    <Box bg={bg} borderRadius="16px" p="20px" {...rest}>
      {children}
    </Box>
  );
}

export function StatTile({ label, value, unit, hint }) {
  const muted = 'secondaryGray.600';
  return (
    <Panel>
      <Text fontSize="sm" color={muted} fontWeight="500">{label}</Text>
      <Flex align="baseline" gap="6px" mt="6px">
        <Text fontSize="2xl" fontWeight="700">{value ?? '–'}</Text>
        {unit && <Text fontSize="sm" color={muted}>{unit}</Text>}
      </Flex>
      {hint && <Text fontSize="xs" color={muted} mt="4px">{hint}</Text>}
    </Panel>
  );
}

export function AqiPill({ aqi, category }) {
  return (
    <Flex
      display="inline-flex"
      align="center"
      px="10px"
      py="2px"
      borderRadius="full"
      bg={category.color}
      color="white"
      fontSize="sm"
      fontWeight="600"
    >
      {aqi ?? '–'} · {category.label}
    </Flex>
  );
}

export function timeAgo(unixSeconds) {
  if (!unixSeconds) return 'unknown';
  const s = Math.max(0, Math.floor(Date.now() / 1000 - unixSeconds));
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export const fmt = (v, d = 1) => (typeof v === 'number' ? v.toFixed(d) : '–');
