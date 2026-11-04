import { HOUSE_WALL_THICKNESS, houseWallPoint, type StudioHouse } from './studio-house';
import { openingSize, type StudioScene, type StudioWall } from './studio.schemas';

export interface HouseWallPanel { sceneId: string; x: number; z: number; y: number; w: number; d: number; h: number }
interface Run { scene: StudioScene; wall: StudioWall; axis: 'x' | 'z'; line: number; start: number; end: number }

// Decupeaza segmentele comune din al doilea perete, inclusiv alipiri partiale.
// Ordinea ID-urilor da un proprietar stabil independent de ordinea scenelor.
export function buildHouseWallPanels(house: StudioHouse, scenes: StudioScene[]): HouseWallPanel[] {
  const runs: Run[] = [];
  const panels: HouseWallPanel[] = [];
  for (const scene of [...scenes].sort((a, b) => a.id.localeCompare(b.id))) {
    const transform = house.roomTransforms[scene.id]; if (!transform) continue;
    for (const wall of ['N', 'E', 'S', 'W'] as StudioWall[]) {
      const center = houseWallPoint(scene, transform, wall);
      const axis = center.nx ? 'z' : 'x';
      const length = wall === 'N' || wall === 'S' ? scene.room.widthM : scene.room.depthM;
      const run: Run = { scene, wall, axis, line: axis === 'x' ? center.z : center.x, start: center[axis] - length / 2, end: center[axis] + length / 2 };
      let intervals = [{ start: run.start, end: run.end }];
      for (const prior of runs) {
        if (prior.axis !== axis || Math.abs(prior.line - run.line) > 0.006) continue;
        intervals = intervals.flatMap((i) => {
          if (prior.end <= i.start || prior.start >= i.end) return [i];
          return [{ start: i.start, end: Math.min(i.end, prior.start) }, { start: Math.max(i.start, prior.end), end: i.end }].filter((v) => v.end - v.start > 0.001);
        });
      }
      const holes = scene.openings.filter((o) => o.wall === wall).map((o) => {
        const size = openingSize(o), point = houseWallPoint(scene, transform, wall, o.offset);
        return { ...size, start: point[axis] - size.w / 2, end: point[axis] + size.w / 2 };
      }).filter((o) => o.cutout);
      for (const interval of intervals) {
        const cuts = [...new Set([interval.start, interval.end, ...holes.flatMap((o) => [o.start, o.end]).filter((v) => v > interval.start && v < interval.end)])].sort((a, b) => a - b);
        for (let i = 0; i < cuts.length - 1; i++) {
          const start = cuts[i], end = cuts[i + 1], mid = (start + end) / 2;
          const hole = holes.find((o) => mid > o.start && mid < o.end);
          const vertical = hole ? [{ bottom: 0, top: hole.sill }, { bottom: hole.sill + hole.h, top: scene.room.wallHeightM }] : [{ bottom: 0, top: scene.room.wallHeightM }];
          for (const span of vertical) if (span.top - span.bottom > 0.001) panels.push({
            sceneId: scene.id, x: axis === 'x' ? mid : run.line, z: axis === 'x' ? run.line : mid,
            y: (span.bottom + span.top) / 2, h: span.top - span.bottom,
            w: axis === 'x' ? end - start : HOUSE_WALL_THICKNESS,
            d: axis === 'z' ? end - start : HOUSE_WALL_THICKNESS,
          });
        }
      }
      runs.push(run);
    }
  }
  return panels;
}
