// Solmar City — tuning, world layout and the palette. One place for every number
// the rest of the game shares, so a balance change never means hunting through files.

export const WORLD_W = 3400;
export const WORLD_H = 2600;
export const ROAD_W = 100;
export const SIDEWALK = 18;

// Avenue (vertical road) centre x positions and street (horizontal) centre y positions.
export const AVENUES_X = [160, 560, 960, 1360, 1760, 2160, 2560, 2960];
export const STREETS_Y = [160, 460, 760, 1060, 1360, 1660, 1960, 2260];
export const AVENUE_NAMES = ['Harbor Rd', 'Palm Blvd', 'Sunset Ave', 'Coral St', 'Marina Ave', 'Solmar Blvd', 'Jacaranda St', 'Ocean Dr'];
export const STREET_NAMES = ['Breaker Ln', 'Calle Verde', 'Mercado St', 'Vista Ave', 'Gull Way', 'Foundry St', 'Pier St', 'Southgate Rd'];

// The beach starts here; past the sand line is the sea (impassable).
export const BEACH_X = 3080;
export const SEA_X = 3300;

export const PLAYER = {
  walkSpeed: 175,
  runSpeed: 265,
  radius: 11,
  maxHealth: 100,
  maxArmor: 100,
};

export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 34, fireRate: 0.22, bulletSpeed: 900, spread: 0.03, auto: false, range: 620 },
  smg: { name: 'SMG', damage: 20, fireRate: 0.085, bulletSpeed: 1000, spread: 0.075, auto: true, range: 560 },
};

// Car models: length/width in px, top speed px/s, acceleration, grip, health.
export const CAR_MODELS = {
  sedan:   { len: 46, wid: 22, topSpeed: 430, accel: 260, grip: 6.5, health: 100, name: 'Sedan' },
  coupe:   { len: 44, wid: 22, topSpeed: 480, accel: 300, grip: 7.0, health: 90,  name: 'Coupe' },
  sports:  { len: 46, wid: 23, topSpeed: 620, accel: 420, grip: 7.6, health: 80,  name: 'Sports' },
  taxi:    { len: 46, wid: 22, topSpeed: 440, accel: 270, grip: 6.5, health: 100, name: 'Taxi' },
  van:     { len: 54, wid: 24, topSpeed: 360, accel: 200, grip: 5.4, health: 140, name: 'Van' },
  truck:   { len: 62, wid: 26, topSpeed: 330, accel: 180, grip: 5.0, health: 180, name: 'Truck' },
  police:  { len: 48, wid: 23, topSpeed: 560, accel: 380, grip: 7.4, health: 130, name: 'Interceptor' },
};
export const CAR_COLORS = ['#c0392b', '#2980b9', '#f1c40f', '#ecf0f1', '#2c3e50', '#27ae60', '#8e44ad', '#e67e22', '#95a5a6', '#16a085', '#d35400', '#7f8c8d'];

// Wanted: how much heat each crime adds, and the star thresholds on the heat scale.
export const CRIME_HEAT = { stealCar: 22, hitPed: 26, killPed: 45, hitCop: 40, killCop: 60, shoot: 12, hitCar: 6, speeding: 0 };
export const STAR_HEAT = [0, 20, 45, 70, 95, 120];
export const RESPRAY_COST_PER_STAR = 150;
export const BAIL_COST = 200;
export const HOSPITAL_COST = 150;

export const SAVE_KEY = 'solmar-city-save-v1';

// Fixed story locations (world coordinates).
export const PLACES = {
  hideout:    { x: 1000, y: 1100, name: 'Kai\u2019s Apartment' },
  garage:     { x: 1380, y: 500,  name: 'Lena\u2019s Garage' },
  diner:      { x: 1780, y: 800,  name: 'Mama Rosa\u2019s Diner' },
  hospital:   { x: 2200, y: 1100, name: 'Solmar General' },
  policeHq:   { x: 1400, y: 1400, name: 'Solmar PD HQ' },
  pier:       { x: 3150, y: 1400, name: 'Solmar Pier' },
  port:       { x: 560,  y: 2100, name: 'Port Solmar' },
  casino:     { x: 2180, y: 800,  name: 'The Grand Solmar' },
  park:       { x: 960,  y: 460,  name: 'Jacaranda Park' },
  taxiRank:   { x: 1760, y: 1060, name: 'Taxi Rank' },
};

// Sun-soaked palette.
export const PALETTE = {
  grass: '#79a85a',
  grassDark: '#6b9a4e',
  sand: '#ecd9a0',
  sea: '#2f9dc0',
  seaDeep: '#1f7fa3',
  asphalt: '#3d4149',
  asphaltDark: '#34383f',
  sidewalk: '#b7b0a0',
  curb: '#9a937f',
  parkGreen: '#5d9c4a',
  concrete: '#a8a294',
  roofColors: ['#c96f4a', '#d9a441', '#7fb3c8', '#b08968', '#a3b18a', '#c9ada7', '#8d99ae', '#e0a458', '#9b7ede', '#6d8ea0'],
  houseColors: ['#f4e3c1', '#f2c9a0', '#cfe3d0', '#f7d6d6', '#d6e4f0', '#efe3b0'],
  downtownColors: ['#5b7fa6', '#7a6a8a', '#4a7d6f', '#8a6a5b', '#6b7f9e', '#977a8f'],
};
