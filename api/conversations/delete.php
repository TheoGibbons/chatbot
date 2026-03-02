<?php
/**
 * Method: POST
 * Path: /api/conversations/delete.php
 * Body JSON params:
 * - conversationId: string
 * Examples:
 * // $conversationId = !empty($data['conversationId']) ? $data['conversationId'] : null;
 */
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode([ 'ok' => false, 'error' => 'method_not_allowed' ]);
  exit;
}
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
$conversationId = !empty($data['conversationId']) ? $data['conversationId'] : null;
// Placeholder: soft-delete the conversation and its messages
echo json_encode([ 'ok' => true ]);
