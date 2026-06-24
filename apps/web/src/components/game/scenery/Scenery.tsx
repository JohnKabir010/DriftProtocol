"use client";

import { useMemo } from "react";
import type { Track, TrackTheme } from "@drift/shared";
import { hashSeed, mulberry32, ringPoints, scatterPoints } from "./scatter";
import { GrassTufts, Mounds, Peaks, PineTrees, Rocks, WaterPatches } from "./props";
import { CanyonWalls } from "./CanyonWalls";
import { NeonStreet } from "./NeonStreet";
import { Rain } from "./Rain";

/**
 * Per-theme 3D environment, composed from instanced primitives with
 * deterministic seeded placement (track id = seed). All placement respects a
 * clearance band around the racing line — scenery can never block the road.
 * City themes keep CityBlocks (rendered by RaceScene); this adds everything
 * beyond the skyline.
 */
export function Scenery({ track, theme }: { track: Track; theme: TrackTheme }) {
  // One RNG per theme component tree; every useMemo below derives from it
  // deterministically because the seed is the track id.
  const points = useMemo(() => {
    const rng = mulberry32(hashSeed(`${track.def.id}:${theme}`));
    switch (theme) {
      case "forest":
        return {
          treesDense: scatterPoints(track, rng, { count: 340, clearance: 6, margin: 90 }),
          rocks: scatterPoints(track, rng, { count: 36, clearance: 4, margin: 40 }),
          water: scatterPoints(track, rng, { count: 3, clearance: 26, margin: 50 }),
          grass: scatterPoints(track, rng, { count: 420, clearance: 1.5, margin: 35, maxDistance: 55 }),
        };
      case "mountain":
        return {
          peaks: ringPoints(track, rng, { count: 18, minRadius: 240, maxRadius: 360 }),
          trees: scatterPoints(track, rng, { count: 130, clearance: 7, margin: 70 }),
          rocks: scatterPoints(track, rng, { count: 70, clearance: 4, margin: 60 }),
        };
      case "hills":
        return {
          mounds: scatterPoints(track, rng, { count: 38, clearance: 22, margin: 110 }),
          trees: scatterPoints(track, rng, { count: 90, clearance: 8, margin: 80 }),
          rocks: scatterPoints(track, rng, { count: 26, clearance: 5, margin: 50 }),
          ridge: ringPoints(track, rng, { count: 12, minRadius: 260, maxRadius: 340 }),
          grass: scatterPoints(track, rng, { count: 300, clearance: 1.5, margin: 30, maxDistance: 50 }),
        };
      case "canyon":
        return {
          rocks: scatterPoints(track, rng, { count: 90, clearance: 5, margin: 70 }),
        };
      default:
        return {};
    }
  }, [track, theme]);

  switch (theme) {
    case "forest":
      return (
        <group>
          <PineTrees points={points.treesDense!} canopyColor="#1d3a24" />
          <Rocks points={points.rocks!} color="#3c4038" />
          <WaterPatches points={points.water!} color="#0d1d28" />
          <GrassTufts points={points.grass!} color="#2f4a2c" />
        </group>
      );

    case "mountain":
      return (
        <group>
          <Peaks
            points={points.peaks!}
            color="#39414c"
            snowColor="#dde6ee"
            minHeight={55}
            maxHeight={130}
          />
          <PineTrees points={points.trees!} canopyColor="#22382c" scale={0.9} />
          <Rocks points={points.rocks!} color="#4d4f54" />
        </group>
      );

    case "hills":
      return (
        <group>
          <Mounds points={points.mounds!} color="#251b29" />
          <Peaks points={points.ridge!} color="#2c1f33" minHeight={30} maxHeight={70} />
          <PineTrees points={points.trees!} canopyColor="#2e2030" trunkColor="#1d1418" scale={0.85} />
          <Rocks points={points.rocks!} color="#352a38" />
          <GrassTufts points={points.grass!} color="#3a2a3a" />
        </group>
      );

    case "canyon":
      return (
        <group>
          <CanyonWalls track={track} />
          <Rocks points={points.rocks!} color="#7a4526" />
        </group>
      );

    case "rain-city":
      return (
        <group>
          <Rain track={track} />
          <NeonStreet track={track} />
        </group>
      );

    case "neon-city":
      return <NeonStreet track={track} />; // CityBlocks carries the skyline

    default:
      return null;
  }
}
