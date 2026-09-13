import * as THREE from 'three';
import type { LayerType } from '../world/TileTypes.ts';
import { TileType } from '../world/TileTypes.ts';
import { createTileMesh } from '../world/BlockFactory.ts';

export type SimsMode = 'build' | 'rooms' | 'function' | 'household';

export interface CatalogItem {
  type: TileType;
  name: string;
  category: CatalogCategory;
  price: number;
  description: string;
  defaultSolid: boolean;
  layer: LayerType;
  tags: string[];
  simsMode: SimsMode;
  subCategory: string;
}

export type CatalogCategory =
  | 'all'
  | 'walls'
  | 'architecture'
  | 'furniture'
  | 'decor'
  | 'shop'
  | 'downtown'
  | 'metro'
  | 'coastal'
  | 'interactive';

export const CATALOG_CATEGORIES: Array<{ id: CatalogCategory; label: string; icon: string }> = [
  { id: 'all', label: 'Mind', icon: '🌟' },
  { id: 'walls', label: 'Falak & Kerítések', icon: '🧱' },
  { id: 'architecture', label: 'Építészet', icon: '🏠' },
  { id: 'furniture', label: 'Bútorok', icon: '🛋️' },
  { id: 'decor', label: 'Díszek', icon: '🖼️' },
  { id: 'shop', label: 'Üzlet', icon: '🛒' },
  { id: 'downtown', label: 'Belváros', icon: '🏙️' },
  { id: 'metro', label: 'Metró', icon: '🚇' },
  { id: 'coastal', label: 'Strand & Természet', icon: '🏖️' },
  { id: 'interactive', label: 'Relikviák & Kódok', icon: '🍄' },
];

