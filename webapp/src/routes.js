import React from 'react';

import { Icon } from '@chakra-ui/react';
import { MdHome, MdSensors, MdLocationPin, MdAdd } from 'react-icons/md';

// Admin Imports
import AirQualityDashboard from 'views/admin/airQuality';
import MySensors from 'views/admin/mySensors';
import SensorMap from 'views/admin/map';
import SensorRegistration from 'views/admin/sensorRegistration';

const icon = (as) => <Icon as={as} width="20px" height="20px" color="inherit" />;

const routes = [
  {
    name: 'Dashboard',
    layout: '/admin',
    path: '/default',
    icon: icon(MdHome),
    component: <AirQualityDashboard />,
  },
  {
    name: 'My sensors',
    layout: '/admin',
    path: '/my-sensors',
    icon: icon(MdSensors),
    component: <MySensors />,
  },
  {
    name: 'Map',
    layout: '/admin',
    path: '/map',
    icon: icon(MdLocationPin),
    component: <SensorMap />,
  },
  {
    name: 'Add a sensor',
    layout: '/admin',
    path: '/sensor-registration',
    icon: icon(MdAdd),
    component: <SensorRegistration />,
  },
];

export default routes;
