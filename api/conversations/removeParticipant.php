<?php
// DELETE /api/conversations/{conversationId}/participants/{userId} (via rewrite)
header('Content-Type: application/json');
$conversationId = isset($_GET['conversationId']) ? $_GET['conversationId'] : 'c_demo_1';
$userId = isset($_GET['userId']) ? $_GET['userId'] : 'u_alex';
echo json_encode(['ok' => true]);

