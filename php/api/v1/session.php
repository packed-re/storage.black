<?php
	require_once($_SERVER["DOCUMENT_ROOT"] . "/lib/utility.php");
	require_once($_SERVER["DOCUMENT_ROOT"] . "/lib/session.php");

	RouteSetup();
	
	switch($_SERVER["REQUEST_METHOD"])
	{
		case "GET":
			if(!isset($_COOKIE["session"]))
				ExitResponse(
					ResponseType::SessionExpired
				);
			
			$decoded = base64_decode($_COOKIE["account_id"]);
			if($decoded === false)
				ExitResponse(
					ResponseType::BadArgument,
					"failed to decode session token"
				);

			if(ByteStringLength($decoded) !== 104)
				ExitResponse(
					ResponseType::BadArgument,
					"invalid session length"
				);

			$session = Session::FromToken($decoded);
			if($session !== false)
			{
				ExitResponse(ResponseType::Success, pack("Qa32", $session->expire_date, $session->DeriveEncryptionKey()));
			}
			else
			{
				// delete the cookie
				ExitResponse(ResponseType::SessionExpired);
			}

		case "POST":
			$request_data = GetAllRequestData();
			if(!isset($request_data["age"]))
				ExitResponse(
					ResponseType::MissingArgument,
					"age not provided"
				);
			
			$age = intval($request_data["age"]);
			if($age === 0)
				ExitResponse(
					ResponseType::BadArgument,
					"age is invalid"
				);
			
			if(!isset($request_data["account_id"]))
				ExitResponse(
					ResponseType::MissingArgument,
					"account_id not provided"
				);

			$account_id_decoded = base64_decode($request_data["account_id"]);
			if(ByteStringLength($decoded) !== 104)
				ExitResponse(
					ResponseType::BadArgument,
					"invalid session length"
				);

			$new_session = Session::Make($age);

			ExitResponse(ResponseType::Success, pack("a32a*", $new_session->encryption_key, $new_session->ToToken()));

		default:
			ExitResponse(ResponseType::BadRequestMethod);
	}
?>