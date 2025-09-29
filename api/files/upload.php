<?php
/**
 * Method: POST (multipart/form-data)
 * Path: /api/files/upload.php
 * Form fields:
 * - file: uploaded file (name, size, type)
 * Examples:
 * // $fileName = !empty($_FILES['file']['name']) ? $_FILES['file']['name'] : null;
 * // $fileSize = !empty($_FILES['file']['size']) ? intval($_FILES['file']['size']) : null;
 * // $fileType = !empty($_FILES['file']['type']) ? $_FILES['file']['type'] : null;
 */

header('Content-Type: application/json');

$name = !empty($_FILES['file']['name']) ? $_FILES['file']['name'] : 'demo.txt';
$size = !empty($_FILES['file']['size']) ? intval($_FILES['file']['size']) : 1234;
$type = !empty($_FILES['file']['type']) ? $_FILES['file']['type'] : 'application/octet-stream';

echo json_encode([
    'ok'         => true,
    'attachment' => [
        'id'   => 'att_demo_1',
        'name' => $name,
        'size' => $size,
        'type' => $type,
        'url'  => '/api/files/tmp/att_demo_1'
    ]
]);
