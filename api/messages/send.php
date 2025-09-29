<?php
/**
 * Method: POST
 * Path: /api/messages/send.php
 * Body JSON params:
 * - conversationId: string|null
 * - text: string|null
 * - attachments: array
 * - channels: array (e.g., { sms?: bool, whatsapp?: bool, email?: bool })
 * - scheduleIn: number|null (seconds)
 * Examples:
 * // $conversationId = !empty($data['conversationId']) ? $data['conversationId'] : null;
 * // $text = !empty($data['text']) ? $data['text'] : null;
 * // $attachments = !empty($data['attachments']) ? $data['attachments'] : [];
 * // $channels = !empty($data['channels']) ? $data['channels'] : [];
 * // $scheduleIn = !empty($data['scheduleIn']) ? $data['scheduleIn'] : null;
 */

header('Content-Type: application/json');

// POST /api/messages/send
$now = gmdate('c');

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
$conversationId = !empty($data['conversationId']) ? $data['conversationId'] : null;
$text = !empty($data['text']) ? $data['text'] : null;
$attachments = !empty($data['attachments']) ? $data['attachments'] : [];
$channels = !empty($data['channels']) ? $data['channels'] : [];
$scheduleIn = !empty($data['scheduleIn']) ? $data['scheduleIn'] : null;

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
