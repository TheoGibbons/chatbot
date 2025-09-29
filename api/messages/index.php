<?php
/**
 * Method: GET
 * Path: /api/messages/index.php?since={timestamp}
 * Query params:
 * - since: string (ISO8601 timestamp)
 * Examples:
 * // $since = !empty($_GET['since']) ? $_GET['since'] : '';
 */

header('Content-Type: application/json');

// $since = !empty($_GET['since']) ? $_GET['since'] : '';
$since = !empty($_GET['since']) ? $_GET['since'] : '';
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
