<?php
	require_once($_SERVER["DOCUMENT_ROOT"] . "/lib/database_interface.php");

	// return account data here
	if($_REQUEST["REQUEST_METHOD"] === "GET")
	{
		$session = HandleSession();

		$db = new FileDatabse(); // GetSubscriptionTypeDataByName
		$account_data = $db->FetchAccountData($session->account_id);
		if($account_data !== null) // expire_date storage_left storage_max
			ExitResponse(
				ResponseType::Success,
				pack("QQQ",
					$account_data["expire_date"],
					$account_data["storage_left"],
					$account_data["storage_max"]
				)
			);
		else
		{
			$sub_type_data = $db->GetSubscriptionTypeDataByName("free");
			ExitResponse(
				ResponseType::Success,
				pack("QQQ",
					time() + $sub_type_data["duration"],
					$sub_type_data["storage"],
					$sub_type_data["storage"]
				)
			);
		}
	}
	else		
		ExitResponse(ResponseType::BadRequestMethod);
?>