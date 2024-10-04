<?php
	require_once("utility.php");
	handle_cors();
	
 	// NOTE: When the file offset is set above the end of the file, everything between it and that position is nulled out.
	
	var_dump($_POST);
	var_dump($_FILES);

	echo 123
?>