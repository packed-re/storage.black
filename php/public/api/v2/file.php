<?php
	require_once($_SERVER["DOCUMENT_ROOT"] . "/../lib/utility.php");
	require_once($_SERVER["DOCUMENT_ROOT"] . "/../lib/session.php");
	require_once($_SERVER["DOCUMENT_ROOT"] . "/../lib/file_manager.php");

	RouteSetup();
	$session = HandleSession();


	function DownloadBlob($fileId, $fileSize, $fileSizeBuff, $from, $to)
	{
		global $session;

		if($from < 0 | $to > $fileSize | $from > $to)
			ExitResponse(ResponseType::BadArgument, "Bad file range " . implode(" | ", [$from, $to]));

		$fileOnDisk = GetManagedFileName($session->account_id, $fileId, $fileSizeBuff);
		if(!file_exists($fileOnDisk))
			ExitResponse(ResponseType::BadArgument, "File not found");
		header("from: " . $from);
		header("to: " . $to);
		ExitResponse(ResponseType::Success, file_get_contents($fileOnDisk, false, null, $from, $to-$from));
	}

	function UploadBlob($fileId, $fileSize, $fileSizeBuff, $from, $dataStream, $dataStat)
	{
		global $session;

		$uploadedByteCount = $dataStat["size"] - ftell($dataStream);
		$writeEnd = $from + $uploadedByteCount;

		if($writeEnd > $fileSize)
			ExitResponse(
				ResponseType::BadArgument,
				"Attempted to write outside the bounds of the file - " . implode(",", [$from, $dataStat["size"], ftell($dataStream), $writeEnd])
			);

		$fileOnDisk = GetManagedFileName($session->account_id, $fileId, $fileSizeBuff);
		if(!file_exists($fileOnDisk))
			ExitResponse(ResponseType::BadArgument, "File not found");
		
		$targetFileStream = fopen($fileOnDisk, "c+");
		fseek($targetFileStream, $from);
		fwrite($targetFileStream, fread($dataStream, $uploadedByteCount));
		//stream_copy_to_stream($dataStream, $targetFileStream, ftell($dataStream));
		fclose($targetFileStream);

		if($writeEnd == $fileSize)
			(new Database())->FinishFileUpload($session->account_id, $fileId);
		
		header("from: " . $from);
		header("writeEnd: " . $writeEnd);
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
		if(file_exists($fileOnDisk))
			unlink($fileOnDisk);//ExitResponse(ResponseType::BadArgument, "File not found");

		$db->UnregisterFile($session->account_id, $fileId);

		ExitResponse(ResponseType::Success);
	}

	if($_SERVER["REQUEST_METHOD"] !== "POST")
		ExitResponse(ResponseType::BadRequestMethod);
	
	$dataStream = GetBinaryRequestDataStream();
	$dataStat = fstat($dataStream);

	if($dataStat["size"] < 1)
		ExitResponse(ResponseType::BadArgument, "Provided data too short");

	$action = fread($dataStream, 1);

	switch($action)
	{
		//case "\x00":

		//case "\x01": // MakeFile

		case "\x02": // Download
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

		case "\x03": // Upload			
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

		case "\x04": // Delete
			if($dataStat["size"] !== 17)
				ExitResponse(
					ResponseType::BadArgument,
					"Provided data is of improper length a " . json_encode($dataStat)
				);

			return DeleteFile(fread($dataStream, 16));
		
		default:
			ExitResponse(ResponseType::BadArgument, "Bad action byte");
	}
?>