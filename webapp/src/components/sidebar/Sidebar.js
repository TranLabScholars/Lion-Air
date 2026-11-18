import React, { useContext } from "react";

// chakra imports
import {
  Box,
  Flex,
  Drawer,
  DrawerBody,
  Icon,
  IconButton,
  Tooltip,
  useColorModeValue,
  DrawerOverlay,
  useDisclosure,
  DrawerContent,
  DrawerCloseButton,
} from "@chakra-ui/react";
import Content from "components/sidebar/components/Content";
import {
  renderThumb,
  renderTrack,
  renderView,
} from "components/scrollbar/Scrollbar";
import { Scrollbars } from "react-custom-scrollbars-2";
import PropTypes from "prop-types";
import { useLocation, useNavigate } from "react-router-dom";
import { SidebarContext } from "contexts/SidebarContext";

// Assets
import { IoMenuOutline } from "react-icons/io5";
import { MdChevronLeft, MdMenu } from "react-icons/md";

const COLLAPSED_WIDTH = "80px";
const EXPANDED_WIDTH = "300px";

// Flattens nested route groups into the plain list of pages that have an icon.
const flattenRoutes = (routes) =>
  routes.flatMap((r) => {
    if (r.items) return flattenRoutes(r.items);
    return r.icon && r.layout && r.path ? [r] : [];
  });

// Icon-only navigation shown while the sidebar is collapsed.
function CollapsedRail({ routes, onExpand }) {
  const location = useLocation();
  const navigate = useNavigate();
  const activeBg = useColorModeValue("secondaryGray.300", "whiteAlpha.200");
  const activeColor = useColorModeValue("brand.500", "white");
  const idleColor = useColorModeValue("secondaryGray.600", "secondaryGray.500");

  return (
    <Flex direction='column' align='center' pt='20px' gap='8px'>
      <Tooltip label='Expand menu' placement='right' hasArrow>
        <IconButton
          aria-label='Expand menu'
          icon={<Icon as={MdMenu} boxSize='22px' />}
          variant='ghost'
          onClick={onExpand}
          mb='12px'
        />
      </Tooltip>
      {flattenRoutes(routes).map((r) => {
        const to = r.layout + r.path;
        const active = location.pathname.startsWith(to);
        return (
          <Tooltip key={to} label={r.name} placement='right' hasArrow>
            <IconButton
              aria-label={r.name}
              aria-current={active ? "page" : undefined}
              icon={r.icon}
              variant='ghost'
              bg={active ? activeBg : "transparent"}
              color={active ? activeColor : idleColor}
              onClick={() => navigate(to)}
            />
          </Tooltip>
        );
      })}
    </Flex>
  );
}

function Sidebar(props) {
  const { routes } = props;
  const { sidebarCollapsed, setSidebarCollapsed } = useContext(SidebarContext);

  let variantChange = "0.2s linear";
  let shadow = useColorModeValue(
    "14px 17px 40px 4px rgba(112, 144, 176, 0.08)",
    "unset"
  );
  // Chakra Color Mode
  let sidebarBg = useColorModeValue("white", "navy.800");
  let sidebarMargins = "0px";

  // SIDEBAR
  return (
    <Box display={{ sm: "none", xl: "block" }} w="100%" position='fixed' minH='100%'>
      <Box
        bg={sidebarBg}
        transition={variantChange}
        w={sidebarCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH}
        h='100vh'
        m={sidebarMargins}
        minH='100%'
        overflowX='hidden'
        position='relative'
        boxShadow={shadow}>
        {sidebarCollapsed ? (
          <CollapsedRail
            routes={routes}
            onExpand={() => setSidebarCollapsed(false)}
          />
        ) : (
          <>
            <Tooltip label='Collapse menu' placement='right' hasArrow>
              <IconButton
                aria-label='Collapse menu'
                icon={<Icon as={MdChevronLeft} boxSize='22px' />}
                variant='ghost'
                size='sm'
                position='absolute'
                top='14px'
                right='12px'
                zIndex='2'
                onClick={() => setSidebarCollapsed(true)}
              />
            </Tooltip>
            <Scrollbars
              autoHide
              renderTrackVertical={renderTrack}
              renderThumbVertical={renderThumb}
              renderView={renderView}>
              <Content routes={routes} />
            </Scrollbars>
          </>
        )}
      </Box>
    </Box>
  );
}

// FUNCTIONS
export function SidebarResponsive(props) {
  let sidebarBackgroundColor = useColorModeValue("white", "navy.800");
  let menuColor = useColorModeValue("gray.400", "white");
  // // SIDEBAR
  const { isOpen, onOpen, onClose } = useDisclosure();
  const btnRef = React.useRef();

  const { routes } = props;
  // let isWindows = navigator.platform.startsWith("Win");
  //  BRAND

  return (
    <Flex display={{ sm: "flex", xl: "none" }} alignItems='center'>
      <Flex ref={btnRef} w='max-content' h='max-content' onClick={onOpen}>
        <Icon
          as={IoMenuOutline}
          color={menuColor}
          my='auto'
          w='20px'
          h='20px'
          me='10px'
          _hover={{ cursor: "pointer" }}
        />
      </Flex>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        placement={document.documentElement.dir === "rtl" ? "right" : "left"}
        finalFocusRef={btnRef}>
        <DrawerOverlay />
        <DrawerContent w='285px' maxW='285px' bg={sidebarBackgroundColor}>
          <DrawerCloseButton
            zIndex='3'
            onClose={onClose}
            _focus={{ boxShadow: "none" }}
            _hover={{ boxShadow: "none" }}
          />
          <DrawerBody maxW='285px' px='0rem' pb='0'>
            <Scrollbars
              autoHide
              renderTrackVertical={renderTrack}
              renderThumbVertical={renderThumb}
              renderView={renderView}>
              <Content routes={routes} />
            </Scrollbars>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Flex>
  );
}
// PROPS

Sidebar.propTypes = {
  logoText: PropTypes.string,
  routes: PropTypes.arrayOf(PropTypes.object),
  variant: PropTypes.string,
};

export default Sidebar;
