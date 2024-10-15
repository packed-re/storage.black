<?php
	require_once("lib/crypto.php");
	require_once("lib/session.php");
	require_once("lib/utility.php");
	require_once("lib/database_interface.php");

	RouteSetup();

	$db = new FileDatabse();

	var_dump($db->ListFiles("12345678901234567890123456789012"));
	var_dump($db->FetchAccountData("12345678901234567890123456789012"));
	var_dump($db->TryReserveSpace("12345678901234567890123456789012", 10));
	//$db->RegisterFile();
	//var_dump($db->FetchAccountID("12345678901234567890123456789012"));

	exit();
	$account_id = random_bytes(32);
	echo "start account_id: " . bin2hex($account_id) . "<br><br>";
	$token = Session::Make(10, $account_id)->ToToken();
	//sleep(11);
	echo sprintf("token len: %d <br>", ByteStringLength($token));
	$session = Session::FromToken($token);
	echo sprintf("<br>rand_long: %s<br><br>", bin2hex($session->rand_long));
	$account_id = bin2hex($session->account_id);
	$data = "hi123";

	echo "account_id: $account_id<br>data: $data<br><br>";

	$ciphertext = BasicEncrypt($data, $session->DeriveEncryptionKey());
	echo "ciphertext: " . ($ciphertext) . "<br>";
	echo "decrypted: " . BasicDecrypt($ciphertext, $session->DeriveEncryptionKey());
	echo sprintf("<br><br>expire_date: %d<br>rand_long: %d<br>account_id: %s", $session->expire_date, unpack("Q", $session->rand_long)[1], bin2hex($session->account_id));
	//var_dump($session);
?>