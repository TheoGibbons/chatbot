<?php
/**
 * Method: POST
 * Path: /api/messages/canDelete.php
 * Body JSON params:
 * - id: string
 */
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode([ 'ok' => false, 'error' => 'method_not_allowed' ]);
  exit;
}
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
$id = !empty($data['id']) ? $data['id'] : null;
// Placeholder implemention; server should implement true rule
// Users can delete only if there is no newer message: here we just return true for demo

echo json_encode([ 'ok' => true, 'can' => true ]);

