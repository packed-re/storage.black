<?php
	require_once("lib/database_interface.php");

	RouteSetup();

	$db = new FileDatabse();
	var_dump($db->CreateActivationCodes(10, 2));
	//echo bin2hex(_CreateDBActivationCode("356346"));
?>