export enum EnemyType {
  GRANNY = 'granny',
  DOG = 'dog',
  CASHIER = 'cashier',
  PASSENGER = 'passenger',
  NPC_BEACH_WALKER = 'npc_beach_walker',
  NPC_VAGRANT = 'npc_vagrant',
}

export interface EnemyConfig {
  type: EnemyType;
  spawnPos: [number, number, number]; // [worldX, worldY, worldZ]
  patrolTarget?: [number, number, number];
  waypoints?: Array<[number, number, number]>;
  facingAngle?: number;
  swimwearColor?: number;
}
