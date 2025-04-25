<?php
	require_once($_SERVER["DOCUMENT_ROOT"] . "/../lib/utility.php");
	require_once($_SERVER["DOCUMENT_ROOT"] . "/../lib/session.php");
	require_once($_SERVER["DOCUMENT_ROOT"] . "/../lib/file_manager.php");

	RouteSetup();

	$session = HandleSession();
	if($_SERVER["REQUEST_METHOD"] !== "POST")
		ExitResponse(ResponseType::BadRequestMethod);

	$data = ReadBinaryRequestData();
	$dataLen = ByteStringLength($data);

	if($dataLen <= 24 || $dataLen > 264)
		ExitResponse(
			ResponseType::BadArgument,
			"provided data is of improper length"
		);

	$dataUnpacked = unpack("a16dataId/a8fileSizeBuff/a*metaData", $data);
	
	$db = new Database();
	$fileId = $db->RegisterFile($session->account_id, $dataUnpacked["dataId"], $dataUnpacked["metaData"], unpack("P", $dataUnpacked["fileSizeBuff"])[1]);
	file_put_contents(GetManagedFileName($session->account_id, $fileId, $dataUnpacked["fileSizeBuff"]), "");
	ExitResponse(ResponseType::Success, $fileId);
?>