<?php
// POST /api/conversations/addParticipant.php
// Body: { conversationId: string, userId: string }
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode([ 'ok' => false, 'error' => 'method_not_allowed' ]);
  exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true) ?: [];
$conversationId = isset($data['conversationId']) ? $data['conversationId'] : null;
$userId = isset($data['userId']) ? $data['userId'] : null;

// Demo: no-op, always ok
// In real code, add $userId to $conversationId

echo json_encode([ 'ok' => true ]);
