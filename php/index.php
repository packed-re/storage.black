<?php
	require_once("lib/utility.php");
	require_once("lib/database_interface.php");
	handle_cors();
	
 	// NOTE: When the file offset is set above the end of the file, everything between it and that position is nulled out.
	
	//var_dump($_POST);
	//var_dump($_FILES);

	$db = new FileDatabse();

	if($_SERVER["REQUEST_METHOD"] === "POST")
	{
		$file = file_get_contents($_FILES["userfile"]["tmp_name"]);
		$db->BlobUpTest($file);
	}
		//move_uploaded_file($_FILES["userfile"]["tmp_name"], "files/" . $_FILES["userfile"]["name"]);
	else
		echo $db->BlobDownTest();//echo file_get_contents("files/Ralfs_Dambitis-kvd-1-1.pdf");
?>