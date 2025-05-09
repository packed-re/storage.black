<?php
	require_once($_SERVER["DOCUMENT_ROOT"] . "/../lib/utility.php");
	require_once($_SERVER["DOCUMENT_ROOT"] . "/../lib/session.php");
	require_once($_SERVER["DOCUMENT_ROOT"] . "/../lib/file_manager.php");

	RouteSetup();
	$session = HandleSession();


	function DownloadBlob($fileId, $fileSize, $fileSizeBuff, $from, $to)
	{
		global $session;

		if($from < 0 | $to > $fileSize)
			ExitResponse(ResponseType::BadArgument, "Bad file range");

		$fileOnDisk = GetManagedFileName($session->account_id, $fileId, $fileSizeBuff);
		if(!file_exists($fileOnDisk))
			ExitResponse(ResponseType::BadArgument, "File not found");

		ExitResponse(ResponseType::Success, file_get_contents($fileOnDisk, false, null, $from, $to-$from));
	}

	function UploadBlob($fileId, $fileSize, $fileSizeBuff, $from, $dataStream, $dataStat)
	{
		global $session;

		$writeEnd = $from + ($dataStat["size"] - ftell($dataStream));

		if($writeEnd > $fileSize)
			ExitResponse(
				ResponseType::BadArgument,
				"Attempted to write outside the bounds of the file"
			);

		$fileOnDisk = GetManagedFileName($session->account_id, $fileId, $fileSizeBuff);
		if(!file_exists($fileOnDisk))
			ExitResponse(ResponseType::BadArgument, "File not found");

		file_put_contents($fileOnDisk, $dataStream, $from);
		if($writeEnd == $fileSize)
			(new Database())->FinishFileUpload($session->account_id, $fileId);

		ExitResponse(ResponseType::Success);
	}

	function DeleteFile($fileId)
	{	
		global $session;

		$db = new Database();
		$fileSize = $db->GetFileSize($fileId);
		if(!$fileSize)
			ExitResponse(ResponseType::BadArgument, "File not found");

		$fileOnDisk = GetManagedFileName($session->account_id, $fileId, pack("P", $fileSize));
		if(!file_exists($fileOnDisk))
			ExitResponse(ResponseType::BadArgument, "File not found");

		unlink($fileOnDisk);
		$db->UnregisterFile($session->account_id, $fileId);

		ExitResponse(ResponseType::Success);
	}

	if($_SERVER["REQUEST_METHOD"] !== "POST")
		ExitResponse(ResponseType::BadRequestMethod);
	
	$dataStream = GetBinaryRequestDataStream();
	$dataStat = fstat($dataStream);

	if($dataStat["size"] < 1)
		ExitResponse(ResponseType::BadArgument, "provided data too short");

	$action = fread($dataStream, 1);

	switch($action)
	{
		case "\x01": // Download
			if($dataStat["size"] !== 41) // action 1 + fileID 16 + fileSize 8 + from 8 + to 8
				ExitResponse(
					ResponseType::BadArgument,
					"provided data is of improper length"
				);
			
			$dataUnpacked = unpack("a16fileId/a8fileSizeBuff/Pfrom/Pto", fread($dataStream, 40));
			return DownloadBlob(
				$dataUnpacked["fileId"],
				unpack("P", $dataUnpacked["fileSizeBuff"])[1],
				$dataUnpacked["fileSizeBuff"],
				$dataUnpacked["from"],
				$dataUnpacked["to"]
			);

		case "\x02": // Upload
			if($dataStat["size"] < 33) // action 1 + fileID 16 + fileSize 8 + from 8
				ExitResponse(
					ResponseType::BadArgument,
					"Provided data is of improper length"
				);
			
			$dataUnpacked = unpack("a16fileId/a8fileSizeBuff/Pfrom", fread($dataStream, 32));
			return UploadBlob(
				$dataUnpacked["fileId"],
				unpack("P", $dataUnpacked["fileSizeBuff"])[1],
				$dataUnpacked["fileSizeBuff"],
				$dataUnpacked["from"],
				$dataStream, $dataStat
			);

		case "\x03": // Delete
			if($dataStat["size"] !== 9)
				ExitResponse(
					ResponseType::BadArgument,
					"Provided data is of improper length"
				);

			return DeleteFile(fread($dataStream, 8));
	}
?>