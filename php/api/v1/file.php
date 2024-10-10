<?php
	require_once($_SERVER["DOCUMENT_ROOT"] . "/lib/utility.php");

	RouteSetup();

	if($_SERVER["REQUEST_METHOD"] === "POST")
	{

	}
	else
		ExitResponse(ResponseType::BadRequestMethod);
?>