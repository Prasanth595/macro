/** Head outlines, drawn as one closed stroke on a 120-unit grid. */
export type AgentFaceShape = 'round' | 'leaf' | 'block';

/** Otto smiles, Wren is level, Kit is a code cursor. */
export type AgentFaceMouth = 'smile' | 'level' | 'cursor';

/** Theme palette tokens, so each accent follows light and dark mode. */
export type AgentFaceColor =
  | 'orange'
  | 'violet'
  | 'green'
  | 'blue'
  | 'pink'
  | 'teal';

export type AgentFaceLook = {
  shape: AgentFaceShape;
  mouth: AgentFaceMouth;
  color: AgentFaceColor;
};

const SHAPES: readonly AgentFaceShape[] = ['round', 'leaf', 'block'];
const MOUTHS: readonly AgentFaceMouth[] = ['smile', 'level', 'cursor'];
const COLORS: readonly AgentFaceColor[] = [
  'orange',
  'violet',
  'green',
  'blue',
  'pink',
  'teal',
];

/**
 * The face an agent wears when it has no uploaded picture. It is derived from
 * the agent's @tag, so the preview while creating it is the face it keeps.
 */
export function agentFaceLook(seed: string): AgentFaceLook {
  // FNV-1a: small, stable, and spreads neighbouring tags apart.
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return {
    shape: SHAPES[hash % SHAPES.length],
    mouth: MOUTHS[Math.floor(hash / SHAPES.length) % MOUTHS.length],
    color:
      COLORS[
        Math.floor(hash / (SHAPES.length * MOUTHS.length)) % COLORS.length
      ],
  };
}
