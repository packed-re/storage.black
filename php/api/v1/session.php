<?php
	require_once($_SERVER["DOCUMENT_ROOT"] . "/lib/utility.php");
	require_once($_SERVER["DOCUMENT_ROOT"] . "/lib/session.php");

	RouteSetup();
	
	switch($_SERVER["REQUEST_METHOD"])
	{
		case "GET":
			$response_data = GetAllRequestData();

			if(!isset($response_data["session"]))
				ExitResponse(
					ResponseType::MissingArgument,
					"session not provided"
				);
			
			$session = Session::FromToken($response_data["session"]);

			if($session !== false)
				ExitResponse(ResponseType::Success);
			else
				ExitResponse(ResponseType::SessionExpired);

		case "POST":
			$response_data = GetAllRequestData();

			if(!isset($response_data["age"]))
				ExitResponse(
					ResponseType::MissingArgument,
					"age not provided"
				);
			
			$age = intval($response_data["age"]);

			if($age === 0)
				ExitResponse(
					ResponseType::BadArgument,
					"age is invalid"
				);
			
			ExitResponse(ResponseType::Success, Session::Make($age)->ToToken());

		default:
			ExitResponse(ResponseType::BadRequestMethod);
	}
?>