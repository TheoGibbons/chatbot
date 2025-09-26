<?php
// GET /api/messages?since={timestamp}
header('Content-Type: application/json');
$since = isset($_GET['since']) ? $_GET['since'] : '';
$now = gmdate('c');
echo json_encode([
    'ok'         => true,
    'changes'    => [
        'messages'      => [],
        'conversations' => [],
        'typing'        => [],
        'presence'      => [
            ['userId' => 'me', 'online' => true],
            ['userId' => 'u_alex', 'online' => true],
            ['userId' => 'u_sam', 'online' => false],
            ['userId' => 'u_jamie', 'online' => true],
        ]
    ],
    'serverTime' => $now
]);

