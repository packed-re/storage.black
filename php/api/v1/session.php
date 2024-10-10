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
			
			$decoded = base64_decode($response_data["session"]);
			if($decoded === false)
				ExitResponse(
					ResponseType::BadArgument,
					"failed to decode session token"
				);

			$session = Session::FromToken($decoded);
			if($session !== false)
				ExitResponse(ResponseType::Success, $session->encryption_key);
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
			
			$new_session = Session::Make($age);

			ExitResponse(ResponseType::Success, pack("a32a*", $new_session->encryption_key, $new_session->ToToken()));

		default:
			ExitResponse(ResponseType::BadRequestMethod);
	}
?>