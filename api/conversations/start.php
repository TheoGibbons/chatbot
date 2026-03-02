<?php
/**
 * Method: POST
 * Path: /api/conversations/start.php
 * Body JSON params:
 * - participants: string[]
 * Examples:
 * // $participants = !empty($data['participants']) ? $data['participants'] : [];
 */

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode([ 'ok' => false, 'error' => 'method_not_allowed' ]);
  exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true) ?: [];
$participants = !empty($data['participants']) ? $data['participants'] : [];

$now = gmdate('c');

echo json_encode([
    'ok'           => true,
    'conversation' => [
        'id'           => 'c_demo_1',
        'name'         => 'Chat with Alex',
        'participants' => ['me', 'u_alex'],
        'createdAt'    => $now,
        'updatedAt'    => $now
    ]
]);
