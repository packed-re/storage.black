<?php
	require_once($_SERVER["DOCUMENT_ROOT"] . "/../lib/utility.php");
	require_once($_SERVER["DOCUMENT_ROOT"] . "/../lib/session.php");
	require_once($_SERVER["DOCUMENT_ROOT"] . "/../lib/file_manager.php");

	RouteSetup();

	$session = HandleSession();
	if($_SERVER["REQUEST_METHOD"] !== "POST")
		ExitResponse(ResponseType::BadRequestMethod);

	$data = ReadBinaryRequestData();
	if($data)
	$dataLen = ByteStringLength($data);
	if($dataLen !== 16)
		ExitResponse(
			ResponseType::BadArgument,
			"provided data is of improper length"
		);

	$db = new Database();
	$files = $db->ListFiles($session->account_id, $data);
	$fileCount = count($files);
	
	$output = "";
	for($i = 0; $i < $fileCount; ++$i)
		$output .= pack(
			"a16PCa*",
			$files[$i]["file_id"],
			$files[$i]["file_size"],
			ByteStringLength($files[$i]["file_data"]),
			$files[$i]["file_data"]
		);
	
	ExitResponse(ResponseType::Success, $output);
?>