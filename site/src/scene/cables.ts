import { project } from './iso.js';
import type { Camera, Vec3 } from './iso.js';
import { ENTRY_POST_H } from './layout.js';
import { chamfer, lengths } from './polyline.js';
import type { Pt } from './polyline.js';

/**
 * Service cables in stage pixels (controller ruling R-n). Each cable enters at the stage top under
 * its card (the anchor), drops to a horizontal bus, runs along it to above its entry post and drops
 * onto the post: straight runs joined by 9 px 45° chamfers (DESIGN.md Cables). Buses are stepped so
 * neighbouring cables never cross: posts keep the anchors' left-to-right order, so of the cables
 * running right the leftmost takes the lowest bus, and of those running left the rightmost does.
 */
export const CABLE = {
  chamfer: 9,
  /** Bus heights below the stage top, px. */
  busTop: 30,
  busStep: 6,
  /** A severed cable's break: its first bar this far down the post leg (or the drop under the card), 16 px between the bars. */
  breakDrop: 26,
  breakGap: 16,
  /** Under the card, when the post leg is too short or runs up out of the stage. */
  cardDrop: 4,
  /** The drop under a card whose post is out of reach: it stops short of the highest bus. */
  stub: 26,
} as const;

export interface CableRoute {
  /** The chamfered polyline, anchor first; it ends on the post when `reaches`, otherwise at the foot of a short drop. */
  points: Pt[];
  length: number;
  /** Whether the route reaches its post. A post above the stage (or too close under the top for a bus) gets only the drop under its card. */
  reaches: boolean;
  /** Distance along `points` of a severed cable's first break bar; the second is `CABLE.breakGap` further on. */
  breakAt: number;
  /** The bus corner under the card, where reduced motion shows a live cable's still dot. */
  corner: Pt;
}

/** How far below the bus a post must sit for the cable to drop onto it. */
const POST_CLEARANCE = 14;

/**
 * One route per anchor. Cables start at y = `top` (0: the stage top under the cards; on the hero, under its
 * labels), and everything below is measured from there.
 */
export function cableRoutes(anchors: number[], stagePosts: Pt[], top = 0): CableRoute[] {
  const posts = stagePosts.map((p) => ({ x: p.x, y: p.y - top }));
  return routesFromTop(anchors, posts).map((r) => ({
    ...r,
    points: r.points.map((p) => ({ x: p.x, y: p.y + top })),
    corner: { x: r.corner.x, y: r.corner.y + top },
  }));
}

function routesFromTop(anchors: number[], posts: Pt[]): CableRoute[] {
  const dir = anchors.map((a, i) => Math.sign(Math.round(posts[i]!.x - a)));
  // Buses depend on which cables reach their posts, and reaching depends on the bus: settle both.
  let reach = posts.map((p) => p.y >= CABLE.busTop + POST_CLEARANCE);
  let bus: number[] = [];
  for (let pass = 0; pass < anchors.length + 1; pass++) {
    const right = dir.flatMap((d, i) => (d > 0 && reach[i] ? [i] : []));
    const left = dir.flatMap((d, i) => (d < 0 && reach[i] ? [i] : []));
    bus = anchors.map((_, i) => {
      const rank = dir[i]! > 0 ? right.length - 1 - right.indexOf(i) : dir[i]! < 0 ? left.indexOf(i) : 0;
      return CABLE.busTop + CABLE.busStep * Math.max(0, rank);
    });
    const next = reach.map((r, i) => r && posts[i]!.y >= bus[i]! + POST_CLEARANCE);
    if (next.every((r, i) => r === reach[i])) break;
    reach = next;
  }
  return anchors.map((ax, i) => {
    const post = posts[i]!;
    const top = { x: ax, y: 0 };
    let corners: Pt[];
    if (!reach[i]) corners = [top, { x: ax, y: CABLE.stub }];
    else if (dir[i] === 0) corners = [top, post];
    else corners = [top, { x: ax, y: bus[i]! }, { x: post.x, y: bus[i]! }, post];
    const points = chamfer(corners, CABLE.chamfer);
    const cum = lengths(points);
    const length = cum[cum.length - 1]!;
    const legTop = dir[i] === 0 ? 0 : bus[i]!;
    // Near the post when its leg drops far enough to hold the break; otherwise just under the card.
    const roomy = reach[i] && post.y - legTop >= CABLE.breakDrop + CABLE.breakGap + 18;
    const breakAt = roomy ? length - (post.y - legTop - CABLE.breakDrop) : CABLE.cardDrop;
    return { points, length, reaches: reach[i]!, breakAt, corner: { x: ax, y: reach[i] && dir[i] !== 0 ? bus[i]! : CABLE.stub } };
  });
}

/** The hero's service labels (DESIGN.md Layout, Landing): boxes this tall, this far from the top and the right edge, this far apart. */
export const HERO_LABEL = { top: 14, h: 22, right: 24, gap: 14, minGap: 6 } as const;

type Box = { x: number; y: number; w: number; h: number };

/**
 * The hero's labels as one row along the top, in card order left to right, right-aligned (the board is cropped
 * on the right, the copy is on the left). Gaps shrink toward `minGap` when the row would not fit; each cable
 * drops from the centre of its label's bottom edge.
 */
export function labelRow(widths: number[], viewW: number): Box[] {
  const total = widths.reduce((a, b) => a + b, 0);
  const room = viewW - HERO_LABEL.right - total;
  const gap = Math.max(HERO_LABEL.minGap, Math.min(HERO_LABEL.gap, room / Math.max(1, widths.length)));
  let x = Math.max(0, viewW - HERO_LABEL.right - total - gap * (widths.length - 1));
  return widths.map((w) => {
    const b = { x, y: HERO_LABEL.top, w, h: HERO_LABEL.h };
    x += w + gap;
    return b;
  });
}

/** An entry post is drawn at least this tall on screen, px, so it reads as a post at any zoom (overlay.ts). */
export const POST_MIN_H = 13;

/** The top of an entry post on screen, where its cable plugs in: the post's own height, or `POST_MIN_H` where that is smaller. */
export function postTop(post: Vec3, cam: Camera): Pt {
  const foot = project(post, cam);
  const top = project({ ...post, z: ENTRY_POST_H }, cam);
  return { x: top.sx, y: Math.min(top.sy, foot.sy - POST_MIN_H) };
}
