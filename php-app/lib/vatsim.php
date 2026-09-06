<?php

const VATSIM_BASE_URL = 'https://api.vatsim.net/v2';

class VatsimNotFoundError extends Exception
{
}

class VatsimApiError extends Exception
{
}

function vatsim_get(string $path): array
{
    $ch = curl_init(VATSIM_BASE_URL . $path);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_TIMEOUT => 10,
    ]);
    $body = curl_exec($ch);
    if ($body === false) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new VatsimApiError("VATSIM API request to {$path} failed: {$error}");
    }
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($status === 404) {
        throw new VatsimNotFoundError("VATSIM member not found for {$path}");
    }
    if ($status < 200 || $status >= 300) {
        throw new VatsimApiError("VATSIM API request to {$path} failed: HTTP {$status}");
    }

    $data = json_decode($body, true);
    if (!is_array($data)) {
        throw new VatsimApiError("VATSIM API request to {$path} returned invalid JSON");
    }
    return $data;
}

function vatsim_get_member_details(int $cid): array
{
    return vatsim_get("/members/{$cid}");
}

function vatsim_get_member_stats(int $cid): array
{
    return vatsim_get("/members/{$cid}/stats");
}
