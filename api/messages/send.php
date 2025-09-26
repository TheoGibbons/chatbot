<?php
header('Content-Type: application/json');
// POST /api/messages/send
$now = gmdate('c');
echo json_encode([
    'ok'      => true,
    'message' => [
        'id'             => 'm_demo_1',
        'conversationId' => 'c_general',
        'authorId'       => 'me',
        'text'           => 'Hello from PHP demo',
        'createdAt'      => $now,
        'updatedAt'      => $now,
        'attachments'    => [],
        'channels'       => ['sms' => false, 'whatsapp' => true, 'email' => false],
        'seenBy'         => []
    ]
]);

