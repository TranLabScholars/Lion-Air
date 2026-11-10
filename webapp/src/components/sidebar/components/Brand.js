import React from 'react';
import { Flex, Icon, Text, Divider, useColorModeValue } from '@chakra-ui/react';
import { MdCloud } from 'react-icons/md';

// Replaces the "Horizon Free" logo in the sidebar.
export function SidebarBrand() {
  const textColor = useColorModeValue('navy.700', 'white');
  return (
    <Flex align="center" direction="column">
      <Flex align="center" gap="10px" my="32px">
        <Icon as={MdCloud} w="30px" h="30px" color="#6d28d9" />
        <Text fontSize="xl" fontWeight="800" color={textColor} letterSpacing="-0.3px">
          Lion Air Quality
        </Text>
      </Flex>
      <Divider mb="20px" />
    </Flex>
  );
}

export default SidebarBrand;
