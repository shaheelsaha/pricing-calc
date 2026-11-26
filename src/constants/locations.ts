// src/constants/locations.ts
// Verified UAE location coordinates from reliable geographic sources

import { Location } from '@/types';

export const UAE_LOCATIONS: Omit<Location, 'createdAt' | 'updatedAt'>[] = [
  // === PORTS ===
  {
    locationId: 'jebel-ali-port',
    name: 'Jebel Ali Port',
    locationType: 'port',
    emirate: 'Dubai',
    latitude: 24.990417,
    longitude: 55.062694,
    address: 'Jebel Ali Terminal 1, Dubai, UAE',
    active: true,
  },
  {
    locationId: 'port-rashid',
    name: 'Port Rashid',
    locationType: 'port',
    emirate: 'Dubai',
    latitude: 25.2697,
    longitude: 55.2820,
    address: 'Port Rashid, Dubai, UAE',
    active: true,
  },
  {
    locationId: 'khalifa-port',
    name: 'Khalifa Port',
    locationType: 'port',
    emirate: 'Abu Dhabi',
    latitude: 24.8020,
    longitude: 54.6480,
    address: 'Khalifa Port, Abu Dhabi, UAE',
    active: true,
  },
  {
    locationId: 'fujairah-port',
    name: 'Fujairah Port',
    locationType: 'port',
    emirate: 'Fujairah',
    latitude: 25.1189,
    longitude: 56.3419,
    address: 'Fujairah Port, Fujairah, UAE',
    active: true,
  },
  {
    locationId: 'sharjah-port',
    name: 'Sharjah Port (Khalid)',
    locationType: 'port',
    emirate: 'Sharjah',
    latitude: 25.3463,
    longitude: 55.3914,
    address: 'Port Khalid, Sharjah, UAE',
    active: true,
  },

  // === AIRPORTS ===
  {
    locationId: 'dubai-airport',
    name: 'Dubai International Airport',
    locationType: 'airport',
    emirate: 'Dubai',
    latitude: 25.2528,
    longitude: 55.3644,
    address: 'Dubai International Airport, Dubai, UAE',
    active: true,
  },
  {
    locationId: 'al-maktoum-airport',
    name: 'Al Maktoum International Airport',
    locationType: 'airport',
    emirate: 'Dubai',
    latitude: 24.8963,
    longitude: 55.1612,
    address: 'Al Maktoum International Airport, Dubai South, UAE',
    active: true,
  },
  {
    locationId: 'abu-dhabi-airport',
    name: 'Abu Dhabi International Airport',
    locationType: 'airport',
    emirate: 'Abu Dhabi',
    latitude: 24.4330,
    longitude: 54.6511,
    address: 'Abu Dhabi International Airport, Abu Dhabi, UAE',
    active: true,
  },
  {
    locationId: 'sharjah-airport',
    name: 'Sharjah International Airport',
    locationType: 'airport',
    emirate: 'Sharjah',
    latitude: 25.3275,
    longitude: 55.5172,
    address: 'Sharjah International Airport, Sharjah, UAE',
    active: true,
  },

  // === FREE ZONES ===
  {
    locationId: 'jafza',
    name: 'JAFZA (Jebel Ali Free Zone)',
    locationType: 'free_zone',
    emirate: 'Dubai',
    latitude: 24.9975,
    longitude: 55.0680,
    address: 'Jebel Ali Free Zone Authority, Dubai, UAE',
    active: true,
  },
  {
    locationId: 'dubai-industrial-city',
    name: 'Dubai Industrial City',
    locationType: 'industrial',
    emirate: 'Dubai',
    latitude: 24.8762,
    longitude: 55.1358,
    address: 'Dubai Industrial City, Dubai, UAE',
    active: true,
  },
  {
    locationId: 'dafza',
    name: 'DAFZA (Dubai Airport Free Zone)',
    locationType: 'free_zone',
    emirate: 'Dubai',
    latitude: 25.2614,
    longitude: 55.3742,
    address: 'Dubai Airport Free Zone, Dubai, UAE',
    active: true,
  },
  {
    locationId: 'saif-zone',
    name: 'Sharjah SAIF Zone',
    locationType: 'free_zone',
    emirate: 'Sharjah',
    latitude: 25.3282,
    longitude: 55.4978,
    address: 'Sharjah Airport International Free Zone, Sharjah, UAE',
    active: true,
  },
  {
    locationId: 'hamriyah-free-zone',
    name: 'Hamriyah Free Zone (Sharjah)',
    locationType: 'free_zone',
    emirate: 'Sharjah',
    latitude: 25.4694,
    longitude: 55.5022,
    address: 'Hamriyah Free Zone, Sharjah, UAE',
    active: true,
  },

  // === INDUSTRIAL / CITY AREAS ===
  {
    locationId: 'al-quoz',
    name: 'Al Quoz Industrial Area',
    locationType: 'industrial',
    emirate: 'Dubai',
    latitude: 25.1424,
    longitude: 55.2213,
    address: 'Al Quoz Industrial Area, Dubai, UAE',
    active: true,
  },
  {
    locationId: 'dubai-investment-park',
    name: 'Dubai Investment Park',
    locationType: 'industrial',
    emirate: 'Dubai',
    latitude: 24.9986,
    longitude: 55.1711,
    address: 'Dubai Investment Park, Dubai, UAE',
    active: true,
  },
  {
    locationId: 'sharjah-industrial',
    name: 'Sharjah Industrial Area',
    locationType: 'industrial',
    emirate: 'Sharjah',
    latitude: 25.3098,
    longitude: 55.4288,
    address: 'Sharjah Industrial Area, Sharjah, UAE',
    active: true,
  },
  {
    locationId: 'sharjah-city',
    name: 'Sharjah City',
    locationType: 'city',
    emirate: 'Sharjah',
    latitude: 25.3573,
    longitude: 55.4033,
    address: 'Sharjah, UAE',
    active: true,
  },
  {
    locationId: 'abu-dhabi-industrial',
    name: 'Abu Dhabi Industrial Area (ICAD)',
    locationType: 'industrial',
    emirate: 'Abu Dhabi',
    latitude: 24.3647,
    longitude: 54.5069,
    address: 'ICAD, Abu Dhabi, UAE',
    active: true,
  },
  {
    locationId: 'ajman',
    name: 'Ajman',
    locationType: 'city',
    emirate: 'Ajman',
    latitude: 25.4111,
    longitude: 55.4354,
    address: 'Ajman, UAE',
    active: true,
  },
  {
    locationId: 'ras-al-khaimah',
    name: 'Ras Al Khaimah',
    locationType: 'city',
    emirate: 'Ras Al Khaimah',
    latitude: 25.7895,
    longitude: 55.9432,
    address: 'Ras Al Khaimah, UAE',
    active: true,
  },
  {
    locationId: 'fujairah-city',
    name: 'Fujairah City',
    locationType: 'city',
    emirate: 'Fujairah',
    latitude: 25.1288,
    longitude: 56.3265,
    address: 'Fujairah, UAE',
    active: true,
  },
  {
    locationId: 'abu-dhabi-city',
    name: 'Abu Dhabi City',
    locationType: 'city',
    emirate: 'Abu Dhabi',
    latitude: 24.4539,
    longitude: 54.3773,
    address: 'Abu Dhabi, UAE',
    active: true,
  },
  {
    locationId: 'dubai-city',
    name: 'Dubai City Centre',
    locationType: 'city',
    emirate: 'Dubai',
    latitude: 25.2048,
    longitude: 55.2708,
    address: 'Dubai, UAE',
    active: true,
  },
  {
    locationId: 'umm-al-quwain',
    name: 'Umm Al Quwain',
    locationType: 'city',
    emirate: 'Umm Al Quwain',
    latitude: 25.5647,
    longitude: 55.5552,
    address: 'Umm Al Quwain, UAE',
    active: true,
  },
  {
    locationId: 'al-ain',
    name: 'Al Ain',
    locationType: 'city',
    emirate: 'Abu Dhabi',
    latitude: 24.2075,
    longitude: 55.7447,
    address: 'Al Ain, Abu Dhabi, UAE',
    active: true,
  },
  {
    locationId: 'khor-khwair-port',
    name: 'Ras Al Khaimah (Khor Khwair Port)',
    locationType: 'port',
    emirate: 'Ras Al Khaimah',
    latitude: 25.9597,
    longitude: 56.0467,
    address: 'Saqr Port / Khor Khwair, Ras Al Khaimah, UAE',
    active: true,
  },
];

