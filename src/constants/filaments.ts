import { FilamentColor } from '../types/brick';

export const BAMBU_FILAMENTS: FilamentColor[] = [
  { id: 'bambu_red', name: 'Bambu PLA Red', hex: '#D32F2F', type: 'Basic PLA', bambuSlot: 1 },
  { id: 'bambu_blue', name: 'Bambu PLA Blue', hex: '#1976D2', type: 'Basic PLA', bambuSlot: 2 },
  { id: 'bambu_green', name: 'Bambu PLA Green', hex: '#388E3C', type: 'Basic PLA', bambuSlot: 3 },
  { id: 'bambu_yellow', name: 'Bambu PLA Yellow', hex: '#FBC02D', type: 'Basic PLA', bambuSlot: 4 },
  { id: 'bambu_orange', name: 'Bambu PLA Orange', hex: '#F57C00', type: 'Basic PLA', bambuSlot: 5 },
  { id: 'bambu_white', name: 'Bambu PLA Jade White', hex: '#F5F5F5', type: 'Basic PLA', bambuSlot: 6 },
  { id: 'bambu_black', name: 'Bambu PLA Black', hex: '#212121', type: 'Basic PLA', bambuSlot: 7 },
  { id: 'bambu_grey', name: 'Bambu PLA Ash Grey', hex: '#757575', type: 'Basic PLA', bambuSlot: 8 },
  { id: 'bambu_matte_marine', name: 'PLA Matte Marine Blue', hex: '#00838F', type: 'Matte PLA', bambuSlot: 9 },
  { id: 'bambu_matte_brown', name: 'PLA Matte Desert Tan', hex: '#8D6E63', type: 'Matte PLA', bambuSlot: 10 },
  { id: 'bambu_matte_pink', name: 'PLA Matte Sakura Pink', hex: '#EC407A', type: 'Matte PLA', bambuSlot: 11 },
  { id: 'bambu_purple', name: 'Bambu PLA Purple', hex: '#7B1FA2', type: 'Basic PLA', bambuSlot: 12 },
  { id: 'bambu_cyan', name: 'Bambu PLA Cyan', hex: '#00ACC1', type: 'Basic PLA', bambuSlot: 13 },
  { id: 'bambu_lime', name: 'Bambu PLA Lime Green', hex: '#7CB342', type: 'Basic PLA', bambuSlot: 14 },
  { id: 'bambu_gold', name: 'Silk Gold Metallic', hex: '#FFB300', type: 'Silk PLA', bambuSlot: 15 },
  { id: 'bambu_silver', name: 'Silk Silver Metallic', hex: '#B0BEC5', type: 'Silk PLA', bambuSlot: 16 },
];

export const DEFAULT_COLOR: FilamentColor = BAMBU_FILAMENTS[0]; // Red default
