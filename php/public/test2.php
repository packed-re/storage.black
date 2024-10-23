<?php
	require_once("../lib/utility.php");

	RouteSetup();

	echo time();
	//var_dump(unpack("x6/Ctest", pack("x6C", 61)));
	/*$db = new FileDatabse();

	var_dump($db->ActivateCode(hex2bin("b736f91e548f4af840542e131a16228e"), "79215678666234567890123456789012"));

	$codes = $db->CreateActivationCodes(30, 1);
	$codeCount = count($codes);
	for($i = 0; $i < $codeCount; ++$i)
		echo sprintf("%s<br>", bin2hex($codes[$i]));*/
?>