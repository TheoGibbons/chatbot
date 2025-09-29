<?php
// POST /api/messages/draft  (save)
// GET  /api/messages/draft?conversationId=...  (fetch)
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'POST') {
  // Save draft (demo: always ok)
  $raw = file_get_contents('php://input');
  $data = json_decode($raw, true) ?: [];
  // $conversationId = $data['conversationId'] ?? null;
  // $text = $data['text'] ?? '';
  // $attachments = $data['attachments'] ?? [];
  echo json_encode([ 'ok' => true ]);
  exit;
}
if ($method === 'GET') {
  // Fetch draft for conversationId (demo returns empty draft)
  $conversationId = isset($_GET['conversationId']) ? $_GET['conversationId'] : '';
  $response = [ 'ok' => true, 'draft' => [ 'text' => '', 'attachments' => [] ] ];
  echo json_encode($response);
  exit;
}

http_response_code(405);
echo json_encode([ 'ok' => false, 'error' => 'method_not_allowed' ]);
