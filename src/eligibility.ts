import type { MemberDetails, MemberStats } from "./vatsim";

export const RATING_NAMES = [
  "SUS", "OBS", "S1", "S2", "S3", "C1", "C2", "C3", "I1", "I2", "I3", "SUP", "ADM",
] as const;

export type RatingName = (typeof RATING_NAMES)[number];

const STATS_KEY_BY_RATING: Partial<Record<RatingName, keyof MemberStats>> = {
  S1: "s1", S2: "s2", S3: "s3",
  C1: "c1", C2: "c2", C3: "c3",
  I1: "i1", I2: "i2", I3: "i3",
  SUP: "sup", ADM: "adm",
};

export interface TvcpConfig {
  minimum_rating: RatingName;
  minimum_rating_change_days: number;
  minimum_consolidated_hours: number;
}

export interface EligibilityResult {
  eligible: boolean;
  findings: string[];
  ratingName: RatingName;
}

export function ratingName(rating: number): RatingName {
  const name = RATING_NAMES[rating];
  if (!name) throw new Error(`Unknown VATSIM rating value: ${rating}`);
  return name;
}

export function evaluateEligibility(
  member: MemberDetails,
  stats: MemberStats,
  config: TvcpConfig,
): EligibilityResult {
  const findings: string[] = [];
  const currentRating = ratingName(member.rating);

  const minIndex = RATING_NAMES.indexOf(config.minimum_rating);
  const currentIndex = RATING_NAMES.indexOf(currentRating);
  if (currentIndex < minIndex) {
    findings.push(
      `Current rating (${currentRating}) is below the minimum required (${config.minimum_rating}).`,
    );
  }

  const daysSinceRatingChange = member.lastratingchange
    ? Math.floor((Date.now() - new Date(member.lastratingchange).getTime()) / 86_400_000)
    : Number.POSITIVE_INFINITY;
  if (daysSinceRatingChange < config.minimum_rating_change_days) {
    findings.push(
      `Current rating was only changed ${daysSinceRatingChange} day(s) ago ` +
        `(minimum ${config.minimum_rating_change_days} days required for consolidation).`,
    );
  }

  const statsKey = STATS_KEY_BY_RATING[currentRating];
  const hoursOnCurrentRating = statsKey ? stats[statsKey] : 0;
  if (hoursOnCurrentRating < config.minimum_consolidated_hours) {
    findings.push(
      `Only ${hoursOnCurrentRating.toFixed(1)} hour(s) logged on the current rating ` +
        `(minimum ${config.minimum_consolidated_hours} hours required).`,
    );
  }

  // TODO: "No region changes in the last 90 days" is a TVCP requirement, but the VATSIM
  // Core API does not expose region-change history (only `lastratingchange`). Not enforced
  // yet — revisit once a data source (e.g. our own historical snapshots) is available.

  return { eligible: findings.length === 0, findings, ratingName: currentRating };
}
