<?php
	require_once($_SERVER["DOCUMENT_ROOT"] . "/lib/session.php");
	require_once($_SERVER["DOCUMENT_ROOT"] . "/lib/utility.php");

	RouteSetup();
	
	switch($_SERVER["REQUEST_METHOD"])
	{
		case "DELETE":
			if(!isset($_COOKIE["session"]))
				ExitResponse(
					ResponseType::MissingArgument
				);

			RemoveCookie("session");
			ExitResponse(ResponseType::Success);

		case "GET":
			if(!isset($_COOKIE["session"]))
				ExitResponse(
					ResponseType::SessionExpired
				);
			
			$session_decoded = base64_decode($_COOKIE["session"]);
			if($session_decoded === false)
				ExitResponse(
					ResponseType::BadArgument,
					"failed to decode session token"
				);

			if(ByteStringLength($session_decoded) !== Session::GetTokenLength())
			{
				// delete the cookie

				ExitResponse(
					ResponseType::SessionExpired // to be safe, we shouldn't give the client too much information about the state of the server or the format of the token
				);
			}

			$session = Session::FromToken($session_decoded);
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
			if(ByteStringLength($account_id_decoded) !== 32)
				ExitResponse(
					ResponseType::BadArgument,
					"account_id should be 32 bytes"
				);
			
			$new_session = Session::Make($age, $account_id_decoded);

			setcookie("session", base64_encode($new_session->ToToken()), [
				"expires" => time() + $age,
				"samesite" => "Strict",
				"secure" => true,
				"httponly" => true
			]);
			ExitResponse(ResponseType::Success, pack("Qa*", $new_session->expire_date, $new_session->DeriveEncryptionKey()));

		default:
			ExitResponse(ResponseType::BadRequestMethod);
	}
?>