// UAE map bounds for initial viewport
export const UAE_BOUNDS = {
  west: 51.5,
  south: 22.6,
  east: 56.4,
  north: 26.1,
};

// Initial map center — Dubai / Jebel Ali area
export const UAE_MAP_CENTER: [number, number] = [55.2708, 25.2048];
export const UAE_MAP_ZOOM = 9;

export const CONTAINER_TYPES = [
  { value: '20ft', label: "20 FT Container" },
  { value: '40ft', label: "40 FT Container" },
  { value: '40ft_hc', label: "40 FT High Cube" },
  { value: 'reefer', label: "Reefer Container" },
  { value: 'lcl', label: "LCL / Loose Cargo" },
  { value: 'other', label: "Other" },
] as const;

export const VEHICLE_TYPES = [
  { value: 'pickup', label: "Pickup Truck" },
  { value: '3ton', label: "3 Ton Truck" },
  { value: '7ton', label: "7 Ton Truck" },
  { value: '10ton', label: "10 Ton Truck" },
  { value: '20ton', label: "20 Ton Truck" },
  { value: 'trailer', label: "Trailer / Semi-Truck" },
  { value: 'lowbed', label: "Low Bed Trailer" },
] as const;

// Real GPS checkpoints for Jebel Ali Port (from user coordinates)
export const JEBEL_ALI_CHECKPOINTS = {
  terminal: {
    id: 'checkpoint-terminal',
    name: 'Jebel Ali Terminal (THC / Port)',
    longitude: 55.062694, // 55°03'45.7"E
    latitude: 24.990417,  // 24°59'25.5"N
  },
  doOffice: {
    id: 'checkpoint-do',
    name: 'DO & Customs Office',
    longitude: 55.060028, // 55°03'36.1"E
    latitude: 24.992944,  // 24°59'34.6"N
  },
  tokenGate: {
    id: 'checkpoint-token',
    name: 'Port Token Gate',
    longitude: 55.069139, // 55°04'08.9"E
    latitude: 24.992389,  // 24°59'32.6"N
  },
  gate: {
    id: 'checkpoint-gate',
    name: 'Jebel Ali Exit Gate (Gate Pass)',
    longitude: 55.086444, // 55°05'11.2"E
    latitude: 25.007472,  // 25°00'26.9"N
  },
} as const;
