<?php
	require_once("lib/file_manager.php");

	RouteSetup();

	$db = new FileDatabse();
	$db->DeleteUnfinishedFiles();

	$stmt = $db->DB->prepare("
		SELECT accounts.account_hash, files.data_id, files.file_data, files.encryption_data, files.file_size, files.finished_writing FROM files
		INNER JOIN accounts ON accounts.id = files.account_id
		WHERE files.finished_writing = 0
	");

	$stmt->execute();

	$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
	$rowCount = count($rows);
	echo "in manual<br>\n";
	for($i = 0; $i < $rowCount; ++$i)
	{
		echo sprintf("%s<br>", GetManagedFileName($rows[$i]["account_hash"], $rows[$i]["data_id"], $rows[$i]["file_data"], $rows[$i]["encryption_data"], $rows[$i]["file_size"]));
	}
	//var_dump(unpack("x6/Ctest", pack("x6C", 61)));
	/*$db = new FileDatabse();

	var_dump($db->ActivateCode(hex2bin("b736f91e548f4af840542e131a16228e"), "79215678666234567890123456789012"));

	$codes = $db->CreateActivationCodes(30, 1);
	$codeCount = count($codes);
	for($i = 0; $i < $codeCount; ++$i)
		echo sprintf("%s<br>", bin2hex($codes[$i]));*/
?>