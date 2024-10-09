<?php
	require_once($_SERVER["DOCUMENT_ROOT"] . "/lib/utility.php");
	handle_cors();
	
	switch($_SERVER["REQUEST_METHOD"])
	{
		case "GET":
			$response_data = getall
			break;
		case "POST":
			echo "post";
			break;
		default:
			echo "invalid method";
	}
?>