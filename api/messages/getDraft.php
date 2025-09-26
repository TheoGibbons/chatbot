<?php
// GET /api/messages/{conversationId}/draft (via rewrite)
header('Content-Type: application/json');
$conversationId = isset($_GET['conversationId']) ? $_GET['conversationId'] : 'c_general';
echo json_encode([
    'ok'    => true,
    'draft' => ['text' => '', 'attachments' => []]
]);

