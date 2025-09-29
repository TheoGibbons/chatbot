<?php
/**
 * Method: POST
 * Path: /api/conversations/addParticipant.php
 * Body JSON params:
 * - conversationId: string|null
 * - userId: string|null
 * Examples:
 * // $conversationId = !empty($data['conversationId']) ? $data['conversationId'] : null;
 * // $userId = !empty($data['userId']) ? $data['userId'] : null;
 */

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode([ 'ok' => false, 'error' => 'method_not_allowed' ]);
  exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true) ?: [];
$conversationId = !empty($data['conversationId']) ? $data['conversationId'] : null;
$userId = !empty($data['userId']) ? $data['userId'] : null;

echo json_encode([ 'ok' => true ]);
