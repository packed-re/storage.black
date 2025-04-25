<?php
	require_once($_SERVER["DOCUMENT_ROOT"] . "/../lib/utility.php");
	require_once($_SERVER["DOCUMENT_ROOT"] . "/../lib/session.php");
	require_once($_SERVER["DOCUMENT_ROOT"] . "/../lib/file_manager.php");

	RouteSetup();
	$session = HandleSession();

	switch($_SERVER["REQUEST_METHOD"])
	{
		case "GET":
			$data = ReadBinaryRequestData();
			$dataLen = ByteStringLength($data);
			if($dataLen !== 40) // fileID 16 + fileSize 8 + from 8 + to 8
				ExitResponse(
					ResponseType::BadArgument,
					"provided data is of improper length"
				);

			$dataUnpacked = unpack("a16fileId/a8fileSizeBuff/Pfrom/Pto", $data);
			$fileSize = unpack("P", $dataUnpacked["fileSizeBuff"])[1];
			$from = $dataUnpacked["from"];
			$to = $dataUnpacked["to"];

			if($from < 0 | $to > $fileSize)
				ExitResponse(ResponseType::BadArgument, "Bad file range");

			$fileOnDisk = GetManagedFileName($session->account_id, $dataUnpacked["fileId"], $dataUnpacked["fileSizeBuff"]);
			if(!file_exists($fileOnDisk))
				ExitResponse(ResponseType::BadArgument, "File not found");

			return ExitResponse(ResponseType::Success, file_get_contents($fileOnDisk, false, null, $from, $to-$from));
		case "POST":
			$data = ReadBinaryRequestData();
			$dataLen = ByteStringLength($data);
			if($dataLen !== 32) // fileID 16 + fileSize 8 + from 8
				ExitResponse(
					ResponseType::BadArgument,
					"Provided data is of improper length"
				);

			$dataUnpacked = unpack("a16fileId/a8fileSizeBuff/Pfrom", $data);
			$fileSize = unpack("P", $dataUnpacked["fileSizeBuff"])[1];
			$from = $dataUnpacked["from"];
			
			$writeEnd = $from + ($dataLen - 32);

			if($writeEnd > $fileSize)
				ExitResponse(
					ResponseType::BadArgument,
					"Attempted to write outside the bounds of the file"
				);

			$fileOnDisk = GetManagedFileName($session->account_id, $dataUnpacked["fileId"], $dataUnpacked["fileSizeBuff"]);
			if(!file_exists($fileOnDisk))
				ExitResponse(ResponseType::BadArgument, "File not found");

			file_put_contents($fileOnDisk, substr($data, 32));
			if($writeEnd == $fileSize)
				(new Database())->FinishFileUpload($session->account_id, $dataUnpacked["fileId"]);

			ExitResponse(ResponseType::Success);

		case "DELETE":
			$data = ReadBinaryRequestData();
			$dataLen = ByteStringLength($data);
			if($dataLen !== 16)
				ExitResponse(
					ResponseType::BadArgument,
					"Provided data is of improper length"
				);
			
			$db = new Database();
			$fileSize = $db->GetFileSize($data);
			if(!$fileSize)
				ExitResponse(ResponseType::BadArgument, "File not found");

			$fileOnDisk = GetManagedFileName($session->account_id, $dataUnpacked["fileId"], pack("P", $fileSize));
			if(!file_exists($fileOnDisk))
				ExitResponse(ResponseType::BadArgument, "File not found");

			unlink($fileOnDisk);
			$db->UnregisterFile($session->account_id, $data);
			
			ExitResponse(ResponseType::Success);
		default:
			ExitResponse(ResponseType::BadRequestMethod);
	}
?>