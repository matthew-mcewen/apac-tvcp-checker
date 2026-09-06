<?php

require __DIR__ . '/../lib/config.php';
require __DIR__ . '/../lib/vatsim.php';
require __DIR__ . '/../lib/eligibility.php';

header('Content-Type: application/json');

const MIN_CID = 800001;
const MAX_CID = 9999999;

function tvcp_parse_cid(?string $raw): ?int
{
    if ($raw === null || !preg_match('/^\d+$/', $raw)) {
        return null;
    }
    $cid = (int) $raw;
    if ($cid < MIN_CID || $cid > MAX_CID) {
        return null;
    }
    return $cid;
}

$cid = tvcp_parse_cid($_GET['cid'] ?? null);
if ($cid === null) {
    http_response_code(400);
    echo json_encode(['error' => 'CID must be an integer between ' . MIN_CID . ' and ' . MAX_CID . '.']);
    exit;
}

$config = tvcp_load_config();

try {
    $member = vatsim_get_member_details($cid);
    $stats = vatsim_get_member_stats($cid);
    $result = tvcp_evaluate_eligibility($member, $stats, $config['tvcp']);

    echo json_encode([
        'member' => [
            'id' => $member['id'],
            'rating' => $result['ratingName'],
            'region' => $member['region_id'] ?? null,
            'division' => $member['division_id'] ?? null,
            'subdivision' => $member['subdivision_id'] ?? null,
            'lastRatingChange' => $member['lastratingchange'] ?? null,
        ],
        'eligible' => $result['eligible'],
        'findings' => $result['findings'],
    ]);
} catch (VatsimNotFoundError $e) {
    http_response_code(404);
    echo json_encode(['error' => 'No VATSIM member found with that CID.']);
} catch (Throwable $e) {
    error_log($e->getMessage());
    http_response_code(502);
    echo json_encode(['error' => 'Unable to reach the VATSIM API. Please try again shortly.']);
}
