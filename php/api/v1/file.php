<?php
	require_once($_SERVER["DOCUMENT_ROOT"] . "/lib/utility.php");

	RouteSetup();

	if($_SERVER["REQUEST_METHOD"] === "POST")
	{
		if(!isset($_FILES["meta"]))
			ExitResponse(
				ResponseType::MissingArgument,
				"Meta not provided"
			);
		
		if($_FILES)

		if(!isset($_FILES["file_content"]))
			ExitResponse(
				ResponseType::MissingArgument,
				"Meta not provided"
			);
	}
	else
		ExitResponse(ResponseType::BadRequestMethod);
?>