export const CATALOG_ITEMS: CatalogItem[] = [
  // 🏠 Építészet (Build Mode - Walls, Doors, Floors, Architecture)
  {
    type: TileType.APARTMENT_WALL,
    name: 'Vakolt Beltéri Fal',
    category: 'walls',
    price: 50,
    description: 'Klasszikus sima vakolatú fal, amely elválasztja a privát tereket a lakásban.',
    defaultSolid: true,
    layer: 'wall',
    tags: ['fal', 'vakolat', 'fehér', 'lakás'],
    simsMode: 'build',
    subCategory: 'walls',
  },
  {
    type: TileType.APARTMENT_CORNER_WALL,
    name: 'Sarokfal Elem',
    category: 'walls',
    price: 65,
    description: 'Merevített sarokelem a stabilitásért és a tiszta belső sarkokért.',
    defaultSolid: true,
    layer: 'wall',
    tags: ['sarok', 'fal', 'lakás'],
    simsMode: 'build',
    subCategory: 'walls',
  },
  {
    type: TileType.WALL_PILLAR,
    name: 'Teherbíró Pillér',
    category: 'architecture',
    price: 80,
    description: 'Elegáns teherhordó oszlop nagy belmagasságú helyiségek áthidalásához.',
    defaultSolid: true,
    layer: 'wall',
    tags: ['oszlop', 'pillér', 'támaszték'],
    simsMode: 'build',
    subCategory: 'architecture',
  },
  {
    type: TileType.APARTMENT_FLOOR,
    name: 'Halszálkás Parketta',
    category: 'architecture',
    price: 40,
    description: 'Hőkezelt baszk tölgyfa padlóburkolat a meleg, otthonos hangulatért.',
    defaultSolid: false,
    layer: 'floor',
    tags: ['padló', 'parketta', 'fa'],
    simsMode: 'build',
    subCategory: 'floors',
  },
  {
    type: TileType.APARTMENT_BALCONY_RAILING,
    name: 'Erkély Üvegkorlát',
    category: 'walls',
    price: 95,
    description: 'Edzett biztonsági üvegkorlát a pazar kilátásért és biztonságért.',
    defaultSolid: true,
    layer: 'wall',
    tags: ['erkély', 'korlát', 'üveg', 'kerítés'],
    simsMode: 'build',
    subCategory: 'fences',
  },
  {
    type: TileType.LIGHT_CEILING_FIXTURE,
    name: 'Mennyezeti Csillár',
    category: 'architecture',
    price: 75,
    description: 'Melegfényű függesztett mennyezeti lámpatest energiatakarékos LED izzókkal.',
    defaultSolid: false,
    layer: 'wallDecor',
    tags: ['lámpa', 'csillár', 'fény', 'mennyezet'],
    simsMode: 'function',
    subCategory: 'lighting',
  },
  {
    type: TileType.DOOR_APARTMENT,
    name: '🚪 Kazettás Faajtó',
    category: 'walls',
    price: 130,
    description: 'Masszív lakásajtó rézkilinccsel a magánszféra megőrzésére.',
    defaultSolid: true,
    layer: 'wall',
    tags: ['ajtó', 'faajtó', 'lakás'],
    simsMode: 'build',
    subCategory: 'doors',
  },

  // 🛋️ Bútorok (Rooms: Living, Bedroom, Kitchen)
  {
    type: TileType.FURNITURE_SOFA,
    name: 'Nappali Kanapé',
    category: 'furniture',
    price: 450,
    description: 'Kényelmes, mélyülésű kárpitozott szófa a délutáni pihenéshez.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['kanapé', 'szófa', 'nappali', 'ülő'],
    simsMode: 'rooms',
    subCategory: 'living',
  },
  {
    type: TileType.SOFA_CORNER,
    name: 'Sarok Kanapé Modul',
    category: 'furniture',
    price: 320,
    description: 'Moduláris L-alakú ülőgarnitúra sarokeleme baráti összejövetelekhez.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['kanapé', 'sarok', 'modul'],
    simsMode: 'rooms',
    subCategory: 'living',
  },
  {
    type: TileType.SOFA_STRAIGHT,
    name: 'Egyenes Kanapé Modul',
    category: 'furniture',
    price: 280,
    description: 'Bővíthető kanapé törzselem kopásálló prémium szövettel.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['kanapé', 'egyenes', 'modul'],
    simsMode: 'rooms',
    subCategory: 'living',
  },
  {
    type: TileType.SOFA_CHAISE,
    name: 'Chaise Longue Heverő',
    category: 'furniture',
    price: 340,
    description: 'Lábtartós heverő, amin kényelmesen elnyújtózhatsz olvasás közben.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['kanapé', 'nyújtó', 'lábtartó'],
    simsMode: 'rooms',
    subCategory: 'living',
  },
  {
    type: TileType.FURNITURE_BED,
    name: 'Franciaágy Matraccal',
    category: 'furniture',
    price: 650,
    description: 'Kétszemélyes memóriahabos luxuságy a garantált jó alvásért.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['ágy', 'háló', 'matrac'],
    simsMode: 'rooms',
    subCategory: 'bedroom',
  },
  {
    type: TileType.FURNITURE_DINING_TABLE,
    name: 'Tölgyfa Étkezőasztal',
    category: 'furniture',
    price: 280,
    description: 'Hatszemélyes fa étkezőasztal családi vacsorákhoz és kártyapartikhoz.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['asztal', 'étkező', 'székek'],
    simsMode: 'rooms',
    subCategory: 'living',
  },
  {
    type: TileType.WARDROBE,
    name: 'Dupla Ruhásszekrény',
    category: 'furniture',
    price: 380,
    description: 'Kétajtós akasztós ruhásszekrény belső fiókokkal a ruhatárnak.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['szekrény', 'ruha', 'gardrób'],
    simsMode: 'rooms',
    subCategory: 'bedroom',
  },
  {
    type: TileType.DRESSER,
    name: '3-Fiókos Komód',
    category: 'furniture',
    price: 220,
    description: 'Kompakt tároló bútor hálószobába fehér selyemfényű fronttal.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['komód', 'fiók', 'tároló'],
    simsMode: 'rooms',
    subCategory: 'bedroom',
  },
  {
    type: TileType.NIGHTSTAND,
    name: 'Éjjeliszekrény',
    category: 'furniture',
    price: 110,
    description: 'Kisméretű lerakóasztal az ágy mellé könyveknek és telefonnak.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['éjjeli', 'lámpa', 'olvasólámpa'],
    simsMode: 'rooms',
    subCategory: 'bedroom',
  },
  {
    type: TileType.FURNITURE_TV_STAND,
    name: 'TV Állvány & 4K OLED',
    category: 'furniture',
    price: 580,
    description: 'Vékonykávás síkképernyős televízió médiaállvánnyal és hangprojektorral.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['tv', 'televízió', 'oled', 'állvány'],
    simsMode: 'rooms',
    subCategory: 'living',
  },
  {
    type: TileType.KITCHEN_COUNTER_SINK,
    name: 'Konyhapult Mosogatóval',
    category: 'furniture',
    price: 360,
    description: 'Rozsdamentes acél mosogatótálca kihúzható fejű csapteleppel.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['konyha', 'pult', 'mosogató', 'csap'],
    simsMode: 'rooms',
    subCategory: 'kitchen',
  },
  {
    type: TileType.KITCHEN_COUNTER_STOVE,
    name: 'Indukciós Tűzhely & Sütő',
    category: 'furniture',
    price: 490,
    description: 'Érintővezérléses főzőlap beépített légkeveréses sütővel a baszk falatokhoz.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['konyha', 'tűzhely', 'sütő', 'főzőlap'],
    simsMode: 'rooms',
    subCategory: 'kitchen',
  },
  {
    type: TileType.KITCHEN_COUNTER_STRAIGHT,
    name: 'Konyhai Előkészítő Pult',
    category: 'furniture',
    price: 190,
    description: 'Márványmintás munkalap a zöldségek és gombák szeleteléséhez.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['konyha', 'pult', 'munkafelület'],
    simsMode: 'rooms',
    subCategory: 'kitchen',
  },
  {
    type: TileType.KITCHEN_UPPER_CABINET,
    name: 'Felső Fali Szekrény',
    category: 'furniture',
    price: 160,
    description: 'Függesztett konyhaszekrény poharaknak, tányéroknak és fűszereknek.',
    defaultSolid: false,
    layer: 'wallDecor',
    tags: ['konyha', 'felső', 'szekrény', 'fali'],
    simsMode: 'rooms',
    subCategory: 'kitchen',
  },
  {
    type: TileType.POTTED_MONSTERA,
    name: 'Cserepes Monstera',
    category: 'furniture',
    price: 95,
    description: 'Dús levelű könnyezőpálma, amely élettel tölti meg a sarkokat.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['növény', 'virág', 'monstera', 'zöld'],
    simsMode: 'function',
    subCategory: 'decor',
  },
  {
    type: TileType.POTTED_FICUS,
    name: 'Cserepes Fikusz',
    category: 'furniture',
    price: 85,
    description: 'Könnyen gondozható szobanövény terrakotta kaspóban.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['növény', 'fikusz', 'cserép'],
    simsMode: 'function',
    subCategory: 'decor',
  },
  {
    type: TileType.FURNITURE_KITCHEN_COUNTER,
    name: 'Klasszikus Konyhapult',
    category: 'furniture',
    price: 210,
    description: 'Fa furnéros klasszikus konyhapult tárolófiókokkal.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['konyha', 'klasszikus', 'pult'],
    simsMode: 'rooms',
    subCategory: 'kitchen',
  },
  {
    type: TileType.FURNITURE_KITCHEN_STOVE,
    name: 'Klasszikus Tűzhely',
    category: 'furniture',
    price: 420,
    description: 'Klasszikus gáztűzhely beépített sütőtérrel és szagelszívóval.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['konyha', 'tűzhely', 'elszívó'],
    simsMode: 'rooms',
    subCategory: 'kitchen',
  },

  // 🖼️ Díszek & Textil (Function: Decor)
  {
    type: TileType.RUG_PERSIAN,
    name: 'Kézi Perzsa Szőnyeg',
    category: 'decor',
    price: 240,
    description: 'Bonyolult geometrikus mintázatú szőtt gyapjúszőnyeg élénk bordó színben.',
    defaultSolid: false,
    layer: 'floorDecor',
    tags: ['szőnyeg', 'perzsa', 'vörös', 'textil'],
    simsMode: 'function',
    subCategory: 'decor',
  },
  {
    type: TileType.RUG_BATH_MAT,
    name: 'Fürdőszobai Kilépő',
    category: 'decor',
    price: 45,
    description: 'Puha mikroszálas szőnyeg a fürdőszobába vagy a kád elé.',
    defaultSolid: false,
    layer: 'floorDecor',
    tags: ['kilépő', 'szőnyeg', 'kék', 'fürdő'],
    simsMode: 'function',
    subCategory: 'decor',
  },
  {
    type: TileType.RUG_MODERN,
    name: 'Modern Geometrikus Szőnyeg',
    category: 'decor',
    price: 180,
    description: 'Modern skandináv stílusú padlószőnyeg a dohányzóasztal alá.',
    defaultSolid: false,
    layer: 'floorDecor',
    tags: ['szőnyeg', 'modern', 'geometrikus'],
    simsMode: 'function',
    subCategory: 'decor',
  },
  {
    type: TileType.BEACH_TOWEL_BLUE,
    name: 'Kék Törölköző',
    category: 'decor',
    price: 30,
    description: 'Élénkkék pamut törölköző fürdőszobába vagy a homokos partra.',
    defaultSolid: false,
    layer: 'floorDecor',
    tags: ['törölköző', 'kék', 'strand'],
    simsMode: 'rooms',
    subCategory: 'beach',
  },
  {
    type: TileType.BEACH_TOWEL_STRIPED,
    name: 'Csíkos Strandlepedő',
    category: 'decor',
    price: 35,
    description: 'Hagyományos tengerészcsíkos törölköző a napsütés élvezetéhez.',
    defaultSolid: false,
    layer: 'floorDecor',
    tags: ['törölköző', 'csíkos', 'strand'],
    simsMode: 'rooms',
    subCategory: 'beach',
  },
  {
    type: TileType.WALL_ART_PSYCHEDELIC,
    name: 'Pszichedelikus Festmény',
    category: 'decor',
    price: 160,
    description: 'Hipnotikus színekben pompázó absztrakt műalkotás, amely tágítja a tudatot.',
    defaultSolid: false,
    layer: 'wallDecor',
    tags: ['kép', 'festmény', 'pszichedelikus', 'fal'],
    simsMode: 'function',
    subCategory: 'decor',
  },
  {
    type: TileType.WALL_ART_BASQUE_MAP,
    name: 'Baszkföld Térkép Keretben',
    category: 'decor',
    price: 130,
    description: 'Történelmi Euskadi térkép tölgyfa díszkeretben, a helyi büszkeség jegyében.',
    defaultSolid: false,
    layer: 'wallDecor',
    tags: ['térkép', 'baszk', 'kép', 'keret'],
    simsMode: 'function',
    subCategory: 'decor',
  },
  {
    type: TileType.WALL_ART_POSTER,
    name: 'Retro Zenei Poszter',
    category: 'decor',
    price: 55,
    description: 'Kultikus 90-es évekbeli bilbaói punk-rock koncertplakát.',
    defaultSolid: false,
    layer: 'wallDecor',
    tags: ['poszter', 'zene', 'plakát'],
    simsMode: 'function',
    subCategory: 'decor',
  },
  {
    type: TileType.STORE_SIGN_NEON,
    name: 'Világító Neon Reklám',
    category: 'decor',
    price: 290,
    description: 'Ragyogó kékeslila neontábla az éjszakai utcák és üzletek megvilágítására.',
    defaultSolid: false,
    layer: 'wallDecor',
    tags: ['neon', 'cégér', 'világító', 'felirat'],
    simsMode: 'rooms',
    subCategory: 'downtown',
  },

  // 🛒 Bolt & Belváros (Downtown)
  {
    type: TileType.GROCERY_MEAT_DISPLAY,
    name: 'Hűtött Hús- és Sajtpult',
    category: 'shop',
    price: 620,
    description: 'Professzionális üvegfedelű csemegepult baszk sajtokkal és sonkákkal.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['húspult', 'hűtő', 'sajt', 'bolt', 'közért'],
    simsMode: 'rooms',
    subCategory: 'downtown',
  },
  {
    type: TileType.GROCERY_VEG_STAND,
    name: 'Piacos Zöldséges Stand',
    category: 'shop',
    price: 260,
    description: 'Fa rekeszes stand friss fügével, paradicsommal és paprikával.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['zöldség', 'gyümölcs', 'láda', 'piac'],
    simsMode: 'rooms',
    subCategory: 'downtown',
  },
  {
    type: TileType.GROCERY_DRINK_FRIDGE,
    name: 'Világító Italhűtő',
    category: 'shop',
    price: 540,
    description: 'Jéghideg baszk almabort és üdítőket kínáló üvegajtós hűtőszekrény.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['ital', 'hűtő', 'üdítő', 'világító'],
    simsMode: 'rooms',
    subCategory: 'downtown',
  },
  {
    type: TileType.STORE_CHECKOUT_DESK,
    name: 'Kasszapult & POS Terminál',
    category: 'shop',
    price: 380,
    description: 'Kasszázó és fizető állomás a boltos és a vásárlók számára.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['kassza', 'pos', 'fizetés', 'terminál'],
    simsMode: 'rooms',
    subCategory: 'downtown',
  },
  {
    type: TileType.GROCERY_SHELF,
    name: 'Közért Polcsor',
    category: 'shop',
    price: 240,
    description: 'Polcozott élelmiszeres árutároló konzervekkel és tésztákkal.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['polc', 'élelmiszer', 'közért', 'konzerv'],
    simsMode: 'rooms',
    subCategory: 'downtown',
  },
  {
    type: TileType.GROCERY_COUNTER,
    name: 'Közért Kiszolgálópult',
    category: 'shop',
    price: 310,
    description: 'Széles kiszolgálópult csomagoláshoz és fizetéshez.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['pult', 'bolt', 'kiszolgáló'],
    simsMode: 'rooms',
    subCategory: 'downtown',
  },
  {
    type: TileType.DOOR_STORE,
    name: '🚪 Bolt Üvegajtó',
    category: 'walls',
    price: 250,
    description: 'Biztonsági üvegajtó felülcsengővel a bolt vendégeinek.',
    defaultSolid: true,
    layer: 'wall',
    tags: ['ajtó', 'bolt', 'üvegajtó'],
    simsMode: 'build',
    subCategory: 'doors',
  },
  {
    type: TileType.DOWNTOWN_BRICK_WALL,
    name: 'Utcai Vörös Téglafal',
    category: 'walls',
    price: 60,
    description: 'Masszív teherbíró klinkertégla homlokzati fal a városi épületekhez.',
    defaultSolid: true,
    layer: 'wall',
    tags: ['tégla', 'fal', 'utca', 'város'],
    simsMode: 'build',
    subCategory: 'walls',
  },
  {
    type: TileType.DOWNTOWN_FACADE,
    name: 'Belvárosi Homlokzat',
    category: 'architecture',
    price: 420,
    description: 'Részletgazdag emeleti lakóház homlokzat kovácsoltvas ablakkal.',
    defaultSolid: true,
    layer: 'wall',
    tags: ['homlokzat', 'épület', 'ház', 'ablak'],
    simsMode: 'build',
    subCategory: 'architecture',
  },
  {
    type: TileType.DOWNTOWN_SIDEWALK,
    name: 'Utcai Beton Járda',
    category: 'architecture',
    price: 30,
    description: 'Kopásálló szürke járólap burkolat a bilbaói sétálóutcákhoz.',
    defaultSolid: false,
    layer: 'floor',
    tags: ['járda', 'kő', 'aszfalt', 'utca'],
    simsMode: 'build',
    subCategory: 'floors',
  },
  {
    type: TileType.DOWNTOWN_BIKELANE,
    name: 'Piros Biciklisáv',
    category: 'architecture',
    price: 35,
    description: 'Élénkpiros festésű kerékpársáv a fenntartható városi közlekedésért.',
    defaultSolid: false,
    layer: 'floor',
    tags: ['bicikli', 'kerékpár', 'piros', 'sáv'],
    simsMode: 'build',
    subCategory: 'floors',
  },
  {
    type: TileType.DOWNTOWN_ROAD_ZEBRA,
    name: 'Gyalogátkelő Zebra',
    category: 'architecture',
    price: 45,
    description: 'Biztonságos kijelölt gyalogos átkelőhely fényvisszaverő csíkokkal.',
    defaultSolid: false,
    layer: 'floor',
    tags: ['zebra', 'átkelő', 'út', 'aszfalt'],
    simsMode: 'build',
    subCategory: 'floors',
  },
  {
    type: TileType.DOWNTOWN_ROAD_MULTILANE,
    name: 'Többsávos Úttest',
    category: 'architecture',
    price: 50,
    description: 'Sima bitumenes útburkolat sávelválasztó szaggatott vonallal.',
    defaultSolid: false,
    layer: 'floor',
    tags: ['út', 'úttest', 'aszfalt', 'autóút'],
    simsMode: 'build',
    subCategory: 'floors',
  },
  {
    type: TileType.DOWNTOWN_TREE,
    name: 'Lombos Parki Platánfa',
    category: 'downtown',
    price: 320,
    description: 'Dús lombkoronájú városi fa, amely hűs árnyékot ad a járókelőknek.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['fa', 'lomb', 'természet', 'park'],
    simsMode: 'rooms',
    subCategory: 'downtown',
  },
  {
    type: TileType.LIGHT_STREET_LAMP,
    name: 'Kandeláber Lámpaoszlop',
    category: 'downtown',
    price: 180,
    description: 'Történelmi stílusú öntöttvas utcai lámpaoszlop Bilbao óvárosából.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['lámpa', 'oszlop', 'közvilágítás', 'fény'],
    simsMode: 'rooms',
    subCategory: 'downtown',
  },
  {
    type: TileType.BUILDING_BLOCK_LARGE,
    name: '3-Szintes Épülettömb',
    category: 'architecture',
    price: 850,
    description: 'Monumentális tömbépület a horizont kitöltéséhez és a városképhez.',
    defaultSolid: true,
    layer: 'wall',
    tags: ['épület', 'tömb', 'nagy', 'ház'],
    simsMode: 'build',
    subCategory: 'architecture',
  },

  // 🚇 Metró (Metro)
  {
    type: TileType.METRO_VAULT_WALL,
    name: 'Metró Íves Betonfal',
    category: 'walls',
    price: 90,
    description: 'Karakteres Foster-stílusú boltíves betonfal a földalatti állomásokhoz.',
    defaultSolid: true,
    layer: 'wall',
    tags: ['metró', 'beton', 'alagút', 'ív'],
    simsMode: 'build',
    subCategory: 'walls',
  },
  {
    type: TileType.METRO_TRAIN_CAR,
    name: 'Metró Szerelvény Vagon',
    category: 'metro',
    price: 1200,
    description: 'Teljes utasszállító metrókocsi ablakokkal és kapaszkodókkal.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['metró', 'vagon', 'szerelvény', 'vonat'],
    simsMode: 'rooms',
    subCategory: 'metro',
  },
  {
    type: TileType.METRO_PLATFORM,
    name: 'Metró Peron Szegély',
    category: 'architecture',
    price: 50,
    description: 'Magasított peronburkolat sárga taktilis biztonsági sávval.',
    defaultSolid: false,
    layer: 'floor',
    tags: ['peron', 'állomás', 'metró'],
    simsMode: 'build',
    subCategory: 'floors',
  },
  {
    type: TileType.METRO_RAIL,
    name: 'Vasúti Sínpár',
    category: 'architecture',
    price: 70,
    description: 'Acél sínszálak talpfákkal a vonatok gördülékeny haladásához.',
    defaultSolid: false,
    layer: 'floor',
    tags: ['sín', 'vasút', 'metró', 'pálya'],
    simsMode: 'build',
    subCategory: 'floors',
  },
  {
    type: TileType.METRO_SEAT_DOUBLE,
    name: 'Metró Dupla Ülés',
    category: 'furniture',
    price: 150,
    description: 'Tartós műanyag dupla ülőke a peronra vagy a vagon belsejébe.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['ülés', 'pad', 'metró', 'szék'],
    simsMode: 'rooms',
    subCategory: 'metro',
  },
  {
    type: TileType.METRO_POLE,
    name: 'Kapaszkodó Oszlop',
    category: 'furniture',
    price: 60,
    description: 'Fényes sárga biztonsági kapaszkodórúd a rázkódások ellen.',
    defaultSolid: false,
    layer: 'prop',
    tags: ['kapaszkodó', 'rúd', 'fém', 'metró'],
    simsMode: 'rooms',
    subCategory: 'metro',
  },
  {
    type: TileType.METRO_INTERIOR_CEILING,
    name: 'Metró Mennyezeti Fény',
    category: 'architecture',
    price: 110,
    description: 'Egyenletes szórt fénnyel világító mennyezeti panel a vagonokba.',
    defaultSolid: false,
    layer: 'wallDecor',
    tags: ['mennyezet', 'fény', 'metró'],
    simsMode: 'rooms',
    subCategory: 'metro',
  },
  {
    type: TileType.METRO_GLASS_PARTITION,
    name: 'Üveg Válaszfal',
    category: 'walls',
    price: 140,
    description: 'Átlátszó akusztikus üvegfal a peron zónáinak elválasztásához.',
    defaultSolid: true,
    layer: 'wall',
    tags: ['üveg', 'fal', 'válaszfal', 'metró'],
    simsMode: 'build',
    subCategory: 'walls',
  },
  {
    type: TileType.FLOOR_METRO,
    name: 'Csúszásgátló Burkolat',
    category: 'architecture',
    price: 45,
    description: 'Texturált gumi padlólap nagy forgalmú közösségi terekhez.',
    defaultSolid: false,
    layer: 'floor',
    tags: ['padló', 'csúszásgátló', 'metró'],
    simsMode: 'build',
    subCategory: 'floors',
  },
  {
    type: TileType.LIGHT_METRO_NEON,
    name: 'Metró Neon Fénycső',
    category: 'architecture',
    price: 80,
    description: 'Földalatti atmoszférát adó fénycső armatúra az alagút falára.',
    defaultSolid: false,
    layer: 'wallDecor',
    tags: ['neon', 'lámpa', 'fénycső', 'metró'],
    simsMode: 'rooms',
    subCategory: 'metro',
  },
  {
    type: TileType.DOOR_METRO,
    name: '🚪 Metró Vagon Tolóajtó',
    category: 'walls',
    price: 280,
    description: 'Kétszárnyú gyors tolóajtó hangjelzéses automata zárással.',
    defaultSolid: true,
    layer: 'wall',
    tags: ['ajtó', 'tolóajtó', 'vagon'],
    simsMode: 'build',
    subCategory: 'doors',
  },

  // 🏖️ Tengerpart & Sopelana (Coastal)
  {
    type: TileType.SOPELANA_SAND,
    name: 'Sopelana Aranyhomok',
    category: 'coastal',
    price: 25,
    description: 'Finom szemcsés, forró óceánparti homoktakaró a strandoláshoz.',
    defaultSolid: false,
    layer: 'floor',
    tags: ['homok', 'strand', 'part', 'tenger'],
    simsMode: 'rooms',
    subCategory: 'beach',
  },
  {
    type: TileType.WATER_BLOCK,
    name: 'Animált Hullámzó Óceán',
    category: 'coastal',
    price: 30,
    description: 'Valós idejű shaderszerű csillogó vízfelület habzó hullámokkal.',
    defaultSolid: false,
    layer: 'floor',
    tags: ['víz', 'óceán', 'tenger', 'hullám'],
    simsMode: 'rooms',
    subCategory: 'beach',
  },
  {
    type: TileType.SOPELANA_STONE_WALL,
    name: 'Tengerparti Kőfal',
    category: 'walls',
    price: 75,
    description: 'Természetes sziklatömbökből illesztett partvédő védőfal.',
    defaultSolid: true,
    layer: 'wall',
    tags: ['kőfal', 'sziklafal', 'part'],
    simsMode: 'build',
    subCategory: 'walls',
  },
  {
    type: TileType.SOPELANA_STONE_PARAPET,
    name: 'Sétány Kő Mellvéd',
    category: 'walls',
    price: 65,
    description: 'Alacsony kőkorlát a tengerre néző panorámasétányhoz.',
    defaultSolid: true,
    layer: 'wall',
    tags: ['mellvéd', 'korlát', 'kő', 'sétány', 'kerítés'],
    simsMode: 'build',
    subCategory: 'fences',
  },
  {
    type: TileType.SOPELANA_PAVEMENT,
    name: 'Sétány Kőburkolat',
    category: 'architecture',
    price: 45,
    description: 'Időtálló rusztikus kőlap burkolat a tengerparti andalgáshoz.',
    defaultSolid: false,
    layer: 'floor',
    tags: ['kő', 'sétány', 'burkolat', 'flaszter'],
    simsMode: 'build',
    subCategory: 'floors',
  },
  {
    type: TileType.SOPELANA_CLIFF_GRASS,
    name: 'Sziklafennsík Pázsit',
    category: 'coastal',
    price: 35,
    description: 'Erős gyökerű, sós tengeri szélhez szokott sziklagyep.',
    defaultSolid: true,
    layer: 'wall',
    tags: ['szikla', 'fű', 'gyep', 'fennsík'],
    simsMode: 'rooms',
    subCategory: 'beach',
  },
  {
    type: TileType.SOPELANA_CLIFF_STAIRS,
    name: 'Sziklalépcső (Emelkedő)',
    category: 'architecture',
    price: 110,
    description: 'Természetes kőből faragott feljáró lépcső szintek áthidalásához.',
    defaultSolid: false,
    layer: 'wall',
    tags: ['lépcső', 'szikla', 'emelkedő'],
    simsMode: 'build',
    subCategory: 'architecture',
  },
  {
    type: TileType.DOOR_SOPELANA_IRON,
    name: '🚪 Kovácsoltvas Kerti Kapu',
    category: 'walls',
    price: 310,
    description: 'Díszes fekete vasrácsos kapu zárszerkezettel a villakertbe.',
    defaultSolid: true,
    layer: 'wall',
    tags: ['kapu', 'vas', 'kovácsoltvas', 'ajtó'],
    simsMode: 'build',
    subCategory: 'doors',
  },
  {
    type: TileType.SUBURBAN_VILLA,
    name: 'Baszk Villa Épület',
    category: 'architecture',
    price: 950,
    description: 'Pazar tengerparti baszk kúria terasszal és cseréptetővel.',
    defaultSolid: true,
    layer: 'wall',
    tags: ['villa', 'ház', 'épület'],
    simsMode: 'build',
    subCategory: 'architecture',
  },
  {
    type: TileType.SUBURBAN_HOUSE,
    name: 'Külvárosi Családi Ház',
    category: 'architecture',
    price: 750,
    description: 'Kétszintes takaros baszk külvárosi otthon zöld zsalugáterekkel.',
    defaultSolid: true,
    layer: 'wall',
    tags: ['ház', 'külváros', 'épület'],
    simsMode: 'build',
    subCategory: 'architecture',
  },
  {
    type: TileType.HEDGE_ROW,
    name: 'Dús Kerti Élősövény',
    category: 'walls',
    price: 85,
    description: 'Gondozott, sűrű zöld növényi kerítés a kíváncsi tekintetek ellen.',
    defaultSolid: true,
    layer: 'wall',
    tags: ['sövény', 'bokor', 'kert', 'zöld', 'kerítés'],
    simsMode: 'build',
    subCategory: 'fences',
  },
  {
    type: TileType.DOOR_SUBURBAN_GATE,
    name: '🚪 Külvárosi Kiskapu',
    category: 'walls',
    price: 160,
    description: 'Fehér léces fakerítés kiskapu kilinccsel és zárral.',
    defaultSolid: true,
    layer: 'wall',
    tags: ['kapu', 'kert', 'kiskapu', 'ajtó'],
    simsMode: 'build',
    subCategory: 'doors',
  },
  {
    type: TileType.BEACH_UMBRELLA,
    name: 'Óceánparti Napernyő',
    category: 'coastal',
    price: 120,
    description: 'Széles vásznú uv-szűrős napernyő a délutáni siestához.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['napernyő', 'strand', 'nap'],
    simsMode: 'rooms',
    subCategory: 'beach',
  },
  {
    type: TileType.BEACH_TOWEL,
    name: 'Strandkellékek & Törölköző',
    category: 'decor',
    price: 65,
    description: 'Napozó lepedő napszemüveggel, naptejjel és egy jó könyvvel.',
    defaultSolid: false,
    layer: 'floorDecor',
    tags: ['törölköző', 'kellék', 'strand'],
    simsMode: 'rooms',
    subCategory: 'beach',
  },
  {
    type: TileType.BEACH_COOLER,
    name: 'Kemping Hűtőláda',
    category: 'coastal',
    price: 140,
    description: 'Szigetelt jéghűtő jéggel és hideg dobozos italokkal megtöltve.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['hűtőtáska', 'kemping', 'ital'],
    simsMode: 'rooms',
    subCategory: 'beach',
  },
  {
    type: TileType.COASTAL_CLIFF_BUSH,
    name: 'Tengerparti Sziklacserje',
    category: 'coastal',
    price: 70,
    description: 'Alacsony termetű sóálló örökzöld bokor a sziklás hegyoldalban.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['cserje', 'bokor', 'fű', 'part'],
    simsMode: 'rooms',
    subCategory: 'beach',
  },

  // 🍄 Interaktív & Családi Eszköztár (Household / Interactive)
  {
    type: TileType.RELIC_MUSHROOM,
    name: '🍄 Gomba Relikvia',
    category: 'interactive',
    price: 500,
    description: 'Mágikus pszichedelikus gomba, amely megnyitja a rejtett dimenziókat!',
    defaultSolid: false,
    layer: 'prop',
    tags: ['gomba', 'shroom', 'relikvia', 'felvétel'],
    simsMode: 'household',
    subCategory: 'relics',
  },
  {
    type: TileType.RELIC_JOINT,
    name: '🚬 Spangli Relikvia',
    category: 'interactive',
    price: 350,
    description: 'Aromás bilbaói fűtekercs a paranoia enyhítésére és a tripre hangolódásra.',
    defaultSolid: false,
    layer: 'prop',
    tags: ['joint', 'spangli', 'cigi', 'relikvia'],
    simsMode: 'household',
    subCategory: 'relics',
  },
  {
    type: TileType.SWITCH_BUTTON,
    name: '🔘 Fali Kapcsológomb',
    category: 'interactive',
    price: 85,
    description: 'Kapcsoló gomb, amely vezetékkel összeköthető célajtókkal vagy zárakkal.',
    defaultSolid: false,
    layer: 'wallDecor',
    tags: ['kapcsoló', 'gomb', 'ajtó', 'huzal'],
    simsMode: 'household',
    subCategory: 'mechanisms',
  },
  {
    type: TileType.KEYPAD_TERMINAL,
    name: '🔢 PIN Kódos Terminál',
    category: 'interactive',
    price: 290,
    description: 'Négyjegyű biztonsági számkód terminál titkos átjárók megnyitásához.',
    defaultSolid: false,
    layer: 'wallDecor',
    tags: ['pin', 'kód', 'terminál', 'számkód', 'ajtó'],
    simsMode: 'household',
    subCategory: 'mechanisms',
  },
  {
    type: TileType.STICKY_NOTE_CLUE,
    name: '📝 Sárga Jegyzet Cetli',
    category: 'interactive',
    price: 25,
    description: 'Falra ragasztott emlékeztető cetli a kód megfejtéséhez.',
    defaultSolid: false,
    layer: 'wallDecor',
    tags: ['jegyzet', 'cetli', 'kód', 'clue', 'papír'],
    simsMode: 'household',
    subCategory: 'mechanisms',
  },
  {
    type: TileType.HEAVY_OBSTACLE,
    name: '📦 Tolható Nehéz Láda',
    category: 'interactive',
    price: 175,
    description: 'Súlyos szállítóláda kooperatív tologatáshoz és akadálypályákhoz.',
    defaultSolid: true,
    layer: 'prop',
    tags: ['akadály', 'tolás', 'kooperatív', 'doboz'],
    simsMode: 'household',
    subCategory: 'mechanisms',
  },
];

