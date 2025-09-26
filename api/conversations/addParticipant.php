<?php
// POST /api/conversations/{conversationId}/participants (via rewrite)
header('Content-Type: application/json');
$conversationId = isset($_GET['conversationId']) ? $_GET['conversationId'] : 'c_demo_1';
echo json_encode(['ok' => true]);

