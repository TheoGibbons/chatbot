<?php
/**
 * Method: GET
 * Path: /api/users/search.php?q={query}
 * Query params:
 * - q: string
 * Examples:
 * // $q = !empty($_GET['q']) ? $_GET['q'] : '';
 */

header('Content-Type: application/json');

$q = !empty($_GET['q']) ? $_GET['q'] : '';

echo json_encode([
    'ok'      => true,
    'results' => [
        ['userId' => 'u_alex', 'name' => 'Alex', 'online' => true],
        ['userId' => 'u_sam', 'name' => 'Sam', 'online' => false],
        ['userId' => 'u_jamie', 'name' => 'Jamie', 'online' => true]
    ]
]);