/**
 * Offscreen 3D Snapshot Thumbnail Generator.
 * Uses a tiny isolated Three.js canvas to render real-time isometric 3D pictures of each block.
 */
class AssetThumbnailGenerator {
  private static cache = new Map<TileType, string>();
  private static renderer: THREE.WebGLRenderer | null = null;
  private static renderScene: THREE.Scene | null = null;
  private static renderCamera: THREE.PerspectiveCamera | null = null;
  private static offscreenCanvas: HTMLCanvasElement | null = null;

  private static init(): boolean {
    if (this.renderer) return true;
    if (typeof document === 'undefined') return false;

    try {
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCanvas.width = 80;
      this.offscreenCanvas.height = 80;

      this.renderer = new THREE.WebGLRenderer({
        canvas: this.offscreenCanvas,
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
      });
      this.renderer.setSize(80, 80, false);
      this.renderer.setClearColor(0x000000, 0);

      this.renderScene = new THREE.Scene();
      const ambLight = new THREE.AmbientLight(0xffffff, 1.4);
      this.renderScene.add(ambLight);

      const dirLight = new THREE.DirectionalLight(0xfffaed, 2.3);
      dirLight.position.set(4, 7, 5);
      this.renderScene.add(dirLight);

      const fillLight = new THREE.DirectionalLight(0x90cdf4, 0.9);
      fillLight.position.set(-5, 2, -4);
      this.renderScene.add(fillLight);

      this.renderCamera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
      this.renderCamera.position.set(2.8, 2.4, 2.8);
      this.renderCamera.lookAt(0, 0.5, 0);

      return true;
    } catch (err) {
      console.warn('AssetThumbnailGenerator init failed:', err);
      return false;
    }
  }

