<?php
	require_once("lib/crypto.php");
	require_once("lib/session.php");
	require_once("lib/utility.php");

	ExitResponse(ResponseType::ServerError, CreateSecureResponseData(bin2hex(random_bytes(32))));
	$token = Session::Make(10)->ToToken();
	//sleep(9);
	$session = Session::FromToken($token);
	
	$key = $session->encryption_key;
	$data = "hi123";

	echo "key: $key<br>data: $data<br><br>";

	$ciphertext = BasicEncrypt($data, $key);
	echo "ciphertext: " . ($ciphertext) . "<br>";
	echo "decrypted: " . BasicDecrypt($ciphertext, $key);

?>