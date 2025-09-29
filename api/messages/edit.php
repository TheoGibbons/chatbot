<?php
/**
 * Method: POST
 * Path: /api/messages/edit.php
 * Body JSON params:
 * - id: string
 * - newText: string
 * Examples:
 * // $id = !empty($data['id']) ? $data['id'] : null;
 * // $newText = !empty($data['newText']) ? $data['newText'] : null;
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
$newText = !empty($data['newText']) ? $data['newText'] : null;

echo json_encode([ 'ok' => true ]);
