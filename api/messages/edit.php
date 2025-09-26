<?php
// POST /api/messages/{id}/edit (via rewrite to this file with ?id=...)
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

$id = isset($_GET['id']) ? $_GET['id'] : null; // not used but captured for completeness
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
$newText = isset($data['newText']) ? $data['newText'] : null; // not used in demo response

echo json_encode(['ok' => true]);

