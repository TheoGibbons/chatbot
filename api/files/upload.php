<?php
// POST /api/files/upload
header('Content-Type: application/json');
$name = isset($_FILES['file']['name']) ? $_FILES['file']['name'] : 'demo.txt';
$size = isset($_FILES['file']['size']) ? intval($_FILES['file']['size']) : 1234;
$type = isset($_FILES['file']['type']) ? $_FILES['file']['type'] : 'application/octet-stream';
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

