<?php
	require_once($_SERVER["DOCUMENT_ROOT"] . "/../lib/session.php");
	require_once($_SERVER["DOCUMENT_ROOT"] . "/../lib/utility.php");

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
					ResponseType::SessionExpired,
					"cookie not set"
				);
			
			$session_decoded = base64_decode($_COOKIE["session"], true);
			if($session_decoded === false || ByteStringLength($session_decoded) !== Session::GetTokenLength())
			{
				RemoveCookie("session");

				ExitResponse(
					ResponseType::SessionExpired, "session is bad length"
				);
			}

			$session = Session::FromToken($session_decoded);
			if($session !== false)
			{
				ExitResponse(ResponseType::Success, $session->DeriveEncryptionKey());
			}
			else
			{
				RemoveCookie("session");				
				ExitResponse(ResponseType::SessionExpired, "failed to decode");
			}

		case "POST":
			$data = ReadBinaryRequestData();
			if($data === null)
				ExitResponse(
					ResponseType::MissingArgument,
					"no data sent to server"
				);

			if(ByteStringLength($data) !== 32)
				ExitResponse(
					ResponseType::BadArgument,
					"account id is of improper length"
				);
			$age = 30 * 24 * 60 * 60; // 30 days
			$new_session = Session::Make($age, $data);

			setcookie("session", base64_encode($new_session->ToToken()), [
				"expires" => time() + $age,
				"samesite" => "Strict",
				"secure" => true,
				"httponly" => true
			]);

			ExitResponse(ResponseType::Success, pack("Qa32", $new_session->expire_date, $new_session->DeriveEncryptionKey()));

		default:
			ExitResponse(ResponseType::BadRequestMethod);
	}
?>