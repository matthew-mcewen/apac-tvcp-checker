<?php

require __DIR__ . '/../lib/config.php';
require __DIR__ . '/../lib/vatsim.php';
require __DIR__ . '/../lib/eligibility.php';
require __DIR__ . '/../lib/delivery.php';

header('Content-Type: application/json');

const MIN_CID = 800001;
const MAX_CID = 9999999;

function tvcp_parse_cid_from_body($raw): ?int
{
    if ($raw === null || !preg_match('/^\d+$/', (string) $raw)) {
        return null;
    }
    $cid = (int) $raw;
    if ($cid < MIN_CID || $cid > MAX_CID) {
        return null;
    }
    return $cid;
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    $body = [];
}

$cid = tvcp_parse_cid_from_body($body['cid'] ?? null);
if ($cid === null) {
    http_response_code(400);
    echo json_encode(['error' => 'CID must be an integer between ' . MIN_CID . ' and ' . MAX_CID . '.']);
    exit;
}
if (($body['consent'] ?? null) !== true) {
    http_response_code(400);
    echo json_encode(['error' => 'Consent is required to submit an application.']);
    exit;
}

$config = tvcp_load_config();

try {
    $member = vatsim_get_member_details($cid);
    $stats = vatsim_get_member_stats($cid);
    $result = tvcp_evaluate_eligibility($member, $stats, $config['tvcp']);
} catch (VatsimNotFoundError $e) {
    http_response_code(404);
    echo json_encode(['error' => 'No VATSIM member found with that CID.']);
    exit;
} catch (Throwable $e) {
    error_log($e->getMessage());
    http_response_code(502);
    echo json_encode(['error' => 'Unable to reach the VATSIM API. Please try again shortly.']);
    exit;
}

if (!$result['eligible']) {
    http_response_code(409);
    echo json_encode(['error' => 'This CID is no longer eligible.', 'findings' => $result['findings']]);
    exit;
}

$deliveryErrors = [];

$discordConfig = $config['delivery']['discord'] ?? ['enabled' => false];
if (!empty($discordConfig['enabled'])) {
    if (empty($discordConfig['webhook_url'])) {
        $deliveryErrors[] = 'Discord delivery is enabled but the webhook URL is not configured.';
    } else {
        try {
            tvcp_send_discord_notification($discordConfig['webhook_url'], $member, $result['ratingName'], $result['hoursOnCurrentRating']);
        } catch (Throwable $e) {
            error_log($e->getMessage());
            $deliveryErrors[] = 'Failed to post the Discord notification.';
        }
    }
}

$sheetsConfig = $config['delivery']['google_sheets'] ?? ['enabled' => false];
if (!empty($sheetsConfig['enabled'])) {
    if (empty($sheetsConfig['webhook_url'])) {
        $deliveryErrors[] = 'Google Sheets delivery is enabled but the webhook URL is not configured.';
    } else {
        try {
            tvcp_send_google_sheets_row($sheetsConfig['webhook_url'], $member, $result['ratingName']);
        } catch (Throwable $e) {
            error_log($e->getMessage());
            $deliveryErrors[] = 'Failed to record the application in Google Sheets.';
        }
    }
}

if (count($deliveryErrors) > 0) {
    http_response_code(502);
    echo json_encode(['error' => 'Application could not be fully delivered.', 'findings' => $deliveryErrors]);
    exit;
}

echo json_encode(['success' => true]);
