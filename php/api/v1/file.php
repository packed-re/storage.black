<?php
	require_once($_SERVER["DOCUMENT_ROOT"] . "/lib/utility.php");
	require_once($_SERVER["DOCUMENT_ROOT"] . "/lib/file_manager.php");

	RouteSetup();

	$min_header_size = 1 + 1 + 6 + 8 + 8 + 104 + 16 + 1;
	$max_header_size = ($min_header_size - 1) + 512;

	$read_chunk_size = 10_000_000;

	if($_SERVER["REQUEST_METHOD"] === "POST")
	{
		$session = HandleSession();

		if(!isset($_FILES["file"]))
			ExitResponse(
				ResponseType::MissingArgument,
				"file not provided"
			);

		if($_FILES["file"]["size"] < $min_header_size)
			ExitResponse(
				ResponseType::BadArgument,
				"file too small"
			);

		$meta_header_size = GetHeader("sb-header-size");
		if($meta_header_size === null)
			ExitResponse(
				ResponseType::MissingArgument,
				"sb-header-size not provided"
			);

		$meta_header_size = intval($meta_header_size);
		if($meta_header_size < $min_header_size)
			ExitResponse(
				ResponseType::BadArgument,
				"sb-header-size too small"
			);

		if($meta_header_size > $max_header_size)
			ExitResponse(
				ResponseType::BadArgument,
				"sb-header-size too large"
			);

		if($_FILES["file"]["size"] < $meta_header_size)
			ExitResponse(
				ResponseType::BadArgument,
				"sb-header-size is invalid"
			);

		$file_name = $_FILES["file"]["tmp_name"];
		$file_handle = fopen($file_name, "rb");
		
		$file_header = new FileHeader(fread($file_handle, $meta_header_size));
		$file_name = $file_header->DeriveFileName($session->account_id);

		if($file_header->action === 1) // if sending
		{
			if(!file_exists($file_name) || $file_header->finished === true)
			{
				$db = new FileDatabse();

				if(!file_exists($file_name))
				{
					if(!$db->TryReserveSpace($session->account_id, $file_header->file_size))
						ExitResponse(ResponseType::FileAllocationFailed);

					$db->RegisterFile($session->account_id, $file_header->data_id, $file_header->file_data, $file_header->encryption_data, $file_header->file_size);
				}
				if($file_header->finished === true)
				{

				}
			}

			$file_content = fread($file_handle, $_FILES["file"]["size"]);
		}
		else
		{
			return file_get_contents(
				$file_name,
				false, null,
				$file_header->offset,
				$read_chunk_size
			);
		}
	}
	else
		ExitResponse(ResponseType::BadRequestMethod);
?>