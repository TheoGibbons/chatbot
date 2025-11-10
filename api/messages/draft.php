<?php
/**
 * Method: POST | GET
 * Path: /api/messages/draft.php
 * POST Body JSON params:
 * - conversationId: string|null
 * - text: string
 * - attachments: array
 * GET Query params:
 * - conversationId: string
 * Examples:
 * // POST: $conversationId = !empty($data['conversationId']) ? $data['conversationId'] : null;
 * // POST: $text = !empty($data['text']) ? $data['text'] : '';
 * // POST: $attachments = !empty($data['attachments']) ? $data['attachments'] : [];
 * // GET:  $conversationId = !empty($_GET['conversationId']) ? $_GET['conversationId'] : '';
 */
// POST /api/messages/draft  (save)
// GET  /api/messages/draft?conversationId=...  (fetch)
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'POST') {
  // Save draft (demo: always ok)
  $raw = file_get_contents('php://input');
  $data = json_decode($raw, true) ?: [];
  // $conversationId = !empty($data['conversationId']) ? $data['conversationId'] : null;
  // $text = !empty($data['text']) ? $data['text'] : '';
  // $attachments = !empty($data['attachments']) ? $data['attachments'] : [];
  echo json_encode([ 'ok' => true ]);
  exit;
}
if ($method === 'GET') {
  // Fetch draft for conversationId (demo returns empty draft)
  $conversationId = !empty($_GET['conversationId']) ? $_GET['conversationId'] : '';
  $response = [ 'ok' => true, 'draft' => [ 'text' => '', 'attachments' => [] ] ];
  echo json_encode($response);
  exit;
}

http_response_code(405);
echo json_encode([ 'ok' => false, 'error' => 'method_not_allowed' ]);
