<?php
/**
 * Method: POST
 * Path: /api/messages/markAsRead.php
 * Body JSON params:
 * - conversationId: string|null
 * - messageIds: array
 * Examples:
 * // $conversationId = !empty($data['conversationId']) ? $data['conversationId'] : null;
 * // $messageIds = !empty($data['messageIds']) ? $data['messageIds'] : [];
 */

header('Content-Type: application/json');

$raw = file_get_contents('php://input');
$data = json_decode($raw, true) ?: [];
$conversationId = !empty($data['conversationId']) ? $data['conversationId'] : null;
$messageIds = !empty($data['messageIds']) ? $data['messageIds'] : [];

echo json_encode(['ok' => true]);
