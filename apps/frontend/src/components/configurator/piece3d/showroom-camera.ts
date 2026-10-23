export function fitShowroomCamera(width: number, height: number, depth: number, aspect: number) {
  const length = Math.hypot(0.48, 0.32, 0.82);
  const direction = [0.48 / length, 0.32 / length, 0.82 / length];
  const horizontal = Math.hypot(direction[0], direction[2]);
  const right = [direction[2] / horizontal, 0, -direction[0] / horizontal];
  const up = [-direction[1] * direction[0] / horizontal, horizontal, -direction[1] * direction[2] / horizontal];
  const tanVertical = Math.tan(16 * Math.PI / 180);
  let distance = 0.8;
  // Toate cele opt colturi trebuie sa incapa, inclusiv in canvas-uri foarte inguste.
  for (const x of [-width / 2, width / 2]) for (const y of [-height / 2, height / 2]) for (const z of [-depth / 2, depth / 2]) {
    const towardCamera = x * direction[0] + y * direction[1] + z * direction[2];
    const screenX = Math.abs(x * right[0] + z * right[2]);
    const screenY = Math.abs(x * up[0] + y * up[1] + z * up[2]);
    distance = Math.max(distance, towardCamera + Math.max(screenY / tanVertical, screenX / (tanVertical * Math.max(aspect, 0.01))) / 0.84);
  }
  return {
    position: [direction[0] * distance, height / 2 + direction[1] * distance, direction[2] * distance] as const,
    target: [0, height / 2, 0] as const,
    maxDistance: Math.max(Math.max(width, height, depth) * 3 + 3, distance * 1.65),
  };
}
