<?php

function tvcp_region_path(array $member): string
{
    $parts = array_filter([
        $member['region_id'] ?? null,
        $member['division_id'] ?? null,
        $member['subdivision_id'] ?? null,
    ]);
    return implode(' / ', $parts);
}

function tvcp_post_json(string $url, array $payload): void
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT => 10,
    ]);
    curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        throw new Exception("Request to {$url} failed: {$error}");
    }
    if ($status < 200 || $status >= 300) {
        throw new Exception("Request to {$url} failed: HTTP {$status}");
    }
}

function tvcp_send_discord_notification(string $webhookUrl, array $member, string $ratingName, float $hoursOnCurrentRating): void
{
    $regionPath = tvcp_region_path($member);

    tvcp_post_json($webhookUrl, [
        'embeds' => [[
            'title' => 'New Specialists Application',
            'color' => 0x0d6efd,
            'fields' => [
                ['name' => 'CID', 'value' => (string) $member['id'], 'inline' => true],
                ['name' => 'Rating', 'value' => $ratingName, 'inline' => true],
                ['name' => "Hours on current rating ({$ratingName})", 'value' => (string) (int) round($hoursOnCurrentRating), 'inline' => true],
                ['name' => 'Region / Division / Subdivision', 'value' => $regionPath ?: 'unknown', 'inline' => false],
                ['name' => 'Last rating change', 'value' => $member['lastratingchange'] ?? 'unknown', 'inline' => false],
            ],
        ]],
    ]);
}

function tvcp_send_google_sheets_row(string $webhookUrl, array $member, string $ratingName): void
{
    tvcp_post_json($webhookUrl, [
        'cid' => $member['id'],
        'rating' => $ratingName,
        'region_path' => tvcp_region_path($member) ?: 'unknown',
        'last_rating_change' => $member['lastratingchange'] ?? 'unknown',
        'submitted_at' => gmdate('c'),
    ]);
}
