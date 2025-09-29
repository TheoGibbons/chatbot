<?php
/**
 * Method: GET
 * Path: /api/messages/draft.php?conversationId={conversationId}
 * Query params:
 * - conversationId: string
 * Examples:
 * // $conversationId = !empty($_GET['conversationId']) ? $_GET['conversationId'] : '';
 */

header('Content-Type: application/json');

$conversationId = !empty($_GET['conversationId']) ? $_GET['conversationId'] : 'c_general';

echo json_encode([
    'ok'    => true,
    'draft' => ['text' => '', 'attachments' => []]
]);
