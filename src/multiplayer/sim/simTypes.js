export function createInputFrame({
  frame = 0,
  flap = false,
  fire = false,
  blast = false,
  special = false,
} = {}) {
  return {
    frame,
    flap: Boolean(flap),
    fire: Boolean(fire),
    blast: Boolean(blast),
    special: Boolean(special),
  };
}

