<?php
// POST /api/messages/edit
// Body: { id: string, newText: string }
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode([ 'ok' => false, 'error' => 'method_not_allowed' ]);
  exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
$id = isset($data['id']) ? $data['id'] : null;
$newText = isset($data['newText']) ? $data['newText'] : null;

// Demo only: no persistence; always return ok
// In a real implementation, validate $id, update message text, and return result

echo json_encode([ 'ok' => true ]);
