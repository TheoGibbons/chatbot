<?php
// POST /api/conversations/start
header('Content-Type: application/json');
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

