<?php

function tvcp_load_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $path = __DIR__ . '/../config.json';
    if (!is_file($path)) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'config.json is missing. Copy config.example.json to config.json and fill it in.']);
        exit;
    }

    $raw = file_get_contents($path);
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'config.json is not valid JSON.']);
        exit;
    }

    $config = $decoded;
    return $config;
}