  public static getThumbnail(type: TileType): string {
    if (this.cache.has(type)) {
      return this.cache.get(type)!;
    }

    if (!this.init() || !this.renderer || !this.renderScene || !this.renderCamera || !this.offscreenCanvas) {
      return this.createFallbackSVG(type);
    }

    try {
      const mesh = createTileMesh(type);
      if (!mesh) {
        return this.createFallbackSVG(type);
      }

      const bbox = new THREE.Box3().setFromObject(mesh);
      const center = bbox.getCenter(new THREE.Vector3());
      const size = bbox.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 0.85);

      mesh.position.sub(center);
      mesh.position.y += size.y * 0.42;
      this.renderScene.add(mesh);

      const dist = maxDim * 2.3;
      this.renderCamera.position.set(dist * 0.8, dist * 0.72, dist * 0.8);
      this.renderCamera.lookAt(0, size.y * 0.42, 0);

      this.renderer.render(this.renderScene, this.renderCamera);
      const dataUrl = this.offscreenCanvas.toDataURL('image/webp', 0.9);

      this.renderScene.remove(mesh);
      mesh.traverse((c) => {
        if (c instanceof THREE.Mesh) {
          if (c.geometry) c.geometry.dispose();
        }
      });

      this.cache.set(type, dataUrl);
      return dataUrl;
    } catch (err) {
      console.warn(`Error generating thumbnail for tile ${type}:`, err);
      const fb = this.createFallbackSVG(type);
      this.cache.set(type, fb);
      return fb;
    }
  }

  private static createFallbackSVG(type: TileType): string {
    const item = CATALOG_ITEMS.find((c) => c.type === type);
    const label = item ? item.name.slice(0, 3) : `#${type}`;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
        <rect width="80" height="80" rx="8" fill="#f8fafc" />
        <rect x="4" y="4" width="72" height="72" rx="6" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.5"/>
        <text x="40" y="46" font-family="sans-serif" font-size="13" font-weight="bold" fill="#0284c7" text-anchor="middle">${label}</text>
      </svg>
    `;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
  }
}

export interface SimsCatalogOptions {
  onSelectTile: (tileType: TileType, defaultSolid: boolean) => void;
  onSelectCategory?: (category: CatalogCategory) => void;
  onDragStartTile?: (tileType: TileType, defaultSolid: boolean) => void;
  onDragEndTile?: () => void;
  onTriggerTool?: (tool: string) => void;
}

/**
 * The Sims 4 Build Mode HUD Catalog Shelf.
 * Faithfully mirrors The Sims 4 bottom build shelf layout:
 * - Left vertical pillar: Search, Build Mode, Rooms, Functions, Household Inventory + Simoleons funds counter
 * - Middle section: Isometric illustration and subcategory icon pills
 * - Right section: Two-row horizontal card grid with pure white cards & bright lime-green (#84cc16) active border
 * - Floating Info Card Tooltip: Item 3D thumbnail, blue title, green § price, badges, and flavor description
 */
export class SimsAssetCatalog {
  private container: HTMLDivElement;
  private pillarEl: HTMLDivElement;
  private subcatContainerEl: HTMLDivElement;
  private cardsScrollContainer: HTMLDivElement;
  private searchInput: HTMLInputElement;
  private solidFilterSelect: HTMLSelectElement;
  private toggleButton: HTMLButtonElement;
  private countBadge: HTMLSpanElement;
  private floatingTooltipEl: HTMLDivElement;

  private currentSimsMode: SimsMode = 'build';
  private currentSubCategory = 'all';
  private searchQuery = '';
  private solidFilter: 'all' | 'solid' | 'walkable' = 'all';
  private isExpanded = true;
  private selectedTileType: TileType = TileType.APARTMENT_WALL;

  private options: SimsCatalogOptions;
  private renderedCardEls = new Map<TileType, HTMLDivElement>();
  private subcategoryButtons: HTMLButtonElement[] = [];

  constructor(options: SimsCatalogOptions) {
    this.options = options;

    // 1. Root Container - Anchored to bottom, Sims 4 frosted off-white aesthetic
    this.container = document.createElement('div');
    this.container.id = 'sims-asset-catalog';
    this.container.style.cssText = `
      position: absolute;
      bottom: 8px;
      left: 50%;
      transform: translateX(-50%);
      width: min(1200px, calc(100vw - 24px));
      height: 184px;
      background: rgba(243, 246, 250, 0.96);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.85);
      border-radius: 12px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.42), 0 2px 8px rgba(0, 0, 0, 0.12);
      display: flex;
      flex-direction: row;
      overflow: visible;
      z-index: 990;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      user-select: none;
      transition: height 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s ease;
      box-sizing: border-box;
    `;

    // 2. Leftmost Pillar (Vertical Sims 4 Mode Dock: Search, Build, Rooms, Function, Inventory + Funds)
    this.pillarEl = document.createElement('div');
    this.pillarEl.style.cssText = `
      width: 60px;
      min-width: 60px;
      background: #ffffff;
      border-right: 1px solid #e2e8f0;
      border-top-left-radius: 11px;
      border-bottom-left-radius: 11px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: 6px 0;
      box-sizing: border-box;
      flex-shrink: 0;
      box-shadow: 2px 0 6px rgba(0, 0, 0, 0.04);
    `;

    const pillarTopGroup = document.createElement('div');
    pillarTopGroup.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%;';

    // Search Toggle Button (🔍)
    const searchBtn = document.createElement('button');
    searchBtn.innerHTML = '🔍';
    searchBtn.title = 'Keresés a katalógusban';
    searchBtn.style.cssText = `
      width: 44px;
      height: 32px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 6px;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
    `;
    searchBtn.addEventListener('click', () => {
      this.searchInput.focus();
      this.searchInput.select();
    });
    searchBtn.onmouseenter = () => (searchBtn.style.background = '#f1f5f9');
    searchBtn.onmouseleave = () => (searchBtn.style.background = 'transparent');
    pillarTopGroup.appendChild(searchBtn);

    // Sims 4 Modes list
    const modes: Array<{ id: SimsMode; icon: string; title: string }> = [
      { id: 'build', icon: '🏠', title: 'Építészet (Falak, Padlók, Ajtók, Kerítések)' },
      { id: 'rooms', icon: '🛋️', title: 'Tárgyak szobánként (Nappali, Konyha, Háló, Strand, Metró)' },
      { id: 'function', icon: '🪑', title: 'Tárgyak funkció szerint (Kényelem, Világítás, Díszek)' },
      { id: 'household', icon: '📦', title: 'Családi eszköztár & Relikviák' },
    ];

    for (const m of modes) {
      const btn = document.createElement('button');
      btn.dataset.simsMode = m.id;
      btn.innerHTML = `<span style="font-size: 18px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.15));">${m.icon}</span>`;
      btn.title = m.title;
      const isSel = m.id === this.currentSimsMode;
      btn.style.cssText = `
        width: 46px;
        height: 32px;
        background: ${isSel ? '#e0f2fe' : 'transparent'};
        border: ${isSel ? '1.5px solid #0284c7' : '1px solid transparent'};
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s;
      `;
      btn.addEventListener('click', () => {
        this.setSimsMode(m.id);
      });
      pillarTopGroup.appendChild(btn);
    }
    this.pillarEl.appendChild(pillarTopGroup);
    this.container.appendChild(this.pillarEl);

    // 3. Middle Content Container (Subcategories + Top Shelf Filter Header + Cards)
    const contentWrapper = document.createElement('div');
    contentWrapper.style.cssText = `
      display: flex;
      flex-direction: column;
      flex: 1;
      height: 100%;
      overflow: hidden;
      min-width: 0;
    `;

    // 3a. Shelf Header Row (Subcategory Pills + Search Input + Filter Dropdown + Count + Collapse)
    const shelfHeader = document.createElement('div');
    shelfHeader.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 38px;
      padding: 4px 10px;
      background: rgba(255, 255, 255, 0.8);
      border-bottom: 1px solid #e2e8f0;
      gap: 8px;
      flex-shrink: 0;
      box-sizing: border-box;
      overflow-x: auto;
      scrollbar-width: none;
    `;

    // Subcategory pill buttons container
    this.subcatContainerEl = document.createElement('div');
    this.subcatContainerEl.style.cssText = `
      display: flex;
      align-items: center;
      gap: 4px;
      overflow-x: auto;
      scrollbar-width: none;
      flex: 1;
    `;
    shelfHeader.appendChild(this.subcatContainerEl);

    // Right Controls inside header
    const rightControls = document.createElement('div');
    rightControls.style.cssText = 'display: flex; align-items: center; gap: 6px; flex-shrink: 0;';

    // Search Input Pill
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.placeholder = 'Keresés...';
    this.searchInput.style.cssText = `
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 9999px;
      color: #0f172a;
      font-size: 11px;
      padding: 3px 10px;
      width: 110px;
      outline: none;
      transition: width 0.2s ease, border-color 0.2s;
    `;
    this.searchInput.addEventListener('focus', () => {
      this.searchInput.style.width = '160px';
      this.searchInput.style.borderColor = '#0284c7';
    });
    this.searchInput.addEventListener('blur', () => {
      if (!this.searchInput.value) {
        this.searchInput.style.width = '110px';
      }
      this.searchInput.style.borderColor = '#cbd5e1';
    });
    this.searchInput.addEventListener('input', () => {
      this.searchQuery = this.searchInput.value.toLowerCase().trim();
      this.refreshCards();
    });
    rightControls.appendChild(this.searchInput);

    // Filter items dropdown (Sims 4 "Filter Items...")
    this.solidFilterSelect = document.createElement('select');
    this.solidFilterSelect.style.cssText = `
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 9999px;
      color: #475569;
      font-size: 10.5px;
      font-weight: 600;
      padding: 3px 8px;
      outline: none;
      cursor: pointer;
    `;
    const filterOpts: Array<{ val: 'all' | 'solid' | 'walkable'; label: string }> = [
      { val: 'all', label: 'Szűrés: Mind' },
      { val: 'solid', label: '🔒 Szilárd' },
      { val: 'walkable', label: '🚶 Átjárható' },
    ];
    for (const fo of filterOpts) {
      const opt = document.createElement('option');
      opt.value = fo.val;
      opt.textContent = fo.label;
      this.solidFilterSelect.appendChild(opt);
    }
    this.solidFilterSelect.addEventListener('change', () => {
      this.solidFilter = this.solidFilterSelect.value as 'all' | 'solid' | 'walkable';
      this.refreshCards();
    });
    rightControls.appendChild(this.solidFilterSelect);

    // Count badge
    this.countBadge = document.createElement('span');
    this.countBadge.style.cssText = 'font-size: 10.5px; color: #0284c7; font-weight: 700; white-space: nowrap;';
    rightControls.appendChild(this.countBadge);

    // Minimize / Maximize button
    this.toggleButton = document.createElement('button');
    this.toggleButton.innerHTML = '▼';
    this.toggleButton.title = 'Katalógus összecsukása / kinyitása';
    this.toggleButton.style.cssText = `
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      color: #475569;
      font-size: 11px;
      font-weight: bold;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s;
    `;
    this.toggleButton.addEventListener('click', () => {
      this.toggleExpanded();
    });
    rightControls.appendChild(this.toggleButton);

    shelfHeader.appendChild(rightControls);
    contentWrapper.appendChild(shelfHeader);

    // 3b. Cards Container - 2-row horizontal scrolling grid exactly matching Sims 4
    this.cardsScrollContainer = document.createElement('div');
    this.cardsScrollContainer.id = 'sims-catalog-cards-container';
    this.cardsScrollContainer.style.cssText = `
      display: grid;
      grid-template-rows: repeat(2, 66px);
      grid-auto-flow: column;
      grid-auto-columns: 66px;
      gap: 6px;
      padding: 6px 12px 8px 12px;
      overflow-x: auto;
      overflow-y: hidden;
      flex: 1;
      scrollbar-width: thin;
      scrollbar-color: rgba(2, 132, 199, 0.4) rgba(241, 245, 249, 0.8);
      box-sizing: border-box;
      align-content: center;
    `;
    contentWrapper.appendChild(this.cardsScrollContainer);
    this.container.appendChild(contentWrapper);

    // 4. Floating Info Card Tooltip (The Sims 4 Info Popup on hover/selection)
    this.floatingTooltipEl = document.createElement('div');
    this.floatingTooltipEl.id = 'sims-catalog-hover-tooltip';
    this.floatingTooltipEl.style.cssText = `
      position: absolute;
      bottom: calc(100% + 10px);
      left: 70px;
      width: 330px;
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 10px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28), 0 2px 6px rgba(0, 0, 0, 0.08);
      padding: 10px 12px;
      display: none;
      align-items: flex-start;
      gap: 12px;
      z-index: 1050;
      pointer-events: none;
      box-sizing: border-box;
      transition: opacity 0.15s ease, transform 0.15s ease;
    `;
    this.container.appendChild(this.floatingTooltipEl);

    // --- Mouse Wheel Horizontal Scrolling on cards & tabs ---
    const handleHorizontalWheel = (e: WheelEvent, targetEl: HTMLElement) => {
      e.preventDefault();
      e.stopPropagation();
      const rawDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (rawDelta === 0) return;
      const multiplier = e.deltaMode === 1 ? 36 : 1.2;
      targetEl.scrollLeft += rawDelta * multiplier;
    };

    this.cardsScrollContainer.addEventListener(
      'wheel',
      (e: WheelEvent) => handleHorizontalWheel(e, this.cardsScrollContainer),
      { passive: false }
    );

    this.subcatContainerEl.addEventListener(
      'wheel',
      (e: WheelEvent) => handleHorizontalWheel(e, this.subcatContainerEl),
      { passive: false }
    );

    // --- Mouse Drag-to-Scroll support on catalog cards row ---
    let isCatalogDragScrolling = false;
    let catalogStartX = 0;
    let catalogStartScrollLeft = 0;

    this.cardsScrollContainer.addEventListener('mousedown', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isCard = !!target.closest('.sims-catalog-card');
      if (!isCard || e.button === 1 || e.button === 2) {
        isCatalogDragScrolling = true;
        catalogStartX = e.clientX;
        catalogStartScrollLeft = this.cardsScrollContainer.scrollLeft;
        this.cardsScrollContainer.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!isCatalogDragScrolling) return;
      const dx = e.clientX - catalogStartX;
      this.cardsScrollContainer.scrollLeft = catalogStartScrollLeft - dx;
    });

    window.addEventListener('mouseup', () => {
      if (isCatalogDragScrolling) {
        isCatalogDragScrolling = false;
        this.cardsScrollContainer.style.cursor = '';
      }
    });

    // Populate subcategories & cards
    this.renderSubcategories();
    this.refreshCards();
  }

  public getElement(): HTMLDivElement {
    return this.container;
  }

  public setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'flex' : 'none';
    if (!visible) {
      this.hideTooltip();
    }
  }

  public toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
    if (this.isExpanded) {
      this.container.style.height = '184px';
      this.toggleButton.innerHTML = '▼';
      this.cardsScrollContainer.style.display = 'grid';
    } else {
      this.container.style.height = '38px';
      this.toggleButton.innerHTML = '▲';
      this.cardsScrollContainer.style.display = 'none';
      this.hideTooltip();
    }
  }

  public setSimsMode(mode: SimsMode): void {
    this.currentSimsMode = mode;
    this.currentSubCategory = 'all';

    // Update pillar buttons styling
    Array.from(this.pillarEl.querySelectorAll('button[data-sims-mode]')).forEach((el) => {
      if (el instanceof HTMLButtonElement) {
        const isSel = el.dataset.simsMode === mode;
        el.style.background = isSel ? '#e0f2fe' : 'transparent';
        el.style.border = isSel ? '1.5px solid #0284c7' : '1px solid transparent';
      }
    });

    this.renderSubcategories();
    this.refreshCards();
  }

  public setCategory(cat: CatalogCategory): void {
    // Map legacy category to Sims 4 mode & subCategory
    if (cat === 'walls') {
      this.currentSimsMode = 'build';
      this.currentSubCategory = 'walls';
    } else if (cat === 'architecture') {
      this.currentSimsMode = 'build';
      this.currentSubCategory = 'architecture';
    } else if (cat === 'furniture') {
      this.currentSimsMode = 'rooms';
      this.currentSubCategory = 'living';
    } else if (cat === 'decor') {
      this.currentSimsMode = 'function';
      this.currentSubCategory = 'decor';
    } else if (cat === 'shop' || cat === 'downtown') {
      this.currentSimsMode = 'rooms';
      this.currentSubCategory = 'downtown';
    } else if (cat === 'metro') {
      this.currentSimsMode = 'rooms';
      this.currentSubCategory = 'metro';
    } else if (cat === 'coastal') {
      this.currentSimsMode = 'rooms';
      this.currentSubCategory = 'beach';
    } else if (cat === 'interactive') {
      this.currentSimsMode = 'household';
      this.currentSubCategory = 'all';
    } else {
      this.currentSimsMode = 'build';
      this.currentSubCategory = 'all';
    }

    this.setSimsMode(this.currentSimsMode);
  }

  private renderSubcategories(): void {
    this.subcatContainerEl.innerHTML = '';
    this.subcategoryButtons = [];

    const subcats: Array<{ id: string; label: string; icon: string }> = [];

    if (this.currentSimsMode === 'build') {
      subcats.push(
        { id: 'all', label: 'Összes Építészet', icon: '🏠' },
        { id: 'walls', label: 'Falak & Szobák', icon: '🧱' },
        { id: 'doors', label: 'Ajtók & Kapuk', icon: '🚪' },
        { id: 'floors', label: 'Padlók & Burkolatok', icon: '🪵' },
        { id: 'fences', label: 'Kerítések & Korlátok', icon: '🛡️' },
        { id: 'architecture', label: 'Homlokzat & Oszlopok', icon: '🏛️' }
      );
    } else if (this.currentSimsMode === 'rooms') {
      subcats.push(
        { id: 'all', label: 'Minden Szoba', icon: '🛋️' },
        { id: 'living', label: 'Nappali', icon: '📺' },
        { id: 'kitchen', label: 'Konyha', icon: '🍳' },
        { id: 'bedroom', label: 'Hálószoba', icon: '🛏️' },
        { id: 'downtown', label: 'Belváros & Üzlet', icon: '🏙️' },
        { id: 'metro', label: 'Metróállomás', icon: '🚇' },
        { id: 'beach', label: 'Strand & Természet', icon: '🏖️' }
      );
    } else if (this.currentSimsMode === 'function') {
      subcats.push(
        { id: 'all', label: 'Minden Funkció', icon: '🪑' },
        { id: 'decor', label: 'Díszek & Textil', icon: '🖼️' },
        { id: 'lighting', label: 'Világítás & Fény', icon: '💡' }
      );
    } else if (this.currentSimsMode === 'household') {
      subcats.push(
        { id: 'all', label: 'Összes Eszköz', icon: '📦' },
        { id: 'relics', label: 'Gomba & Spangli Relikviák', icon: '🍄' },
        { id: 'mechanisms', label: 'Kapcsolók, Kódok & Akadályok', icon: '⚙️' }
      );
    }

    for (const sc of subcats) {
      const btn = document.createElement('button');
      btn.innerHTML = `${sc.icon} <span>${sc.label}</span>`;
      btn.dataset.subcat = sc.id;
      const isSel = sc.id === this.currentSubCategory;
      btn.style.cssText = `
        background: ${isSel ? '#0284c7' : '#f1f5f9'};
        color: ${isSel ? '#ffffff' : '#475569'};
        border: 1px solid ${isSel ? '#0284c7' : '#cbd5e1'};
        border-radius: 9999px;
        padding: 3px 9px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
        transition: all 0.15s ease;
      `;
      btn.addEventListener('click', () => {
        this.currentSubCategory = sc.id;
        this.subcategoryButtons.forEach((b) => {
          const s = b.dataset.subcat === sc.id;
          b.style.background = s ? '#0284c7' : '#f1f5f9';
          b.style.color = s ? '#ffffff' : '#475569';
          b.style.borderColor = s ? '#0284c7' : '#cbd5e1';
        });
        this.refreshCards();
      });
      this.subcategoryButtons.push(btn);
      this.subcatContainerEl.appendChild(btn);
    }
  }

  public setSelectedTile(type: TileType): void {
    this.selectedTileType = type;

    // Update green highlights
    this.renderedCardEls.forEach((cardEl, tileType) => {
      const isSelected = tileType === type;
      cardEl.style.outline = isSelected ? '3px solid #84cc16' : '1px solid #e2e8f0';
      cardEl.style.outlineOffset = isSelected ? '-1px' : '0px';
      cardEl.style.boxShadow = isSelected ? '0 0 14px rgba(132, 204, 22, 0.6)' : '0 1px 3px rgba(0,0,0,0.06)';
      cardEl.style.background = isSelected ? '#f7fee7' : '#ffffff';
      if (isSelected) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    });

    const item = CATALOG_ITEMS.find((c) => c.type === type);
    if (item) {
      this.showTooltip(item);
    }
  }

  public refreshCards(): void {
    this.cardsScrollContainer.innerHTML = '';
    this.renderedCardEls.clear();

    const filtered = CATALOG_ITEMS.filter((item) => {
      // Sims 4 Mode filter
      if (item.simsMode !== this.currentSimsMode) {
        return false;
      }
      // Subcategory filter
      if (this.currentSubCategory !== 'all' && item.subCategory !== this.currentSubCategory) {
        return false;
      }
      // Solid filter
      if (this.solidFilter === 'solid' && !item.defaultSolid) return false;
      if (this.solidFilter === 'walkable' && item.defaultSolid) return false;
      // Search query
      if (this.searchQuery) {
        const nameMatch = item.name.toLowerCase().includes(this.searchQuery);
        const tagMatch = item.tags.some((t) => t.includes(this.searchQuery));
        if (!nameMatch && !tagMatch) return false;
      }
      return true;
    });

    this.countBadge.textContent = `${filtered.length} elem`;

    if (filtered.length === 0) {
      const emptyNotice = document.createElement('div');
      emptyNotice.style.cssText = 'font-size: 12px; color: #64748b; font-style: italic; margin: auto; grid-column: span 3;';
      emptyNotice.textContent = 'Nincs találat a megadott szűrési feltételekre.';
      this.cardsScrollContainer.appendChild(emptyNotice);
      return;
    }

    for (const item of filtered) {
      const card = this.createItemCard(item);
      this.renderedCardEls.set(item.type, card);
      this.cardsScrollContainer.appendChild(card);
    }
  }

  private createItemCard(item: CatalogItem): HTMLDivElement {
    const card = document.createElement('div');
    const isSelected = item.type === this.selectedTileType;

    // Pure white clean Sims 4 square card
    card.style.cssText = `
      width: 66px;
      height: 66px;
      background: ${isSelected ? '#f7fee7' : '#ffffff'};
      border: none;
      outline: ${isSelected ? '3px solid #84cc16' : '1px solid #e2e8f0'};
      outline-offset: ${isSelected ? '-1px' : '0px'};
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      cursor: pointer;
      box-sizing: border-box;
      box-shadow: ${isSelected ? '0 0 14px rgba(132, 204, 22, 0.6)' : '0 1px 3px rgba(0,0,0,0.06)'};
      transition: outline 0.12s ease, transform 0.12s ease, box-shadow 0.12s ease;
      overflow: hidden;
    `;

    // Discreet top-left solid indicator
    const solidIndicator = document.createElement('span');
    solidIndicator.style.cssText = `
      position: absolute;
      top: 2px;
      left: 3px;
      font-size: 8px;
      opacity: 0.7;
      pointer-events: none;
    `;
    solidIndicator.textContent = item.defaultSolid ? '🔒' : '🚶';
    card.appendChild(solidIndicator);

    // 3D Rendered thumbnail image
    const img = document.createElement('img');
    img.width = 54;
    img.height = 54;
    img.style.cssText = 'object-fit: contain; pointer-events: none;';
    img.alt = item.name;
    img.src = AssetThumbnailGenerator.getThumbnail(item.type);
    card.appendChild(img);

    // Hover effect & Info Tooltip
    card.addEventListener('mouseenter', () => {
      this.showTooltip(item, card);
      if (item.type !== this.selectedTileType) {
        card.style.outline = '2px solid #0284c7';
        card.style.transform = 'translateY(-2px)';
        card.style.boxShadow = '0 6px 14px rgba(0,0,0,0.12)';
      }
    });

    card.addEventListener('mouseleave', () => {
      if (item.type !== this.selectedTileType) {
        card.style.outline = '1px solid #e2e8f0';
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
      }
    });

    // Drag & Drop
    card.className = 'sims-catalog-card';
    card.draggable = true;

    card.addEventListener('dragstart', (e: DragEvent) => {
      this.setSelectedTile(item.type);
      this.options.onSelectTile(item.type, item.defaultSolid);
      if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', item.type.toString());
        e.dataTransfer.effectAllowed = 'copy';
      }
      if (this.options.onDragStartTile) {
        this.options.onDragStartTile(item.type, item.defaultSolid);
      }
    });

    card.addEventListener('dragend', () => {
      if (this.options.onDragEndTile) {
        this.options.onDragEndTile();
      }
    });

    // Click: Select Tile
    card.addEventListener('click', () => {
      this.setSelectedTile(item.type);
      this.options.onSelectTile(item.type, item.defaultSolid);
    });

    return card;
  }

  private showTooltip(item: CatalogItem, cardEl?: HTMLElement): void {
    const thumbUrl = AssetThumbnailGenerator.getThumbnail(item.type);

    this.floatingTooltipEl.innerHTML = `
      <div style="width: 64px; height: 64px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <img src="${thumbUrl}" width="58" height="58" style="object-fit: contain;" alt="${item.name}" />
      </div>
      <div style="display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0;">
        <div style="font-size: 13px; font-weight: 700; color: #0284c7; line-height: 1.2;">${item.name}</div>
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
          <span style="font-size: 10px; color: #475569; background: #f1f5f9; padding: 2px 7px; border-radius: 4px; font-weight: 700; border: 1px solid #e2e8f0;">
            ${item.defaultSolid ? '🔒 Szilárd' : '🚶 Átjárható'} • ${item.layer.toUpperCase()}
          </span>
        </div>
        <div style="font-size: 10.5px; color: #475569; line-height: 1.35; margin-top: 3px;">
          ${item.description}
        </div>
      </div>
    `;

    // Calculate position
    if (cardEl) {
      const cardRect = cardEl.getBoundingClientRect();
      const containerRect = this.container.getBoundingClientRect();
      const targetLeft = Math.max(12, Math.min(cardRect.left - containerRect.left - 40, containerRect.width - 340));
      this.floatingTooltipEl.style.left = `${targetLeft}px`;
    }

    this.floatingTooltipEl.style.display = 'flex';
  }

  public hideTooltip(): void {
    this.floatingTooltipEl.style.display = 'none';
  }

  public setFunds(_amount: number): void {
    // Sandbox mode: items are free, no price/funds
  }
}
