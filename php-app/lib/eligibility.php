<?php

const RATING_NAMES = [
    'SUS', 'OBS', 'S1', 'S2', 'S3', 'C1', 'C2', 'C3', 'I1', 'I2', 'I3', 'SUP', 'ADM',
];

const STATS_KEY_BY_RATING = [
    'S1' => 's1', 'S2' => 's2', 'S3' => 's3',
    'C1' => 'c1', 'C2' => 'c2', 'C3' => 'c3',
    'I1' => 'i1', 'I2' => 'i2', 'I3' => 'i3',
    'SUP' => 'sup', 'ADM' => 'adm',
];

function tvcp_rating_name(int $rating): string
{
    if (!isset(RATING_NAMES[$rating])) {
        throw new Exception("Unknown VATSIM rating value: {$rating}");
    }
    return RATING_NAMES[$rating];
}

/**
 * @return array{eligible: bool, findings: string[], ratingName: string, hoursOnCurrentRating: float}
 */
function tvcp_evaluate_eligibility(array $member, array $stats, array $config): array
{
    $findings = [];
    $currentRating = tvcp_rating_name((int) $member['rating']);

    $minIndex = array_search($config['minimum_rating'], RATING_NAMES, true);
    $currentIndex = array_search($currentRating, RATING_NAMES, true);
    if ($currentIndex < $minIndex) {
        $findings[] = "Current rating ({$currentRating}) is below the minimum required ({$config['minimum_rating']}).";
    }

    $lastRatingChange = $member['lastratingchange'] ?? null;
    if ($lastRatingChange) {
        $daysSinceRatingChange = (int) floor((time() - strtotime($lastRatingChange)) / 86400);
    } else {
        $daysSinceRatingChange = PHP_INT_MAX;
    }
    if ($daysSinceRatingChange < $config['minimum_rating_change_days']) {
        $findings[] = "Current rating was only changed {$daysSinceRatingChange} day(s) ago " .
            "(minimum {$config['minimum_rating_change_days']} days required for consolidation).";
    }

    $statsKey = STATS_KEY_BY_RATING[$currentRating] ?? null;
    $hoursOnCurrentRating = $statsKey ? (float) ($stats[$statsKey] ?? 0) : 0.0;
    if ($hoursOnCurrentRating < $config['minimum_consolidated_hours']) {
        $hoursFormatted = number_format($hoursOnCurrentRating, 1);
        $findings[] = "Only {$hoursFormatted} hour(s) logged on the current rating " .
            "(minimum {$config['minimum_consolidated_hours']} hours required).";
    }

    // "No region changes in the last 90 days" is a TVCP requirement, but the VATSIM
    // Core API does not expose region-change history (only lastratingchange). Not enforced
    // yet — revisit once a data source (e.g. historical snapshots) is available.

    return [
        'eligible' => count($findings) === 0,
        'findings' => $findings,
        'ratingName' => $currentRating,
        'hoursOnCurrentRating' => $hoursOnCurrentRating,
    ];
}
