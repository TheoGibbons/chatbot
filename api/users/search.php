<?php
// GET /api/users/search?q=...
header('Content-Type: application/json');
$q = isset($_GET['q']) ? $_GET['q'] : '';
echo json_encode([
    'ok'      => true,
    'results' => [
        ['userId' => 'u_alex', 'name' => 'Alex', 'online' => true],
        ['userId' => 'u_sam', 'name' => 'Sam', 'online' => false],
        ['userId' => 'u_jamie', 'name' => 'Jamie', 'online' => true]
    ]
]);

