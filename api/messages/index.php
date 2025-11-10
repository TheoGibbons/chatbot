<?php
/**
 * Method: GET
 * Path: /api/messages/index.php?since={timestamp}
 * Query params:
 * - since: string (ISO8601 timestamp)
 */

header('Content-Type: application/json');

// $since = !empty($_GET['since']) ? $_GET['since'] : '';
$since = !empty($_GET['since']) ? $_GET['since'] : '';
$now = gmdate('c');

// Sample conversations (2)
$conversations = [
    [
        'id'           => 'c_general',
        'name'         => 'General',
        'participants' => ['me', 'u_alex', 'u_jamie'],
        'createdAt'    => $now,
        'updatedAt'    => $now,
    ],
    [
        'id'           => 'c_support',
        'name'         => 'Support',
        'participants' => ['me', 'u_sam'],
        'createdAt'    => $now,
        'updatedAt'    => $now,
    ],
];

// Sample messages (2) matching conversations
$messages = [
    [
        'id'             => 'm_demo_1',
        'conversationId' => 'c_general',
        'authorId'       => 'u_alex',
        'text'           => 'Welcome to the PHP demo!',
        'createdAt'      => $now,
        'updatedAt'      => $now,
        'attachments'    => [],
        'channels'       => ['sms' => false, 'whatsapp' => true, 'email' => false],
        'seenBy'         => [['userId' => 'me', 'at' => $now]]
    ],
    [
        'id'             => 'm_demo_2',
        'conversationId' => 'c_support',
        'authorId'       => 'me',
        'text'           => 'I need assistance with my order.',
        'createdAt'      => $now,
        'updatedAt'      => $now,
        'attachments'    => [],
        'channels'       => ['sms' => true, 'whatsapp' => false, 'email' => true],
        'seenBy'         => []
    ],
];

// Sample typing indicators (2)
$typing = [
    ['conversationId' => 'c_general', 'userId' => 'u_alex'],
    ['conversationId' => 'c_support', 'userId' => 'u_sam'],
];

// Presence remains as before
$presence = [
    ['userId' => 'me', 'online' => true],
    ['userId' => 'u_alex', 'online' => true],
    ['userId' => 'u_sam', 'online' => false],
    ['userId' => 'u_jamie', 'online' => true],
];

echo json_encode([
    'ok'         => true,
    'changes'    => [
        'messages'      => $messages,
        'conversations' => $conversations,
        'typing'        => $typing,
        'presence'      => $presence,
    ],
    'serverTime' => $now
]);
