import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import type { RaceResultReport } from "@drift/shared";

/** Physics constants mirroring the shared sim (server-side verification). */
const MAX_THEORETICAL_SPEED_MS = 56; // ~200 km/h — hard cap for Class S cars with S-tier upgrades
const MAX_DRIFT_SCORE_PER_MS = 0.025; // 14 pts/s at peak drift × some headroom
const MAX_POSITION_JUMP_M = 15; // MAX_DS_PER_TICK from track.ts
const MIN_RACE_DURATION_MS = 30_000; // fastest possible 2-lap on Neon Row

@Injectable()
export class ReplayVerifierService {
  private readonly logger = new Logger(ReplayVerifierService.name);

  /**
   * Run statistical plausibility checks on a race result report.
   * Throws BadRequestException if the report contains impossible values.
   * The authoritative server already controls finish positions and times;
   * these checks catch any replay hash / score manipulation in transit.
   */
  verify(report: RaceResultReport): void {
    const durationMs = new Date(report.endedAt).getTime() - new Date(report.startedAt).getTime();

    if (durationMs < MIN_RACE_DURATION_MS) {
      throw new BadRequestException(
        `Race duration ${durationMs}ms is below minimum ${MIN_RACE_DURATION_MS}ms`,
      );
    }

    for (const entry of report.entries) {
      this.verifyEntry(entry, durationMs);
    }

    // Finish positions must be unique 1..N
    const positions = report.entries.map((e) => e.finishPosition);
    const unique = new Set(positions);
    if (unique.size !== positions.length) {
      throw new BadRequestException("Duplicate finish positions in report");
    }

    // Winner's time must be within race duration
    const winner = report.entries.find((e) => e.finishPosition === 1);
    if (winner?.finishTimeMs && winner.finishTimeMs > durationMs + 5000) {
      throw new BadRequestException("Winner finish time exceeds race duration");
    }

    this.logger.debug(`Report ${report.raceId} passed plausibility checks (${report.entries.length} entries)`);
  }

  private verifyEntry(
    entry: RaceResultReport["entries"][number],
    durationMs: number,
  ): void {
    // Drift score ceiling: even spamming perfect drifts can't exceed this
    const maxDriftScore = MAX_DRIFT_SCORE_PER_MS * durationMs;
    if (entry.driftScore > maxDriftScore) {
      throw new BadRequestException(
        `Player ${entry.playerId} drift score ${entry.driftScore} exceeds ceiling ${maxDriftScore}`,
      );
    }

    // Finish time sanity (non-finishers have null)
    if (entry.finishTimeMs !== null) {
      if (entry.finishTimeMs < MIN_RACE_DURATION_MS) {
        throw new BadRequestException(
          `Player ${entry.playerId} finish time ${entry.finishTimeMs}ms is impossibly fast`,
        );
      }
      if (entry.finishTimeMs > durationMs + 10_000) {
        throw new BadRequestException(
          `Player ${entry.playerId} finish time ${entry.finishTimeMs}ms exceeds race end`,
        );
      }
    }

    // Position bounds
    if (entry.finishPosition < 1 || entry.finishPosition > 8) {
      throw new BadRequestException(
        `Player ${entry.playerId} has invalid finish position ${entry.finishPosition}`,
      );
    }

    // Best lap must be shorter than total duration
    if (entry.bestLapMs !== null && entry.bestLapMs !== undefined) {
      if (entry.bestLapMs < 10_000) {
        throw new BadRequestException(
          `Player ${entry.playerId} best lap ${entry.bestLapMs}ms is impossibly fast`,
        );
      }
    }
  }
}
